import { Router } from "express";
import {
  transitionReportStatus,
  checkRegenerationStatus,
  regenerateReport,
  getWorkflowHistory,
  getReportsRequiringAttention,
  autoRegenerateReports,
  bulkStatusTransition,
  getWorkflowConfig,
  getExpirationStatus,
  scheduleRegeneration
} from "../../controllers/reports/reportWorkflow.controller";
import authorize from "../../middlewares/auth.middleware";
import { hasProjectAccess } from "../../middlewares/role.middleware";
import { validateObjectId } from "../../middlewares/validation.middleware";

const workflowRouter = Router();

// Bulk operations and admin routes (no project-specific access needed)
workflowRouter.get(
  '/attention-required',
  authorize,
  getReportsRequiringAttention
);

workflowRouter.post(
  '/auto-regenerate',
  authorize,
  autoRegenerateReports
);

workflowRouter.put(
  '/bulk-status',
  authorize,
  bulkStatusTransition
);

// Individual report workflow operations
workflowRouter.put(
  '/:reportId/status',
  authorize,
  validateObjectId('reportId'),
  transitionReportStatus
);

workflowRouter.get(
  '/:reportId/regeneration-status',
  authorize,
  validateObjectId('reportId'),
  checkRegenerationStatus
);

workflowRouter.post(
  '/:reportId/regenerate',
  authorize,
  validateObjectId('reportId'),
  regenerateReport
);

workflowRouter.get(
  '/:reportId/workflow-history',
  authorize,
  validateObjectId('reportId'),
  getWorkflowHistory
);

workflowRouter.get(
  '/:reportId/workflow-config',
  authorize,
  validateObjectId('reportId'),
  getWorkflowConfig
);

workflowRouter.get(
  '/:reportId/expiration-status',
  authorize,
  validateObjectId('reportId'),
  getExpirationStatus
);

workflowRouter.post(
  '/:reportId/schedule-regeneration',
  authorize,
  validateObjectId('reportId'),
  scheduleRegeneration
);

export default workflowRouter;