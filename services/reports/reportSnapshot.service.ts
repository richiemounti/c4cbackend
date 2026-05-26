// services/reports/reportSnapshot.service.ts
import mongoose from "mongoose";
import Report from "../../models/report.model";
import { IReportDocument } from "../../models/report.model";

// Interface for report snapshot data
// Update the interface
interface IReportSnapshot {
  _id?: mongoose.Types.ObjectId;
  reportId: mongoose.Types.ObjectId;
  version: number;
  snapshotType: 'manual' | 'automatic' | 'scheduled' | 'approval';
  snapshotData?: {  // Make optional to match schema
    reportData: any;
    metadata: any;
    filters: any;
    status: string;
    title: string;
    description?: string;
  };
  snapshotMetadata?: {  // Make optional to match schema
    createdAt: Date;
    createdBy: mongoose.Types.ObjectId;
    reason: string;
    dataSize: number;
    checksumMD5: string;
  };
  previousSnapshotId?: mongoose.Types.ObjectId;
  changesSummary?: {
    fieldsChanged: string[];
    recordsAdded: number;
    recordsModified: number;
    recordsRemoved: number;
    significantChanges: boolean;
  };
}

// Interface for snapshot comparison result
interface ISnapshotComparison {
  fromSnapshot: {
    id: string;
    version: number;
    createdAt: Date;
  };
  toSnapshot: {
    id: string;
    version: number;
    createdAt: Date;
  };
  differences: {
    fieldChanges: Array<{
      field: string;
      path: string;
      oldValue: any;
      newValue: any;
      changeType: 'added' | 'modified' | 'removed';
    }>;
    dataChanges: {
      recordsAdded: Array<{
        type: string;
        data: any;
      }>;
      recordsModified: Array<{
        type: string;
        id: string;
        changes: any;
      }>;
      recordsRemoved: Array<{
        type: string;
        id: string;
        data: any;
      }>;
    };
    metadataChanges: Array<{
      field: string;
      oldValue: any;
      newValue: any;
    }>;
  };
  summary: {
    totalChanges: number;
    significantChanges: boolean;
    changeScore: number; // 0-100 based on magnitude of changes
  };
}

// Snapshot schema for MongoDB
const snapshotSchema = new mongoose.Schema({
  reportId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Report',
    required: true,
    index: true
  },
  version: {
    type: Number,
    required: true,
    min: 1
  },
  snapshotType: {
    type: String,
    enum: ['manual', 'automatic', 'scheduled', 'approval'],
    required: true,
    index: true
  },
  snapshotData: {
    reportData: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    filters: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    status: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: true
    },
    description: String
  },
  snapshotMetadata: {
    createdAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    reason: {
      type: String,
      required: true
    },
    dataSize: {
      type: Number,
      required: true
    },
    checksumMD5: {
      type: String,
      required: true,
      index: true
    }
  },
  previousSnapshotId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ReportSnapshot',
    index: true
  },
  changesSummary: {
    fieldsChanged: [String],
    recordsAdded: {
      type: Number,
      default: 0
    },
    recordsModified: {
      type: Number,
      default: 0
    },
    recordsRemoved: {
      type: Number,
      default: 0
    },
    significantChanges: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
snapshotSchema.index({ reportId: 1, version: -1 });
snapshotSchema.index({ reportId: 1, 'snapshotMetadata.createdAt': -1 });
snapshotSchema.index({ snapshotType: 1, 'snapshotMetadata.createdAt': -1 });
snapshotSchema.index({ 'snapshotMetadata.checksumMD5': 1 });

// Compound index for uniqueness
snapshotSchema.index(
  { reportId: 1, version: 1 },
  { unique: true }
);

const ReportSnapshot = mongoose.model('ReportSnapshot', snapshotSchema);

export class ReportSnapshotService {
  
  /**
   * Create a snapshot of a report
   */
  static async createSnapshot(
    reportId: string,
    userId: string,
    snapshotType: 'manual' | 'automatic' | 'scheduled' | 'approval',
    reason: string,
    forceSnapshot: boolean = false
  ): Promise<IReportSnapshot> {
    try {
      const report = await Report.findById(reportId);
      if (!report) {
        throw new Error('Report not found');
      }

      // Get the latest snapshot to determine version number
      const latestSnapshot = await ReportSnapshot.findOne({ reportId })
        .sort({ version: -1 })
        .limit(1);

      const nextVersion = latestSnapshot ? latestSnapshot.version + 1 : 1;

      // Create snapshot data
      const snapshotData = {
        reportData: report.reportData,
        metadata: report.metadata,
        filters: report.filters,
        status: report.status,
        title: report.title,
        description: report.description
      };

      // Calculate data size and checksum
      const dataString = JSON.stringify(snapshotData);
      const dataSize = Buffer.byteLength(dataString, 'utf8');
      const checksumMD5 = require('crypto')
        .createHash('md5')
        .update(dataString)
        .digest('hex');

      // Check if snapshot already exists with same checksum (avoid duplicates)
      if (!forceSnapshot) {
        const existingSnapshot = await ReportSnapshot.findOne({
          reportId,
          'snapshotMetadata.checksumMD5': checksumMD5
        });

        if (existingSnapshot) {
            console.log(`Snapshot for report ${reportId} already exists with same data`);
            return existingSnapshot.toObject() as IReportSnapshot;
        }
      }

      // Calculate changes summary if there's a previous snapshot
      let changesSummary;
      if (latestSnapshot) {
        changesSummary = await this.calculateChangesSummary(
          latestSnapshot.snapshotData,
          snapshotData
        );
      }

      // Create new snapshot
      const snapshot = new ReportSnapshot({
        reportId,
        version: nextVersion,
        snapshotType,
        snapshotData,
        snapshotMetadata: {
          createdAt: new Date(),
          createdBy: new mongoose.Types.ObjectId(userId),
          reason,
          dataSize,
          checksumMD5
        },
        previousSnapshotId: latestSnapshot?._id,
        changesSummary
      });

      await snapshot.save();

      // Update report's version if this is a significant snapshot
      if (snapshotType === 'approval' || snapshotType === 'manual') {
        report.version = nextVersion;
        await report.save();
      }

      return snapshot.toObject() as IReportSnapshot;

    } catch (error) {
      console.error('Error creating snapshot:', error);
      throw new Error(`Failed to create snapshot: ${error}`);
    }
  }

  /**
   * Get snapshots for a report with pagination
   */
  static async getReportSnapshots(
    reportId: string,
    options: {
      page?: number;
      limit?: number;
      snapshotType?: string;
      fromDate?: Date;
      toDate?: Date;
    } = {}
  ): Promise<{
    snapshots: any[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalCount: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 10;
      const skip = (page - 1) * limit;

      // Build query
      const query: any = { reportId };

      if (options.snapshotType) {
        query.snapshotType = options.snapshotType;
      }

      if (options.fromDate || options.toDate) {
        query['snapshotMetadata.createdAt'] = {};
        if (options.fromDate) {
          query['snapshotMetadata.createdAt'].$gte = options.fromDate;
        }
        if (options.toDate) {
          query['snapshotMetadata.createdAt'].$lte = options.toDate;
        }
      }

      // Execute query
      const [snapshots, totalCount] = await Promise.all([
        ReportSnapshot.find(query)
          .populate('snapshotMetadata.createdBy', 'name email')
          .sort({ version: -1 })
          .skip(skip)
          .limit(limit)
          .select('-snapshotData'), // Exclude heavy data field in listings
        ReportSnapshot.countDocuments(query)
      ]);

      return {
        snapshots,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          hasNext: page < Math.ceil(totalCount / limit),
          hasPrev: page > 1
        }
      };

    } catch (error) {
      console.error('Error getting snapshots:', error);
      throw new Error(`Failed to get snapshots: ${error}`);
    }
  }

  /**
   * Get a specific snapshot with full data
   */
  static async getSnapshotById(snapshotId: string): Promise<IReportSnapshot | null> {
    try {
      const snapshot = await ReportSnapshot.findById(snapshotId)
        .populate('snapshotMetadata.createdBy', 'name email')
        .populate('reportId', 'title reportType');

      return snapshot ? (snapshot.toObject() as IReportSnapshot) : null;

    } catch (error) {
      console.error('Error getting snapshot:', error);
      throw new Error(`Failed to get snapshot: ${error}`);
    }
  }

  /**
   * Compare two snapshots
   */
  static async compareSnapshots(
    fromSnapshotId: string,
    toSnapshotId: string
  ): Promise<ISnapshotComparison> {
    try {
      const [fromSnapshot, toSnapshot] = await Promise.all([
        ReportSnapshot.findById(fromSnapshotId),
        ReportSnapshot.findById(toSnapshotId)
      ]);

      if (!fromSnapshot || !toSnapshot) {
        throw new Error('One or both snapshots not found');
      }

      if (fromSnapshot.reportId.toString() !== toSnapshot.reportId.toString()) {
        throw new Error('Snapshots must be from the same report');
      }

      // Perform deep comparison
      const differences = this.performDeepComparison(
        fromSnapshot.snapshotData,
        toSnapshot.snapshotData
      );

      // Calculate change score (0-100 based on significance)
      const changeScore = this.calculateChangeScore(differences);

      return {
        fromSnapshot: {
            id: fromSnapshot._id.toString(),
            version: fromSnapshot.version,
            createdAt: fromSnapshot.snapshotMetadata?.createdAt || new Date()
        },
        toSnapshot: {
            id: toSnapshot._id.toString(),
            version: toSnapshot.version,
            createdAt: toSnapshot.snapshotMetadata?.createdAt || new Date()
        },
        differences,
        summary: {
          totalChanges: differences.fieldChanges.length + 
                      differences.dataChanges.recordsAdded.length +
                      differences.dataChanges.recordsModified.length +
                      differences.dataChanges.recordsRemoved.length,
          significantChanges: changeScore > 50,
          changeScore
        }
      };

    } catch (error) {
      console.error('Error comparing snapshots:', error);
      throw new Error(`Failed to compare snapshots: ${error}`);
    }
  }

  /**
   * Restore a report from a snapshot
   */
  static async restoreFromSnapshot(
    snapshotId: string,
    userId: string,
    createBackup: boolean = true
  ): Promise<IReportDocument> {
    try {
      const snapshot = await ReportSnapshot.findById(snapshotId);
      if (!snapshot) {
        throw new Error('Snapshot not found');
      }

      const report = await Report.findById(snapshot.reportId);
      if (!report) {
        throw new Error('Report not found');
      }

      // Create backup snapshot before restoring
    if (createBackup) {
        await this.createSnapshot(
            (report._id as mongoose.Types.ObjectId).toString(),
            userId,
            'manual',
            `Backup before restoring to version ${snapshot.version}`,
            true
        );
    }

      // Restore data from snapshot
      if (snapshot.snapshotData) {
        report.reportData = snapshot.snapshotData.reportData;
        report.metadata = {
            ...report.metadata,
            ...snapshot.snapshotData.metadata,
            // Preserve current workflow and regeneration tracking
            workflowHistory: report.metadata.workflowHistory,
            regenerationAttempts: report.metadata.regenerationAttempts,
            lastRegenerationAttempt: report.metadata.lastRegenerationAttempt
        };
        report.filters = snapshot.snapshotData.filters;
        report.title = snapshot.snapshotData.title;
        report.description = snapshot.snapshotData.description || undefined;
        report.lastUpdatedBy = new mongoose.Types.ObjectId(userId);
      }

      // Add workflow history entry
      report.addWorkflowHistory(
        report.status,
        report.status,
        new mongoose.Types.ObjectId(userId),
        `Restored from snapshot version ${snapshot.version}`
      );

      await report.save();

      return report;

    } catch (error) {
      console.error('Error restoring from snapshot:', error);
      throw new Error(`Failed to restore from snapshot: ${error}`);
    }
  }

  /**
   * Delete old snapshots based on retention policy
   */
  static async cleanupOldSnapshots(
    reportId?: string,
    retentionDays: number = 365,
    maxSnapshots: number = 50
  ): Promise<{
    deletedCount: number;
    preservedCount: number;
  }> {
    try {
      const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));
      
      let query: any = {
        'snapshotMetadata.createdAt': { $lt: cutoffDate }
      };

      if (reportId) {
        query.reportId = reportId;
      }

      // Always preserve manual and approval snapshots
      query.snapshotType = { $in: ['automatic', 'scheduled'] };

      // Find snapshots to delete, but preserve the most recent ones
      const allSnapshots = await ReportSnapshot.find(
        reportId ? { reportId } : {},
        '_id snapshotMetadata.createdAt snapshotType'
      ).sort({ 'snapshotMetadata.createdAt': -1 });

      // Group by report and determine which to delete
      const snapshotsToDelete: string[] = [];
      const reportGroups = new Map();

      allSnapshots.forEach(snapshot => {
        const reportIdStr = snapshot.reportId.toString();
        if (!reportGroups.has(reportIdStr)) {
          reportGroups.set(reportIdStr, []);
        }
        reportGroups.get(reportIdStr).push(snapshot);
      });

      // For each report, keep only the most recent maxSnapshots
      reportGroups.forEach((snapshots, reportId) => {
        const eligibleForDeletion = snapshots
          .filter((s: any) => 
            ['automatic', 'scheduled'].includes(s.snapshotType) &&
            s.snapshotMetadata.createdAt < cutoffDate
          )
          .slice(maxSnapshots); // Keep first maxSnapshots, delete the rest

        snapshotsToDelete.push(...eligibleForDeletion.map((s: any) => s._id.toString()));
      });

      // Delete the identified snapshots
      const deleteResult = await ReportSnapshot.deleteMany({
        _id: { $in: snapshotsToDelete }
      });

      return {
        deletedCount: deleteResult.deletedCount || 0,
        preservedCount: allSnapshots.length - (deleteResult.deletedCount || 0)
      };

    } catch (error) {
      console.error('Error cleaning up snapshots:', error);
      throw new Error(`Failed to cleanup snapshots: ${error}`);
    }
  }

  // Private helper methods
  private static async calculateChangesSummary(
    oldData: any,
    newData: any
  ): Promise<any> {
    try {
      const fieldsChanged: string[] = [];
      let recordsAdded = 0;
      let recordsModified = 0;
      let recordsRemoved = 0;

      // Simple field comparison for top-level changes
      const oldKeys = Object.keys(oldData);
      const newKeys = Object.keys(newData);

      // Find added/removed fields
      newKeys.forEach(key => {
        if (!oldKeys.includes(key)) {
          fieldsChanged.push(key);
        }
      });

      oldKeys.forEach(key => {
        if (!newKeys.includes(key)) {
          fieldsChanged.push(key);
        }
      });

      // Find modified fields
      oldKeys.forEach(key => {
        if (newKeys.includes(key)) {
          if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
            fieldsChanged.push(key);
          }
        }
      });

      // For report data, try to count record changes
      if (oldData.reportData && newData.reportData) {
        const oldReportStr = JSON.stringify(oldData.reportData);
        const newReportStr = JSON.stringify(newData.reportData);
        
        // Simple heuristic: if strings are very different, assume significant changes
        const similarity = this.calculateStringSimilarity(oldReportStr, newReportStr);
        if (similarity < 0.8) {
          recordsModified = Math.floor((1 - similarity) * 10); // Rough estimate
        }
      }

      return {
        fieldsChanged: [...new Set(fieldsChanged)], // Remove duplicates
        recordsAdded,
        recordsModified,
        recordsRemoved,
        significantChanges: fieldsChanged.length > 3 || recordsModified > 0
      };

    } catch (error) {
      console.error('Error calculating changes summary:', error);
      return {
        fieldsChanged: [],
        recordsAdded: 0,
        recordsModified: 0,
        recordsRemoved: 0,
        significantChanges: false
      };
    }
  }

  private static performDeepComparison(oldData: any, newData: any): any {
    const differences = {
      fieldChanges: [] as any[],
      dataChanges: {
        recordsAdded: [],
        recordsModified: [],
        recordsRemoved: []
      },
      metadataChanges: [] as any[]
    };

    // Simple implementation - can be enhanced with more sophisticated diff algorithms
    this.compareObjects('', oldData, newData, differences.fieldChanges);

    return differences;
  }

  private static compareObjects(path: string, oldObj: any, newObj: any, changes: any[]): void {
    const oldKeys = oldObj ? Object.keys(oldObj) : [];
    const newKeys = newObj ? Object.keys(newObj) : [];
    const allKeys = [...new Set([...oldKeys, ...newKeys])];

    allKeys.forEach(key => {
      const currentPath = path ? `${path}.${key}` : key;
      const oldValue = oldObj?.[key];
      const newValue = newObj?.[key];

      if (oldValue === undefined && newValue !== undefined) {
        changes.push({
          field: key,
          path: currentPath,
          oldValue: undefined,
          newValue,
          changeType: 'added'
        });
      } else if (oldValue !== undefined && newValue === undefined) {
        changes.push({
          field: key,
          path: currentPath,
          oldValue,
          newValue: undefined,
          changeType: 'removed'
        });
      } else if (oldValue !== newValue) {
        if (typeof oldValue === 'object' && typeof newValue === 'object' && 
            oldValue !== null && newValue !== null) {
          // Recursively compare objects
          this.compareObjects(currentPath, oldValue, newValue, changes);
        } else {
          changes.push({
            field: key,
            path: currentPath,
            oldValue,
            newValue,
            changeType: 'modified'
          });
        }
      }
    });
  }

  private static calculateChangeScore(differences: any): number {
    const fieldChanges = differences.fieldChanges.length;
    const recordChanges = differences.dataChanges.recordsAdded.length +
                         differences.dataChanges.recordsModified.length +
                         differences.dataChanges.recordsRemoved.length;

    // Simple scoring algorithm - can be enhanced
    const baseScore = Math.min((fieldChanges * 10) + (recordChanges * 5), 100);
    return Math.round(baseScore);
  }

  private static calculateStringSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1;
    
    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => 
      Array(str1.length + 1).fill(null)
    );

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + substitutionCost
        );
      }
    }

    return matrix[str2.length][str1.length];
  }
}

export default ReportSnapshotService;
export { IReportSnapshot, ISnapshotComparison, ReportSnapshot };