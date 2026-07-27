"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/tocConsultationPlan.routes.ts
const express_1 = require("express");
const tocConsultationPlan_controller_1 = require("../controllers/tocConsultationPlan.controller");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const consultationRouter = (0, express_1.Router)();
// Apply authentication middleware to all routes
consultationRouter.use(auth_middleware_1.default);
/**
 * @route   POST /api/v1/toc-consultation-plans
 * @desc    Create or update a consultation plan for a project site
 * @access  Private
 */
consultationRouter.post('/', tocConsultationPlan_controller_1.createOrUpdateConsultationPlan);
/**
 * @route   GET /api/v1/toc-consultation-plans/site/:siteId/stakeholder-groups
 * @desc    Get available stakeholder groups for a project site
 * @access  Private
 */
consultationRouter.get('/site/:siteId/stakeholder-groups', tocConsultationPlan_controller_1.getStakeholderGroupsForSite);
/**
 * @route   GET /api/v1/toc-consultation-plans/site/:siteId/status
 * @desc    Check if consultation plan is completed for a site
 * @access  Private
 */
consultationRouter.get('/site/:siteId/status', tocConsultationPlan_controller_1.checkConsultationPlanStatus);
/**
 * @route   GET /api/v1/toc-consultation-plans/site/:siteId
 * @desc    Get consultation plan for a specific project site
 * @access  Private
 */
consultationRouter.get('/site/:siteId', tocConsultationPlan_controller_1.getConsultationPlanBySite);
/**
 * @route   GET /api/v1/toc-consultation-plans/project/:projectId
 * @desc    Get all consultation plans for a project
 * @access  Private
 */
consultationRouter.get('/project/:projectId', tocConsultationPlan_controller_1.getConsultationPlansByProject);
/**
 * @route   PUT /api/v1/toc-consultation-plans/:planId/complete
 * @desc    Mark consultation plan as completed
 * @access  Private
 */
consultationRouter.put('/:planId/complete', tocConsultationPlan_controller_1.completeConsultationPlan);
/**
 * @route   DELETE /api/v1/toc-consultation-plans/:planId
 * @desc    Delete a consultation plan
 * @access  Private
 */
consultationRouter.delete('/:planId', tocConsultationPlan_controller_1.deleteConsultationPlan);
exports.default = consultationRouter;
//# sourceMappingURL=tocConsultationPlan.routes.js.map