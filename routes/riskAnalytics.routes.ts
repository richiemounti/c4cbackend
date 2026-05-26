// routes/riskAnalytics.routes.ts
import { Router } from "express";
import {
  getRiskChangelog,
  getRiskTrends,
  getStatusChanges,
  getMitigationEffectiveness,
  getChangeStats
} from "../controllers/riskAnalytics.controller";
import authorize from "../middlewares/auth.middleware";
import { hasRole } from "../middlewares/role.middleware";

const riskAnalyticsRouter = Router();

// Apply authentication middleware to all routes
riskAnalyticsRouter.use(authorize);

/**
 * Get change log for a specific risk
 * @route GET /api/v1/admin/dashboard/risks/:riskId/changelog
 * @access Private (Manager, ProjectCreator, Organiser, Reviewer)
 */
riskAnalyticsRouter.get(
  '/dashboard/risks/:riskId/changelog',
  // Same permission pattern as your existing routes
  (req, res, next) => {
    if (req.user?.isConnectGoStaff) {
      return next(); // Admin can access
    }
    return hasRole(['manager', 'projectCreator', 'organiser', 'reviewer', 'admin'])(req, res, next);
  },
  getRiskChangelog
);

/**
 * Get risk trends over time for charts
 * @route GET /api/v1/admin/dashboard/risks/analytics/trends
 * @access Private (Manager, ProjectCreator, Organiser, Reviewer)
 */
riskAnalyticsRouter.get(
  '/dashboard/risks/analytics/trends',
  (req, res, next) => {
    if (req.user?.isConnectGoStaff) {
      return next();
    }
    return hasRole(['manager', 'projectCreator', 'organiser', 'reviewer', 'admin'])(req, res, next);
  },
  getRiskTrends
);

/**
 * Get status change analysis
 * @route GET /api/v1/admin/dashboard/risks/analytics/status-changes
 * @access Private (Manager, ProjectCreator, Organiser, Reviewer)
 */
riskAnalyticsRouter.get(
  '/dashboard/risks/analytics/status-changes',
  (req, res, next) => {
    if (req.user?.isConnectGoStaff) {
      return next();
    }
    return hasRole(['manager', 'projectCreator', 'organiser', 'reviewer', 'admin'])(req, res, next);
  },
  getStatusChanges
);

/**
 * Get mitigation effectiveness metrics
 * @route GET /api/v1/admin/dashboard/risks/analytics/mitigation-effectiveness
 * @access Private (Manager, ProjectCreator, Organiser, Reviewer)
 */
riskAnalyticsRouter.get(
  '/dashboard/risks/analytics/mitigation-effectiveness',
  (req, res, next) => {
    if (req.user?.isConnectGoStaff) {
      return next();
    }
    return hasRole(['manager', 'projectCreator', 'organiser', 'reviewer', 'admin'])(req, res, next);
  },
  getMitigationEffectiveness
);

/**
 * Get change statistics
 * @route GET /api/v1/admin/dashboard/risks/analytics/change-stats
 * @access Private (Manager, ProjectCreator, Organiser, Reviewer)
 */
riskAnalyticsRouter.get(
  '/dashboard/risks/analytics/change-stats',
  (req, res, next) => {
    if (req.user?.isConnectGoStaff) {
      return next();
    }
    return hasRole(['manager', 'projectCreator', 'organiser', 'reviewer', 'admin'])(req, res, next);
  },
  getChangeStats
);

export default riskAnalyticsRouter;