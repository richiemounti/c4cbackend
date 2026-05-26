// controllers/reports/enhancedReportController.ts
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Report from "../../models/report.model";
import { CustomError } from "../../middlewares/error.middleware";
import ReportSearchService from "../../services/reports/reportSearch.service";
import ReportCacheService from "../../services/reports/reportCache.service";
import BackgroundReportGenerationService from "../../services/reports/backgroundGeneration.service";
import ReportPersistenceService from "../../services/reports/reportPersistence.service";
import { trackReportActivity } from "../../middlewares/reportActivity.middleware";

// Type guard for authenticated user
function isUserAuthenticated(req: Request): req is Request & { 
  user: { 
    _id: mongoose.Types.ObjectId; 
    primaryRole?: string;
    isConnectGoStaff?: boolean;
  } 
} {
  return req.user !== undefined;
}

/**
 * Advanced search for reports with comprehensive filtering
 * @route POST /api/v1/reports/search
 * @access Private
 */
export const searchReports = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const {
      filters = {},
      options = {}
    } = req.body;

    // Enhanced search with user context
    const searchResult = await ReportSearchService.searchReports(
      filters,
      {
        includeContent: options.includeContent || false,
        fuzzySearch: options.fuzzySearch || false,
        aggregateResults: options.aggregateResults || true,
        includeRelated: options.includeRelated !== false,
        cacheResults: options.cacheResults !== false
      },
      req.user._id.toString()
    );

    res.status(200).json({
      success: true,
      data: searchResult
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Quick search for reports with autocomplete
 * @route GET /api/v1/reports/quick-search
 * @access Private
 */
export const quickSearch = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { q: searchTerm, limit = 10 } = req.query;

    if (!searchTerm || typeof searchTerm !== 'string') {
      const error = new Error('Search term is required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const results = await ReportSearchService.quickSearch(
      searchTerm,
      req.user._id.toString(),
      parseInt(limit as string)
    );

    res.status(200).json({
      success: true,
      data: results
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get search facets for building advanced search UI
 * @route GET /api/v1/reports/search/facets
 * @access Private
 */
export const getSearchFacets = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const facets = await ReportSearchService.getSearchFacets(req.user._id.toString());

    res.status(200).json({
      success: true,
      data: facets
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Export search results in various formats
 * @route POST /api/v1/reports/search/export
 * @access Private
 */
export const exportSearchResults = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const {
      filters = {},
      format = 'json'
    } = req.body;

    if (!['csv', 'excel', 'json'].includes(format)) {
      const error = new Error('Invalid export format. Supported: csv, excel, json') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const exportResult = await ReportSearchService.exportSearchResults(
      filters,
      format,
      req.user._id.toString()
    );

    // Set appropriate headers
    res.setHeader('Content-Type', exportResult.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
    
    res.status(200).send(exportResult.data);

  } catch (error) {
    next(error);
  }
};

/**
 * Get cached report data with fallback to database
 * @route GET /api/v1/reports/:reportId/cached
 * @access Private
 */
export const getCachedReport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { reportId } = req.params;

    // Try cache first
    let reportData = await ReportCacheService.getCachedReportData(reportId);
    let source = 'cache';

    // Fallback to database if not in cache
    if (!reportData) {
      const report = await ReportPersistenceService.getReportById(reportId, req.user._id.toString());
      reportData = report;
      source = 'database';

      // Cache the result for future requests
      if (report) {
        await ReportCacheService.cacheReportData(reportId, report);
      }
    }

    if (!reportData) {
      const error = new Error('Report not found') as CustomError;
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

  } catch (error) {
    next(error);
  }
};

/**
 * Queue background report generation
 * @route POST /api/v1/reports/generate/background
 * @access Private
 */
export const queueReportGeneration = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const {
      reportType,
      entityType,
      entityId,
      options = {}
    } = req.body;

    if (!reportType || !entityType || !entityId) {
      const error = new Error('reportType, entityType, and entityId are required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const result = await BackgroundReportGenerationService.queueReportGeneration(
      reportType,
      entityType,
      entityId,
      req.user._id.toString(),
      options
    );

    res.status(202).json({
      success: true,
      message: 'Report generation queued successfully',
      data: {
        jobId: result.jobId,
        estimatedDuration: result.estimatedDuration,
        status: 'queued'
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Queue batch report generation
 * @route POST /api/v1/reports/generate/batch
 * @access Private
 */
export const queueBatchGeneration = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const {
      reports,
      organizationId,
      options = {}
    } = req.body;

    if (!reports || !Array.isArray(reports) || reports.length === 0) {
      const error = new Error('Reports array is required and cannot be empty') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    if (reports.length > 50) {
      const error = new Error('Maximum 50 reports can be generated in a single batch') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const result = await BackgroundReportGenerationService.queueBatchGeneration(
      reports,
      req.user._id.toString(),
      organizationId,
      options
    );

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

  } catch (error) {
    next(error);
  }
};

/**
 * Get background job status
 * @route GET /api/v1/reports/jobs/:jobId/status
 * @access Private
 */
export const getJobStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { jobId } = req.params;
    const { queueType = 'report' } = req.query;

    const status = await BackgroundReportGenerationService.getJobStatus(
      jobId, 
      queueType as 'report' | 'batch' | 'regeneration'
    );

    res.status(200).json({
      success: true,
      data: status
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Cancel background job
 * @route DELETE /api/v1/reports/jobs/:jobId
 * @access Private
 */
export const cancelJob = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { jobId } = req.params;
    const { queueType = 'report' } = req.query;

    const cancelled = await BackgroundReportGenerationService.cancelJob(
      jobId,
      queueType as 'report' | 'batch' | 'regeneration'
    );

    if (cancelled) {
      res.status(200).json({
        success: true,
        message: 'Job cancelled successfully'
      });
    } else {
      const error = new Error('Job not found or could not be cancelled') as CustomError;
      error.statusCode = 404;
      throw error;
    }

  } catch (error) {
    next(error);
  }
};

/**
 * Get queue statistics for monitoring
 * @route GET /api/v1/reports/queues/stats
 * @access Private (Admin only)
 */
export const getQueueStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    // Check if user has admin privileges
    if (!req.user.isConnectGoStaff && !['admin', 'manager'].includes(req.user.primaryRole || '')) {
      const error = new Error('Admin privileges required') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const stats = await BackgroundReportGenerationService.getQueueStats();

    res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get cache statistics for monitoring
 * @route GET /api/v1/reports/cache/stats
 * @access Private (Admin only)
 */
export const getCacheStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    // Check if user has admin privileges
    if (!req.user.isConnectGoStaff && !['admin', 'manager'].includes(req.user.primaryRole || '')) {
      const error = new Error('Admin privileges required') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const stats = await ReportCacheService.getCacheStats();

    res.status(200).json({
      success: true,
      data: stats
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Clear report caches
 * @route DELETE /api/v1/reports/cache
 * @access Private (Admin only)
 */
export const clearCaches = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    // Check if user has admin privileges
    if (!req.user.isConnectGoStaff && !['admin'].includes(req.user.primaryRole || '')) {
      const error = new Error('Admin privileges required') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const { scope = 'all' } = req.body;

    if (scope === 'project' && req.body.projectId) {
      await ReportCacheService.invalidateProjectCaches(req.body.projectId);
    } else if (scope === 'report' && req.body.reportId) {
      await ReportCacheService.invalidateReport(req.body.reportId);
    } else {
      await ReportCacheService.clearAllCaches();
    }

    res.status(200).json({
      success: true,
      message: `Cache cleared successfully (scope: ${scope})`
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get report analytics and performance insights
 * @route GET /api/v1/reports/analytics
 * @access Private
 */
export const getReportAnalytics = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const {
      organizationId,
      projectId,
      timeRange = '30d'
    } = req.query;

    // Build filters for analytics
    const filters: any = {};
    if (organizationId) filters.organizationId = organizationId as string;
    if (projectId) filters.projectId = [projectId as string];

    // Set date range
    const dateRanges: Record<string, Date> = {
      '7d': new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      '30d': new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      '90d': new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      '1y': new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
    };

    if (dateRanges[timeRange as string]) {
      filters.createdAfter = dateRanges[timeRange as string];
    }

    const analytics = await ReportPersistenceService.getReportAnalytics(filters, {
      startDate: filters.createdAfter,
      endDate: new Date()
    });

    res.status(200).json({
      success: true,
      data: {
        ...analytics,
        timeRange,
        generatedAt: new Date()
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Build search indexes for better performance
 * @route POST /api/v1/reports/search/build-index
 * @access Private (Admin only)
 */
export const buildSearchIndex = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    // Check if user has admin privileges
    if (!req.user.isConnectGoStaff && !['admin'].includes(req.user.primaryRole || '')) {
      const error = new Error('Admin privileges required') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    await ReportSearchService.buildSearchIndex();

    res.status(200).json({
      success: true,
      message: 'Search indexes built successfully'
    });

  } catch (error) {
    next(error);
  }
};

export default {
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
};