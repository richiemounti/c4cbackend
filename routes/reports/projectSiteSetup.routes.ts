// routes/reports/projectSiteSetup.routes.ts
import { Router } from "express";
import {
  generateProjectSiteSetupReport
} from "../../controllers/reports/projectSiteSetupReportController";
import authorize from "../../middlewares/auth.middleware";

const projectSiteSetupReportRouter = Router();

// Generate project site setup report
projectSiteSetupReportRouter.post(
  '/:siteId',
  authorize,
  generateProjectSiteSetupReport
);

export default projectSiteSetupReportRouter;