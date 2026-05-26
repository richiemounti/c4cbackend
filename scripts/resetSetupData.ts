// scripts/resetSetupData.ts
// Deletes all ProjectSetup and ProjectSiteSetup documents so they get
// re-initialized from the TaskTemplate on next GET request.
// Run AFTER seedSetupTasks.ts to pick up the correct questions from CSV.

import dotenv from 'dotenv';
import { connectToDatabase } from '../database/mongodb';
import ProjectSetup from '../models/projectSetupTask.model';
import ProjectSiteSetup from '../models/projectSiteSetupTask.model';

dotenv.config();

const resetSetupData = async () => {
  try {
    await connectToDatabase();

    const projectResult = await ProjectSetup.deleteMany({});
    console.log(`Deleted ${projectResult.deletedCount} ProjectSetup document(s)`);

    const siteResult = await ProjectSiteSetup.deleteMany({});
    console.log(`Deleted ${siteResult.deletedCount} ProjectSiteSetup document(s)`);

    console.log('Done. Setup documents will be re-initialized from the TaskTemplate on next load.');
    process.exit(0);
  } catch (error) {
    console.error('Failed to reset setup data:', error);
    process.exit(1);
  }
};

resetSetupData();
