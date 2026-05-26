// middlewares/reportActivity.middleware.ts
import { Request, Response, NextFunction } from "express";
import UserActivityTrackingService from "../services/reports/userActivityTracking.service";

// Extended request interface to include activity tracking
// Replace the ActivityTrackingRequest interface with:
interface ActivityTrackingRequest extends Omit<Request, 'user'> {
  user?: {
    _id: any;
    primaryRole?: string;
    isConnectGoStaff?: boolean;
  };
  startTime?: number;
  activityLogged?: boolean;
  sessionID?: string;
}

/**
 * Middleware to automatically track report views and interactions
 */
export const trackReportActivity = (
  activityType: 'view' | 'edit' | 'export' | 'share' | 'approve' | 'comment' | 'restore' = 'view',
  actionName?: string
) => {
  return async (req: ActivityTrackingRequest, res: Response, next: NextFunction) => {
    try {
      // Skip if user is not authenticated
      if (!req.user?._id) {
        return next();
      }

      // Extract reportId from various possible locations
      const reportId = req.params.reportId || 
                      req.params.id || 
                      req.body.reportId ||
                      req.query.reportId;

      if (!reportId) {
        return next();
      }

      // Record start time for duration tracking
      req.startTime = Date.now();

      // Default action name based on HTTP method and route
      const defaultAction = actionName || `${req.method.toLowerCase()}_${activityType}`;

      // Log the activity after response is sent
      res.on('finish', async () => {
        try {
          // Skip if already logged or if it's an error response
          if (req.activityLogged || res.statusCode >= 400) {
            return;
          }

          // Calculate duration
          const duration = req.startTime ? Date.now() - req.startTime : undefined;

          // Determine description based on the endpoint
          let description = `${req.method} ${req.path}`;
          
          // Enhanced descriptions for specific endpoints
          if (req.path.includes('/snapshots')) {
            description = 'Viewed report snapshots';
          } else if (req.path.includes('/activity')) {
            description = 'Viewed report activity';
          } else if (req.path.includes('/versions')) {
            description = 'Viewed report version history';
          } else if (req.path.includes('/export')) {
            description = 'Exported report';
            activityType = 'export';
          }

          await UserActivityTrackingService.logActivity(
            reportId,
            req.user!._id.toString(),
            activityType,
            defaultAction,
            {
              description,
              metadata: {
                method: req.method,
                path: req.path,
                statusCode: res.statusCode,
                responseSize: res.get('Content-Length'),
                query: req.query
              },
              duration,
              ipAddress: req.ip,
              userAgent: req.get('User-Agent'),
              sessionId: req.get('X-Session-ID') || req.sessionID,
              source: req.get('X-Client-Source') as any || 'web',
              referrer: req.get('Referer'),
              location: req.get('X-User-Location')
            }
          );

          req.activityLogged = true;

        } catch (error) {
          // Don't fail the request if activity logging fails
          console.error('Failed to log activity:', error);
        }
      });

      next();

    } catch (error) {
      // Don't fail the request if activity tracking setup fails
      console.error('Failed to setup activity tracking:', error);
      next();
    }
  };
};

/**
 * Middleware to track session start/heartbeat
 */
export const trackSession = () => {
  return async (req: ActivityTrackingRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?._id) {
        return next();
      }

      const reportId = req.params.reportId || req.params.id;
      const sessionId = req.get('X-Session-ID') || req.sessionID;

      if (reportId && sessionId) {
        // Start or update session (non-blocking)
        UserActivityTrackingService.startSession(
          reportId,
          req.user._id.toString(),
          sessionId
        ).catch(error => {
          console.error('Failed to track session:', error);
        });
      }

      next();

    } catch (error) {
      console.error('Failed to setup session tracking:', error);
      next();
    }
  };
};

/**
 * Middleware to automatically create snapshots on significant changes
 */
export const autoSnapshot = (
  trigger: 'approval' | 'status_change' | 'major_edit' = 'status_change'
) => {
  return async (req: ActivityTrackingRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?._id) {
        return next();
      }

      const reportId = req.params.reportId || req.params.id;
      
      if (!reportId) {
        return next();
      }

      // Create snapshot after successful response
      res.on('finish', async () => {
        try {
          // Only create snapshot for successful requests
          if (res.statusCode >= 200 && res.statusCode < 300) {
            
            let reason = '';
            let snapshotType: 'automatic' | 'approval' = 'automatic';

            switch (trigger) {
              case 'approval':
                reason = 'Automatic snapshot on approval';
                snapshotType = 'approval';
                break;
              case 'status_change':
                reason = 'Automatic snapshot on status change';
                break;
              case 'major_edit':
                reason = 'Automatic snapshot on major edit';
                break;
            }

            // Import here to avoid circular dependencies
            const { default: ReportSnapshotService } = await import('../services/reports/reportSnapshot.service');
            
            await ReportSnapshotService.createSnapshot(
              reportId,
              req.user!._id.toString(),
              snapshotType,
              reason,
              false // Don't force if no changes
            );

          }
        } catch (error) {
          // Don't fail the request if snapshot creation fails
          console.error('Failed to create automatic snapshot:', error);
        }
      });

      next();

    } catch (error) {
      console.error('Failed to setup auto snapshot:', error);
      next();
    }
  };
};

/**
 * Middleware to track export activities with enhanced metadata
 */
export const trackExportActivity = () => {
  return async (req: ActivityTrackingRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user?._id) {
        return next();
      }

      const reportId = req.params.reportId || req.params.id;
      
      if (!reportId) {
        return next();
      }

      // Track export completion
      res.on('finish', async () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const format = req.query.format || req.body.format || 'unknown';
            const fileSize = res.get('Content-Length');

            await UserActivityTrackingService.logActivity(
              reportId,
              req.user!._id.toString(),
              'export',
              `export_${format}`,
              {
                description: `Exported report as ${format}`,
                metadata: {
                  format,
                  fileSize: fileSize ? parseInt(fileSize) : undefined,
                  exportOptions: req.body.options || req.query
                },
                duration: req.startTime ? Date.now() - req.startTime : undefined,
                ipAddress: req.ip,
                userAgent: req.get('User-Agent'),
                sessionId: req.get('X-Session-ID') || req.sessionID
              }
            );

            // Also update report's export history
            const Report = (await import('../models/report.model')).default;
            const report = await Report.findById(reportId);
            if (report) {
              report.addExportRecord(
                format as string,
                req.user!._id,
                fileSize ? parseInt(fileSize) : undefined
              );
              await report.save();
            }
          }
        } catch (error) {
          console.error('Failed to track export activity:', error);
        }
      });

      next();

    } catch (error) {
      console.error('Failed to setup export tracking:', error);
      next();
    }
  };
};

export default {
  trackReportActivity,
  trackSession,
  autoSnapshot,
  trackExportActivity
};