// routes/reports/main.routes.ts
import { Router } from "express";
import {
  getProjectReports,
  getReportById,
  deleteReport,
  approveReport
} from "../../controllers/reports/reportController";
import authorize from "../../middlewares/auth.middleware";
import { hasProjectAccess } from "../../middlewares/role.middleware";

const mainReportsRouter = Router();

// Get all reports for a project
mainReportsRouter.get(
  '/project/:projectId',
  authorize,
  hasProjectAccess(),
  getProjectReports
);

// Get specific report by ID
mainReportsRouter.get(
  '/:reportId',
  authorize,
  getReportById
);

// Delete/Archive report
mainReportsRouter.delete(
  '/:reportId',
  authorize,
  deleteReport
);

// Approve report (Manager/Admin only)
mainReportsRouter.put(
  '/:reportId/approve',
  authorize,
  approveReport
);

export default mainReportsRouter;