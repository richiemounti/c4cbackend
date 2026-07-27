"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reportWorkflow_controller_1 = require("../../controllers/reports/reportWorkflow.controller");
const auth_middleware_1 = __importDefault(require("../../middlewares/auth.middleware"));
const validation_middleware_1 = require("../../middlewares/validation.middleware");
const workflowRouter = (0, express_1.Router)();
// Bulk operations and admin routes (no project-specific access needed)
workflowRouter.get('/attention-required', auth_middleware_1.default, reportWorkflow_controller_1.getReportsRequiringAttention);
workflowRouter.post('/auto-regenerate', auth_middleware_1.default, reportWorkflow_controller_1.autoRegenerateReports);
workflowRouter.put('/bulk-status', auth_middleware_1.default, reportWorkflow_controller_1.bulkStatusTransition);
// Individual report workflow operations
workflowRouter.put('/:reportId/status', auth_middleware_1.default, (0, validation_middleware_1.validateObjectId)('reportId'), reportWorkflow_controller_1.transitionReportStatus);
workflowRouter.get('/:reportId/regeneration-status', auth_middleware_1.default, (0, validation_middleware_1.validateObjectId)('reportId'), reportWorkflow_controller_1.checkRegenerationStatus);
workflowRouter.post('/:reportId/regenerate', auth_middleware_1.default, (0, validation_middleware_1.validateObjectId)('reportId'), reportWorkflow_controller_1.regenerateReport);
workflowRouter.get('/:reportId/workflow-history', auth_middleware_1.default, (0, validation_middleware_1.validateObjectId)('reportId'), reportWorkflow_controller_1.getWorkflowHistory);
workflowRouter.get('/:reportId/workflow-config', auth_middleware_1.default, (0, validation_middleware_1.validateObjectId)('reportId'), reportWorkflow_controller_1.getWorkflowConfig);
workflowRouter.get('/:reportId/expiration-status', auth_middleware_1.default, (0, validation_middleware_1.validateObjectId)('reportId'), reportWorkflow_controller_1.getExpirationStatus);
workflowRouter.post('/:reportId/schedule-regeneration', auth_middleware_1.default, (0, validation_middleware_1.validateObjectId)('reportId'), reportWorkflow_controller_1.scheduleRegeneration);
exports.default = workflowRouter;
//# sourceMappingURL=workflow.routes.js.map