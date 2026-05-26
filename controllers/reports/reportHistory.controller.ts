// controllers/reports/reportHistory.controller.ts
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { CustomError } from "../../middlewares/error.middleware";
import ReportSnapshotService from "../../services/reports/reportSnapshot.service";
import UserActivityTrackingService from "../../services/reports/userActivityTracking.service";

// Type guard for authenticated user
function isUserAuthenticated(req: Request): req is Request & { 
  user: { 
    _id: mongoose.Types.ObjectId; 
    primaryRole?: string;
    isConnectGoStaff?: boolean;
  } 
} {
  return req.user !== undefined;
}

/**
 * Create manual snapshot of a report
 * @route POST /api/v1/reports/:reportId/snapshots
 * @access Private
 */
export const createReportSnapshot = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { reportId } = req.params;
    const { reason, forceSnapshot = false } = req.body;

    if (!reason) {
      const error = new Error('Reason for snapshot is required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const snapshot = await ReportSnapshotService.createSnapshot(
      reportId,
      req.user._id.toString(),
      'manual',
      reason,
      forceSnapshot
    );

    // Log the activity
    await UserActivityTrackingService.logActivity(
      reportId,
      req.user._id.toString(),
      'edit',
      'snapshot_created',
      {
        description: `Manual snapshot created: ${reason}`,
        metadata: { snapshotId: snapshot._id },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    );

    res.status(201).json({
      success: true,
      message: 'Report snapshot created successfully',
      data: snapshot
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get snapshots for a report
 * @route GET /api/v1/reports/:reportId/snapshots
 * @access Private
 */
export const getReportSnapshots = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { reportId } = req.params;
    const {
      page = '1',
      limit = '10',
      snapshotType,
      fromDate,
      toDate
    } = req.query;

    const options: any = {
      page: parseInt(page as string),
      limit: parseInt(limit as string)
    };

    if (snapshotType) options.snapshotType = snapshotType;
    if (fromDate) options.fromDate = new Date(fromDate as string);
    if (toDate) options.toDate = new Date(toDate as string);

    const result = await ReportSnapshotService.getReportSnapshots(reportId, options);

    // Log view activity
    await UserActivityTrackingService.logActivity(
      reportId,
      req.user._id.toString(),
      'view',
      'snapshots_viewed',
      {
        description: 'Viewed report snapshots',
        metadata: { page: options.page, limit: options.limit },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    );

    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get specific snapshot by ID
 * @route GET /api/v1/reports/snapshots/:snapshotId
 * @access Private
 */
export const getSnapshotById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { snapshotId } = req.params;

    const snapshot = await ReportSnapshotService.getSnapshotById(snapshotId);
    if (!snapshot) {
      const error = new Error('Snapshot not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Log view activity
    await UserActivityTrackingService.logActivity(
      snapshot.reportId.toString(),
      req.user._id.toString(),
      'view',
      'snapshot_viewed',
      {
        description: `Viewed snapshot version ${snapshot.version}`,
        metadata: { snapshotId: snapshot._id },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    );

    res.status(200).json({
      success: true,
      data: snapshot
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Compare two snapshots
 * @route GET /api/v1/reports/snapshots/:fromSnapshotId/compare/:toSnapshotId
 * @access Private
 */
export const compareSnapshots = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { fromSnapshotId, toSnapshotId } = req.params;

    const comparison = await ReportSnapshotService.compareSnapshots(
      fromSnapshotId,
      toSnapshotId
    );

    // Log comparison activity
    const reportId = comparison.fromSnapshot.id; // Assuming they're from same report
    await UserActivityTrackingService.logActivity(
      reportId,
      req.user._id.toString(),
      'view',
      'snapshots_compared',
      {
        description: `Compared snapshots v${comparison.fromSnapshot.version} and v${comparison.toSnapshot.version}`,
        metadata: { 
          fromSnapshotId, 
          toSnapshotId,
          totalChanges: comparison.summary.totalChanges
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    );

    res.status(200).json({
      success: true,
      data: comparison
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Restore report from snapshot
 * @route POST /api/v1/reports/snapshots/:snapshotId/restore
 * @access Private
 */
export const restoreFromSnapshot = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { snapshotId } = req.params;
    const { createBackup = true } = req.body;

    const restoredReport = await ReportSnapshotService.restoreFromSnapshot(
      snapshotId,
      req.user._id.toString(),
      createBackup
    );

    // Log restore activity
    await UserActivityTrackingService.logActivity(
        (restoredReport._id as mongoose.Types.ObjectId).toString(),
        req.user._id.toString(),
        'restore',
        'report_restored',
        {
            description: `Restored report from snapshot`,
            metadata: { 
            snapshotId,
            createBackup
            },
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
        }
    );

    res.status(200).json({
      success: true,
      message: 'Report restored from snapshot successfully',
      data: {
        reportId: restoredReport._id,
        restoredAt: new Date(),
        backupCreated: createBackup
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get report activity history
 * @route GET /api/v1/reports/:reportId/activity
 * @access Private
 */
export const getReportActivity = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { reportId } = req.params;
    const {
      userId,
      activityTypes,
      fromDate,
      toDate,
      page = '1',
      limit = '20'
    } = req.query;

    const options: any = {
      page: parseInt(page as string),
      limit: parseInt(limit as string)
    };

    if (userId) options.userId = userId as string;
    if (activityTypes) {
      options.activityTypes = (activityTypes as string).split(',');
    }
    if (fromDate) options.fromDate = new Date(fromDate as string);
    if (toDate) options.toDate = new Date(toDate as string);

    const result = await UserActivityTrackingService.getReportActivity(reportId, options);

    // Log the view activity (but don't create infinite loop)
    if (req.query.logActivity !== 'false') {
      await UserActivityTrackingService.logActivity(
        reportId,
        req.user._id.toString(),
        'view',
        'activity_history_viewed',
        {
          description: 'Viewed report activity history',
          metadata: { 
            filters: options,
            resultCount: result.activities.length
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent')
        }
      );
    }

    res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get user activity summary
 * @route GET /api/v1/reports/activity/user/:userId/summary
 * @access Private
 */
export const getUserActivitySummary = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { userId } = req.params;
    const {
      reportId,
      fromDate,
      toDate
    } = req.query;

    // Check if user can access this data (either self or admin)
    const isOwnData = userId === req.user._id.toString();
    const isAdmin = req.user.isConnectGoStaff || ['admin', 'manager'].includes(req.user.primaryRole || '');

    if (!isOwnData && !isAdmin) {
      const error = new Error('Not authorized to view this user activity') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const options: any = {};
    if (reportId) options.reportId = reportId as string;
    if (fromDate) options.fromDate = new Date(fromDate as string);
    if (toDate) options.toDate = new Date(toDate as string);

    const summary = await UserActivityTrackingService.getUserActivitySummary(userId, options);

    res.status(200).json({
      success: true,
      data: summary
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Start tracking user session
 * @route POST /api/v1/reports/:reportId/session/start
 * @access Private
 */
export const startUserSession = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { reportId } = req.params;
    const { sessionId } = req.body;

    if (!sessionId) {
      const error = new Error('Session ID is required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const session = await UserActivityTrackingService.startSession(
      reportId,
      req.user._id.toString(),
      sessionId
    );

    // Log session start
    await UserActivityTrackingService.logActivity(
      reportId,
      req.user._id.toString(),
      'view',
      'session_started',
      {
        description: 'User session started',
        sessionId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    );

    res.status(200).json({
      success: true,
      message: 'Session started successfully',
      data: session
    });

  } catch (error) {
    next(error);
  }
};

/**
 * End user session
 * @route POST /api/v1/reports/session/:sessionId/end
 * @access Private
 */
export const endUserSession = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { sessionId } = req.params;

    await UserActivityTrackingService.endSession(sessionId);

    res.status(200).json({
      success: true,
      message: 'Session ended successfully'
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Track collaboration event
 * @route POST /api/v1/reports/:reportId/collaboration
 * @access Private
 */
export const trackCollaboration = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { reportId } = req.params;
    const { eventType, participants } = req.body;

    if (!eventType || !participants || !Array.isArray(participants)) {
      const error = new Error('Event type and participants array are required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const collaborationEvent = await UserActivityTrackingService.trackCollaboration(
      reportId,
      eventType,
      participants
    );

    res.status(201).json({
      success: true,
      message: 'Collaboration event tracked successfully',
      data: collaborationEvent
    });

  } catch (error) {
    next(error);
  }
};

/**
 * End collaboration event
 * @route PUT /api/v1/reports/collaboration/:collaborationEventId/end
 * @access Private
 */
export const endCollaboration = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { collaborationEventId } = req.params;
    const { summary } = req.body;

    await UserActivityTrackingService.endCollaboration(collaborationEventId, summary);

    res.status(200).json({
      success: true,
      message: 'Collaboration event ended successfully'
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get collaboration analytics for a report
 * @route GET /api/v1/reports/:reportId/collaboration/analytics
 * @access Private
 */
export const getCollaborationAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { reportId } = req.params;
    const { fromDate, toDate } = req.query;

    const options: any = {};
    if (fromDate) options.fromDate = new Date(fromDate as string);
    if (toDate) options.toDate = new Date(toDate as string);

    const analytics = await UserActivityTrackingService.getCollaborationAnalytics(reportId, options);

    res.status(200).json({
      success: true,
      data: analytics
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Log custom user activity
 * @route POST /api/v1/reports/:reportId/activity/log
 * @access Private
 */
export const logCustomActivity = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { reportId } = req.params;
    const {
      activityType,
      action,
      description,
      metadata,
      duration,
      sessionId
    } = req.body;

    if (!activityType || !action) {
      const error = new Error('Activity type and action are required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const validActivityTypes = ['view', 'edit', 'export', 'share', 'approve', 'comment', 'restore'];
    if (!validActivityTypes.includes(activityType)) {
      const error = new Error(`Invalid activity type. Must be one of: ${validActivityTypes.join(', ')}`) as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const activity = await UserActivityTrackingService.logActivity(
      reportId,
      req.user._id.toString(),
      activityType,
      action,
      {
        description,
        metadata,
        duration,
        sessionId,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      }
    );

    res.status(201).json({
      success: true,
      message: 'Activity logged successfully',
      data: activity
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get report version history (snapshots with comparison data)
 * @route GET /api/v1/reports/:reportId/versions
 * @access Private
 */
export const getReportVersionHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { reportId } = req.params;
    const { limit = '10' } = req.query;

    // Get recent snapshots
    const snapshotsResult = await ReportSnapshotService.getReportSnapshots(reportId, {
      limit: parseInt(limit as string),
      page: 1
    });

    // Enhance with comparison summaries
    const versionsWithChanges = await Promise.all(
      snapshotsResult.snapshots.map(async (snapshot, index) => {
        let changesSummary = null;
        
        // Compare with previous version if exists
        if (index < snapshotsResult.snapshots.length - 1) {
          const previousSnapshot = snapshotsResult.snapshots[index + 1];
          try {
            const comparison = await ReportSnapshotService.compareSnapshots(
              previousSnapshot._id.toString(),
              snapshot._id.toString()
            );
            changesSummary = comparison.summary;
          } catch (error) {
            // Don't fail if comparison fails, just skip it
            console.warn('Failed to compare snapshots:', error);
          }
        }

        return {
          ...snapshot,
          changesSummary
        };
      })
    );

    res.status(200).json({
      success: true,
      data: {
        versions: versionsWithChanges,
        pagination: snapshotsResult.pagination
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Cleanup old snapshots and activity logs
 * @route DELETE /api/v1/reports/cleanup
 * @access Private (Admin only)
 */
export const cleanupOldData = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    // Check admin permissions
    if (!req.user.isConnectGoStaff && !['admin'].includes(req.user.primaryRole || '')) {
      const error = new Error('Admin privileges required') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const {
      snapshotRetentionDays = 365,
      activityRetentionDays = 365,
      maxSnapshotsPerReport = 50,
      reportId
    } = req.body;

    // Run cleanup operations in parallel
    const [snapshotCleanup, activityCleanup] = await Promise.all([
      ReportSnapshotService.cleanupOldSnapshots(
        reportId,
        snapshotRetentionDays,
        maxSnapshotsPerReport
      ),
      UserActivityTrackingService.cleanupOldActivity(activityRetentionDays)
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

  } catch (error) {
    next(error);
  }
};