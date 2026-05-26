// scripts/reseedStakeholderTaskOptions.ts
// Re-seeds StakeholderTaskOption labels from the constants file.
// Run after any label changes to stakeholderMapping.constants.ts to propagate updates to the DB.

import dotenv from 'dotenv';
import { connectToDatabase } from '../database/mongodb';
import Category from '../models/category.model';
import StakeholderTaskOption from '../models/stakeholderTaskOption.model';
import { CATEGORY_OPTIONS_MAP } from '../constants/stakeholderMapping.constants';

dotenv.config();

const reseedStakeholderTaskOptions = async () => {
  try {
    await connectToDatabase();

    let totalUpdated = 0;
    let totalNotFound = 0;

    for (const [categoryName, taskOptions] of Object.entries(CATEGORY_OPTIONS_MAP)) {
      const category = await Category.findOne({ name: categoryName });
      if (!category) {
        console.log(`Category not found in DB: "${categoryName}" — skipping`);
        totalNotFound++;
        continue;
      }

      console.log(`Processing: "${categoryName}" (${category._id})`);

      for (const [taskType, options] of Object.entries(taskOptions)) {
        for (const option of options) {
          const result = await StakeholderTaskOption.findOneAndUpdate(
            { category: category._id, taskType, optionId: option.optionId },
            { label: option.label },
            { new: true }
          );

          if (result) {
            totalUpdated++;
          } else {
            console.log(`  No existing record for [${taskType}] "${option.optionId}" — skipping`);
          }
        }
      }
    }

    console.log(`\nDone. Updated ${totalUpdated} option label(s). Categories not in DB: ${totalNotFound}.`);
    process.exit(0);
  } catch (error) {
    console.error('Failed to reseed stakeholder task options:', error);
    process.exit(1);
  }
};

reseedStakeholderTaskOptions();
