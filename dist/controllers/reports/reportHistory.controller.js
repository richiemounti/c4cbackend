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
exports.cleanupOldData = exports.getReportVersionHistory = exports.logCustomActivity = exports.getCollaborationAnalytics = exports.endCollaboration = exports.trackCollaboration = exports.endUserSession = exports.startUserSession = exports.getUserActivitySummary = exports.getReportActivity = exports.restoreFromSnapshot = exports.compareSnapshots = exports.getSnapshotById = exports.getReportSnapshots = exports.createReportSnapshot = void 0;
const reportSnapshot_service_1 = __importDefault(require("../../services/reports/reportSnapshot.service"));
const userActivityTracking_service_1 = __importDefault(require("../../services/reports/userActivityTracking.service"));
// Type guard for authenticated user
function isUserAuthenticated(req) {
    return req.user !== undefined;
}
/**
 * Create manual snapshot of a report
 * @route POST /api/v1/reports/:reportId/snapshots
 * @access Private
 */
const createReportSnapshot = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { reportId } = req.params;
        const { reason, forceSnapshot = false } = req.body;
        if (!reason) {
            const error = new Error('Reason for snapshot is required');
            error.statusCode = 400;
            throw error;
        }
        const snapshot = yield reportSnapshot_service_1.default.createSnapshot(reportId, req.user._id.toString(), 'manual', reason, forceSnapshot);
        // Log the activity
        yield userActivityTracking_service_1.default.logActivity(reportId, req.user._id.toString(), 'edit', 'snapshot_created', {
            description: `Manual snapshot created: ${reason}`,
            metadata: { snapshotId: snapshot._id },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });
        res.status(201).json({
            success: true,
            message: 'Report snapshot created successfully',
            data: snapshot
        });
    }
    catch (error) {
        next(error);
    }
});
exports.createReportSnapshot = createReportSnapshot;
/**
 * Get snapshots for a report
 * @route GET /api/v1/reports/:reportId/snapshots
 * @access Private
 */
const getReportSnapshots = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { reportId } = req.params;
        const { page = '1', limit = '10', snapshotType, fromDate, toDate } = req.query;
        const options = {
            page: parseInt(page),
            limit: parseInt(limit)
        };
        if (snapshotType)
            options.snapshotType = snapshotType;
        if (fromDate)
            options.fromDate = new Date(fromDate);
        if (toDate)
            options.toDate = new Date(toDate);
        const result = yield reportSnapshot_service_1.default.getReportSnapshots(reportId, options);
        // Log view activity
        yield userActivityTracking_service_1.default.logActivity(reportId, req.user._id.toString(), 'view', 'snapshots_viewed', {
            description: 'Viewed report snapshots',
            metadata: { page: options.page, limit: options.limit },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });
        res.status(200).json({
            success: true,
            data: result
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getReportSnapshots = getReportSnapshots;
/**
 * Get specific snapshot by ID
 * @route GET /api/v1/reports/snapshots/:snapshotId
 * @access Private
 */
const getSnapshotById = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { snapshotId } = req.params;
        const snapshot = yield reportSnapshot_service_1.default.getSnapshotById(snapshotId);
        if (!snapshot) {
            const error = new Error('Snapshot not found');
            error.statusCode = 404;
            throw error;
        }
        // Log view activity
        yield userActivityTracking_service_1.default.logActivity(snapshot.reportId.toString(), req.user._id.toString(), 'view', 'snapshot_viewed', {
            description: `Viewed snapshot version ${snapshot.version}`,
            metadata: { snapshotId: snapshot._id },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });
        res.status(200).json({
            success: true,
            data: snapshot
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getSnapshotById = getSnapshotById;
/**
 * Compare two snapshots
 * @route GET /api/v1/reports/snapshots/:fromSnapshotId/compare/:toSnapshotId
 * @access Private
 */
const compareSnapshots = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { fromSnapshotId, toSnapshotId } = req.params;
        const comparison = yield reportSnapshot_service_1.default.compareSnapshots(fromSnapshotId, toSnapshotId);
        // Log comparison activity
        const reportId = comparison.fromSnapshot.id; // Assuming they're from same report
        yield userActivityTracking_service_1.default.logActivity(reportId, req.user._id.toString(), 'view', 'snapshots_compared', {
            description: `Compared snapshots v${comparison.fromSnapshot.version} and v${comparison.toSnapshot.version}`,
            metadata: {
                fromSnapshotId,
                toSnapshotId,
                totalChanges: comparison.summary.totalChanges
            },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });
        res.status(200).json({
            success: true,
            data: comparison
        });
    }
    catch (error) {
        next(error);
    }
});
exports.compareSnapshots = compareSnapshots;
/**
 * Restore report from snapshot
 * @route POST /api/v1/reports/snapshots/:snapshotId/restore
 * @access Private
 */
const restoreFromSnapshot = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { snapshotId } = req.params;
        const { createBackup = true } = req.body;
        const restoredReport = yield reportSnapshot_service_1.default.restoreFromSnapshot(snapshotId, req.user._id.toString(), createBackup);
        // Log restore activity
        yield userActivityTracking_service_1.default.logActivity(restoredReport._id.toString(), req.user._id.toString(), 'restore', 'report_restored', {
            description: `Restored report from snapshot`,
            metadata: {
                snapshotId,
                createBackup
            },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });
        res.status(200).json({
            success: true,
            message: 'Report restored from snapshot successfully',
            data: {
                reportId: restoredReport._id,
                restoredAt: new Date(),
                backupCreated: createBackup
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.restoreFromSnapshot = restoreFromSnapshot;
/**
 * Get report activity history
 * @route GET /api/v1/reports/:reportId/activity
 * @access Private
 */
const getReportActivity = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { reportId } = req.params;
        const { userId, activityTypes, fromDate, toDate, page = '1', limit = '20' } = req.query;
        const options = {
            page: parseInt(page),
            limit: parseInt(limit)
        };
        if (userId)
            options.userId = userId;
        if (activityTypes) {
            options.activityTypes = activityTypes.split(',');
        }
        if (fromDate)
            options.fromDate = new Date(fromDate);
        if (toDate)
            options.toDate = new Date(toDate);
        const result = yield userActivityTracking_service_1.default.getReportActivity(reportId, options);
        // Log the view activity (but don't create infinite loop)
        if (req.query.logActivity !== 'false') {
            yield userActivityTracking_service_1.default.logActivity(reportId, req.user._id.toString(), 'view', 'activity_history_viewed', {
                description: 'Viewed report activity history',
                metadata: {
                    filters: options,
                    resultCount: result.activities.length
                },
                ipAddress: req.ip,
                userAgent: req.get('User-Agent')
            });
        }
        res.status(200).json({
            success: true,
            data: result
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getReportActivity = getReportActivity;
/**
 * Get user activity summary
 * @route GET /api/v1/reports/activity/user/:userId/summary
 * @access Private
 */
const getUserActivitySummary = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { userId } = req.params;
        const { reportId, fromDate, toDate } = req.query;
        // Check if user can access this data (either self or admin)
        const isOwnData = userId === req.user._id.toString();
        const isAdmin = req.user.isConnectGoStaff || ['admin', 'manager'].includes(req.user.primaryRole || '');
        if (!isOwnData && !isAdmin) {
            const error = new Error('Not authorized to view this user activity');
            error.statusCode = 403;
            throw error;
        }
        const options = {};
        if (reportId)
            options.reportId = reportId;
        if (fromDate)
            options.fromDate = new Date(fromDate);
        if (toDate)
            options.toDate = new Date(toDate);
        const summary = yield userActivityTracking_service_1.default.getUserActivitySummary(userId, options);
        res.status(200).json({
            success: true,
            data: summary
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getUserActivitySummary = getUserActivitySummary;
/**
 * Start tracking user session
 * @route POST /api/v1/reports/:reportId/session/start
 * @access Private
 */
const startUserSession = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { reportId } = req.params;
        const { sessionId } = req.body;
        if (!sessionId) {
            const error = new Error('Session ID is required');
            error.statusCode = 400;
            throw error;
        }
        const session = yield userActivityTracking_service_1.default.startSession(reportId, req.user._id.toString(), sessionId);
        // Log session start
        yield userActivityTracking_service_1.default.logActivity(reportId, req.user._id.toString(), 'view', 'session_started', {
            description: 'User session started',
            sessionId,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });
        res.status(200).json({
            success: true,
            message: 'Session started successfully',
            data: session
        });
    }
    catch (error) {
        next(error);
    }
});
exports.startUserSession = startUserSession;
/**
 * End user session
 * @route POST /api/v1/reports/session/:sessionId/end
 * @access Private
 */
const endUserSession = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { sessionId } = req.params;
        yield userActivityTracking_service_1.default.endSession(sessionId);
        res.status(200).json({
            success: true,
            message: 'Session ended successfully'
        });
    }
    catch (error) {
        next(error);
    }
});
exports.endUserSession = endUserSession;
/**
 * Track collaboration event
 * @route POST /api/v1/reports/:reportId/collaboration
 * @access Private
 */
const trackCollaboration = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { reportId } = req.params;
        const { eventType, participants } = req.body;
        if (!eventType || !participants || !Array.isArray(participants)) {
            const error = new Error('Event type and participants array are required');
            error.statusCode = 400;
            throw error;
        }
        const collaborationEvent = yield userActivityTracking_service_1.default.trackCollaboration(reportId, eventType, participants);
        res.status(201).json({
            success: true,
            message: 'Collaboration event tracked successfully',
            data: collaborationEvent
        });
    }
    catch (error) {
        next(error);
    }
});
exports.trackCollaboration = trackCollaboration;
/**
 * End collaboration event
 * @route PUT /api/v1/reports/collaboration/:collaborationEventId/end
 * @access Private
 */
const endCollaboration = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { collaborationEventId } = req.params;
        const { summary } = req.body;
        yield userActivityTracking_service_1.default.endCollaboration(collaborationEventId, summary);
        res.status(200).json({
            success: true,
            message: 'Collaboration event ended successfully'
        });
    }
    catch (error) {
        next(error);
    }
});
exports.endCollaboration = endCollaboration;
/**
 * Get collaboration analytics for a report
 * @route GET /api/v1/reports/:reportId/collaboration/analytics
 * @access Private
 */
const getCollaborationAnalytics = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { reportId } = req.params;
        const { fromDate, toDate } = req.query;
        const options = {};
        if (fromDate)
            options.fromDate = new Date(fromDate);
        if (toDate)
            options.toDate = new Date(toDate);
        const analytics = yield userActivityTracking_service_1.default.getCollaborationAnalytics(reportId, options);
        res.status(200).json({
            success: true,
            data: analytics
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getCollaborationAnalytics = getCollaborationAnalytics;
/**
 * Log custom user activity
 * @route POST /api/v1/reports/:reportId/activity/log
 * @access Private
 */
const logCustomActivity = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { reportId } = req.params;
        const { activityType, action, description, metadata, duration, sessionId } = req.body;
        if (!activityType || !action) {
            const error = new Error('Activity type and action are required');
            error.statusCode = 400;
            throw error;
        }
        const validActivityTypes = ['view', 'edit', 'export', 'share', 'approve', 'comment', 'restore'];
        if (!validActivityTypes.includes(activityType)) {
            const error = new Error(`Invalid activity type. Must be one of: ${validActivityTypes.join(', ')}`);
            error.statusCode = 400;
            throw error;
        }
        const activity = yield userActivityTracking_service_1.default.logActivity(reportId, req.user._id.toString(), activityType, action, {
            description,
            metadata,
            duration,
            sessionId,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        });
        res.status(201).json({
            success: true,
            message: 'Activity logged successfully',
            data: activity
        });
    }
    catch (error) {
        next(error);
    }
});
exports.logCustomActivity = logCustomActivity;
/**
 * Get report version history (snapshots with comparison data)
 * @route GET /api/v1/reports/:reportId/versions
 * @access Private
 */
const getReportVersionHistory = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { reportId } = req.params;
        const { limit = '10' } = req.query;
        // Get recent snapshots
        const snapshotsResult = yield reportSnapshot_service_1.default.getReportSnapshots(reportId, {
            limit: parseInt(limit),
            page: 1
        });
        // Enhance with comparison summaries
        const versionsWithChanges = yield Promise.all(snapshotsResult.snapshots.map((snapshot, index) => __awaiter(void 0, void 0, void 0, function* () {
            let changesSummary = null;
            // Compare with previous version if exists
            if (index < snapshotsResult.snapshots.length - 1) {
                const previousSnapshot = snapshotsResult.snapshots[index + 1];
                try {
                    const comparison = yield reportSnapshot_service_1.default.compareSnapshots(previousSnapshot._id.toString(), snapshot._id.toString());
                    changesSummary = comparison.summary;
                }
                catch (error) {
                    // Don't fail if comparison fails, just skip it
                    console.warn('Failed to compare snapshots:', error);
                }
            }
            return Object.assign(Object.assign({}, snapshot), { changesSummary });
        })));
        res.status(200).json({
            success: true,
            data: {
                versions: versionsWithChanges,
                pagination: snapshotsResult.pagination
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getReportVersionHistory = getReportVersionHistory;
/**
 * Cleanup old snapshots and activity logs
 * @route DELETE /api/v1/reports/cleanup
 * @access Private (Admin only)
 */
const cleanupOldData = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        // Check admin permissions
        if (!req.user.isConnectGoStaff && !['admin'].includes(req.user.primaryRole || '')) {
            const error = new Error('Admin privileges required');
            error.statusCode = 403;
            throw error;
        }
        const { snapshotRetentionDays = 365, activityRetentionDays = 365, maxSnapshotsPerReport = 50, reportId } = req.body;
        // Run cleanup operations in parallel
        const [snapshotCleanup, activityCleanup] = yield Promise.all([
            reportSnapshot_service_1.default.cleanupOldSnapshots(reportId, snapshotRetentionDays, maxSnapshotsPerReport),
            userActivityTracking_service_1.default.cleanupOldActivity(activityRetentionDays)
        ]);
        res.status(200).json({
            success: true,
            message: 'Cleanup completed successfully',
            data: {
                snapshots: {
                    deleted: snapshotCleanup.deletedCount,
                    preserved: snapshotCleanup.preservedCount
                },
                activity: {
                    activitiesDeleted: activityCleanup.activitiesDeleted,
                    sessionsDeleted: activityCleanup.sessionsDeleted,
                    collaborationEventsDeleted: activityCleanup.collaborationEventsDeleted
                },
                totalRecordsProcessed: snapshotCleanup.deletedCount +
                    snapshotCleanup.preservedCount +
                    activityCleanup.activitiesDeleted +
                    activityCleanup.sessionsDeleted +
                    activityCleanup.collaborationEventsDeleted
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.cleanupOldData = cleanupOldData;
//# sourceMappingURL=reportHistory.controller.js.map