// scripts/reorderSiteTasks.ts
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import TaskUpdateService from '../services/taskUpdate.service';
import { connectToDatabase, disconnectFromDatabase } from '../database/mongodb';

dotenv.config();

async function reorderSiteTasks() {
  try {
    await connectToDatabase();

    const args = process.argv.slice(2);
    const shouldApply = args.includes('--apply');
    const dryRun = !shouldApply;

    console.log('='.repeat(60));
    console.log('PROJECT SITE TASK REORDERING');
    console.log('='.repeat(60));
    console.log(`Mode: ${dryRun ? '🔍 DRY RUN (no changes will be made)' : '⚠️  APPLYING CHANGES'}`);
    console.log('\nChanges to be made:');
    console.log('  • Task 6 (gps_coordinates) → Position 2');
    console.log('  • Task 2 (site_location_description) → Position 3');
    console.log('  • Task 3 (admin_level_1) → Position 4');
    console.log('  • Task 4 (admin_level_2) → Position 5');
    console.log('  • Task 5 (admin_level_3) → Position 6');
    console.log('='.repeat(60));
    console.log('');

    const reorderMap = [
      { fieldName: 'gps_coordinates', newSortOrder: 2 },
      { fieldName: 'site_location_description', newSortOrder: 3 },
      { fieldName: 'admin_level_1', newSortOrder: 4 },
      { fieldName: 'admin_level_2', newSortOrder: 5 },
      { fieldName: 'admin_level_3', newSortOrder: 6 },
    ];

    const results = await TaskUpdateService.reorderTasks(
      'projectSite',
      reorderMap,
      dryRun
    );

    console.log('\n' + '='.repeat(60));
    console.log('REORDERING RESULTS');
    console.log('='.repeat(60));

    let successCount = 0;
    let errorCount = 0;

    results.forEach(result => {
      if (result.error) {
        console.log(`❌ ${result.fieldName}: ${result.error}`);
        errorCount++;
      } else if (dryRun) {
        console.log(`✓ ${result.fieldName} → sortOrder ${result.newSortOrder}`);
        console.log(`  Would affect: ${result.affectedSites || 0} site(s)`);
        successCount++;
      } else {
        console.log(`✅ ${result.fieldName} → sortOrder ${result.newSortOrder}`);
        console.log(`  Updated: ${result.documentsUpdated} document(s)`);
        console.log(`  Template: ${result.templateUpdated ? 'Updated' : 'Skipped'}`);
        successCount++;
      }
    });

    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total tasks processed: ${results.length}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${errorCount}`);

    if (dryRun) {
      console.log('\n🔍 This was a dry run. No changes were made.');
      console.log('Run with --apply flag to apply changes:');
      console.log('  npm run reorder-tasks:apply');
    } else {
      console.log('\n✅ Task reordering completed successfully!');
    }

  } catch (error) {
    console.error('\n❌ Error reordering tasks:', error);
    process.exit(1);
  } finally {
    await disconnectFromDatabase();
  }
}

if (require.main === module) {
  reorderSiteTasks();
}

export { reorderSiteTasks };