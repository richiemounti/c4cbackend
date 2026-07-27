"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/adminDashboard.routes.ts
const express_1 = require("express");
const adminDashboard_controller_1 = require("../controllers/adminDashboard.controller");
const dashboardDetails_controller_1 = require("../controllers/dashboardDetails.controller");
const workload_controller_1 = require("../controllers/workload.controller");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const role_middleware_1 = require("../middlewares/role.middleware");
const adminDashboardRouter = (0, express_1.Router)();
// Dashboard Overview Routes (Admin only)
adminDashboardRouter.get('/overview', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), adminDashboard_controller_1.getDashboardOverview);
adminDashboardRouter.get('/organizations', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), adminDashboard_controller_1.getOrganizationsSummary);
// Timeline and Detail Routes (Admin only)
adminDashboardRouter.get('/timeline/:entityType/:entityId', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), adminDashboard_controller_1.getEntityTimeline);
adminDashboardRouter.get('/project/:projectId/detail', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), dashboardDetails_controller_1.getProjectDetailForDashboard);
adminDashboardRouter.get('/project-site/:siteId/detail', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), dashboardDetails_controller_1.getProjectSiteDetailForDashboard);
// Setup Task Management (Admin only)
adminDashboardRouter.get('/project/:projectId/setup-tasks', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), dashboardDetails_controller_1.getProjectSetupTasks);
adminDashboardRouter.get('/project-site/:siteId/setup-tasks', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), dashboardDetails_controller_1.getSiteSetupTasks);
// Add these routes to the router (anywhere after the existing routes)
// Workload Management Routes
adminDashboardRouter.get('/workload/summary', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), workload_controller_1.getWorkloadSummary);
adminDashboardRouter.post('/workload/:itemType/:itemId/complete', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), workload_controller_1.markItemCompleted);
// Support & Incident Stats
adminDashboardRouter.get('/support/stats', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), workload_controller_1.getSupportEscalationStats);
adminDashboardRouter.get('/incidents/stats', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), workload_controller_1.getIncidentStats);
// NOTE: Risk Management Routes have been moved to a separate router
// See routes/riskManagement.routes.ts for risk-related endpoints
exports.default = adminDashboardRouter;
//# sourceMappingURL=adminDashboard.routes.js.map