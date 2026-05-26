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

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectToDatabase } from '../database/mongodb';

dotenv.config();

// ─── Known descriptions for junk-options fields ───────────────────────────────
// These are the exact descriptions from the CSV seed files.
// The old service did: description.split(',').map(s => s.trim())
// We reproduce that here so we know which responseData values are junk.
const TAG_FIELD_DESCRIPTIONS: Record<string, string> = {
  ethnic_groups_present:      'Ethnic groups present in the site community',
  approval_granted_by:        'Entities that formally approved the project (e.g. village, district, national authorities)',
  implementing_organisations: 'Organisations or actors responsible for day-to-day project delivery',
  oversight_authorities:      'Authorities responsible for monitoring, compliance, or enforcement',
  villages:                   'Villages or localities within the site boundary',
};

// Reconstruct what the old comma-split produced for each field.
const JUNK_OPTIONS: Record<string, Set<string>> = {};
for (const [field, desc] of Object.entries(TAG_FIELD_DESCRIPTIONS)) {
  const junk = desc.split(',').map((s: string) => s.trim()).filter(Boolean);
  JUNK_OPTIONS[field] = new Set(junk);
}

// ─── Minimal schemas — we only need _id + tasks ──────────────────────────────
const taskSubSchema = new mongoose.Schema(
  { fieldName: String, options: [String], responseData: mongoose.Schema.Types.Mixed },
  { strict: false }
);

const ProjectSetup = mongoose.models.ProjectSetup ||
  mongoose.model(
    'ProjectSetup',
    new mongoose.Schema({ tasks: [taskSubSchema] }, { strict: false }),
    'projectsetups'
  );

const ProjectSiteSetup = mongoose.models.ProjectSiteSetup ||
  mongoose.model(
    'ProjectSiteSetup',
    new mongoose.Schema({ tasks: [taskSubSchema] }, { strict: false }),
    'projectsitesetups'
  );

// ─── Core clean-up logic ─────────────────────────────────────────────────────
async function cleanCollection(
  Model: mongoose.Model<any>,
  label: string
): Promise<void> {
  const docs = await Model.find({}).lean();
  console.log(`\n[${label}] Found ${docs.length} documents`);

  let docsUpdated = 0;
  let optionsCleared = 0;
  let responseDataCleaned = 0;

  for (const doc of docs) {
    const tasks: any[] = doc.tasks || [];
    let docDirty = false;

    const updatedTasks = tasks.map((task: any) => {
      const junkSet = JUNK_OPTIONS[task.fieldName];
      if (!junkSet) return task;

      let updated = { ...task };

      // 1. Clear junk options
      if (Array.isArray(task.options) && task.options.length > 0) {
        console.log(
          `  • doc ${doc._id} | "${task.fieldName}" | clearing options: ${JSON.stringify(task.options)}`
        );
        updated.options = [];
        docDirty = true;
        optionsCleared++;
      }

      // 2. Strip junk values from responseData
      if (Array.isArray(task.responseData) && task.responseData.length > 0) {
        const originalCount = task.responseData.length;
        const cleaned = task.responseData.filter(
          (val: string) => !junkSet.has(val)
        );
        if (cleaned.length !== originalCount) {
          const removed = task.responseData.filter((val: string) => junkSet.has(val));
          console.log(
            `  • doc ${doc._id} | "${task.fieldName}" | removing junk responseData: ${JSON.stringify(removed)}`
          );
          updated.responseData = cleaned;
          docDirty = true;
          responseDataCleaned++;
        }
      }

      return updated;
    });

    if (docDirty) {
      await Model.updateOne(
        { _id: doc._id },
        { $set: { tasks: updatedTasks } }
      );
      docsUpdated++;
    }
  }

  console.log(
    `[${label}] Done — ${docsUpdated} doc(s) updated | ` +
    `${optionsCleared} options cleared | ${responseDataCleaned} responseData entries cleaned`
  );
}

// ─── Entry point ─────────────────────────────────────────────────────────────
async function run(): Promise<void> {
  try {
    await connectToDatabase();
    console.log('Connected to database');

    await cleanCollection(ProjectSetup as any, 'ProjectSetup');
    await cleanCollection(ProjectSiteSetup as any, 'ProjectSiteSetup');

    console.log('\nCleanup complete.');
    process.exit(0);
  } catch (err) {
    console.error('Cleanup failed:', err);
    process.exit(1);
  }
}

run();
