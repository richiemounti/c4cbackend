"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildSearchIndex = exports.getReportAnalytics = exports.clearCaches = exports.getCacheStats = exports.getQueueStats = exports.cancelJob = exports.getJobStatus = exports.queueBatchGeneration = exports.queueReportGeneration = exports.getCachedReport = exports.exportSearchResults = exports.getSearchFacets = exports.quickSearch = exports.searchReports = void 0;
const reportSearch_service_1 = __importDefault(require("../../services/reports/reportSearch.service"));
const reportCache_service_1 = __importDefault(require("../../services/reports/reportCache.service"));
const backgroundGeneration_service_1 = __importDefault(require("../../services/reports/backgroundGeneration.service"));
const reportPersistence_service_1 = __importDefault(require("../../services/reports/reportPersistence.service"));
// Type guard for authenticated user
function isUserAuthenticated(req) {
    return req.user !== undefined;
}
/**
 * Advanced search for reports with comprehensive filtering
 * @route POST /api/v1/reports/search
 * @access Private
 */
const searchReports = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { filters = {}, options = {} } = req.body;
        // Enhanced search with user context
        const searchResult = yield reportSearch_service_1.default.searchReports(filters, {
            includeContent: options.includeContent || false,
            fuzzySearch: options.fuzzySearch || false,
            aggregateResults: options.aggregateResults || true,
            includeRelated: options.includeRelated !== false,
            cacheResults: options.cacheResults !== false
        }, req.user._id.toString());
        res.status(200).json({
            success: true,
            data: searchResult
        });
    }
    catch (error) {
        next(error);
    }
});
exports.searchReports = searchReports;
/**
 * Quick search for reports with autocomplete
 * @route GET /api/v1/reports/quick-search
 * @access Private
 */
const quickSearch = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { q: searchTerm, limit = 10 } = req.query;
        if (!searchTerm || typeof searchTerm !== 'string') {
            const error = new Error('Search term is required');
            error.statusCode = 400;
            throw error;
        }
        const results = yield reportSearch_service_1.default.quickSearch(searchTerm, req.user._id.toString(), parseInt(limit));
        res.status(200).json({
            success: true,
            data: results
        });
    }
    catch (error) {
        next(error);
    }
});
exports.quickSearch = quickSearch;
/**
 * Get search facets for building advanced search UI
 * @route GET /api/v1/reports/search/facets
 * @access Private
 */
const getSearchFacets = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const facets = yield reportSearch_service_1.default.getSearchFacets(req.user._id.toString());
        res.status(200).json({
            success: true,
            data: facets
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getSearchFacets = getSearchFacets;
/**
 * Export search results in various formats
 * @route POST /api/v1/reports/search/export
 * @access Private
 */
const exportSearchResults = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { filters = {}, format = 'json' } = req.body;
        if (!['csv', 'excel', 'json'].includes(format)) {
            const error = new Error('Invalid export format. Supported: csv, excel, json');
            error.statusCode = 400;
            throw error;
        }
        const exportResult = yield reportSearch_service_1.default.exportSearchResults(filters, format, req.user._id.toString());
        // Set appropriate headers
        res.setHeader('Content-Type', exportResult.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
        res.status(200).send(exportResult.data);
    }
    catch (error) {
        next(error);
    }
});
exports.exportSearchResults = exportSearchResults;
/**
 * Get cached report data with fallback to database
 * @route GET /api/v1/reports/:reportId/cached
 * @access Private
 */
const getCachedReport = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { reportId } = req.params;
        // Try cache first
        let reportData = yield reportCache_service_1.default.getCachedReportData(reportId);
        let source = 'cache';
        // Fallback to database if not in cache
        if (!reportData) {
            const report = yield reportPersistence_service_1.default.getReportById(reportId, req.user._id.toString());
            reportData = report;
            source = 'database';
            // Cache the result for future requests
            if (report) {
                yield reportCache_service_1.default.cacheReportData(reportId, report);
            }
        }
        if (!reportData) {
            const error = new Error('Report not found');
            error.statusCode = 404;
            throw error;
        }
        res.status(200).json({
            success: true,
            data: reportData,
            metadata: {
                source,
                cachedAt: source === 'cache' ? new Date() : undefined
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getCachedReport = getCachedReport;
/**
 * Queue background report generation
 * @route POST /api/v1/reports/generate/background
 * @access Private
 */
const queueReportGeneration = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { reportType, entityType, entityId, options = {} } = req.body;
        if (!reportType || !entityType || !entityId) {
            const error = new Error('reportType, entityType, and entityId are required');
            error.statusCode = 400;
            throw error;
        }
        const result = yield backgroundGeneration_service_1.default.queueReportGeneration(reportType, entityType, entityId, req.user._id.toString(), options);
        res.status(202).json({
            success: true,
            message: 'Report generation queued successfully',
            data: {
                jobId: result.jobId,
                estimatedDuration: result.estimatedDuration,
                status: 'queued'
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.queueReportGeneration = queueReportGeneration;
/**
 * Queue batch report generation
 * @route POST /api/v1/reports/generate/batch
 * @access Private
 */
const queueBatchGeneration = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { reports, organizationId, options = {} } = req.body;
        if (!reports || !Array.isArray(reports) || reports.length === 0) {
            const error = new Error('Reports array is required and cannot be empty');
            error.statusCode = 400;
            throw error;
        }
        if (reports.length > 50) {
            const error = new Error('Maximum 50 reports can be generated in a single batch');
            error.statusCode = 400;
            throw error;
        }
        const result = yield backgroundGeneration_service_1.default.queueBatchGeneration(reports, req.user._id.toString(), organizationId, options);
        res.status(202).json({
            success: true,
            message: 'Batch report generation queued successfully',
            data: {
                jobId: result.jobId,
                estimatedDuration: result.estimatedDuration,
                reportCount: reports.length,
                status: 'queued'
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.queueBatchGeneration = queueBatchGeneration;
/**
 * Get background job status
 * @route GET /api/v1/reports/jobs/:jobId/status
 * @access Private
 */
const getJobStatus = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { jobId } = req.params;
        const { queueType = 'report' } = req.query;
        const status = yield backgroundGeneration_service_1.default.getJobStatus(jobId, queueType);
        res.status(200).json({
            success: true,
            data: status
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getJobStatus = getJobStatus;
/**
 * Cancel background job
 * @route DELETE /api/v1/reports/jobs/:jobId
 * @access Private
 */
const cancelJob = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { jobId } = req.params;
        const { queueType = 'report' } = req.query;
        const cancelled = yield backgroundGeneration_service_1.default.cancelJob(jobId, queueType);
        if (cancelled) {
            res.status(200).json({
                success: true,
                message: 'Job cancelled successfully'
            });
        }
        else {
            const error = new Error('Job not found or could not be cancelled');
            error.statusCode = 404;
            throw error;
        }
    }
    catch (error) {
        next(error);
    }
});
exports.cancelJob = cancelJob;
/**
 * Get queue statistics for monitoring
 * @route GET /api/v1/reports/queues/stats
 * @access Private (Admin only)
 */
const getQueueStats = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        // Check if user has admin privileges
        if (!req.user.isConnectGoStaff && !['admin', 'manager'].includes(req.user.primaryRole || '')) {
            const error = new Error('Admin privileges required');
            error.statusCode = 403;
            throw error;
        }
        const stats = yield backgroundGeneration_service_1.default.getQueueStats();
        res.status(200).json({
            success: true,
            data: stats
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getQueueStats = getQueueStats;
/**
 * Get cache statistics for monitoring
 * @route GET /api/v1/reports/cache/stats
 * @access Private (Admin only)
 */
const getCacheStats = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        // Check if user has admin privileges
        if (!req.user.isConnectGoStaff && !['admin', 'manager'].includes(req.user.primaryRole || '')) {
            const error = new Error('Admin privileges required');
            error.statusCode = 403;
            throw error;
        }
        const stats = yield reportCache_service_1.default.getCacheStats();
        res.status(200).json({
            success: true,
            data: stats
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getCacheStats = getCacheStats;
/**
 * Clear report caches
 * @route DELETE /api/v1/reports/cache
 * @access Private (Admin only)
 */
const clearCaches = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        // Check if user has admin privileges
        if (!req.user.isConnectGoStaff && !['admin'].includes(req.user.primaryRole || '')) {
            const error = new Error('Admin privileges required');
            error.statusCode = 403;
            throw error;
        }
        const { scope = 'all' } = req.body;
        if (scope === 'project' && req.body.projectId) {
            yield reportCache_service_1.default.invalidateProjectCaches(req.body.projectId);
        }
        else if (scope === 'report' && req.body.reportId) {
            yield reportCache_service_1.default.invalidateReport(req.body.reportId);
        }
        else {
            yield reportCache_service_1.default.clearAllCaches();
        }
        res.status(200).json({
            success: true,
            message: `Cache cleared successfully (scope: ${scope})`
        });
    }
    catch (error) {
        next(error);
    }
});
exports.clearCaches = clearCaches;
/**
 * Get report analytics and performance insights
 * @route GET /api/v1/reports/analytics
 * @access Private
 */
const getReportAnalytics = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { organizationId, projectId, timeRange = '30d' } = req.query;
        // Build filters for analytics
        const filters = {};
        if (organizationId)
            filters.organizationId = organizationId;
        if (projectId)
            filters.projectId = [projectId];
        // Set date range
        const dateRanges = {
            '7d': new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            '30d': new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            '90d': new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
            '1y': new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
        };
        if (dateRanges[timeRange]) {
            filters.createdAfter = dateRanges[timeRange];
        }
        const analytics = yield reportPersistence_service_1.default.getReportAnalytics(filters, {
            startDate: filters.createdAfter,
            endDate: new Date()
        });
        res.status(200).json({
            success: true,
            data: Object.assign(Object.assign({}, analytics), { timeRange, generatedAt: new Date() })
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getReportAnalytics = getReportAnalytics;
/**
 * Build search indexes for better performance
 * @route POST /api/v1/reports/search/build-index
 * @access Private (Admin only)
 */
const buildSearchIndex = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        // Check if user has admin privileges
        if (!req.user.isConnectGoStaff && !['admin'].includes(req.user.primaryRole || '')) {
            const error = new Error('Admin privileges required');
            error.statusCode = 403;
            throw error;
        }
        yield reportSearch_service_1.default.buildSearchIndex();
        res.status(200).json({
            success: true,
            message: 'Search indexes built successfully'
        });
    }
    catch (error) {
        next(error);
    }
});
exports.buildSearchIndex = buildSearchIndex;
exports.default = {
    searchReports: exports.searchReports,
    quickSearch: exports.quickSearch,
    getSearchFacets: exports.getSearchFacets,
    exportSearchResults: exports.exportSearchResults,
    getCachedReport: exports.getCachedReport,
    queueReportGeneration: exports.queueReportGeneration,
    queueBatchGeneration: exports.queueBatchGeneration,
    getJobStatus: exports.getJobStatus,
    cancelJob: exports.cancelJob,
    getQueueStats: exports.getQueueStats,
    getCacheStats: exports.getCacheStats,
    clearCaches: exports.clearCaches,
    getReportAnalytics: exports.getReportAnalytics,
    buildSearchIndex: exports.buildSearchIndex
};
//# sourceMappingURL=enhancedReportController.js.map