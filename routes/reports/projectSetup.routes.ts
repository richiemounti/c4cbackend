// routes/reports/projectSetup.routes.ts
import { Router } from "express";
import {
  generateProjectSetupReport,
  getProjectSetupSummary
} from "../../controllers/reports/projectSetupReportController";
import authorize from "../../middlewares/auth.middleware";
import { hasProjectAccess } from "../../middlewares/role.middleware";

const projectSetupReportRouter = Router();

// Generate project setup report
projectSetupReportRouter.post(
  '/:projectId',
  authorize,
  hasProjectAccess(),
  generateProjectSetupReport
);

// Get project setup summary stats
projectSetupReportRouter.get(
  '/:projectId/summary',
  authorize,
  hasProjectAccess(),
  getProjectSetupSummary
);

export default projectSetupReportRouter;