// routes/adminDashboard.routes.ts
import { Router } from "express";
import {
  getDashboardOverview,
  getOrganizationsSummary,
  getReviewQueue,
  generateReviews,
  getEntityTimeline
} from "../controllers/adminDashboard.controller";
import {
  getProjectDetailForDashboard,
  getProjectSiteDetailForDashboard,
  getProjectSetupTasks,
  getSiteSetupTasks
} from "../controllers/dashboardDetails.controller";

import {
  getWorkloadSummary,
  markItemCompleted,
  getSupportEscalationStats,
  getIncidentStats,
} from "../controllers/workload.controller";

import authorize from "../middlewares/auth.middleware";
import { isConnectGoStaff } from "../middlewares/role.middleware";

const adminDashboardRouter = Router();

// Dashboard Overview Routes (Admin only)
adminDashboardRouter.get('/overview', 
  authorize, 
  isConnectGoStaff(), 
  getDashboardOverview
);

adminDashboardRouter.get('/organizations', 
  authorize, 
  isConnectGoStaff(), 
  getOrganizationsSummary
);


// Timeline and Detail Routes (Admin only)
adminDashboardRouter.get('/timeline/:entityType/:entityId', 
  authorize, 
  isConnectGoStaff(), 
  getEntityTimeline
);


adminDashboardRouter.get('/project/:projectId/detail', 
  authorize, 
  isConnectGoStaff(), 
  getProjectDetailForDashboard
);

adminDashboardRouter.get('/project-site/:siteId/detail', 
  authorize, 
  isConnectGoStaff(), 
  getProjectSiteDetailForDashboard
);

// Setup Task Management (Admin only)
adminDashboardRouter.get('/project/:projectId/setup-tasks', 
  authorize, 
  isConnectGoStaff(), 
  getProjectSetupTasks
);

adminDashboardRouter.get('/project-site/:siteId/setup-tasks', 
  authorize, 
  isConnectGoStaff(), 
  getSiteSetupTasks
);


// Add these routes to the router (anywhere after the existing routes)

// Workload Management Routes
adminDashboardRouter.get('/workload/summary',
  authorize,
  isConnectGoStaff(),
  getWorkloadSummary
);

adminDashboardRouter.post('/workload/:itemType/:itemId/complete',
  authorize,
  isConnectGoStaff(),
  markItemCompleted
);

// Support & Incident Stats
adminDashboardRouter.get('/support/stats',
  authorize,
  isConnectGoStaff(),
  getSupportEscalationStats
);

adminDashboardRouter.get('/incidents/stats',
  authorize,
  isConnectGoStaff(),
  getIncidentStats
);

// NOTE: Risk Management Routes have been moved to a separate router
// See routes/riskManagement.routes.ts for risk-related endpoints

export default adminDashboardRouter;