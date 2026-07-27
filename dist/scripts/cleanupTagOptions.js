"use strict";
/**
 * scripts/cleanupTagOptions.ts
 *
 * One-off migration — clears incorrectly stored "options" arrays AND
 * junk "responseData" from free-text tag tasks in existing ProjectSetup
 * and ProjectSiteSetup documents.
 *
 * Root cause:
 *   getDefaultProjectSetupTasks / getDefaultProjectSiteSetupTasks in
 *   projectSetup.service.ts used to comma-split the task description field
 *   to generate options when none existed in the template.  For fields like
 *   "approval_granted_by" (description: "Entities that formally approved the
 *   project (e.g. village, district, national authorities)") this produced
 *   3 junk fragments which were stored in both options AND — if the user
 *   previously ticked those checkboxes — in responseData as well.
 *
 * What this script does:
 *   1. Iterates every ProjectSetup and ProjectSiteSetup document.
 *   2. For each task whose fieldName is in FREE_TEXT_TAG_FIELDS:
 *      a. Clears options → []
 *      b. Computes the junk values that would have been generated from the
 *         description (the same comma-split the old service used)
 *      c. Removes those junk values from responseData, keeping any real tags
 *         the user actually typed.
 *   3. Logs a summary of everything changed.
 *
 * Safe to re-run — real user-entered tags are preserved; only description-
 * derived junk is removed.
 *
 * Usage:
 *   npx ts-node scripts/cleanupTagOptions.ts
 */
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
dotenv_1.default.config();
// ─── Known descriptions for junk-options fields ───────────────────────────────
// These are the exact descriptions from the CSV seed files.
// The old service did: description.split(',').map(s => s.trim())
// We reproduce that here so we know which responseData values are junk.
const TAG_FIELD_DESCRIPTIONS = {
    ethnic_groups_present: 'Ethnic groups present in the site community',
    approval_granted_by: 'Entities that formally approved the project (e.g. village, district, national authorities)',
    implementing_organisations: 'Organisations or actors responsible for day-to-day project delivery',
    oversight_authorities: 'Authorities responsible for monitoring, compliance, or enforcement',
    villages: 'Villages or localities within the site boundary',
};
// Reconstruct what the old comma-split produced for each field.
const JUNK_OPTIONS = {};
for (const [field, desc] of Object.entries(TAG_FIELD_DESCRIPTIONS)) {
    const junk = desc.split(',').map((s) => s.trim()).filter(Boolean);
    JUNK_OPTIONS[field] = new Set(junk);
}
// ─── Minimal schemas — we only need _id + tasks ──────────────────────────────
const taskSubSchema = new mongoose_1.default.Schema({ fieldName: String, options: [String], responseData: mongoose_1.default.Schema.Types.Mixed }, { strict: false });
const ProjectSetup = mongoose_1.default.models.ProjectSetup ||
    mongoose_1.default.model('ProjectSetup', new mongoose_1.default.Schema({ tasks: [taskSubSchema] }, { strict: false }), 'projectsetups');
const ProjectSiteSetup = mongoose_1.default.models.ProjectSiteSetup ||
    mongoose_1.default.model('ProjectSiteSetup', new mongoose_1.default.Schema({ tasks: [taskSubSchema] }, { strict: false }), 'projectsitesetups');
// ─── Core clean-up logic ─────────────────────────────────────────────────────
function cleanCollection(Model, label) {
    return __awaiter(this, void 0, void 0, function* () {
        const docs = yield Model.find({}).lean();
        console.log(`\n[${label}] Found ${docs.length} documents`);
        let docsUpdated = 0;
        let optionsCleared = 0;
        let responseDataCleaned = 0;
        for (const doc of docs) {
            const tasks = doc.tasks || [];
            let docDirty = false;
            const updatedTasks = tasks.map((task) => {
                const junkSet = JUNK_OPTIONS[task.fieldName];
                if (!junkSet)
                    return task;
                let updated = Object.assign({}, task);
                // 1. Clear junk options
                if (Array.isArray(task.options) && task.options.length > 0) {
                    console.log(`  • doc ${doc._id} | "${task.fieldName}" | clearing options: ${JSON.stringify(task.options)}`);
                    updated.options = [];
                    docDirty = true;
                    optionsCleared++;
                }
                // 2. Strip junk values from responseData
                if (Array.isArray(task.responseData) && task.responseData.length > 0) {
                    const originalCount = task.responseData.length;
                    const cleaned = task.responseData.filter((val) => !junkSet.has(val));
                    if (cleaned.length !== originalCount) {
                        const removed = task.responseData.filter((val) => junkSet.has(val));
                        console.log(`  • doc ${doc._id} | "${task.fieldName}" | removing junk responseData: ${JSON.stringify(removed)}`);
                        updated.responseData = cleaned;
                        docDirty = true;
                        responseDataCleaned++;
                    }
                }
                return updated;
            });
            if (docDirty) {
                yield Model.updateOne({ _id: doc._id }, { $set: { tasks: updatedTasks } });
                docsUpdated++;
            }
        }
        console.log(`[${label}] Done — ${docsUpdated} doc(s) updated | ` +
            `${optionsCleared} options cleared | ${responseDataCleaned} responseData entries cleaned`);
    });
}
// ─── Entry point ─────────────────────────────────────────────────────────────
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield (0, mongodb_1.connectToDatabase)();
            console.log('Connected to database');
            yield cleanCollection(ProjectSetup, 'ProjectSetup');
            yield cleanCollection(ProjectSiteSetup, 'ProjectSiteSetup');
            console.log('\nCleanup complete.');
            process.exit(0);
        }
        catch (err) {
            console.error('Cleanup failed:', err);
            process.exit(1);
        }
    });
}
run();
//# sourceMappingURL=cleanupTagOptions.js.map