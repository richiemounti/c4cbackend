"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/riskManagement.routes.ts
const express_1 = require("express");
// ✅ UPDATE THE IMPORT (around line 2-14):
const riskManagement_controller_1 = require("../controllers/riskManagement.controller");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const role_middleware_1 = require("../middlewares/role.middleware");
const riskManagementRouter = (0, express_1.Router)();
// Apply authentication middleware to all routes
riskManagementRouter.use(auth_middleware_1.default);
// Risk register summary - accessible to manager, projectCreator, organiser, reviewer
riskManagementRouter.get('/dashboard/risks', 
// Add middleware that allows both hasRole AND isConnectGoStaff
(req, res, next) => {
    var _a;
    if ((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff) {
        return next(); // Admin can access
    }
    return (0, role_middleware_1.hasRole)(['manager', 'projectCreator', 'organiser', 'reviewer'])(req, res, next);
}, riskManagement_controller_1.getRiskRegisterSummary);
// Create new risk - only manager and projectCreator can create
riskManagementRouter.post('/dashboard/risks', (0, role_middleware_1.hasRole)(['manager', 'projectCreator']), riskManagement_controller_1.createRiskItem);
// Get detailed risk information - accessible to manager, projectCreator, organiser, reviewer
riskManagementRouter.get('/dashboard/risks/:riskId', (0, role_middleware_1.hasRole)(['manager', 'projectCreator', 'organiser', 'reviewer']), riskManagement_controller_1.getRiskDetails);
// Update risk item - manager, projectCreator (additional access control handled in controller)
riskManagementRouter.put('/dashboard/risks/:riskId', (0, role_middleware_1.hasRole)(['manager', 'projectCreator', 'organiser', 'reviewer']), // Access control handled in controller
riskManagement_controller_1.updateRiskItem);
// ✅ NEW: Add comment to risk - all roles with risk access
riskManagementRouter.post('/dashboard/risks/:riskId/comments', (0, role_middleware_1.hasRole)(['manager', 'projectCreator', 'organiser', 'reviewer']), riskManagement_controller_1.addComment);
// ✅ NEW: Toggle comment as key insight - all roles with risk access
riskManagementRouter.put('/dashboard/risks/:riskId/comments/:commentId/star', (0, role_middleware_1.hasRole)(['manager', 'projectCreator', 'organiser', 'reviewer']), riskManagement_controller_1.toggleCommentKeyInsight);
// Add mitigation action - manager, projectCreator (additional access control handled in controller)
riskManagementRouter.post('/dashboard/risks/:riskId/mitigation-actions', (0, role_middleware_1.hasRole)(['manager', 'projectCreator', 'organiser', 'reviewer']), // Access control handled in controller
riskManagement_controller_1.addMitigationAction);
// Update mitigation action status - manager, projectCreator, risk owners, and action responsible
riskManagementRouter.put('/dashboard/risks/:riskId/mitigation-actions/:actionId', (0, role_middleware_1.hasRole)(['manager', 'projectCreator', 'organiser', 'reviewer']), // Access control handled in controller
riskManagement_controller_1.updateMitigationAction);
// Add review comment - reviewers and managers (deprecated - use /comments endpoint)
riskManagementRouter.post('/dashboard/risks/:riskId/review-comments', (0, role_middleware_1.hasRole)(['manager', 'reviewer']), riskManagement_controller_1.addReviewComment);
// Get risks assigned to current user - all roles with risk access
riskManagementRouter.get('/my-risks', (0, role_middleware_1.hasRole)(['manager', 'projectCreator', 'organiser', 'reviewer']), riskManagement_controller_1.getMyRisks);
// Archive/Delete risk - only admin and manager
riskManagementRouter.delete('/dashboard/risks/:riskId', (0, role_middleware_1.hasRole)(['manager']), // Admin access handled via isConnectGoStaff check in controller
riskManagement_controller_1.archiveRisk);
exports.default = riskManagementRouter;
//# sourceMappingURL=riskManagement.routes.js.map