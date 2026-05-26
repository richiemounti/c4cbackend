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

import mongoose from 'mongoose';
import dotenv from 'dotenv';

import { connectToDatabase, disconnectFromDatabase } from '../database/mongodb';
import SurveyTranslation from '../models/surveyTranslation.model';
import Review from '../models/review.model';
import { createReview } from '../utils/reviewHelpers';

// These models are not used directly but must be imported so Mongoose
// registers their schemas before any .populate() call resolves them.
import '../models/survey.model';
import '../models/project.model';
import '../models/organization.model';
import '../models/user.model';

dotenv.config();

// ─── Status mapping ───────────────────────────────────────────────────────────

const TRANSLATION_TO_REVIEW_STATUS: Record<string, 'pending' | 'approved' | 'resolved'> = {
  pending_review: 'pending',
  approved:       'approved',
  published:      'resolved',
};

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  const args   = process.argv.slice(2);
  const dryRun = !args.includes('--apply');

  console.log('═'.repeat(60));
  console.log('MIGRATE — Backfill Translation Reviews');
  console.log('═'.repeat(60));
  console.log(`Mode: ${dryRun ? '🔍 DRY RUN (add --apply to write)' : '⚠️  APPLYING'}\n`);

  await connectToDatabase();

  // Find all translations that should have a review (not draft)
  const translations = await SurveyTranslation.find({
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
    const survey  = translation.survey as any;
    const project = survey?.project;
    const lang    = translation.languageName || translation.language.toUpperCase();
    const label   = `"${lang}" — ${survey?.title ?? translation._id}`;

    // Skip if no project/org context (data integrity issue, not our concern here)
    if (!project?._id || !project?.organization) {
      console.log(`  ⚠️   Skipping ${label}: survey missing project/org`);
      skipped++;
      continue;
    }

    // Check if a review already exists for this translation
    const existing = await Review.findOne({
      module:       'survey_translation',
      moduleItemId: translation._id,
    });

    if (existing) {
      console.log(`  ⏭️   Already has review (${existing.status}): ${label}`);
      skipped++;
      continue;
    }

    const reviewStatus = TRANSLATION_TO_REVIEW_STATUS[translation.status];
    const methodLabel  = translation.translationMethod === 'machine'
      ? ' [Machine]'
      : translation.translationMethod === 'hybrid'
      ? ' [Hybrid]'
      : '';
    const title = `Translation (${lang}${methodLabel}): ${survey.title}`;

    const description = `
**Survey:** ${survey.title}
**Language:** ${lang} (${translation.language})
**Translation Method:** ${translation.translationMethod ?? 'human'}
**Completion:** ${translation.completionPercentage ?? 0}%
**Translator:** ${(translation.translator as any)?.name ?? 'Unknown'}

Backfilled by migration — translation was in "${translation.status}" state when the review feature was introduced.
    `.trim();

    // Priority: machine translations get critical, hybrid get high, human get medium
    const priority =
      translation.translationMethod === 'machine' ? 'critical' :
      translation.translationMethod === 'hybrid'  ? 'high'     :
      'medium';

    // submittedBy: prefer the translator, fall back to the survey's project creator
    const submittedBy: mongoose.Types.ObjectId =
      (translation.translator as any)?._id ??
      project.creator ??
      new mongoose.Types.ObjectId(); // last resort (shouldn't happen)

    if (dryRun) {
      console.log(`  🔍  Would create review [${reviewStatus}/${priority}]: ${label}`);
      created++;
      continue;
    }

    try {
      const review = await createReview({
        module:          'survey_translation',
        moduleItemId:    translation._id as mongoose.Types.ObjectId,
        organizationId:  project.organization._id ?? project.organization,
        projectId:       project._id,
        projectSiteId:   survey.projectSite?._id,
        submittedBy,
        title,
        description,
        priority,
        autoAssignReviewers: reviewStatus === 'pending', // only auto-assign if still needs review
      });

      // If the translation is already past pending_review, fast-forward the review status
      if (reviewStatus !== 'pending') {
        review.changeStatus(reviewStatus, submittedBy, `Backfilled from translation status "${translation.status}"`);
        await review.save();
      }

      console.log(`  ✅  Created review [${reviewStatus}/${priority}]: ${label}`);
      created++;
    } catch (err: any) {
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
    const total = await Review.countDocuments({ module: 'survey_translation' });
    console.log(`\n  DB state: ${total} survey_translation review(s) total`);
  }

  await disconnectFromDatabase();
  console.log(dryRun ? '\n🔍 Dry run complete — run with --apply to write.' : '\n✅ Done.');
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
