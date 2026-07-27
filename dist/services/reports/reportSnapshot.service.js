"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportSnapshot = exports.ReportSnapshotService = void 0;
// services/reports/reportSnapshot.service.ts
const mongoose_1 = __importDefault(require("mongoose"));
const report_model_1 = __importDefault(require("../../models/report.model"));
// Snapshot schema for MongoDB
const snapshotSchema = new mongoose_1.default.Schema({
    reportId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
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
            type: mongoose_1.default.Schema.Types.Mixed,
            required: true
        },
        metadata: {
            type: mongoose_1.default.Schema.Types.Mixed,
            required: true
        },
        filters: {
            type: mongoose_1.default.Schema.Types.Mixed,
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
            type: mongoose_1.default.Schema.Types.ObjectId,
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
        type: mongoose_1.default.Schema.Types.ObjectId,
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
snapshotSchema.index({ reportId: 1, version: 1 }, { unique: true });
const ReportSnapshot = mongoose_1.default.model('ReportSnapshot', snapshotSchema);
exports.ReportSnapshot = ReportSnapshot;
class ReportSnapshotService {
    /**
     * Create a snapshot of a report
     */
    static createSnapshot(reportId_1, userId_1, snapshotType_1, reason_1) {
        return __awaiter(this, arguments, void 0, function* (reportId, userId, snapshotType, reason, forceSnapshot = false) {
            try {
                const report = yield report_model_1.default.findById(reportId);
                if (!report) {
                    throw new Error('Report not found');
                }
                // Get the latest snapshot to determine version number
                const latestSnapshot = yield ReportSnapshot.findOne({ reportId })
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
                    const existingSnapshot = yield ReportSnapshot.findOne({
                        reportId,
                        'snapshotMetadata.checksumMD5': checksumMD5
                    });
                    if (existingSnapshot) {
                        console.log(`Snapshot for report ${reportId} already exists with same data`);
                        return existingSnapshot.toObject();
                    }
                }
                // Calculate changes summary if there's a previous snapshot
                let changesSummary;
                if (latestSnapshot) {
                    changesSummary = yield this.calculateChangesSummary(latestSnapshot.snapshotData, snapshotData);
                }
                // Create new snapshot
                const snapshot = new ReportSnapshot({
                    reportId,
                    version: nextVersion,
                    snapshotType,
                    snapshotData,
                    snapshotMetadata: {
                        createdAt: new Date(),
                        createdBy: new mongoose_1.default.Types.ObjectId(userId),
                        reason,
                        dataSize,
                        checksumMD5
                    },
                    previousSnapshotId: latestSnapshot === null || latestSnapshot === void 0 ? void 0 : latestSnapshot._id,
                    changesSummary
                });
                yield snapshot.save();
                // Update report's version if this is a significant snapshot
                if (snapshotType === 'approval' || snapshotType === 'manual') {
                    report.version = nextVersion;
                    yield report.save();
                }
                return snapshot.toObject();
            }
            catch (error) {
                console.error('Error creating snapshot:', error);
                throw new Error(`Failed to create snapshot: ${error}`);
            }
        });
    }
    /**
     * Get snapshots for a report with pagination
     */
    static getReportSnapshots(reportId_1) {
        return __awaiter(this, arguments, void 0, function* (reportId, options = {}) {
            try {
                const page = options.page || 1;
                const limit = options.limit || 10;
                const skip = (page - 1) * limit;
                // Build query
                const query = { reportId };
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
                const [snapshots, totalCount] = yield Promise.all([
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
            }
            catch (error) {
                console.error('Error getting snapshots:', error);
                throw new Error(`Failed to get snapshots: ${error}`);
            }
        });
    }
    /**
     * Get a specific snapshot with full data
     */
    static getSnapshotById(snapshotId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const snapshot = yield ReportSnapshot.findById(snapshotId)
                    .populate('snapshotMetadata.createdBy', 'name email')
                    .populate('reportId', 'title reportType');
                return snapshot ? snapshot.toObject() : null;
            }
            catch (error) {
                console.error('Error getting snapshot:', error);
                throw new Error(`Failed to get snapshot: ${error}`);
            }
        });
    }
    /**
     * Compare two snapshots
     */
    static compareSnapshots(fromSnapshotId, toSnapshotId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const [fromSnapshot, toSnapshot] = yield Promise.all([
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
                const differences = this.performDeepComparison(fromSnapshot.snapshotData, toSnapshot.snapshotData);
                // Calculate change score (0-100 based on significance)
                const changeScore = this.calculateChangeScore(differences);
                return {
                    fromSnapshot: {
                        id: fromSnapshot._id.toString(),
                        version: fromSnapshot.version,
                        createdAt: ((_a = fromSnapshot.snapshotMetadata) === null || _a === void 0 ? void 0 : _a.createdAt) || new Date()
                    },
                    toSnapshot: {
                        id: toSnapshot._id.toString(),
                        version: toSnapshot.version,
                        createdAt: ((_b = toSnapshot.snapshotMetadata) === null || _b === void 0 ? void 0 : _b.createdAt) || new Date()
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
            }
            catch (error) {
                console.error('Error comparing snapshots:', error);
                throw new Error(`Failed to compare snapshots: ${error}`);
            }
        });
    }
    /**
     * Restore a report from a snapshot
     */
    static restoreFromSnapshot(snapshotId_1, userId_1) {
        return __awaiter(this, arguments, void 0, function* (snapshotId, userId, createBackup = true) {
            try {
                const snapshot = yield ReportSnapshot.findById(snapshotId);
                if (!snapshot) {
                    throw new Error('Snapshot not found');
                }
                const report = yield report_model_1.default.findById(snapshot.reportId);
                if (!report) {
                    throw new Error('Report not found');
                }
                // Create backup snapshot before restoring
                if (createBackup) {
                    yield this.createSnapshot(report._id.toString(), userId, 'manual', `Backup before restoring to version ${snapshot.version}`, true);
                }
                // Restore data from snapshot
                if (snapshot.snapshotData) {
                    report.reportData = snapshot.snapshotData.reportData;
                    report.metadata = Object.assign(Object.assign(Object.assign({}, report.metadata), snapshot.snapshotData.metadata), { 
                        // Preserve current workflow and regeneration tracking
                        workflowHistory: report.metadata.workflowHistory, regenerationAttempts: report.metadata.regenerationAttempts, lastRegenerationAttempt: report.metadata.lastRegenerationAttempt });
                    report.filters = snapshot.snapshotData.filters;
                    report.title = snapshot.snapshotData.title;
                    report.description = snapshot.snapshotData.description || undefined;
                    report.lastUpdatedBy = new mongoose_1.default.Types.ObjectId(userId);
                }
                // Add workflow history entry
                report.addWorkflowHistory(report.status, report.status, new mongoose_1.default.Types.ObjectId(userId), `Restored from snapshot version ${snapshot.version}`);
                yield report.save();
                return report;
            }
            catch (error) {
                console.error('Error restoring from snapshot:', error);
                throw new Error(`Failed to restore from snapshot: ${error}`);
            }
        });
    }
    /**
     * Delete old snapshots based on retention policy
     */
    static cleanupOldSnapshots(reportId_1) {
        return __awaiter(this, arguments, void 0, function* (reportId, retentionDays = 365, maxSnapshots = 50) {
            try {
                const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));
                let query = {
                    'snapshotMetadata.createdAt': { $lt: cutoffDate }
                };
                if (reportId) {
                    query.reportId = reportId;
                }
                // Always preserve manual and approval snapshots
                query.snapshotType = { $in: ['automatic', 'scheduled'] };
                // Find snapshots to delete, but preserve the most recent ones
                const allSnapshots = yield ReportSnapshot.find(reportId ? { reportId } : {}, '_id snapshotMetadata.createdAt snapshotType').sort({ 'snapshotMetadata.createdAt': -1 });
                // Group by report and determine which to delete
                const snapshotsToDelete = [];
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
                        .filter((s) => ['automatic', 'scheduled'].includes(s.snapshotType) &&
                        s.snapshotMetadata.createdAt < cutoffDate)
                        .slice(maxSnapshots); // Keep first maxSnapshots, delete the rest
                    snapshotsToDelete.push(...eligibleForDeletion.map((s) => s._id.toString()));
                });
                // Delete the identified snapshots
                const deleteResult = yield ReportSnapshot.deleteMany({
                    _id: { $in: snapshotsToDelete }
                });
                return {
                    deletedCount: deleteResult.deletedCount || 0,
                    preservedCount: allSnapshots.length - (deleteResult.deletedCount || 0)
                };
            }
            catch (error) {
                console.error('Error cleaning up snapshots:', error);
                throw new Error(`Failed to cleanup snapshots: ${error}`);
            }
        });
    }
    // Private helper methods
    static calculateChangesSummary(oldData, newData) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const fieldsChanged = [];
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
            }
            catch (error) {
                console.error('Error calculating changes summary:', error);
                return {
                    fieldsChanged: [],
                    recordsAdded: 0,
                    recordsModified: 0,
                    recordsRemoved: 0,
                    significantChanges: false
                };
            }
        });
    }
    static performDeepComparison(oldData, newData) {
        const differences = {
            fieldChanges: [],
            dataChanges: {
                recordsAdded: [],
                recordsModified: [],
                recordsRemoved: []
            },
            metadataChanges: []
        };
        // Simple implementation - can be enhanced with more sophisticated diff algorithms
        this.compareObjects('', oldData, newData, differences.fieldChanges);
        return differences;
    }
    static compareObjects(path, oldObj, newObj, changes) {
        const oldKeys = oldObj ? Object.keys(oldObj) : [];
        const newKeys = newObj ? Object.keys(newObj) : [];
        const allKeys = [...new Set([...oldKeys, ...newKeys])];
        allKeys.forEach(key => {
            const currentPath = path ? `${path}.${key}` : key;
            const oldValue = oldObj === null || oldObj === void 0 ? void 0 : oldObj[key];
            const newValue = newObj === null || newObj === void 0 ? void 0 : newObj[key];
            if (oldValue === undefined && newValue !== undefined) {
                changes.push({
                    field: key,
                    path: currentPath,
                    oldValue: undefined,
                    newValue,
                    changeType: 'added'
                });
            }
            else if (oldValue !== undefined && newValue === undefined) {
                changes.push({
                    field: key,
                    path: currentPath,
                    oldValue,
                    newValue: undefined,
                    changeType: 'removed'
                });
            }
            else if (oldValue !== newValue) {
                if (typeof oldValue === 'object' && typeof newValue === 'object' &&
                    oldValue !== null && newValue !== null) {
                    // Recursively compare objects
                    this.compareObjects(currentPath, oldValue, newValue, changes);
                }
                else {
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
    static calculateChangeScore(differences) {
        const fieldChanges = differences.fieldChanges.length;
        const recordChanges = differences.dataChanges.recordsAdded.length +
            differences.dataChanges.recordsModified.length +
            differences.dataChanges.recordsRemoved.length;
        // Simple scoring algorithm - can be enhanced
        const baseScore = Math.min((fieldChanges * 10) + (recordChanges * 5), 100);
        return Math.round(baseScore);
    }
    static calculateStringSimilarity(str1, str2) {
        if (str1 === str2)
            return 1;
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        if (longer.length === 0)
            return 1;
        const distance = this.levenshteinDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
    }
    static levenshteinDistance(str1, str2) {
        const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
        for (let i = 0; i <= str1.length; i++)
            matrix[0][i] = i;
        for (let j = 0; j <= str2.length; j++)
            matrix[j][0] = j;
        for (let j = 1; j <= str2.length; j++) {
            for (let i = 1; i <= str1.length; i++) {
                const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(matrix[j][i - 1] + 1, matrix[j - 1][i] + 1, matrix[j - 1][i - 1] + substitutionCost);
            }
        }
        return matrix[str2.length][str1.length];
    }
}
exports.ReportSnapshotService = ReportSnapshotService;
exports.default = ReportSnapshotService;
//# sourceMappingURL=reportSnapshot.service.js.map