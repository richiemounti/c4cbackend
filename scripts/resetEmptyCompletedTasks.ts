/**
 * scripts/resetEmptyCompletedTasks.ts
 *
 * Finds tasks that are marked isCompleted: true but have empty/null responseData
 * for the known tag fields, and resets isCompleted to false so they can be re-entered.
 *
 * Run once after cleanupTagOptions.ts to fix the inconsistent state where tasks
 * appear complete but have no data.
 *
 * Usage:
 *   npx ts-node scripts/resetEmptyCompletedTasks.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectToDatabase } from '../database/mongodb';

dotenv.config({ path: '.env.development.local' });

const TAG_FIELDS = [
  'ethnic_groups_present',
  'approval_granted_by',
  'implementing_organisations',
  'oversight_authorities',
];

const taskSubSchema = new mongoose.Schema(
  { fieldName: String, options: [String], responseData: mongoose.Schema.Types.Mixed, isCompleted: Boolean },
  { strict: false }
);

const ProjectSetup = mongoose.models.ProjectSetup ||
  mongoose.model('ProjectSetup', new mongoose.Schema({ tasks: [taskSubSchema] }, { strict: false }), 'projectsetups');

const ProjectSiteSetup = mongoose.models.ProjectSiteSetup ||
  mongoose.model('ProjectSiteSetup', new mongoose.Schema({ tasks: [taskSubSchema] }, { strict: false }), 'projectsitesetups');

async function resetCollection(Model: mongoose.Model<any>, label: string) {
  const docs = await Model.find({}).lean();
  console.log(`\n[${label}] Checking ${docs.length} documents...`);

  let docsUpdated = 0;
  let tasksReset = 0;

  for (const doc of docs) {
    const tasks: any[] = doc.tasks || [];
    let docDirty = false;

    const updatedTasks = tasks.map((task: any) => {
      if (!TAG_FIELDS.includes(task.fieldName)) return task;

      const isEmpty =
        task.isCompleted === true &&
        (
          task.responseData === null ||
          task.responseData === undefined ||
          (Array.isArray(task.responseData) && task.responseData.length === 0)
        );

      if (isEmpty) {
        console.log(`  • doc ${doc._id} | "${task.fieldName}" → resetting isCompleted: true → false`);
        docDirty = true;
        tasksReset++;
        return { ...task, isCompleted: false };
      }
      return task;
    });

    if (docDirty) {
      await Model.updateOne({ _id: doc._id }, { $set: { tasks: updatedTasks } });
      docsUpdated++;
    }
  }

  console.log(`[${label}] Done — ${docsUpdated} doc(s) updated, ${tasksReset} task(s) reset to incomplete`);
}

async function run() {
  await connectToDatabase();
  await resetCollection(ProjectSetup as any, 'ProjectSetup');
  await resetCollection(ProjectSiteSetup as any, 'ProjectSiteSetup');
  console.log('\nDone.');
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
