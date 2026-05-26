// routes/stakeholderReport.routes.ts
import { Router } from "express";
import {
  generateStakeholderReport,
  getStakeholderReports,
  getStakeholderReport,
  approveStakeholderReport,
  archiveStakeholderReport,
  deleteStakeholderReport
} from "../controllers/stakeholderReport.controller";

import authorize from "../middlewares/auth.middleware";
import { hasProjectAccess, hasPermission } from "../middlewares/role.middleware";

const stakeholderReportRouter = Router();

// All routes require authentication
stakeholderReportRouter.use(authorize);

// Get all reports
stakeholderReportRouter.get(
  '/',
  getStakeholderReports
);

// Get a single report
stakeholderReportRouter.get(
  '/:id',
  getStakeholderReport
);

// Generate a new report
stakeholderReportRouter.post(
  '/',
  hasPermission(['create_projects', 'configure_projects', 'manage_org_projects']),
  generateStakeholderReport
);

// Approve a report
stakeholderReportRouter.put(
  '/:id/approve',
  hasPermission(['manage_org_projects', 'approve_submissions']),
  approveStakeholderReport
);

// Archive a report
stakeholderReportRouter.put(
  '/:id/archive',
  hasPermission(['manage_org_projects']),
  archiveStakeholderReport
);

// Delete a report
stakeholderReportRouter.delete(
  '/:id',
  hasPermission(['manage_org_projects']),
  deleteStakeholderReport
);

export default stakeholderReportRouter;