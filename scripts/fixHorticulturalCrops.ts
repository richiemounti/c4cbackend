// scripts/fixHorticulturalCrops.ts
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import TaskUpdateService from '../services/taskUpdate.service';
import { connectToDatabase, disconnectFromDatabase } from '../database/mongodb';

dotenv.config();

async function fixHorticulturalCrops() {
  try {
    await connectToDatabase();

    const args = process.argv.slice(2);
    const shouldApply = args.includes('--apply');
    const dryRun = !shouldApply;

    console.log('='.repeat(60));
    console.log('FIXING HORTICULTURAL CROPS OPTIONS');
    console.log('='.repeat(60));
    console.log(`Mode: ${dryRun ? '🔍 DRY RUN' : '⚠️  APPLYING CHANGES'}`);
    console.log('');

    // The correct options array for crops_grown
    const correctOptions = [
      "Maize",
      "Upland rice",
      "Paddy rice",
      "Cassava",
      "Millet",
      "Sorghum",
      "Sesame",
      "Groundnuts",
      "Sunflower",
      "Cashew",
      "Soybean",
      "Tobacco",
      "Beans",
      "Pigeon pea",
      "Horticultural crops (e.g. tomato, onion)", // FIXED: Combined into one option
      "Banana or plantain",
      "Sugarcane",
      "Other (please specify)"
    ];

    const result = await TaskUpdateService.updateTaskGlobally(
      'crops_grown',
      {
        options: correctOptions
      },
      {
        dryRun,
        setupType: 'projectSite',
        onlyIncompleted: false
      }
    );

    console.log(`Result: ${JSON.stringify(result, null, 2)}`);

    // Update template
    if (!dryRun) {
      const templateResult = await TaskUpdateService.updateTaskTemplate(
        'projectSite',
        'crops_grown',
        { options: correctOptions }
      );
      console.log(`Template updated: ${templateResult?.modifiedCount || 0} document(s)`);
    }

    console.log('\n' + '='.repeat(60));
    if (dryRun) {
      console.log('🔍 This was a dry run. Run with --apply to fix.');
    } else {
      console.log('✅ Horticultural crops option fixed!');
    }

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await disconnectFromDatabase();
  }
}

if (require.main === module) {
  fixHorticulturalCrops();
}

export { fixHorticulturalCrops };