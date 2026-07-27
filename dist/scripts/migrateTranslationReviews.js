"use strict";
// scripts/migrateTranslationReviews.ts
//
// Backfills Review documents for existing SurveyTranslations that were
// submitted/approved/published before the review auto-trigger was wired up.
//
// Idempotent — skips translations that already have a Review document.
//
// Translation status → Review status mapping:
//   pending_review → pending   (waiting to be reviewed)
//   approved       → approved  (already reviewed and signed off)
//   published      → resolved  (fully completed and live)
//
// Usage:
//   npx ts-node scripts/migrateTranslationReviews.ts           → dry run
//   npx ts-node scripts/migrateTranslationReviews.ts --apply   → write to DB
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const mongodb_1 = require("../database/mongodb");
const surveyTranslation_model_1 = __importDefault(require("../models/surveyTranslation.model"));
const review_model_1 = __importDefault(require("../models/review.model"));
const reviewHelpers_1 = require("../utils/reviewHelpers");
// These models are not used directly but must be imported so Mongoose
// registers their schemas before any .populate() call resolves them.
require("../models/survey.model");
require("../models/project.model");
require("../models/organization.model");
require("../models/user.model");
dotenv_1.default.config();
// ─── Status mapping ───────────────────────────────────────────────────────────
const TRANSLATION_TO_REVIEW_STATUS = {
    pending_review: 'pending',
    approved: 'approved',
    published: 'resolved',
};
// ─── Main ─────────────────────────────────────────────────────────────────────
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        const args = process.argv.slice(2);
        const dryRun = !args.includes('--apply');
        console.log('═'.repeat(60));
        console.log('MIGRATE — Backfill Translation Reviews');
        console.log('═'.repeat(60));
        console.log(`Mode: ${dryRun ? '🔍 DRY RUN (add --apply to write)' : '⚠️  APPLYING'}\n`);
        yield (0, mongodb_1.connectToDatabase)();
        // Find all translations that should have a review (not draft)
        const translations = yield surveyTranslation_model_1.default.find({
            status: { $in: ['pending_review', 'approved', 'published'] },
            archived: { $ne: true },
        })
            .populate('translator', 'name email')
            .populate({
            path: 'survey',
            populate: { path: 'project', populate: { path: 'organization' } },
        });
        console.log(`Found ${translations.length} translation(s) in reviewable state.\n`);
        let created = 0, skipped = 0, errors = 0;
        for (const translation of translations) {
            const survey = translation.survey;
            const project = survey === null || survey === void 0 ? void 0 : survey.project;
            const lang = translation.languageName || translation.language.toUpperCase();
            const label = `"${lang}" — ${(_a = survey === null || survey === void 0 ? void 0 : survey.title) !== null && _a !== void 0 ? _a : translation._id}`;
            // Skip if no project/org context (data integrity issue, not our concern here)
            if (!(project === null || project === void 0 ? void 0 : project._id) || !(project === null || project === void 0 ? void 0 : project.organization)) {
                console.log(`  ⚠️   Skipping ${label}: survey missing project/org`);
                skipped++;
                continue;
            }
            // Check if a review already exists for this translation
            const existing = yield review_model_1.default.findOne({
                module: 'survey_translation',
                moduleItemId: translation._id,
            });
            if (existing) {
                console.log(`  ⏭️   Already has review (${existing.status}): ${label}`);
                skipped++;
                continue;
            }
            const reviewStatus = TRANSLATION_TO_REVIEW_STATUS[translation.status];
            const methodLabel = translation.translationMethod === 'machine'
                ? ' [Machine]'
                : translation.translationMethod === 'hybrid'
                    ? ' [Hybrid]'
                    : '';
            const title = `Translation (${lang}${methodLabel}): ${survey.title}`;
            const description = `
**Survey:** ${survey.title}
**Language:** ${lang} (${translation.language})
**Translation Method:** ${(_b = translation.translationMethod) !== null && _b !== void 0 ? _b : 'human'}
**Completion:** ${(_c = translation.completionPercentage) !== null && _c !== void 0 ? _c : 0}%
**Translator:** ${(_e = (_d = translation.translator) === null || _d === void 0 ? void 0 : _d.name) !== null && _e !== void 0 ? _e : 'Unknown'}

Backfilled by migration — translation was in "${translation.status}" state when the review feature was introduced.
    `.trim();
            // Priority: machine translations get critical, hybrid get high, human get medium
            const priority = translation.translationMethod === 'machine' ? 'critical' :
                translation.translationMethod === 'hybrid' ? 'high' :
                    'medium';
            // submittedBy: prefer the translator, fall back to the survey's project creator
            const submittedBy = (_h = (_g = (_f = translation.translator) === null || _f === void 0 ? void 0 : _f._id) !== null && _g !== void 0 ? _g : project.creator) !== null && _h !== void 0 ? _h : new mongoose_1.default.Types.ObjectId(); // last resort (shouldn't happen)
            if (dryRun) {
                console.log(`  🔍  Would create review [${reviewStatus}/${priority}]: ${label}`);
                created++;
                continue;
            }
            try {
                const review = yield (0, reviewHelpers_1.createReview)({
                    module: 'survey_translation',
                    moduleItemId: translation._id,
                    organizationId: (_j = project.organization._id) !== null && _j !== void 0 ? _j : project.organization,
                    projectId: project._id,
                    projectSiteId: (_k = survey.projectSite) === null || _k === void 0 ? void 0 : _k._id,
                    submittedBy,
                    title,
                    description,
                    priority,
                    autoAssignReviewers: reviewStatus === 'pending', // only auto-assign if still needs review
                });
                // If the translation is already past pending_review, fast-forward the review status
                if (reviewStatus !== 'pending') {
                    review.changeStatus(reviewStatus, submittedBy, `Backfilled from translation status "${translation.status}"`);
                    yield review.save();
                }
                console.log(`  ✅  Created review [${reviewStatus}/${priority}]: ${label}`);
                created++;
            }
            catch (err) {
                console.error(`  ❌  Error on ${label}: ${err.message}`);
                errors++;
            }
        }
        // ─── Summary ────────────────────────────────────────────────────────────────
        console.log('\n' + '─'.repeat(60));
        console.log(`  ${dryRun ? 'Would create' : 'Created'}: ${created}`);
        console.log(`  Skipped (already had review): ${skipped}`);
        console.log(`  Errors: ${errors}`);
        console.log('─'.repeat(60));
        if (!dryRun) {
            const total = yield review_model_1.default.countDocuments({ module: 'survey_translation' });
            console.log(`\n  DB state: ${total} survey_translation review(s) total`);
        }
        yield (0, mongodb_1.disconnectFromDatabase)();
        console.log(dryRun ? '\n🔍 Dry run complete — run with --apply to write.' : '\n✅ Done.');
    });
}
run().catch(err => { console.error('Fatal:', err); process.exit(1); });
//# sourceMappingURL=migrateTranslationReviews.js.map