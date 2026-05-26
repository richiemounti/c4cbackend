// scripts/migrateBugReports.ts - Updated with debugging
import mongoose from 'mongoose';
import BugReport from '../models/bugReport.model';
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

export async function migrateBugReports() {
  try {
    console.log('Starting bug report migration...');
    
    // Debug environment variables
    console.log('Environment check:');
    console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
    console.log(`DB_URI exists: ${!!process.env.DB_URI}`);
    console.log(`DB_URI length: ${process.env.DB_URI?.length || 0}`);
    
    // Check if DB_URI starts with the correct format
    if (process.env.DB_URI) {
      const uri = process.env.DB_URI;
      console.log(`DB_URI starts with mongodb: ${uri.startsWith('mongodb://')}`);
      console.log(`DB_URI starts with mongodb+srv: ${uri.startsWith('mongodb+srv://')}`);
      console.log(`DB_URI first 20 chars: ${uri.substring(0, 20)}...`);
    }
    
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
    console.log('✅ Connected to MongoDB successfully');
    
    // Find all existing bug reports
    const existingReports = await BugReport.find({});
    console.log(`Found ${existingReports.length} existing bug reports`);
    
    let updatedCount = 0;
    
    for (const report of existingReports) {
      const updates: any = {};
      
      // Set default feedbackType if not present
      if (!report.feedbackType) {
        updates.feedbackType = 'bug_report';
      }
      
      // Map old priority to new priority system
      if (report.priority && !report.priority.startsWith('p')) {
        const priorityMap: any = {
          'critical': 'p0',
          'high': 'p1', 
          'medium': 'p2',
          'low': 'p3'
        };
        updates.priority = priorityMap[report.priority] || 'p3';
      }
      
      // Set default category based on existing data
      if (!report.category) {
        // Try to infer category from title/description
        const text = (report.title + ' ' + report.description).toLowerCase();
        
        if (text.includes('slow') || text.includes('performance') || text.includes('speed')) {
          updates.category = 'performance';
        } else if (text.includes('ui') || text.includes('button') || text.includes('display')) {
          updates.category = 'ui_ux';
        } else if (text.includes('function') || text.includes('feature') || text.includes('work')) {
          updates.category = 'functionality';
        } else {
          updates.category = 'other';
        }
      }
      
      // Set default urgencyLevel if not present
      if (!report.urgencyLevel) {
        updates.urgencyLevel = report.priority === 'p0' ? 'critical' : 
                              report.priority === 'p1' ? 'high' :
                              report.priority === 'p2' ? 'medium' : 'low';
      }
      
      // Initialize metrics if not present
      if (!report.metrics) {
        updates.metrics = {
          viewCount: 0,
          commentCount: 0,
          reopenCount: 0
        };
      }
      
      // Initialize businessImpact with defaults
      if (!report.businessImpact) {
        updates.businessImpact = {
          affectedUsers: 'some',
          functionalityBlocked: report.priority === 'p0',
          workaroundAvailable: false,
          revenueImpact: false,
          complianceImpact: false
        };
      }
      
      // Set default tags as empty array
      if (!report.tags) {
        updates.tags = [];
      }
      
      // Set default values for new boolean fields
      if (report.requiresFollowUp === undefined) {
        updates.requiresFollowUp = false;
      }
      
      if (report.verifiedByReporter === undefined) {
        updates.verifiedByReporter = false;
      }
      
      // Update the report if there are changes
      if (Object.keys(updates).length > 0) {
        await BugReport.findByIdAndUpdate(report._id, updates);
        updatedCount++;
        console.log(`Updated bug report: ${report._id}`);
      }
    }
    
    console.log(`✅ Migration completed successfully!`);
    console.log(`Total reports: ${existingReports.length}`);
    console.log(`Updated reports: ${updatedCount}`);
    console.log(`Unchanged reports: ${existingReports.length - updatedCount}`);
    
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
  migrateBugReports()
    .then(() => {
      console.log('🎉 Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}