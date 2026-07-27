"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/riskAnalytics.routes.ts
const express_1 = require("express");
const riskAnalytics_controller_1 = require("../controllers/riskAnalytics.controller");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const role_middleware_1 = require("../middlewares/role.middleware");
const riskAnalyticsRouter = (0, express_1.Router)();
// Apply authentication middleware to all routes
riskAnalyticsRouter.use(auth_middleware_1.default);
/**
 * Get change log for a specific risk
 * @route GET /api/v1/admin/dashboard/risks/:riskId/changelog
 * @access Private (Manager, ProjectCreator, Organiser, Reviewer)
 */
riskAnalyticsRouter.get('/dashboard/risks/:riskId/changelog', 
// Same permission pattern as your existing routes
(req, res, next) => {
    var _a;
    if ((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff) {
        return next(); // Admin can access
    }
    return (0, role_middleware_1.hasRole)(['manager', 'projectCreator', 'organiser', 'reviewer', 'admin'])(req, res, next);
}, riskAnalytics_controller_1.getRiskChangelog);
/**
 * Get risk trends over time for charts
 * @route GET /api/v1/admin/dashboard/risks/analytics/trends
 * @access Private (Manager, ProjectCreator, Organiser, Reviewer)
 */
riskAnalyticsRouter.get('/dashboard/risks/analytics/trends', (req, res, next) => {
    var _a;
    if ((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff) {
        return next();
    }
    return (0, role_middleware_1.hasRole)(['manager', 'projectCreator', 'organiser', 'reviewer', 'admin'])(req, res, next);
}, riskAnalytics_controller_1.getRiskTrends);
/**
 * Get status change analysis
 * @route GET /api/v1/admin/dashboard/risks/analytics/status-changes
 * @access Private (Manager, ProjectCreator, Organiser, Reviewer)
 */
riskAnalyticsRouter.get('/dashboard/risks/analytics/status-changes', (req, res, next) => {
    var _a;
    if ((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff) {
        return next();
    }
    return (0, role_middleware_1.hasRole)(['manager', 'projectCreator', 'organiser', 'reviewer', 'admin'])(req, res, next);
}, riskAnalytics_controller_1.getStatusChanges);
/**
 * Get mitigation effectiveness metrics
 * @route GET /api/v1/admin/dashboard/risks/analytics/mitigation-effectiveness
 * @access Private (Manager, ProjectCreator, Organiser, Reviewer)
 */
riskAnalyticsRouter.get('/dashboard/risks/analytics/mitigation-effectiveness', (req, res, next) => {
    var _a;
    if ((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff) {
        return next();
    }
    return (0, role_middleware_1.hasRole)(['manager', 'projectCreator', 'organiser', 'reviewer', 'admin'])(req, res, next);
}, riskAnalytics_controller_1.getMitigationEffectiveness);
/**
 * Get change statistics
 * @route GET /api/v1/admin/dashboard/risks/analytics/change-stats
 * @access Private (Manager, ProjectCreator, Organiser, Reviewer)
 */
riskAnalyticsRouter.get('/dashboard/risks/analytics/change-stats', (req, res, next) => {
    var _a;
    if ((_a = req.user) === null || _a === void 0 ? void 0 : _a.isConnectGoStaff) {
        return next();
    }
    return (0, role_middleware_1.hasRole)(['manager', 'projectCreator', 'organiser', 'reviewer', 'admin'])(req, res, next);
}, riskAnalytics_controller_1.getChangeStats);
exports.default = riskAnalyticsRouter;
//# sourceMappingURL=riskAnalytics.routes.js.map