// routes/reports/theoryOfChange.routes.ts - UPDATED VERSION
import { Router } from "express";
import {
  generateStage1Report, // ✅ NEW
  generateWorkplanReport,
  generateOutcomeReport,
  generateConsultationPlanReport,
  generateFullToCReport,
  getGanttChartData
} from "../../controllers/reports/theoryOfChangeReportController";
import authorize from "../../middlewares/auth.middleware";
import { hasProjectAccess } from "../../middlewares/role.middleware";

const theoryOfChangeReportRouter = Router();

// ============================================================================
// STAGE 1 DATA REPORT (NEW - Data-focused)
// ============================================================================

/**
 * Generate Stage 1 data report (data-focused)
 * Focus: Stage 1 - Stakeholder Actions detailed data
 * Includes: Action details, breakdowns by status/priority/stakeholder/theme, progress
 */
theoryOfChangeReportRouter.post(
  '/:projectId/stage1',
  authorize,
  hasProjectAccess(),
  (req, res, next) => {
    req.body.filters = req.body.filters || {};
    req.body.filters.scope = req.body.filters.scope || 'all';
    req.body.filters.stageNumbers = [1]; // Force Stage 1 only
    req.body.filters.reportDimension = 'stage1'; // ✅ ADD: Set report dimension explicitly
    next();
  },
  generateStage1Report
);

// ============================================================================
// WORKPLAN REPORT (Visual-focused)
// ============================================================================

/**
 * Generate work plan report with enhanced Gantt timeline and metrics
 * Focus: Stage 1 - Visual representation with Gantt charts
 * Includes: Timeline, dependencies, workload distribution, critical path, metrics
 */
theoryOfChangeReportRouter.post(
  '/:projectId/workplan',
  authorize,
  hasProjectAccess(),
  (req, res, next) => {
    req.body.filters = req.body.filters || {};
    req.body.filters.scope = req.body.filters.scope || 'all';
    req.body.filters.stageNumbers = [1]; // Force Stage 1 only
    req.body.filters.reportDimension = 'workplan'; // ✅ ADD: Set report dimension explicitly
    next();
  },
  generateWorkplanReport
);

// ============================================================================
// OUTCOME REPORT (STAGE 2 - IMPACTS/OUTCOMES ONLY)
// ============================================================================

/**
 * Generate outcome-based report with framework selection
 * Focus: Stage 2 - Social Impacts (Outcomes)
 * Includes: Impact by stakeholder, framework grouping, risk register
 */
theoryOfChangeReportRouter.post(
  '/:projectId/outcome',
  authorize,
  hasProjectAccess(),
  (req, res, next) => {
    req.body.filters = req.body.filters || {};
    req.body.filters.scope = req.body.filters.scope || 'all';
    req.body.filters.stageNumbers = [2]; // Force Stage 2 only
    req.body.filters.reportDimension = 'outcome'; // ✅ ADD: Set report dimension explicitly
    req.body.frameworkFilter = req.body.frameworkFilter || 'themes';
    next();
  },
  generateOutcomeReport
);

// ============================================================================
// CONSULTATION PLAN REPORT (SITE SELECTION PHASE)
// ============================================================================

/**
 * Generate consultation plan report for a specific site
 * Focus: Pre-ToC site selection and stakeholder consultation planning
 */
theoryOfChangeReportRouter.post(
  '/:projectId/site/:siteId/consultation-plan',
  authorize,
  hasProjectAccess(),
  generateConsultationPlanReport
);

// ============================================================================
// FULL THEORY OF CHANGE REPORT (BOTH STAGES)
// ============================================================================

/**
 * Generate comprehensive Theory of Change report
 * Focus: Both Stage 1 (Actions) and Stage 2 (Impacts)
 */
theoryOfChangeReportRouter.post(
  '/:projectId/full',
  authorize,
  hasProjectAccess(),
  (req, res, next) => {
    req.body.filters = req.body.filters || {};
    req.body.filters.scope = req.body.filters.scope || 'all';
    req.body.filters.stageNumbers = [1, 2]; // Both stages
    req.body.filters.reportDimension = 'full'; // ✅ ADD: Set report dimension explicitly
    req.body.frameworkFilter = req.body.frameworkFilter || 'themes';
    next();
  },
  generateFullToCReport
);

// ============================================================================
// SITE-SPECIFIC REPORTS
// ============================================================================

/**
 * Generate site-specific Stage 1 report
 */
theoryOfChangeReportRouter.post(
  '/:projectId/site/:siteId/stage1',
  authorize,
  hasProjectAccess(),
  (req, res, next) => {
    req.body.filters = req.body.filters || {};
    req.body.filters.scope = 'site';
    req.body.filters.siteIds = [req.params.siteId];
    req.body.filters.stageNumbers = [1];
    req.body.filters.reportDimension = 'stage1'; // ✅ ADD: Set report dimension explicitly
    next();
  },
  generateStage1Report
);

/**
 * Generate site-specific workplan report
 */
theoryOfChangeReportRouter.post(
  '/:projectId/site/:siteId/workplan',
  authorize,
  hasProjectAccess(),
  (req, res, next) => {
    req.body.filters = req.body.filters || {};
    req.body.filters.scope = 'site';
    req.body.filters.siteIds = [req.params.siteId];
    req.body.filters.stageNumbers = [1];
    req.body.filters.reportDimension = 'workplan'; // ✅ ADD: Set report dimension explicitly
    next();
  },
  generateWorkplanReport
);

/**
 * Generate site-specific outcome report
 */
theoryOfChangeReportRouter.post(
  '/:projectId/site/:siteId/outcome',
  authorize,
  hasProjectAccess(),
  (req, res, next) => {
    req.body.filters = req.body.filters || {};
    req.body.filters.scope = 'site';
    req.body.filters.siteIds = [req.params.siteId];
    req.body.filters.stageNumbers = [2];
    req.body.filters.reportDimension = 'outcome'; // ✅ ADD: Set report dimension explicitly
    req.body.frameworkFilter = req.body.frameworkFilter || 'themes';
    next();
  },
  generateOutcomeReport
);

/**
 * Generate site-specific full ToC report
 */
theoryOfChangeReportRouter.post(
  '/:projectId/site/:siteId/full',
  authorize,
  hasProjectAccess(),
  (req, res, next) => {
    req.body.filters = req.body.filters || {};
    req.body.filters.scope = 'site';
    req.body.filters.siteIds = [req.params.siteId];
    req.body.filters.stageNumbers = [1, 2];
    req.body.filters.reportDimension = 'full'; // ✅ ADD: Set report dimension explicitly
    req.body.frameworkFilter = req.body.frameworkFilter || 'themes';
    next();
  },
  generateFullToCReport
);

// ============================================================================
// GANTT CHART DATA (LIGHTWEIGHT ENDPOINT)
// ============================================================================

/**
 * Get Gantt chart data for timeline visualization
 * Returns only timeline data without full report structure
 */
theoryOfChangeReportRouter.get(
  '/:projectId/gantt',
  authorize,
  hasProjectAccess(),
  getGanttChartData
);

export default theoryOfChangeReportRouter;

/**
 * USAGE EXAMPLES:
 * 
 * 1. Generate Stage 1 Data Report (NEW):
 *    POST /api/v1/reports/theory-of-change/:projectId/stage1
 *    Body: {
 *      saveReport: true,
 *      filters: { scope: 'all' }
 *    }
 * 
 * 2. Generate Workplan Report (Visual):
 *    POST /api/v1/reports/theory-of-change/:projectId/workplan
 *    Body: {
 *      saveReport: true,
 *      filters: { scope: 'all' }
 *    }
 * 
 * 3. Generate Outcome Report (Stage 2):
 *    POST /api/v1/reports/theory-of-change/:projectId/outcome
 *    Body: {
 *      saveReport: true,
 *      frameworkFilter: 'sdgs',
 *      filters: { scope: 'all' }
 *    }
 * 
 * 4. Generate Full ToC Report:
 *    POST /api/v1/reports/theory-of-change/:projectId/full
 *    Body: {
 *      saveReport: true,
 *      frameworkFilter: 'themes',
 *      filters: { scope: 'all' }
 *    }
 */