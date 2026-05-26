// scripts/migrate-villagers-to-sites.ts
// Migration to move project-level villager stakeholder groups to site-level

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.development.local') });
dotenv.config();

// Define interfaces
interface IStakeholderGroup extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  project: mongoose.Types.ObjectId;
  projectSite?: mongoose.Types.ObjectId;
  category: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  estimatedPopulation?: number;
  themes: mongoose.Types.ObjectId[];
  tasks: any[];
  completionStatus: string;
  creator: mongoose.Types.ObjectId;
  lastUpdatedBy?: mongoose.Types.ObjectId;
  archived: boolean;
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: any;
}

interface IProjectSite extends mongoose.Document {
  _id: mongoose.Types.ObjectId;
  project: mongoose.Types.ObjectId;
  name: string;
  [key: string]: any;
}

// Define loose schemas for migration
const stakeholderGroupSchema = new mongoose.Schema({}, { strict: false });
const projectSiteSchema = new mongoose.Schema({}, { strict: false });

const StakeholderGroup = mongoose.model<IStakeholderGroup>('StakeholderGroup', stakeholderGroupSchema);
const ProjectSite = mongoose.model<IProjectSite>('ProjectSite', projectSiteSchema);

// Migration mapping: stakeholder ID -> site ID
const MIGRATION_MAP = [
  {
    stakeholderName: 'Bujombe Villagers',
    stakeholderId: '691ecf68f0cfce0cc7a35f06',
    siteName: 'Bujombe Village',
    siteId: '691ebd26f0cfce0cc7a350a4'
  },
  {
    stakeholderName: 'Kagunga Villagers',
    stakeholderId: '691f1276f0cfce0cc7a372a1',
    siteName: 'Kagunga Village',
    siteId: '69232639f0cfce0cc7a4114c'
  },
  {
    stakeholderName: 'Kapanga Villagers',
    stakeholderId: '6920ae33f0cfce0cc7a37ebe',
    siteName: 'Kapanga Village',
    siteId: '692328f6f0cfce0cc7a41318'
  },
  {
    stakeholderName: 'Katuma Villagers',
    stakeholderId: '6920c3b4f0cfce0cc7a385c0',
    siteName: 'Katuma Village',
    siteId: '69232c5df0cfce0cc7a41373'
  },
  {
    stakeholderName: 'Lugonesi Villagers',
    stakeholderId: '69211443f0cfce0cc7a38e04',
    siteName: 'Lugonesi Village',
    siteId: '69233736f0cfce0cc7a413cf'
  },
  {
    stakeholderName: 'Lwega Villagers',
    stakeholderId: '69212125f0cfce0cc7a397b2',
    siteName: 'Lwega Village',
    siteId: '69233a40f0cfce0cc7a4142c'
  },
  {
    stakeholderName: 'Mpembe Villagers',
    stakeholderId: '6921a162f0cfce0cc7a3a7c4',
    siteName: 'Mpembe Village',
    siteId: '69233ff6f0cfce0cc7a4148a'
  },
  {
    stakeholderName: 'Mwese Villagers',
    stakeholderId: '6921b3bff0cfce0cc7a3b4aa',
    siteName: 'Mwese Village',
    siteId: '6923412ef0cfce0cc7a414e9'
  }
];

// Configuration - check for --apply flag from command line
const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--apply'); // Will be false if --apply is passed

/**
 * Validate that all stakeholders and sites exist
 */
const validateMigrationData = async (): Promise<boolean> => {
  console.log('\n🔍 Validating migration data...\n');
  
  let allValid = true;
  
  for (const mapping of MIGRATION_MAP) {
    console.log(`📋 Checking: ${mapping.stakeholderName} -> ${mapping.siteName}`);
    
    // Check stakeholder exists
    const stakeholder = await StakeholderGroup.findById(mapping.stakeholderId);
    if (!stakeholder) {
      console.log(`   ❌ Stakeholder not found: ${mapping.stakeholderName} (${mapping.stakeholderId})`);
      allValid = false;
      continue;
    }
    
    // Validate stakeholder name matches
    if (stakeholder.name !== mapping.stakeholderName) {
      console.log(`   ⚠️  Name mismatch! Expected: "${mapping.stakeholderName}", Found: "${stakeholder.name}"`);
      allValid = false;
      continue;
    }
    
    // Check if stakeholder is at project level (no projectSite)
    if (stakeholder.projectSite) {
      console.log(`   ⚠️  Stakeholder already has a projectSite: ${stakeholder.projectSite}`);
      allValid = false;
      continue;
    }
    
    // Check site exists
    const site = await ProjectSite.findById(mapping.siteId);
    if (!site) {
      console.log(`   ❌ Site not found: ${mapping.siteName} (${mapping.siteId})`);
      allValid = false;
      continue;
    }
    
    // Validate site name matches
    if (site.name !== mapping.siteName) {
      console.log(`   ⚠️  Site name mismatch! Expected: "${mapping.siteName}", Found: "${site.name}"`);
      allValid = false;
      continue;
    }
    
    // Check if site belongs to same project as stakeholder
    if (!stakeholder.project.equals(site.project)) {
      console.log(`   ❌ Project mismatch! Stakeholder project: ${stakeholder.project}, Site project: ${site.project}`);
      allValid = false;
      continue;
    }
    
    // Check for potential duplicates at site level
    const existingAtSite = await StakeholderGroup.findOne({
      projectSite: mapping.siteId,
      category: stakeholder.category,
      name: stakeholder.name,
      archived: false
    });
    
    if (existingAtSite) {
      console.log(`   ⚠️  Duplicate found! Stakeholder with same name/category already exists at site level`);
      allValid = false;
      continue;
    }
    
    console.log(`   ✅ Valid: ${stakeholder.name}`);
    console.log(`      - Tasks: ${stakeholder.tasks?.length || 0}`);
    console.log(`      - Status: ${stakeholder.completionStatus}`);
    console.log(`      - Themes: ${stakeholder.themes?.length || 0}`);
    console.log(`      - Project: ${stakeholder.project}`);
    console.log(`      - Target Site: ${site.name} (${site._id})`);
  }
  
  return allValid;
};

/**
 * Perform the migration
 */
const migrateVillagersToSites = async (): Promise<void> => {
  try {
    console.log('🚀 Starting villager stakeholders migration to site level...\n');
    
    // Connect to MongoDB
    if (!process.env.DB_URI) {
      throw new Error('DB_URI environment variable is required');
    }
    
    await mongoose.connect(process.env.DB_URI);
    console.log('✅ Connected to MongoDB\n');
    
    // Validate all data first
    const isValid = await validateMigrationData();
    
    if (!isValid) {
      console.log('\n❌ Validation failed! Please fix the issues above before proceeding.');
      return;
    }
    
    console.log('\n✅ All validation checks passed!\n');
    
    if (DRY_RUN) {
      console.log('🔍 DRY RUN MODE - No changes will be made');
      console.log('   Set DRY_RUN = false in the script to perform actual migration\n');
      
      // Show what would happen
      console.log('📝 Migration Plan:');
      for (const mapping of MIGRATION_MAP) {
        console.log(`   ✓ ${mapping.stakeholderName} (${mapping.stakeholderId})`);
        console.log(`     → Will be moved to ${mapping.siteName} (${mapping.siteId})\n`);
      }
      return;
    }
    
    // Perform actual migration
    console.log('🔄 Starting migration...\n');
    
    let successCount = 0;
    let failCount = 0;
    
    for (const mapping of MIGRATION_MAP) {
      try {
        console.log(`📌 Migrating: ${mapping.stakeholderName}`);
        
        // Update the stakeholder group to set projectSite
        const result = await StakeholderGroup.updateOne(
          { _id: mapping.stakeholderId },
          { 
            $set: { 
              projectSite: new mongoose.Types.ObjectId(mapping.siteId),
              updatedAt: new Date()
            } 
          }
        );
        
        if (result.modifiedCount === 1) {
          console.log(`   ✅ Successfully moved to ${mapping.siteName}`);
          successCount++;
          
          // Verify the update
          const updated = await StakeholderGroup.findById(mapping.stakeholderId);
          if (updated && updated.projectSite) {
            console.log(`   ✓ Verified: projectSite = ${updated.projectSite}`);
            console.log(`   ✓ All data preserved (${updated.tasks?.length || 0} tasks, ${updated.themes?.length || 0} themes)\n`);
          }
        } else {
          console.log(`   ⚠️  No changes made for ${mapping.stakeholderName}`);
          failCount++;
        }
      } catch (error) {
        console.error(`   ❌ Error migrating ${mapping.stakeholderName}:`, error);
        failCount++;
      }
    }
    
    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary:');
    console.log('='.repeat(60));
    console.log(`✅ Successfully migrated: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`📝 Total: ${MIGRATION_MAP.length}`);
    console.log('='.repeat(60) + '\n');
    
    if (successCount === MIGRATION_MAP.length) {
      console.log('🎉 All stakeholders successfully migrated to site level!');
      console.log('✓ All tasks, themes, and data have been preserved');
      console.log('✓ Stakeholders are now site-specific');
    } else if (failCount > 0) {
      console.log('⚠️  Some migrations failed. Please review the errors above.');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
};

// Run the migration
const runMigration = async (): Promise<void> => {
  try {
    await migrateVillagersToSites();
    console.log('\n✨ Migration process completed');
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Migration process failed:', error);
    process.exit(1);
  }
};

// Execute if run directly
if (require.main === module) {
  runMigration();
}

export { migrateVillagersToSites };