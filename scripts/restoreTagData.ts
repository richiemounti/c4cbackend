/**
 * scripts/restoreTagData.ts
 *
 * Targeted restore of tag field responseData for a specific ProjectSetup document.
 * Fill in the RESTORE_DATA values below from your Atlas backup before running.
 *
 * Usage:
 *   npx ts-node scripts/restoreTagData.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectToDatabase } from '../database/mongodb';

dotenv.config({ path: '.env.development.local' });

// ─── FILL THESE IN FROM YOUR BACKUP ──────────────────────────────────────────
// Document ID of the ProjectSetup that had data deleted
const TARGET_DOC_ID = '69e0afab3eebc5c8b6443a48';

// For each field, provide the array of values from the backup.
// These will be stored as proper tag arrays (responseData) and isCompleted: true.
// Example:
//   approval_granted_by: ['Village Council', 'District Office', 'National Authority']
const RESTORE_DATA: Record<string, string[]> = {
  approval_granted_by:        [], // ← paste values from backup here
  implementing_organisations: [], // ← paste values from backup here
  oversight_authorities:      [], // ← paste values from backup here
};
// ─────────────────────────────────────────────────────────────────────────────

const taskSubSchema = new mongoose.Schema(
  { fieldName: String, options: [String], responseData: mongoose.Schema.Types.Mixed, isCompleted: Boolean },
  { strict: false }
);

const ProjectSetup = mongoose.models.ProjectSetup ||
  mongoose.model('ProjectSetup', new mongoose.Schema({ tasks: [taskSubSchema] }, { strict: false }), 'projectsetups');

async function run() {
  await connectToDatabase();

  const doc = await (ProjectSetup as any).findById(TARGET_DOC_ID).lean() as any;
  if (!doc) {
    console.error(`Document ${TARGET_DOC_ID} not found.`);
    process.exit(1);
  }

  const tasks: any[] = doc.tasks || [];
  let changed = 0;

  const updatedTasks = tasks.map((task: any) => {
    const restoreValues = RESTORE_DATA[task.fieldName];
    if (restoreValues === undefined) return task;

    if (restoreValues.length === 0) {
      console.log(`  ⚠️  "${task.fieldName}" — no restore values provided, skipping`);
      return task;
    }

    console.log(`  ✅ "${task.fieldName}" → restoring: ${JSON.stringify(restoreValues)}`);
    changed++;
    return {
      ...task,
      responseData: restoreValues,
      options: [],          // ensure options stay clean
      isCompleted: true,
    };
  });

  if (changed === 0) {
    console.log('No fields restored — did you fill in RESTORE_DATA above?');
    process.exit(0);
  }

  await (ProjectSetup as any).updateOne(
    { _id: TARGET_DOC_ID },
    { $set: { tasks: updatedTasks } }
  );

  console.log(`\nRestored ${changed} field(s) on document ${TARGET_DOC_ID}`);
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
