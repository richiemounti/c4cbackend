// routes/riskManagement.routes.ts
import { Router } from "express";
// ✅ UPDATE THE IMPORT (around line 2-14):
import {
  getRiskRegisterSummary,
  createRiskItem,
  getRiskDetails,
  updateRiskItem,
  addComment,
  toggleCommentKeyInsight, // ✅ NEW
  addMitigationAction,
  updateMitigationAction,
  addReviewComment,
  getMyRisks,
  archiveRisk
} from "../controllers/riskManagement.controller";
import authorize from "../middlewares/auth.middleware";
import { hasRole, isConnectGoStaff } from "../middlewares/role.middleware";

const riskManagementRouter = Router();

// Apply authentication middleware to all routes
riskManagementRouter.use(authorize);

// Risk register summary - accessible to manager, projectCreator, organiser, reviewer
riskManagementRouter.get(
  '/dashboard/risks',
  // Add middleware that allows both hasRole AND isConnectGoStaff
  (req, res, next) => {
    if (req.user?.isConnectGoStaff) {
      return next(); // Admin can access
    }
    return hasRole(['manager', 'projectCreator', 'organiser', 'reviewer'])(req, res, next);
  },
  getRiskRegisterSummary
);

// Create new risk - only manager and projectCreator can create
riskManagementRouter.post(
  '/dashboard/risks',
  hasRole(['manager', 'projectCreator']),
  createRiskItem
);

// Get detailed risk information - accessible to manager, projectCreator, organiser, reviewer
riskManagementRouter.get(
  '/dashboard/risks/:riskId',
  hasRole(['manager', 'projectCreator', 'organiser', 'reviewer']),
  getRiskDetails
);

// Update risk item - manager, projectCreator (additional access control handled in controller)
riskManagementRouter.put(
  '/dashboard/risks/:riskId',
  hasRole(['manager', 'projectCreator', 'organiser', 'reviewer']), // Access control handled in controller
  updateRiskItem
);

// ✅ NEW: Add comment to risk - all roles with risk access
riskManagementRouter.post(
  '/dashboard/risks/:riskId/comments',
  hasRole(['manager', 'projectCreator', 'organiser', 'reviewer']),
  addComment
);

// ✅ NEW: Toggle comment as key insight - all roles with risk access
riskManagementRouter.put(
  '/dashboard/risks/:riskId/comments/:commentId/star',
  hasRole(['manager', 'projectCreator', 'organiser', 'reviewer']),
  toggleCommentKeyInsight
);

// Add mitigation action - manager, projectCreator (additional access control handled in controller)
riskManagementRouter.post(
  '/dashboard/risks/:riskId/mitigation-actions',
  hasRole(['manager', 'projectCreator', 'organiser', 'reviewer']), // Access control handled in controller
  addMitigationAction
);

// Update mitigation action status - manager, projectCreator, risk owners, and action responsible
riskManagementRouter.put(
  '/dashboard/risks/:riskId/mitigation-actions/:actionId',
  hasRole(['manager', 'projectCreator', 'organiser', 'reviewer']), // Access control handled in controller
  updateMitigationAction
);

// Add review comment - reviewers and managers (deprecated - use /comments endpoint)
riskManagementRouter.post(
  '/dashboard/risks/:riskId/review-comments',
  hasRole(['manager', 'reviewer']),
  addReviewComment
);

// Get risks assigned to current user - all roles with risk access
riskManagementRouter.get(
  '/my-risks',
  hasRole(['manager', 'projectCreator', 'organiser', 'reviewer']),
  getMyRisks
);

// Archive/Delete risk - only admin and manager
riskManagementRouter.delete(
  '/dashboard/risks/:riskId',
  hasRole(['manager']), // Admin access handled via isConnectGoStaff check in controller
  archiveRisk
);

export default riskManagementRouter;