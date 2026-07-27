"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/reports/history.routes.ts
const express_1 = require("express");
const reportHistory_controller_1 = require("../../controllers/reports/reportHistory.controller");
const auth_middleware_1 = __importDefault(require("../../middlewares/auth.middleware"));
const validation_middleware_1 = require("../../middlewares/validation.middleware");
const historyRouter = (0, express_1.Router)();
// Snapshot management routes
historyRouter.post('/:reportId/snapshots', auth_middleware_1.default, (0, validation_middleware_1.validateObjectId)('reportId'), reportHistory_controller_1.createReportSnapshot);
historyRouter.get('/:reportId/snapshots', auth_middleware_1.default, (0, validation_middleware_1.validateObjectId)('reportId'), reportHistory_controller_1.getReportSnapshots);
historyRouter.get('/snapshots/:snapshotId', auth_middleware_1.default, (0, validation_middleware_1.validateObjectId)('snapshotId'), reportHistory_controller_1.getSnapshotById);
historyRouter.get('/snapshots/:fromSnapshotId/compare/:toSnapshotId', auth_middleware_1.default, (0, validation_middleware_1.validateObjectId)('fromSnapshotId'), (0, validation_middleware_1.validateObjectId)('toSnapshotId'), reportHistory_controller_1.compareSnapshots);
historyRouter.post('/snapshots/:snapshotId/restore', auth_middleware_1.default, (0, validation_middleware_1.validateObjectId)('snapshotId'), reportHistory_controller_1.restoreFromSnapshot);
// Version history (enhanced snapshots view)
historyRouter.get('/:reportId/versions', auth_middleware_1.default, (0, validation_middleware_1.validateObjectId)('reportId'), reportHistory_controller_1.getReportVersionHistory);
// Activity tracking routes
historyRouter.get('/:reportId/activity', auth_middleware_1.default, (0, validation_middleware_1.validateObjectId)('reportId'), reportHistory_controller_1.getReportActivity);
historyRouter.post('/:reportId/activity/log', auth_middleware_1.default, (0, validation_middleware_1.validateObjectId)('reportId'), reportHistory_controller_1.logCustomActivity);
historyRouter.get('/activity/user/:userId/summary', auth_middleware_1.default, (0, validation_middleware_1.validateObjectId)('userId'), reportHistory_controller_1.getUserActivitySummary);
// Session management routes
historyRouter.post('/:reportId/session/start', auth_middleware_1.default, (0, validation_middleware_1.validateObjectId)('reportId'), reportHistory_controller_1.startUserSession);
historyRouter.post('/session/:sessionId/end', auth_middleware_1.default, reportHistory_controller_1.endUserSession);
// Collaboration tracking routes
historyRouter.post('/:reportId/collaboration', auth_middleware_1.default, (0, validation_middleware_1.validateObjectId)('reportId'), reportHistory_controller_1.trackCollaboration);
historyRouter.put('/collaboration/:collaborationEventId/end', auth_middleware_1.default, (0, validation_middleware_1.validateObjectId)('collaborationEventId'), reportHistory_controller_1.endCollaboration);
historyRouter.get('/:reportId/collaboration/analytics', auth_middleware_1.default, (0, validation_middleware_1.validateObjectId)('reportId'), reportHistory_controller_1.getCollaborationAnalytics);
// Admin routes
historyRouter.delete('/cleanup', auth_middleware_1.default, reportHistory_controller_1.cleanupOldData);
exports.default = historyRouter;
//# sourceMappingURL=history.routes.js.map