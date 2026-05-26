// services/reports/reportSearch.service.ts
import mongoose from "mongoose";
import Report from "../../models/report.model";
import Project from "../../models/project.model";
import ProjectSite from "../../models/projectSite.model";
import Organization from "../../models/organization.model";
import User from "../../models/user.model";
import ReportCacheService from "./reportCache.service";

// Search filter interfaces
interface IReportSearchFilters {
  // Basic filters
  reportType?: string[];
  status?: string[];
  visibility?: string[];
  entityType?: string[];
  
  // Organization and project filters
  organizationId?: string;
  projectId?: string[];
  projectSiteId?: string[];
  
  // User filters
  creatorId?: string[];
  approvedBy?: string;
  lastUpdatedBy?: string;
  
  // Date filters
  createdAfter?: Date;
  createdBefore?: Date;
  updatedAfter?: Date;
  updatedBefore?: Date;
  approvedAfter?: Date;
  approvedBefore?: Date;
  
  // Content search
  searchTerm?: string;
  searchFields?: string[]; // title, description, reportData content
  
  // Metadata filters
  tags?: string[];
  version?: number;
  hasExports?: boolean;
  
  // Size and complexity filters
  minTotalItems?: number;
  maxTotalItems?: number;
  minCompletionPercentage?: number;
  maxCompletionPercentage?: number;
  
  // Advanced filters
  hasSnapshots?: boolean;
  hasWorkflowHistory?: boolean;
  isExpired?: boolean;
  needsRegeneration?: boolean;
  
  // Sorting options
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  
  // Pagination
  page?: number;
  limit?: number;
}

// Advanced search options
interface IAdvancedSearchOptions {
  includeContent?: boolean; // Search within report data
  fuzzySearch?: boolean; // Enable fuzzy matching
  aggregateResults?: boolean; // Include aggregation data
  includeRelated?: boolean; // Include related entity data
  cacheResults?: boolean; // Cache search results
}

// Search result interface
interface ISearchResult {
  reports: any[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasNext: boolean;
    hasPrev: boolean;
    limit: number;
  };
  aggregations?: {
    byReportType: Record<string, number>;
    byStatus: Record<string, number>;
    byOrganization: Record<string, number>;
    byProject: Record<string, number>;
    byCreator: Record<string, number>;
    dateDistribution: Array<{
      month: string;
      count: number;
    }>;
  };
  searchMetadata: {
    query: IReportSearchFilters;
    executionTime: number;
    fromCache: boolean;
    totalResults: number;
  };
}

export class ReportSearchService {
  
  /**
   * Advanced report search with comprehensive filtering
   */
  static async searchReports(
    filters: IReportSearchFilters,
    options: IAdvancedSearchOptions = {},
    userId?: string
  ): Promise<ISearchResult> {
    const startTime = Date.now();
    
    try {
      // Check cache first
      let cacheKey = '';
      let cachedResult = null;
      
      if (options.cacheResults !== false) {
        cacheKey = this.generateCacheKey(filters, options);
        cachedResult = await ReportCacheService.getCachedReportList({ searchFilters: filters });
        
        if (cachedResult) {
          return {
            ...cachedResult,
            searchMetadata: {
              ...cachedResult.searchMetadata,
              fromCache: true,
              executionTime: Date.now() - startTime
            }
          };
        }
      }

      // Build MongoDB aggregation pipeline
      const pipeline = await this.buildSearchPipeline(filters, options, userId);
      
      // Execute search
      const [results, countResults] = await Promise.all([
        Report.aggregate(pipeline),
        this.getSearchCount(filters, userId)
      ]);

      // Process pagination
      const page = filters.page || 1;
      const limit = Math.min(filters.limit || 20, 100); // Max 100 per page
      const totalCount = countResults;
      const totalPages = Math.ceil(totalCount / limit);

      // Generate aggregations if requested
      let aggregations;
      if (options.aggregateResults) {
        aggregations = await this.generateAggregations(filters, userId);
      }

      const searchResult: ISearchResult = {
        reports: results,
        pagination: {
          currentPage: page,
          totalPages,
          totalCount,
          hasNext: page < totalPages,
          hasPrev: page > 1,
          limit
        },
        aggregations,
        searchMetadata: {
          query: filters,
          executionTime: Date.now() - startTime,
          fromCache: false,
          totalResults: totalCount
        }
      };

      // Cache results
      if (options.cacheResults !== false && cacheKey) {
        await ReportCacheService.cacheReportList({ searchFilters: filters }, searchResult);
      }

      return searchResult;

    } catch (error) {
      console.error('Report search failed:', error);
      throw new Error(`Report search failed: ${error}`);
    }
  }

  /**
   * Quick search for reports with autocomplete suggestions
   */
  static async quickSearch(
    searchTerm: string,
    userId?: string,
    limit: number = 10
  ): Promise<{
    reports: Array<{
      _id: string;
      title: string;
      reportType: string;
      projectName: string;
      organizationName: string;
      status: string;
      createdAt: Date;
      relevanceScore: number;
    }>;
    suggestions: string[];
  }> {
    try {
      const pipeline = [
        // Text search stage
        {
          $match: {
            $and: [
              { archived: { $ne: true } },
              {
                $or: [
                  { title: { $regex: searchTerm, $options: 'i' } },
                  { description: { $regex: searchTerm, $options: 'i' } },
                  { 'metadata.tags': { $regex: searchTerm, $options: 'i' } }
                ]
              }
            ]
          }
        },
        
        // Add relevance scoring
        {
          $addFields: {
            relevanceScore: {
              $add: [
                // Title match gets highest score
                {
                  $cond: [
                    { $regexMatch: { input: '$title', regex: searchTerm, options: 'i' } },
                    10,
                    0
                  ]
                },
                // Description match gets medium score
                {
                  $cond: [
                    { $regexMatch: { input: '$description', regex: searchTerm, options: 'i' } },
                    5,
                    0
                  ]
                },
                // Tag match gets low score
                {
                  $cond: [
                    { $in: [{ $regex: searchTerm, $options: 'i' }, '$metadata.tags'] },
                    3,
                    0
                  ]
                }
              ]
            }
          }
        },
        
        // Join with related collections
        {
          $lookup: {
            from: 'projects',
            localField: 'project',
            foreignField: '_id',
            as: 'projectInfo'
          }
        },
        {
          $lookup: {
            from: 'organizations',
            localField: 'organization',
            foreignField: '_id',
            as: 'orgInfo'
          }
        },
        
        // Sort by relevance and recency
        {
            $sort: {
                relevanceScore: -1 as -1,
                createdAt: -1 as -1
            }
        },
        
        // Limit results
        { $limit: limit },
        
        // Project only needed fields
        {
          $project: {
            _id: 1,
            title: 1,
            reportType: 1,
            status: 1,
            createdAt: 1,
            relevanceScore: 1,
            projectName: { $first: '$projectInfo.name' },
            organizationName: { $first: '$orgInfo.name' }
          }
        }
      ];

      const results = await Report.aggregate(pipeline);

      // Generate search suggestions
      const suggestions = await this.generateSearchSuggestions(searchTerm);

      return {
        reports: results,
        suggestions
      };

    } catch (error) {
      console.error('Quick search failed:', error);
      throw new Error(`Quick search failed: ${error}`);
    }
  }

  /**
   * Get saved search filters and recent searches for a user
   */
  static async getUserSearchHistory(userId: string): Promise<{
    savedSearches: Array<{
      id: string;
      name: string;
      filters: IReportSearchFilters;
      createdAt: Date;
      lastUsed: Date;
    }>;
    recentSearches: Array<{
      searchTerm: string;
      filters: IReportSearchFilters;
      searchedAt: Date;
    }>;
  }> {
    try {
      // This would typically come from a UserSearchHistory model
      // For now, return empty arrays - implement based on your requirements
      return {
        savedSearches: [],
        recentSearches: []
      };

    } catch (error) {
      console.error('Failed to get user search history:', error);
      return {
        savedSearches: [],
        recentSearches: []
      };
    }
  }

  /**
   * Get faceted search options for building search UI
   */
  static async getSearchFacets(userId?: string): Promise<{
    reportTypes: Array<{ value: string; label: string; count: number }>;
    statuses: Array<{ value: string; label: string; count: number }>;
    organizations: Array<{ value: string; label: string; count: number }>;
    projects: Array<{ value: string; label: string; count: number }>;
    creators: Array<{ value: string; label: string; count: number }>;
    tags: Array<{ value: string; count: number }>;
  }> {
    try {
      const baseQuery = { archived: { $ne: true } };
      
      const [
        reportTypeFacets,
        statusFacets,
        organizationFacets,
        projectFacets,
        creatorFacets,
        tagFacets
      ] = await Promise.all([
        this.getFacetCounts('reportType', baseQuery),
        this.getFacetCounts('status', baseQuery),
        this.getEntityFacets('organization', 'organizations', 'name', baseQuery),
        this.getEntityFacets('project', 'projects', 'name', baseQuery),
        this.getEntityFacets('creator', 'users', 'name', baseQuery),
        this.getArrayFacets('metadata.tags', baseQuery)
      ]);

      return {
        reportTypes: this.formatReportTypeFacets(reportTypeFacets),
        statuses: this.formatStatusFacets(statusFacets),
        organizations: organizationFacets,
        projects: projectFacets,
        creators: creatorFacets,
        tags: tagFacets
      };

    } catch (error) {
      console.error('Failed to get search facets:', error);
      return {
        reportTypes: [],
        statuses: [],
        organizations: [],
        projects: [],
        creators: [],
        tags: []
      };
    }
  }

  /**
   * Export search results to different formats
   */
  static async exportSearchResults(
    filters: IReportSearchFilters,
    format: 'csv' | 'excel' | 'json',
    userId?: string
  ): Promise<{
    data: any;
    filename: string;
    contentType: string;
  }> {
    try {
      // Get all matching reports without pagination
      const searchFilters = { ...filters, page: 1, limit: 10000 };
      const results = await this.searchReports(searchFilters, { 
        includeContent: false,
        cacheResults: false 
      }, userId);

      const exportData = results.reports.map(report => ({
        id: report._id,
        title: report.title,
        reportType: report.reportType,
        status: report.status,
        projectName: report.projectInfo?.name || '',
        organizationName: report.orgInfo?.name || '',
        creatorName: report.creatorInfo?.name || '',
        createdAt: report.createdAt,
        lastUpdated: report.updatedAt,
        totalItems: report.metadata?.summary?.totalItems || 0,
        completedItems: report.metadata?.summary?.completedItems || 0,
        completionPercentage: report.metadata?.summary?.completionPercentage || 0
      }));

      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `reports-export-${timestamp}`;

      switch (format) {
        case 'csv':
          return {
            data: this.convertToCSV(exportData),
            filename: `${filename}.csv`,
            contentType: 'text/csv'
          };
        case 'excel':
          return {
            data: this.convertToExcel(exportData),
            filename: `${filename}.xlsx`,
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          };
        case 'json':
        default:
          return {
            data: JSON.stringify(exportData, null, 2),
            filename: `${filename}.json`,
            contentType: 'application/json'
          };
      }

    } catch (error) {
      console.error('Export search results failed:', error);
      throw new Error(`Export failed: ${error}`);
    }
  }

  // Private helper methods
  private static async buildSearchPipeline(
    filters: IReportSearchFilters,
    options: IAdvancedSearchOptions,
    userId?: string
  ): Promise<any[]> {
    const pipeline: any[] = [];

    // Base match stage
    const matchStage: any = {
      archived: { $ne: true }
    };

    // Apply filters
    if (filters.reportType?.length) {
      matchStage.reportType = { $in: filters.reportType };
    }

    if (filters.status?.length) {
      matchStage.status = { $in: filters.status };
    }

    if (filters.visibility?.length) {
      matchStage.visibility = { $in: filters.visibility };
    }

    if (filters.entityType?.length) {
      matchStage.entityType = { $in: filters.entityType };
    }

    if (filters.organizationId) {
      matchStage.organization = new mongoose.Types.ObjectId(filters.organizationId);
    }

    if (filters.projectId?.length) {
      matchStage.project = { $in: filters.projectId.map(id => new mongoose.Types.ObjectId(id)) };
    }

    if (filters.projectSiteId?.length) {
      matchStage.projectSite = { $in: filters.projectSiteId.map(id => new mongoose.Types.ObjectId(id)) };
    }

    if (filters.creatorId?.length) {
      matchStage.creator = { $in: filters.creatorId.map(id => new mongoose.Types.ObjectId(id)) };
    }

    // Date filters
    if (filters.createdAfter || filters.createdBefore) {
      matchStage.createdAt = {};
      if (filters.createdAfter) matchStage.createdAt.$gte = filters.createdAfter;
      if (filters.createdBefore) matchStage.createdAt.$lte = filters.createdBefore;
    }

    if (filters.updatedAfter || filters.updatedBefore) {
      matchStage.updatedAt = {};
      if (filters.updatedAfter) matchStage.updatedAt.$gte = filters.updatedAfter;
      if (filters.updatedBefore) matchStage.updatedAt.$lte = filters.updatedBefore;
    }

    // Content search
    if (filters.searchTerm) {
      const searchFields = filters.searchFields || ['title', 'description'];
      const searchConditions = searchFields.map(field => ({
        [field]: { $regex: filters.searchTerm, $options: 'i' }
      }));

      if (options.includeContent) {
        // Add search within report data (expensive operation)
        searchConditions.push({
          'reportData': { $regex: filters.searchTerm, $options: 'i' }
        });
      }

      matchStage.$or = searchConditions;
    }

    // Metadata filters
    if (filters.tags?.length) {
      matchStage['metadata.tags'] = { $in: filters.tags };
    }

    if (filters.version) {
      matchStage.version = filters.version;
    }

    // Advanced filters
    if (filters.hasExports) {
      matchStage['metadata.exportHistory'] = { $exists: true, $not: { $size: 0 } };
    }

    if (filters.hasSnapshots) {
      // This would require a lookup to snapshots collection
      // Implement based on your snapshot storage strategy
    }

    pipeline.push({ $match: matchStage });

    // Lookup stages for related data
    if (options.includeRelated !== false) {
      pipeline.push(
        {
          $lookup: {
            from: 'organizations',
            localField: 'organization',
            foreignField: '_id',
            as: 'orgInfo'
          }
        },
        {
          $lookup: {
            from: 'projects',
            localField: 'project',
            foreignField: '_id',
            as: 'projectInfo'
          }
        },
        {
          $lookup: {
            from: 'projectsites',
            localField: 'projectSite',
            foreignField: '_id',
            as: 'siteInfo'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'creator',
            foreignField: '_id',
            as: 'creatorInfo'
          }
        }
      );
    }

    // Sorting
    const sortStage: any = {};
    if (filters.sortBy) {
      sortStage[filters.sortBy] = filters.sortOrder === 'asc' ? 1 : -1;
    } else {
      sortStage.createdAt = -1; // Default sort by newest
    }
    pipeline.push({ $sort: sortStage });

    // Pagination
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const skip = (page - 1) * limit;

    pipeline.push(
      { $skip: skip },
      { $limit: limit }
    );

    return pipeline;
  }

  private static async getSearchCount(filters: IReportSearchFilters, userId?: string): Promise<number> {
    const pipeline = await this.buildSearchPipeline(filters, { includeRelated: false }, userId);
    
    // Remove pagination stages and add count
    const countPipeline = pipeline
      .filter(stage => !stage.$skip && !stage.$limit)
      .concat([{ $count: 'total' }]);

    const countResult = await Report.aggregate(countPipeline);
    return countResult[0]?.total || 0;
  }

  private static async generateAggregations(filters: IReportSearchFilters, userId?: string): Promise<any> {
    const baseQuery = { archived: { $ne: true } };
    
    // Apply basic filters for aggregations (exclude the field being aggregated)
    if (filters.organizationId) {
      (baseQuery as any).organization = new mongoose.Types.ObjectId(filters.organizationId);
    }

    const [
      reportTypeAgg,
      statusAgg,
      organizationAgg,
      projectAgg,
      creatorAgg,
      dateDistribution
    ] = await Promise.all([
      this.getFacetCounts('reportType', baseQuery),
      this.getFacetCounts('status', baseQuery),
      this.getEntityFacets('organization', 'organizations', 'name', baseQuery),
      this.getEntityFacets('project', 'projects', 'name', baseQuery),
      this.getEntityFacets('creator', 'users', 'name', baseQuery),
      this.getDateDistribution(baseQuery)
    ]);

    return {
      byReportType: this.arrayToObject(reportTypeAgg),
      byStatus: this.arrayToObject(statusAgg),
      byOrganization: this.arrayToObject(organizationAgg as any),
      byProject: this.arrayToObject(projectAgg as any),
      byCreator: this.arrayToObject(creatorAgg as any),
      dateDistribution
    };
  }

  private static async getFacetCounts(field: string, baseQuery: any): Promise<Array<{_id: string, count: number}>> {
    return await Report.aggregate([
      { $match: baseQuery },
      { $group: { _id: `${field}`, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 50 }
    ]);
  }

  private static async getEntityFacets(
    localField: string, 
    fromCollection: string, 
    nameField: string, 
    baseQuery: any
  ): Promise<Array<{value: string, label: string, count: number}>> {
    const results = await Report.aggregate([
      { $match: baseQuery },
      { $group: { _id: `${localField}`, count: { $sum: 1 } } },
      {
        $lookup: {
          from: fromCollection,
          localField: '_id',
          foreignField: '_id',
          as: 'entityInfo'
        }
      },
      {
        $project: {
          value: { $toString: '$_id' },
          label: { $first: `$entityInfo.${nameField}` },
          count: 1
        }
      },
      { $sort: { count: -1 } },
      { $limit: 50 }
    ]);

    return results.map(r => ({
      value: r.value,
      label: r.label || 'Unknown',
      count: r.count
    }));
  }

  private static async getArrayFacets(field: string, baseQuery: any): Promise<Array<{value: string, count: number}>> {
    const results = await Report.aggregate([
      { $match: baseQuery },
      { $unwind: `${field}` },
      { $group: { _id: `${field}`, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);

    return results.map(r => ({
      value: r._id,
      count: r.count
    }));
  }

  private static async getDateDistribution(baseQuery: any): Promise<Array<{month: string, count: number}>> {
    const results = await Report.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } },
      { $limit: 12 }
    ]);

    return results.map(r => ({
      month: `${r._id.year}-${r._id.month.toString().padStart(2, '0')}`,
      count: r.count
    }));
  }

  private static async generateSearchSuggestions(searchTerm: string): Promise<string[]> {
    // Generate suggestions based on common report terms, tags, etc.
    const suggestions: string[] = [];

    try {
      // Get common tags that match the search term
      const tagSuggestions = await Report.aggregate([
        { $match: { archived: { $ne: true } } },
        { $unwind: '$metadata.tags' },
        { $match: { 'metadata.tags': { $regex: searchTerm, $options: 'i' } } },
        { $group: { _id: '$metadata.tags', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]);

      suggestions.push(...tagSuggestions.map(s => s._id));

      // Get common report titles that partially match
      const titleSuggestions = await Report.aggregate([
        { $match: { 
          archived: { $ne: true },
          title: { $regex: searchTerm, $options: 'i' }
        }},
        { $group: { _id: '$title', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 3 }
      ]);

      suggestions.push(...titleSuggestions.map(s => s._id));

      // Add some predefined suggestions based on report types
      const predefinedSuggestions = [
        'project setup',
        'stakeholder mapping', 
        'risk register',
        'theory of change',
        'site setup',
        'completed',
        'draft',
        'approved'
      ].filter(s => s.toLowerCase().includes(searchTerm.toLowerCase()));

      suggestions.push(...predefinedSuggestions);

      // Return unique suggestions, limited to 10
      return [...new Set(suggestions)].slice(0, 10);

    } catch (error) {
      console.error('Failed to generate search suggestions:', error);
      return [];
    }
  }

  private static generateCacheKey(filters: IReportSearchFilters, options: IAdvancedSearchOptions): string {
    const crypto = require('crypto');
    const keyData = JSON.stringify({ filters, options }, Object.keys({ filters, options }).sort());
    return crypto.createHash('md5').update(keyData).digest('hex');
  }

  private static formatReportTypeFacets(facets: Array<{_id: string, count: number}>): Array<{value: string, label: string, count: number}> {
    const labels: Record<string, string> = {
      'project_setup': 'Project Setup',
      'project_site_setup': 'Site Setup',
      'stakeholder_mapping': 'Stakeholder Mapping',
      'theory_of_change': 'Theory of Change',
      'risk_register': 'Risk Register'
    };

    return facets.map(f => ({
      value: f._id,
      label: labels[f._id] || f._id,
      count: f.count
    }));
  }

  private static formatStatusFacets(facets: Array<{_id: string, count: number}>): Array<{value: string, label: string, count: number}> {
    const labels: Record<string, string> = {
      'draft': 'Draft',
      'generated': 'Generated', 
      'approved': 'Approved',
      'published': 'Published',
      'archived': 'Archived'
    };

    return facets.map(f => ({
      value: f._id,
      label: labels[f._id] || f._id,
      count: f.count
    }));
  }

  private static arrayToObject(array: Array<{_id: string, count: number}>): Record<string, number> {
    return array.reduce((obj, item) => {
      obj[item._id] = item.count;
      return obj;
    }, {} as Record<string, number>);
  }

  private static convertToCSV(data: any[]): string {
    if (!data.length) return '';

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Escape quotes and wrap in quotes if contains comma
          const escaped = String(value).replace(/"/g, '""');
          return escaped.includes(',') ? `"${escaped}"` : escaped;
        }).join(',')
      )
    ];

    return csvContent.join('\n');
  }

  private static convertToExcel(data: any[]): Buffer {
    // This would require a library like 'exceljs' or 'xlsx'
    // For now, return CSV as buffer
    const csvData = this.convertToCSV(data);
    return Buffer.from(csvData, 'utf8');
  }

  /**
   * Build search index for better performance
   */
  static async buildSearchIndex(): Promise<void> {
    try {
      // Create text index for content search
      await Report.collection.createIndex({
        title: 'text',
        description: 'text',
        'metadata.tags': 'text'
      }, {
        name: 'report_text_index',
        weights: {
          title: 10,
          description: 5,
          'metadata.tags': 3
        }
      });

      // Create compound indexes for common filter combinations
      await Report.collection.createIndex({
        organization: 1,
        reportType: 1,
        status: 1,
        createdAt: -1
      });

      await Report.collection.createIndex({
        project: 1,
        reportType: 1,
        createdAt: -1
      });

      await Report.collection.createIndex({
        creator: 1,
        status: 1,
        createdAt: -1
      });

      console.log('Report search indexes created successfully');

    } catch (error) {
      console.error('Failed to build search indexes:', error);
    }
  }

  /**
   * Analyze search patterns for optimization
   */
  static async analyzeSearchPatterns(): Promise<{
    topSearchTerms: Array<{term: string, frequency: number}>;
    commonFilterCombinations: Array<{filters: any, frequency: number}>;
    performanceMetrics: {
      averageSearchTime: number;
      slowQueries: Array<{query: any, executionTime: number}>;
    };
  }> {
    // This would analyze search logs to optimize performance
    // Implementation depends on your logging strategy
    return {
      topSearchTerms: [],
      commonFilterCombinations: [],
      performanceMetrics: {
        averageSearchTime: 0,
        slowQueries: []
      }
    };
  }
}

export default ReportSearchService;