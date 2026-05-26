// scripts/updateProjectTasks.ts
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import TaskUpdateService from '../services/taskUpdate.service';
import { connectToDatabase, disconnectFromDatabase } from '../database/mongodb';

// Load environment variables FIRST
dotenv.config();

/**
 * Standalone script to update project and site tasks
 * Run with: npm run update-tasks
 * Or: npm run update-tasks -- --apply (to actually apply changes)
 * Or: npm run update-tasks -- --type=project --apply (to update only projects)
 * Or: npm run update-tasks -- --type=site --apply (to update only sites)
 */
async function runTaskUpdates() {
  try {
    // Use your existing database connection function
    await connectToDatabase();

    // Log registered models to verify
    console.log('Registered models:', mongoose.modelNames());
    
    // Check command line arguments
    const args = process.argv.slice(2);
    const shouldApply = args.includes('--apply');
    const dryRun = !shouldApply;
    
    // Check if specific type is requested
    const typeArg = args.find(arg => arg.startsWith('--type='));
    const updateType = typeArg ? typeArg.split('=')[1] : 'both'; // both, project, or site

    if (dryRun) {
      console.log('🔍 DRY RUN MODE - No changes will be made');
      console.log('Add --apply flag to actually apply changes');
    } else {
      console.log('⚠️  APPLYING CHANGES - This will modify the database');
    }

    if (updateType === 'project' || updateType === 'both') {
      console.log('\n' + '='.repeat(50));
      console.log('PROJECT TASK MODIFICATIONS');
      console.log('='.repeat(50));

      const projectResults = await TaskUpdateService.applyProjectTaskModifications(dryRun);
      
      console.log('\n' + '='.repeat(50));
      console.log('PROJECT SUMMARY');
      console.log('='.repeat(50));

      const projectSummary = {
        totalModifications: projectResults.length,
        successful: projectResults.filter(r => r.success).length,
        failed: projectResults.filter(r => !r.success).length
      };

      console.log(`Total modifications: ${projectSummary.totalModifications}`);
      console.log(`Successful: ${projectSummary.successful}`);
      console.log(`Failed: ${projectSummary.failed}`);

      if (projectSummary.failed > 0) {
        console.log('\nFailed project modifications:');
        projectResults.filter(r => !r.success).forEach(r => {
          console.log(`  - ${r.fieldName}: ${r.error}`);
        });
      }
    }

    if (updateType === 'site' || updateType === 'both') {
      console.log('\n' + '='.repeat(50));
      console.log('PROJECT SITE TASK MODIFICATIONS');
      console.log('='.repeat(50));

      const siteResults = await TaskUpdateService.applyProjectSiteTaskModifications(dryRun);
      
      console.log('\n' + '='.repeat(50));
      console.log('PROJECT SITE SUMMARY');
      console.log('='.repeat(50));

      const siteSummary = {
        totalModifications: siteResults.length,
        successful: siteResults.filter(r => r.success).length,
        failed: siteResults.filter(r => !r.success).length
      };

      console.log(`Total modifications: ${siteSummary.totalModifications}`);
      console.log(`Successful: ${siteSummary.successful}`);
      console.log(`Failed: ${siteSummary.failed}`);

      if (siteSummary.failed > 0) {
        console.log('\nFailed site modifications:');
        siteResults.filter(r => !r.success).forEach(r => {
          console.log(`  - ${r.fieldName}: ${r.error}`);
        });
      }
    }

    if (dryRun) {
      console.log('\n🔍 This was a dry run. No changes were made.');
      console.log('Run with --apply flag to apply changes.');
      console.log('Use --type=project or --type=site to update specific types only.');
    } else {
      console.log('\n✅ Changes have been applied to the database.');
    }

  } catch (error) {
    console.error('Error updating tasks:', error);
    process.exit(1);
  } finally {
    await disconnectFromDatabase();
  }
}

// Run if this script is executed directly
if (require.main === module) {
  runTaskUpdates();
}

export { runTaskUpdates };