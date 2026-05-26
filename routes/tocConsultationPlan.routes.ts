// routes/tocConsultationPlan.routes.ts
import { Router } from 'express';
import {
  createOrUpdateConsultationPlan,
  getConsultationPlanBySite,
  getStakeholderGroupsForSite,
  completeConsultationPlan,
  checkConsultationPlanStatus,
  getConsultationPlansByProject,
  deleteConsultationPlan
} from '../controllers/tocConsultationPlan.controller';
import authorize from '../middlewares/auth.middleware';

const consultationRouter = Router();

// Apply authentication middleware to all routes
consultationRouter.use(authorize);

/**
 * @route   POST /api/v1/toc-consultation-plans
 * @desc    Create or update a consultation plan for a project site
 * @access  Private
 */
consultationRouter.post('/', createOrUpdateConsultationPlan);

/**
 * @route   GET /api/v1/toc-consultation-plans/site/:siteId/stakeholder-groups
 * @desc    Get available stakeholder groups for a project site
 * @access  Private
 */
consultationRouter.get('/site/:siteId/stakeholder-groups', getStakeholderGroupsForSite);

/**
 * @route   GET /api/v1/toc-consultation-plans/site/:siteId/status
 * @desc    Check if consultation plan is completed for a site
 * @access  Private
 */
consultationRouter.get('/site/:siteId/status', checkConsultationPlanStatus);

/**
 * @route   GET /api/v1/toc-consultation-plans/site/:siteId
 * @desc    Get consultation plan for a specific project site
 * @access  Private
 */
consultationRouter.get('/site/:siteId', getConsultationPlanBySite);

/**
 * @route   GET /api/v1/toc-consultation-plans/project/:projectId
 * @desc    Get all consultation plans for a project
 * @access  Private
 */
consultationRouter.get('/project/:projectId', getConsultationPlansByProject);

/**
 * @route   PUT /api/v1/toc-consultation-plans/:planId/complete
 * @desc    Mark consultation plan as completed
 * @access  Private
 */
consultationRouter.put('/:planId/complete', completeConsultationPlan);

/**
 * @route   DELETE /api/v1/toc-consultation-plans/:planId
 * @desc    Delete a consultation plan
 * @access  Private
 */
consultationRouter.delete('/:planId', deleteConsultationPlan);

export default consultationRouter;