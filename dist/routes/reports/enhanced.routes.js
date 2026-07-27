"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/reports/enhanced.routes.ts
const express_1 = require("express");
const enhancedReportController_1 = require("../../controllers/reports/enhancedReportController");
const auth_middleware_1 = __importDefault(require("../../middlewares/auth.middleware"));
const validation_middleware_1 = require("../../middlewares/validation.middleware");
const reportActivity_middleware_1 = require("../../middlewares/reportActivity.middleware");
const enhancedReportsRouter = (0, express_1.Router)();
// Search and filtering routes
enhancedReportsRouter.post('/search', auth_middleware_1.default, enhancedReportController_1.searchReports);
enhancedReportsRouter.get('/quick-search', auth_middleware_1.default, enhancedReportController_1.quickSearch);
enhancedReportsRouter.get('/search/facets', auth_middleware_1.default, enhancedReportController_1.getSearchFacets);
enhancedReportsRouter.post('/search/export', auth_middleware_1.default, enhancedReportController_1.exportSearchResults);
// Caching routes
enhancedReportsRouter.get('/:reportId/cached', auth_middleware_1.default, (0, validation_middleware_1.validateObjectId)('reportId'), (0, reportActivity_middleware_1.trackReportActivity)('view', 'get_cached_report'), (0, reportActivity_middleware_1.trackSession)(), enhancedReportController_1.getCachedReport);
// Background generation routes
enhancedReportsRouter.post('/generate/background', auth_middleware_1.default, enhancedReportController_1.queueReportGeneration);
enhancedReportsRouter.post('/generate/batch', auth_middleware_1.default, enhancedReportController_1.queueBatchGeneration);
// Job management routes
enhancedReportsRouter.get('/jobs/:jobId/status', auth_middleware_1.default, enhancedReportController_1.getJobStatus);
enhancedReportsRouter.delete('/jobs/:jobId', auth_middleware_1.default, enhancedReportController_1.cancelJob);
// Monitoring and admin routes
enhancedReportsRouter.get('/queues/stats', auth_middleware_1.default, enhancedReportController_1.getQueueStats);
enhancedReportsRouter.get('/cache/stats', auth_middleware_1.default, enhancedReportController_1.getCacheStats);
enhancedReportsRouter.delete('/cache', auth_middleware_1.default, enhancedReportController_1.clearCaches);
enhancedReportsRouter.get('/analytics', auth_middleware_1.default, enhancedReportController_1.getReportAnalytics);
enhancedReportsRouter.post('/search/build-index', auth_middleware_1.default, enhancedReportController_1.buildSearchIndex);
exports.default = enhancedReportsRouter;
//# sourceMappingURL=enhanced.routes.js.map