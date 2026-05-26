// routes/reports/enhanced.routes.ts
import { Router } from "express";
import {
  searchReports,
  quickSearch,
  getSearchFacets,
  exportSearchResults,
  getCachedReport,
  queueReportGeneration,
  queueBatchGeneration,
  getJobStatus,
  cancelJob,
  getQueueStats,
  getCacheStats,
  clearCaches,
  getReportAnalytics,
  buildSearchIndex
} from "../../controllers/reports/enhancedReportController";
import authorize from "../../middlewares/auth.middleware";
import { hasProjectAccess } from "../../middlewares/role.middleware";
import { validateObjectId } from "../../middlewares/validation.middleware";
import { trackReportActivity, trackSession } from "../../middlewares/reportActivity.middleware";

const enhancedReportsRouter = Router();

// Search and filtering routes
enhancedReportsRouter.post(
  '/search',
  authorize,
  searchReports
);

enhancedReportsRouter.get(
  '/quick-search',
  authorize,
  quickSearch
);

enhancedReportsRouter.get(
  '/search/facets',
  authorize,
  getSearchFacets
);

enhancedReportsRouter.post(
  '/search/export',
  authorize,
  exportSearchResults
);

// Caching routes
enhancedReportsRouter.get(
  '/:reportId/cached',
  authorize,
  validateObjectId('reportId'),
  trackReportActivity('view', 'get_cached_report'),
  trackSession(),
  getCachedReport
);

// Background generation routes
enhancedReportsRouter.post(
  '/generate/background',
  authorize,
  queueReportGeneration
);

enhancedReportsRouter.post(
  '/generate/batch',
  authorize,
  queueBatchGeneration
);

// Job management routes
enhancedReportsRouter.get(
  '/jobs/:jobId/status',
  authorize,
  getJobStatus
);

enhancedReportsRouter.delete(
  '/jobs/:jobId',
  authorize,
  cancelJob
);

// Monitoring and admin routes
enhancedReportsRouter.get(
  '/queues/stats',
  authorize,
  getQueueStats
);

enhancedReportsRouter.get(
  '/cache/stats',
  authorize,
  getCacheStats
);

enhancedReportsRouter.delete(
  '/cache',
  authorize,
  clearCaches
);

enhancedReportsRouter.get(
  '/analytics',
  authorize,
  getReportAnalytics
);

enhancedReportsRouter.post(
  '/search/build-index',
  authorize,
  buildSearchIndex
);

export default enhancedReportsRouter;