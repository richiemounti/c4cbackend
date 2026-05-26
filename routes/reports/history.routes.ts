// routes/reports/history.routes.ts
import { Router } from "express";
import {
  createReportSnapshot,
  getReportSnapshots,
  getSnapshotById,
  compareSnapshots,
  restoreFromSnapshot,
  getReportActivity,
  getUserActivitySummary,
  startUserSession,
  endUserSession,
  trackCollaboration,
  endCollaboration,
  getCollaborationAnalytics,
  logCustomActivity,
  cleanupOldData,
  getReportVersionHistory
} from "../../controllers/reports/reportHistory.controller";
import authorize from "../../middlewares/auth.middleware";
import { validateObjectId } from "../../middlewares/validation.middleware";

const historyRouter = Router();

// Snapshot management routes
historyRouter.post(
  '/:reportId/snapshots',
  authorize,
  validateObjectId('reportId'),
  createReportSnapshot
);

historyRouter.get(
  '/:reportId/snapshots',
  authorize,
  validateObjectId('reportId'),
  getReportSnapshots
);

historyRouter.get(
  '/snapshots/:snapshotId',
  authorize,
  validateObjectId('snapshotId'),
  getSnapshotById
);

historyRouter.get(
  '/snapshots/:fromSnapshotId/compare/:toSnapshotId',
  authorize,
  validateObjectId('fromSnapshotId'),
  validateObjectId('toSnapshotId'),
  compareSnapshots
);

historyRouter.post(
  '/snapshots/:snapshotId/restore',
  authorize,
  validateObjectId('snapshotId'),
  restoreFromSnapshot
);

// Version history (enhanced snapshots view)
historyRouter.get(
  '/:reportId/versions',
  authorize,
  validateObjectId('reportId'),
  getReportVersionHistory
);

// Activity tracking routes
historyRouter.get(
  '/:reportId/activity',
  authorize,
  validateObjectId('reportId'),
  getReportActivity
);

historyRouter.post(
  '/:reportId/activity/log',
  authorize,
  validateObjectId('reportId'),
  logCustomActivity
);

historyRouter.get(
  '/activity/user/:userId/summary',
  authorize,
  validateObjectId('userId'),
  getUserActivitySummary
);

// Session management routes
historyRouter.post(
  '/:reportId/session/start',
  authorize,
  validateObjectId('reportId'),
  startUserSession
);

historyRouter.post(
  '/session/:sessionId/end',
  authorize,
  endUserSession
);

// Collaboration tracking routes
historyRouter.post(
  '/:reportId/collaboration',
  authorize,
  validateObjectId('reportId'),
  trackCollaboration
);

historyRouter.put(
  '/collaboration/:collaborationEventId/end',
  authorize,
  validateObjectId('collaborationEventId'),
  endCollaboration
);

historyRouter.get(
  '/:reportId/collaboration/analytics',
  authorize,
  validateObjectId('reportId'),
  getCollaborationAnalytics
);

// Admin routes
historyRouter.delete(
  '/cleanup',
  authorize,
  cleanupOldData
);

export default historyRouter;