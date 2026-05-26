/**
 * scripts/checkTagData.ts
 * Shows the current state of tag fields in the DB so we know exactly what data remains.
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

async function checkCollection(Model: mongoose.Model<any>, label: string) {
  const docs = await Model.find({}).lean();
  console.log(`\n===== ${label} (${docs.length} docs) =====`);
  for (const doc of docs) {
    const tasks: any[] = doc.tasks || [];
    const relevant = tasks.filter(t => TAG_FIELDS.includes(t.fieldName));
    if (relevant.length === 0) continue;
    console.log(`\nDoc _id: ${doc._id}`);
    for (const t of relevant) {
      console.log(`  Field: ${t.fieldName}`);
      console.log(`    isCompleted : ${t.isCompleted}`);
      console.log(`    options     : ${JSON.stringify(t.options)}`);
      console.log(`    responseData: ${JSON.stringify(t.responseData)}`);
    }
  }
}

async function run() {
  await connectToDatabase();
  await checkCollection(ProjectSetup as any, 'ProjectSetup');
  await checkCollection(ProjectSiteSetup as any, 'ProjectSiteSetup');
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
