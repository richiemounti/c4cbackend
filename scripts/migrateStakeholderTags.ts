import mongoose from 'mongoose';
import StakeholderGroup from '../models/stakeholderGroup.model';
import { resolve } from 'path';
import { config } from 'dotenv';
import * as fs from 'fs';

// Load environment variables (same as your other migrations)
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

// scripts/migrateStakeholderTags.ts - Updated version
export async function migrateStakeholderTags() {
  try {
    console.log('Starting stakeholder tags migration...');
    
    const dbUri = process.env.DB_URI;
    if (!dbUri) {
      throw new Error('DB_URI environment variable is not set');
    }
    
    console.log('Connecting to MongoDB...');
    await mongoose.connect(dbUri);
    console.log('Connected to MongoDB successfully');
    
    // Find all stakeholder groups
    const stakeholderGroups = await StakeholderGroup.find({});
    console.log(`Found ${stakeholderGroups.length} stakeholder groups`);
    
    let updatedCount = 0;
    let tasksUpdated = 0;
    
    for (const group of stakeholderGroups) {
      let groupNeedsUpdate = false;
      
      console.log(`Checking group: ${group.name} (${group.tasks.length} tasks)`);
      
      // Check each task in the group
      for (let i = 0; i < group.tasks.length; i++) {
        const task = group.tasks[i];
        
        // More comprehensive check: if tags doesn't exist, is null, undefined, or not an array
        if (!task.tags || !Array.isArray(task.tags)) {
          console.log(`  - Task ${i} (${task.taskType}): adding tags field`);
          task.tags = []; // Add empty tags array
          groupNeedsUpdate = true;
          tasksUpdated++;
        } else {
          console.log(`  - Task ${i} (${task.taskType}): tags field exists (${task.tags.length} tags)`);
        }
      }
      
      // Save the group if any task was updated
      if (groupNeedsUpdate) {
        await group.save();
        updatedCount++;
        console.log(`Updated stakeholder group: ${group._id} - "${group.name}"`);
      }
    }
    
    console.log(`Migration completed successfully!`);
    console.log(`Total stakeholder groups: ${stakeholderGroups.length}`);
    console.log(`Updated groups: ${updatedCount}`);
    console.log(`Total tasks updated: ${tasksUpdated}`);
    
    // More detailed validation check
    const totalTasks = await StakeholderGroup.aggregate([
      { $unwind: '$tasks' },
      { $count: 'total' }
    ]);
    
    const tasksWithTags = await StakeholderGroup.aggregate([
      { $unwind: '$tasks' },
      { $match: { 'tasks.tags': { $exists: true, $type: 'array' } } },
      { $count: 'withTags' }
    ]);
    
    console.log(`Total tasks: ${totalTasks[0]?.total || 0}`);
    console.log(`Tasks with tags field: ${tasksWithTags[0]?.withTags || 0}`);
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}


// Run migration if called directly
if (require.main === module) {
  migrateStakeholderTags()
    .then(() => {
      console.log('Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}