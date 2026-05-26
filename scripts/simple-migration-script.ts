// simple-migration-script.ts - Direct MongoDB operations to avoid validation errors

import mongoose from 'mongoose';
import { resolve } from 'path';
import { config } from 'dotenv';
import * as fs from 'fs';

// Load environment variables
const envPaths = [
  resolve(__dirname, '../.env.development.local'),
  resolve(__dirname, '../.env.development'),
  resolve(__dirname, '../.env.local'),
  resolve(__dirname, '../.env')
];

let envLoaded = false;
for (const path of envPaths) {
  if (fs.existsSync(path)) {
    console.log(`Loading environment from ${path}`);
    config({ path });
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  console.log('No .env file found, using process.env variables');
}

async function simpleMigration() {
  try {
    console.log('🚀 Starting SIMPLE bug report migration...');
    
    // Validate and connect to DB
    const dbUri = process.env.DB_URI;
    if (!dbUri) {
      throw new Error('DB_URI environment variable is not set');
    }

    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(dbUri);
    console.log('✅ Connected successfully!');
    
    // Get the collection directly (bypasses Mongoose model validation)
    const db = mongoose.connection.db;
    const collection = db!.collection('bugreports');
    
    console.log('\n📊 Starting data fixes...');
    
    // 1. Fix urgencyLevel values (most critical)
    console.log('\n🚨 Fixing urgencyLevel...');
    
    // Fix string "null" values
    let result = await collection.updateMany(
      { urgencyLevel: "null" },
      { $set: { urgencyLevel: "fix_this_week" } }
    );
    console.log(`✅ Fixed ${result.modifiedCount} documents with urgencyLevel "null"`);
    
    // Fix "medium"
    result = await collection.updateMany(
      { urgencyLevel: "medium" },
      { $set: { urgencyLevel: "fix_this_week" } }
    );
    console.log(`✅ Fixed ${result.modifiedCount} documents with urgencyLevel "medium"`);
    
    // Fix "high"
    result = await collection.updateMany(
      { urgencyLevel: "high" },
      { $set: { urgencyLevel: "fix_1_3_days" } }
    );
    console.log(`✅ Fixed ${result.modifiedCount} documents with urgencyLevel "high"`);
    
    // Fix "low"
    result = await collection.updateMany(
      { urgencyLevel: "low" },
      { $set: { urgencyLevel: "fix_next_month" } }
    );
    console.log(`✅ Fixed ${result.modifiedCount} documents with urgencyLevel "low"`);
    
    // Fix "critical"
    result = await collection.updateMany(
      { urgencyLevel: "critical" },
      { $set: { urgencyLevel: "fix_24_hours" } }
    );
    console.log(`✅ Fixed ${result.modifiedCount} documents with urgencyLevel "critical"`);
    
    // Fix "blocker"
    result = await collection.updateMany(
      { urgencyLevel: "blocker" },
      { $set: { urgencyLevel: "fix_24_hours" } }
    );
    console.log(`✅ Fixed ${result.modifiedCount} documents with urgencyLevel "blocker"`);
    
    // Fix actual null values
    result = await collection.updateMany(
      { urgencyLevel: null },
      { $set: { urgencyLevel: "fix_this_week" } }
    );
    console.log(`✅ Fixed ${result.modifiedCount} documents with urgencyLevel null`);
    
    // Fix missing urgencyLevel
    result = await collection.updateMany(
      { urgencyLevel: { $exists: false } },
      { $set: { urgencyLevel: "fix_this_week" } }
    );
    console.log(`✅ Fixed ${result.modifiedCount} documents with missing urgencyLevel`);
    
    // 2. Fix bugType values
    console.log('\n🔧 Fixing bugType...');
    
    // Fix string "null" bugType
    result = await collection.updateMany(
      { bugType: "null" },
      { $set: { bugType: "fix" } }
    );
    console.log(`✅ Fixed ${result.modifiedCount} documents with bugType "null"`);
    
    // Fix actual null bugType
    result = await collection.updateMany(
      { bugType: null },
      { $set: { bugType: "fix" } }
    );
    console.log(`✅ Fixed ${result.modifiedCount} documents with bugType null`);
    
    // Fix missing bugType
    result = await collection.updateMany(
      { bugType: { $exists: false } },
      { $set: { bugType: "fix" } }
    );
    console.log(`✅ Fixed ${result.modifiedCount} documents with missing bugType`);
    
    // 3. Migrate old estimatedEffort field
    console.log('\n🔄 Migrating estimatedEffort to bugType...');
    
    // Migrate "trivial" -> "fix"
    result = await collection.updateMany(
      { estimatedEffort: "trivial" },
      { 
        $set: { bugType: "fix" },
        $unset: { estimatedEffort: "" }
      }
    );
    console.log(`✅ Migrated ${result.modifiedCount} documents: estimatedEffort "trivial" -> bugType "fix"`);
    
    // Migrate "minor" -> "fix"
    result = await collection.updateMany(
      { estimatedEffort: "minor" },
      { 
        $set: { bugType: "fix" },
        $unset: { estimatedEffort: "" }
      }
    );
    console.log(`✅ Migrated ${result.modifiedCount} documents: estimatedEffort "minor" -> bugType "fix"`);
    
    // Migrate "moderate" -> "food_for_thought"
    result = await collection.updateMany(
      { estimatedEffort: "moderate" },
      { 
        $set: { bugType: "food_for_thought" },
        $unset: { estimatedEffort: "" }
      }
    );
    console.log(`✅ Migrated ${result.modifiedCount} documents: estimatedEffort "moderate" -> bugType "food_for_thought"`);
    
    // Migrate string "null" estimatedEffort
    result = await collection.updateMany(
      { estimatedEffort: "null" },
      { 
        $set: { bugType: "fix" },
        $unset: { estimatedEffort: "" }
      }
    );
    console.log(`✅ Migrated ${result.modifiedCount} documents: estimatedEffort "null" -> bugType "fix"`);
    
    // Migrate actual null estimatedEffort
    result = await collection.updateMany(
      { estimatedEffort: null },
      { 
        $set: { bugType: "fix" },
        $unset: { estimatedEffort: "" }
      }
    );
    console.log(`✅ Migrated ${result.modifiedCount} documents: estimatedEffort null -> bugType "fix"`);
    
    // Remove any remaining estimatedEffort fields
    result = await collection.updateMany(
      { estimatedEffort: { $exists: true } },
      { $unset: { estimatedEffort: "" } }
    );
    console.log(`✅ Removed remaining estimatedEffort fields from ${result.modifiedCount} documents`);
    
    // 4. Fix assignedToTeamMember
    console.log('\n👥 Fixing assignedToTeamMember...');
    
    // Remove string "null" values
    result = await collection.updateMany(
      { assignedToTeamMember: "null" },
      { $unset: { assignedToTeamMember: "" } }
    );
    console.log(`✅ Removed ${result.modifiedCount} assignedToTeamMember "null" values`);
    
    // Remove empty strings
    result = await collection.updateMany(
      { assignedToTeamMember: "" },
      { $unset: { assignedToTeamMember: "" } }
    );
    console.log(`✅ Removed ${result.modifiedCount} empty assignedToTeamMember values`);
    
    // 5. Verification
    console.log('\n🔍 Verifying migration...');
    
    const totalDocs = await collection.countDocuments();
    console.log(`📊 Total documents: ${totalDocs}`);
    
    // Check remaining invalid urgencyLevel values
    const invalidUrgency = await collection.countDocuments({
      urgencyLevel: { 
        $nin: ['fix_24_hours', 'fix_1_3_days', 'fix_this_week', 'fix_2_weeks', 'fix_next_month', 'later'] 
      }
    });
    console.log(`⚠️  Documents with invalid urgencyLevel: ${invalidUrgency}`);
    
    // Check remaining invalid bugType values
    const invalidBugType = await collection.countDocuments({
      $or: [
        { bugType: { $nin: ['fix', 'food_for_thought', 'pipeline'] } },
        { bugType: { $exists: false } }
      ]
    });
    console.log(`⚠️  Documents with invalid/missing bugType: ${invalidBugType}`);
    
    // Check remaining estimatedEffort fields
    const remainingEstimatedEffort = await collection.countDocuments({
      estimatedEffort: { $exists: true }
    });
    console.log(`⚠️  Documents with remaining estimatedEffort: ${remainingEstimatedEffort}`);
    
    if (invalidUrgency === 0 && invalidBugType === 0 && remainingEstimatedEffort === 0) {
      console.log('\n🎉 SUCCESS! All critical issues have been fixed!');
    } else {
      console.log('\n⚠️  Some issues remain. You may need to check individual documents.');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run migration
if (require.main === module) {
  simpleMigration()
    .then(() => {
      console.log('\n✅ Simple migration completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Simple migration failed:', error);
      process.exit(1);
    });
}

export default simpleMigration;