// check-data-script.ts - TypeScript version with concurrent checking

import mongoose from 'mongoose';
import { Collection, Db } from 'mongodb';
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

interface DataCheckResult {
  field: string;
  totalValues: string[];
  invalidValues: string[];
  invalidCount: number;
  isValid: boolean;
}

interface CheckStats {
  totalDocuments: number;
  checksPerformed: number;
  issues: DataCheckResult[];
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

class BugReportDataChecker {
  private db: Db | null = null;
  private collection: Collection | null = null;
  private stats: CheckStats;

  // Valid enum values
  private readonly validEnums = {
    urgencyLevel: ['fix_24_hours', 'fix_1_3_days', 'fix_this_week', 'fix_2_weeks', 'fix_next_month', 'later'],
    status: ['new', 'triaged', 'resolved', 'verified', 'cannot-reproduce', 'duplicate', 'deferred'],
    priority: ['p0', 'p1', 'p2', 'p3', 'p4'],
    bugType: ['fix', 'food_for_thought', 'pipeline'],
    assignedToTeamMember: ['kate', 'sam', 'belinda']
  };

  constructor() {
    this.stats = {
      totalDocuments: 0,
      checksPerformed: 0,
      issues: [],
      startTime: new Date()
    };
  }

  async connect(): Promise<void> {
    console.log('Starting bug report data check...');
    
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

    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(dbUri);
    console.log('✅ Connected to MongoDB successfully!');
    
    this.db = mongoose.connection.db!; // Assert non-null since we just connected
    this.collection = this.db.collection('bugreports');
  }

  async disconnect(): Promise<void> {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }

  private async checkField(
    fieldName: string, 
    validValues: string[], 
    allowEmpty: boolean = false
  ): Promise<DataCheckResult> {
    if (!this.collection) {
      throw new Error('Collection not initialized');
    }

    // Get all distinct values for this field
    const allValues = await this.collection.distinct(fieldName);
    
    // Find invalid values
    const invalidValues = allValues.filter((value: any) => {
      if (allowEmpty && (value === '' || value === null || value === undefined)) {
        return false;
      }
      return !validValues.includes(value);
    });

    // Count documents with invalid values
    let invalidCount = 0;
    if (invalidValues.length > 0) {
      const invalidCountPromises = invalidValues.map(async (value: any) => {
        if (value === null || value === undefined) {
          return this.collection!.countDocuments({ [fieldName]: value });
        }
        return this.collection!.countDocuments({ [fieldName]: value });
      });
      
      const counts = await Promise.all(invalidCountPromises);
      invalidCount = counts.reduce((sum, count) => sum + count, 0);
    }

    const result: DataCheckResult = {
      field: fieldName,
      totalValues: allValues,
      invalidValues,
      invalidCount,
      isValid: invalidValues.length === 0
    };

    this.stats.checksPerformed++;
    if (!result.isValid) {
      this.stats.issues.push(result);
    }

    return result;
  }

  private async checkEmptyStrings(fieldName: string): Promise<DataCheckResult> {
    if (!this.collection) throw new Error('Collection not initialized');

    const emptyCount = await this.collection.countDocuments({ [fieldName]: '' });
    
    const result: DataCheckResult = {
      field: `${fieldName} (empty strings)`,
      totalValues: [''],
      invalidValues: emptyCount > 0 ? [''] : [],
      invalidCount: emptyCount,
      isValid: emptyCount === 0
    };

    this.stats.checksPerformed++;
    if (!result.isValid) {
      this.stats.issues.push(result);
    }

    return result;
  }

  private async checkOldFields(): Promise<DataCheckResult[]> {
    if (!this.collection) throw new Error('Collection not initialized');

    const oldFieldChecks = [
      {
        fieldName: 'estimatedEffort',
        displayName: 'estimatedEffort (old field)'
      }
    ];

    const results = await Promise.all(
      oldFieldChecks.map(async ({ fieldName, displayName }) => {
        const count = await this.collection!.countDocuments({ 
          [fieldName]: { $exists: true } 
        });

        const distinctValues = count > 0 
          ? await this.collection!.distinct(fieldName)
          : [];

        const result: DataCheckResult = {
          field: displayName,
          totalValues: distinctValues,
          invalidValues: count > 0 ? distinctValues : [],
          invalidCount: count,
          isValid: count === 0
        };

        this.stats.checksPerformed++;
        if (!result.isValid) {
          this.stats.issues.push(result);
        }

        return result;
      })
    );

    return results;
  }

  private printFieldResult(result: DataCheckResult, emoji: string): void {
    console.log(`\n${emoji} ${result.field.toUpperCase()}:`);
    console.log(`Found values: [${result.totalValues.map(v => `"${v}"`).join(', ')}]`);
    
    if (result.isValid) {
      console.log('✅ All values are valid!');
    } else {
      console.log(`⚠️  Found ${result.invalidCount} documents with invalid values:`);
      result.invalidValues.forEach(value => {
        console.log(`   - "${value}"`);
      });
    }
  }

  async checkAllData(): Promise<void> {
    console.log('\n📊 CHECKING BUG REPORT DATA...\n');
    
    if (!this.collection) throw new Error('Collection not initialized');

    // Get total document count
    this.stats.totalDocuments = await this.collection.countDocuments();
    console.log(`📋 Total bug reports: ${this.stats.totalDocuments}`);
    
    if (this.stats.totalDocuments === 0) {
      console.log('No bug reports found in database.');
      return;
    }

    // Run all field checks concurrently for better performance
    const fieldChecks = await Promise.all([
      this.checkField('urgencyLevel', this.validEnums.urgencyLevel),
      this.checkField('status', this.validEnums.status),
      this.checkField('priority', this.validEnums.priority),
      this.checkField('bugType', this.validEnums.bugType),
      this.checkField('assignedToTeamMember', this.validEnums.assignedToTeamMember, true),
      this.checkEmptyStrings('assignedToTeamMember')
    ]);

    // Check for old fields
    const oldFieldResults = await this.checkOldFields();

    // Print results
    const [
      urgencyResult,
      statusResult, 
      priorityResult,
      bugTypeResult,
      teamMemberResult,
      emptyTeamMemberResult
    ] = fieldChecks;

    this.printFieldResult(urgencyResult, '🚨');
    this.printFieldResult(statusResult, '📊');
    this.printFieldResult(priorityResult, '🔥');
    this.printFieldResult(bugTypeResult, '🔧');
    this.printFieldResult(teamMemberResult, '👥');
    
    if (!emptyTeamMemberResult.isValid) {
      console.log(`\n⚠️  Found ${emptyTeamMemberResult.invalidCount} documents with empty assignedToTeamMember`);
    }

    // Print old field results
    oldFieldResults.forEach(result => {
      if (!result.isValid) {
        console.log(`\n🔄 ${result.field.toUpperCase()}:`);
        console.log(`⚠️  Found ${result.invalidCount} documents with old field`);
        console.log(`Values: [${result.totalValues.map(v => `"${v}"`).join(', ')}]`);
      }
    });
  }

  printSummary(): void {
    this.stats.endTime = new Date();
    this.stats.duration = this.stats.endTime.getTime() - this.stats.startTime.getTime();

    console.log('\n📝 SUMMARY:');
    console.log(`⏱️  Check duration: ${this.stats.duration}ms`);
    console.log(`🔍 Checks performed: ${this.stats.checksPerformed}`);
    console.log(`📋 Total documents: ${this.stats.totalDocuments}`);
    
    if (this.stats.issues.length === 0) {
      console.log('✅ ALL DATA IS VALID! No migration needed.');
    } else {
      console.log('⚠️  MIGRATION NEEDED! Found issues with:');
      this.stats.issues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue.field}: ${issue.invalidCount} documents`);
      });
      console.log('\n🚀 Run migration: npm run migrate:bug-reports');
    }
  }

  async run(): Promise<void> {
    try {
      await this.connect();
      await this.checkAllData();
      this.printSummary();
    } catch (error) {
      console.error('❌ Error checking data:', error);
      throw error;
    } finally {
      await this.disconnect();
    }
  }
}

// Main execution
async function main(): Promise<void> {
  const checker = new BugReportDataChecker();
  
  try {
    await checker.run();
    process.exit(0);
  } catch (error) {
    console.error('💥 Data check failed:', error);
    process.exit(1);
  }
}

// Handle process termination gracefully
process.on('SIGINT', async () => {
  console.log('\n⚠️  Received SIGINT. Shutting down gracefully...');
  await mongoose.connection.close();
  process.exit(0);
});

// Run the check
if (require.main === module) {
  main();
}

export default BugReportDataChecker;