// scripts/migrateTheoryOfChangeModels.ts
import mongoose from 'mongoose';
import StakeholderAction from '../models/stakeholderAction.model';
import SocialImpact from '../models/socialImpact.model';
import { resolve } from 'path';
import { config } from 'dotenv';
import * as fs from 'fs';

// Load environment variables with better path resolution
const envPaths = [
  resolve(__dirname, '../.env.development.local'),
  resolve(__dirname, '../.env.development'),
  resolve(__dirname, '../.env.local'),
  resolve(__dirname, '../.env')
];

// Try to load from the first existing file
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

export async function migrateTheoryOfChangeModels() {
  try {
    console.log('Starting Theory of Change models migration...');
    
    // Debug environment variables
    console.log('Environment check:');
    console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`DB_URI exists: ${!!process.env.DB_URI}`);
    
    // Validate DB_URI
    const dbUri = process.env.DB_URI;
    if (!dbUri) {
      throw new Error('DB_URI environment variable is not set');
    }
    
    if (!dbUri.startsWith('mongodb://') && !dbUri.startsWith('mongodb+srv://')) {
      throw new Error(`Invalid DB_URI format. Expected to start with "mongodb://" or "mongodb+srv://", but got: ${dbUri.substring(0, 20)}...`);
    }
    
    console.log('Connecting to MongoDB...');
    await mongoose.connect(dbUri);
    console.log('Connected to MongoDB successfully');
    
    // ===== MIGRATE STAKEHOLDER ACTIONS =====
    console.log('\n=== Migrating StakeholderAction documents ===');
    
    // Find all existing stakeholder actions
    const existingActions = await StakeholderAction.find({});
    console.log(`Found ${existingActions.length} existing stakeholder actions`);
    
    let actionsUpdatedCount = 0;
    
    for (const action of existingActions) {
      const updates: any = {};
      
      // Add status if not present
      if (!action.status) {
        updates.status = 'not_started';
      }
      
      // Add progress if not present
      if (action.progress === undefined || action.progress === null) {
        updates.progress = 0;
      }
      
      // Add dependencies if not present
      if (!action.dependencies) {
        updates.dependencies = [];
      }
      
      // Add priority if not present
      if (!action.priority) {
        updates.priority = 'medium';
      }
      
      // Add milestones if not present
      if (!action.milestones) {
        updates.milestones = [];
      }
      
      // Enhance timeframe structure if basic timeframe exists but missing new fields
      if (action.timeframe) {
        const timeframeUpdates: any = {};
        
        // Preserve existing startDate and endDate
        if (action.timeframe.startDate) {
          timeframeUpdates.startDate = action.timeframe.startDate;
        }
        if (action.timeframe.endDate) {
          timeframeUpdates.endDate = action.timeframe.endDate;
        }
        
        // Add estimatedDuration if not present
        if (!action.timeframe.estimatedDuration) {
          // Calculate from existing dates or set default
          if (action.timeframe.startDate && action.timeframe.endDate) {
            const duration = Math.ceil(
              (action.timeframe.endDate.getTime() - action.timeframe.startDate.getTime()) 
              / (24 * 60 * 60 * 1000)
            );
            timeframeUpdates.estimatedDuration = duration > 0 ? duration : 7; // default 7 days
          } else {
            timeframeUpdates.estimatedDuration = 7; // default 7 days
          }
        }
        
        // Add isFlexible if not present
        if (action.timeframe.isFlexible === undefined) {
          timeframeUpdates.isFlexible = false;
        }
        
        if (Object.keys(timeframeUpdates).length > 0) {
          updates.timeframe = timeframeUpdates;
        }
      } else {
        // Create basic timeframe structure if completely missing
        updates.timeframe = {
          startDate: null,
          endDate: null,
          estimatedDuration: 7,
          isFlexible: false
        };
      }
      
      // Update the action if there are changes
      if (Object.keys(updates).length > 0) {
        await StakeholderAction.findByIdAndUpdate(action._id, updates);
        actionsUpdatedCount++;
        console.log(`Updated action: ${action._id} - "${action.action?.substring(0, 50)}..."`);
      }
    }
    
    // ===== MIGRATE SOCIAL IMPACTS =====
    console.log('\n=== Migrating SocialImpact documents ===');
    
    // Find all existing social impacts
    const existingImpacts = await SocialImpact.find({});
    console.log(`Found ${existingImpacts.length} existing social impacts`);
    
    let impactsUpdatedCount = 0;
    
    for (const impact of existingImpacts) {
      const updates: any = {};
      
      // Add status if not present
      if (!impact.status) {
        updates.status = 'planned';
      }
      
      // Add progress if not present
      if (impact.progress === undefined || impact.progress === null) {
        updates.progress = 0;
      }
      
      // Add timeframe structure if not present
      if (!impact.timeframe) {
        updates.timeframe = {
          targetDate: null,
          reviewDate: null,
          estimatedDuration: 30 // Default 30 days for impacts
        };
      } else {
        // Enhance existing timeframe
        const timeframeUpdates: any = { ...impact.timeframe };
        
        if (!timeframeUpdates.estimatedDuration) {
          timeframeUpdates.estimatedDuration = 30;
        }
        
        updates.timeframe = timeframeUpdates;
      }
      
      // Add measurementPlan if not present
      if (!impact.measurementPlan) {
        updates.measurementPlan = {
          indicators: [],
          measurementMethod: '',
          frequency: 'quarterly'
        };
      }
      
      // Update the impact if there are changes
      if (Object.keys(updates).length > 0) {
        await SocialImpact.findByIdAndUpdate(impact._id, updates);
        impactsUpdatedCount++;
        console.log(`Updated impact: ${impact._id} - "${impact.outcome?.substring(0, 50)}..."`);
      }
    }
    
    // ===== VALIDATION CHECKS =====
    console.log('\n=== Running validation checks ===');
    
    // Check StakeholderActions
    const actionsWithStatus = await StakeholderAction.countDocuments({ status: { $exists: true } });
    const actionsWithProgress = await StakeholderAction.countDocuments({ progress: { $exists: true } });
    const actionsWithDependencies = await StakeholderAction.countDocuments({ dependencies: { $exists: true } });
    
    console.log(`StakeholderActions validation:`);
    console.log(`- With status field: ${actionsWithStatus}/${existingActions.length}`);
    console.log(`- With progress field: ${actionsWithProgress}/${existingActions.length}`);
    console.log(`- With dependencies field: ${actionsWithDependencies}/${existingActions.length}`);
    
    // Check SocialImpacts
    const impactsWithStatus = await SocialImpact.countDocuments({ status: { $exists: true } });
    const impactsWithProgress = await SocialImpact.countDocuments({ progress: { $exists: true } });
    const impactsWithTimeframe = await SocialImpact.countDocuments({ timeframe: { $exists: true } });
    
    console.log(`SocialImpacts validation:`);
    console.log(`- With status field: ${impactsWithStatus}/${existingImpacts.length}`);
    console.log(`- With progress field: ${impactsWithProgress}/${existingImpacts.length}`);
    console.log(`- With timeframe field: ${impactsWithTimeframe}/${existingImpacts.length}`);
    
    console.log(`\nMigration completed successfully!`);
    console.log(`StakeholderActions - Total: ${existingActions.length}, Updated: ${actionsUpdatedCount}, Unchanged: ${existingActions.length - actionsUpdatedCount}`);
    console.log(`SocialImpacts - Total: ${existingImpacts.length}, Updated: ${impactsUpdatedCount}, Unchanged: ${existingImpacts.length - impactsUpdatedCount}`);
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    // Close the database connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateTheoryOfChangeModels()
    .then(() => {
      console.log('Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration script failed:', error);
      process.exit(1);
    });
}