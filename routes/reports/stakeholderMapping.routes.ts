// routes/reports/stakeholderMapping.routes.ts
import { Router } from "express";
import {
  generateStakeholderMappingReport
} from "../../controllers/reports/stakeholderMappingReportController";
import authorize from "../../middlewares/auth.middleware";
import { hasProjectAccess } from "../../middlewares/role.middleware";

const stakeholderMappingReportRouter = Router();

// Generate stakeholder mapping report (full project)
stakeholderMappingReportRouter.post(
  '/:projectId',
  authorize,
  hasProjectAccess(),
  (req, res, next) => {
    // Set default scope to 'all' - use type assertion to fix TypeScript error
    (req.body as any).filters = (req.body as any).filters || {};
    (req.body as any).filters.scope = (req.body as any).filters.scope || 'all';
    next();
  },
  generateStakeholderMappingReport
);

// Generate site-specific stakeholder mapping report
stakeholderMappingReportRouter.post(
  '/:projectId/site/:siteId',
  authorize,
  hasProjectAccess(),
  (req, res, next) => {
    // Set filters for site-specific report
    (req.body as any).filters = (req.body as any).filters || {};
    (req.body as any).filters.scope = 'site';
    (req.body as any).filters.siteIds = [req.params.siteId];
    next();
  },
  generateStakeholderMappingReport
);

// Generate project-only stakeholder mapping report
stakeholderMappingReportRouter.post(
  '/:projectId/project-only',
  authorize,
  hasProjectAccess(),
  (req, res, next) => {
    // Set filters for project-only report
    (req.body as any).filters = (req.body as any).filters || {};
    (req.body as any).filters.scope = 'project';
    next();
  },
  generateStakeholderMappingReport
);

export default stakeholderMappingReportRouter;