// routes/reports/riskRegister.routes.ts
import { Router } from "express";
import {
  generateRiskRegisterReport
} from "../../controllers/reports/riskRegisterReportController";
import authorize from "../../middlewares/auth.middleware";
import { hasProjectAccess } from "../../middlewares/role.middleware";

const riskRegisterReportRouter = Router();

// Generate risk register report (full project)
riskRegisterReportRouter.post(
  '/:projectId',
  authorize,
  hasProjectAccess(),
  (req, res, next) => {
    // Set default scope to 'all'
    req.body.filters = req.body.filters || {};
    req.body.filters.scope = req.body.filters.scope || 'all';
    next();
  },
  generateRiskRegisterReport
);

// Generate site-specific risk register report
riskRegisterReportRouter.post(
  '/:projectId/site/:siteId',
  authorize,
  hasProjectAccess(),
  (req, res, next) => {
    // Set filters for site-specific report
    req.body.filters = req.body.filters || {};
    req.body.filters.scope = 'site';
    req.body.filters.siteIds = [req.params.siteId];
    next();
  },
  generateRiskRegisterReport
);

// Generate project-only risk register report
riskRegisterReportRouter.post(
  '/:projectId/project-only',
  authorize,
  hasProjectAccess(),
  (req, res, next) => {
    // Set filters for project-only report
    req.body.filters = req.body.filters || {};
    req.body.filters.scope = 'project';
    next();
  },
  generateRiskRegisterReport
);

// Generate overdue risks report
riskRegisterReportRouter.post(
  '/:projectId/overdue',
  authorize,
  hasProjectAccess(),
  (req, res, next) => {
    // Set filters for overdue risks only
    req.body.filters = req.body.filters || {};
    req.body.filters.scope = 'all';
    req.body.filters.overdueOnly = true;
    next();
  },
  generateRiskRegisterReport
);

export default riskRegisterReportRouter;