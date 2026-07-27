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
exports.ReportSearchService = void 0;
// services/reports/reportSearch.service.ts
const mongoose_1 = __importDefault(require("mongoose"));
const report_model_1 = __importDefault(require("../../models/report.model"));
const reportCache_service_1 = __importDefault(require("./reportCache.service"));
class ReportSearchService {
    /**
     * Advanced report search with comprehensive filtering
     */
    static searchReports(filters_1) {
        return __awaiter(this, arguments, void 0, function* (filters, options = {}, userId) {
            const startTime = Date.now();
            try {
                // Check cache first
                let cacheKey = '';
                let cachedResult = null;
                if (options.cacheResults !== false) {
                    cacheKey = this.generateCacheKey(filters, options);
                    cachedResult = yield reportCache_service_1.default.getCachedReportList({ searchFilters: filters });
                    if (cachedResult) {
                        return Object.assign(Object.assign({}, cachedResult), { searchMetadata: Object.assign(Object.assign({}, cachedResult.searchMetadata), { fromCache: true, executionTime: Date.now() - startTime }) });
                    }
                }
                // Build MongoDB aggregation pipeline
                const pipeline = yield this.buildSearchPipeline(filters, options, userId);
                // Execute search
                const [results, countResults] = yield Promise.all([
                    report_model_1.default.aggregate(pipeline),
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
                    aggregations = yield this.generateAggregations(filters, userId);
                }
                const searchResult = {
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
                    yield reportCache_service_1.default.cacheReportList({ searchFilters: filters }, searchResult);
                }
                return searchResult;
            }
            catch (error) {
                console.error('Report search failed:', error);
                throw new Error(`Report search failed: ${error}`);
            }
        });
    }
    /**
     * Quick search for reports with autocomplete suggestions
     */
    static quickSearch(searchTerm_1, userId_1) {
        return __awaiter(this, arguments, void 0, function* (searchTerm, userId, limit = 10) {
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
                            relevanceScore: -1,
                            createdAt: -1
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
                const results = yield report_model_1.default.aggregate(pipeline);
                // Generate search suggestions
                const suggestions = yield this.generateSearchSuggestions(searchTerm);
                return {
                    reports: results,
                    suggestions
                };
            }
            catch (error) {
                console.error('Quick search failed:', error);
                throw new Error(`Quick search failed: ${error}`);
            }
        });
    }
    /**
     * Get saved search filters and recent searches for a user
     */
    static getUserSearchHistory(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // This would typically come from a UserSearchHistory model
                // For now, return empty arrays - implement based on your requirements
                return {
                    savedSearches: [],
                    recentSearches: []
                };
            }
            catch (error) {
                console.error('Failed to get user search history:', error);
                return {
                    savedSearches: [],
                    recentSearches: []
                };
            }
        });
    }
    /**
     * Get faceted search options for building search UI
     */
    static getSearchFacets(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const baseQuery = { archived: { $ne: true } };
                const [reportTypeFacets, statusFacets, organizationFacets, projectFacets, creatorFacets, tagFacets] = yield Promise.all([
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
            }
            catch (error) {
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
        });
    }
    /**
     * Export search results to different formats
     */
    static exportSearchResults(filters, format, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Get all matching reports without pagination
                const searchFilters = Object.assign(Object.assign({}, filters), { page: 1, limit: 10000 });
                const results = yield this.searchReports(searchFilters, {
                    includeContent: false,
                    cacheResults: false
                }, userId);
                const exportData = results.reports.map(report => {
                    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
                    return ({
                        id: report._id,
                        title: report.title,
                        reportType: report.reportType,
                        status: report.status,
                        projectName: ((_a = report.projectInfo) === null || _a === void 0 ? void 0 : _a.name) || '',
                        organizationName: ((_b = report.orgInfo) === null || _b === void 0 ? void 0 : _b.name) || '',
                        creatorName: ((_c = report.creatorInfo) === null || _c === void 0 ? void 0 : _c.name) || '',
                        createdAt: report.createdAt,
                        lastUpdated: report.updatedAt,
                        totalItems: ((_e = (_d = report.metadata) === null || _d === void 0 ? void 0 : _d.summary) === null || _e === void 0 ? void 0 : _e.totalItems) || 0,
                        completedItems: ((_g = (_f = report.metadata) === null || _f === void 0 ? void 0 : _f.summary) === null || _g === void 0 ? void 0 : _g.completedItems) || 0,
                        completionPercentage: ((_j = (_h = report.metadata) === null || _h === void 0 ? void 0 : _h.summary) === null || _j === void 0 ? void 0 : _j.completionPercentage) || 0
                    });
                });
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
            }
            catch (error) {
                console.error('Export search results failed:', error);
                throw new Error(`Export failed: ${error}`);
            }
        });
    }
    // Private helper methods
    static buildSearchPipeline(filters, options, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            const pipeline = [];
            // Base match stage
            const matchStage = {
                archived: { $ne: true }
            };
            // Apply filters
            if ((_a = filters.reportType) === null || _a === void 0 ? void 0 : _a.length) {
                matchStage.reportType = { $in: filters.reportType };
            }
            if ((_b = filters.status) === null || _b === void 0 ? void 0 : _b.length) {
                matchStage.status = { $in: filters.status };
            }
            if ((_c = filters.visibility) === null || _c === void 0 ? void 0 : _c.length) {
                matchStage.visibility = { $in: filters.visibility };
            }
            if ((_d = filters.entityType) === null || _d === void 0 ? void 0 : _d.length) {
                matchStage.entityType = { $in: filters.entityType };
            }
            if (filters.organizationId) {
                matchStage.organization = new mongoose_1.default.Types.ObjectId(filters.organizationId);
            }
            if ((_e = filters.projectId) === null || _e === void 0 ? void 0 : _e.length) {
                matchStage.project = { $in: filters.projectId.map(id => new mongoose_1.default.Types.ObjectId(id)) };
            }
            if ((_f = filters.projectSiteId) === null || _f === void 0 ? void 0 : _f.length) {
                matchStage.projectSite = { $in: filters.projectSiteId.map(id => new mongoose_1.default.Types.ObjectId(id)) };
            }
            if ((_g = filters.creatorId) === null || _g === void 0 ? void 0 : _g.length) {
                matchStage.creator = { $in: filters.creatorId.map(id => new mongoose_1.default.Types.ObjectId(id)) };
            }
            // Date filters
            if (filters.createdAfter || filters.createdBefore) {
                matchStage.createdAt = {};
                if (filters.createdAfter)
                    matchStage.createdAt.$gte = filters.createdAfter;
                if (filters.createdBefore)
                    matchStage.createdAt.$lte = filters.createdBefore;
            }
            if (filters.updatedAfter || filters.updatedBefore) {
                matchStage.updatedAt = {};
                if (filters.updatedAfter)
                    matchStage.updatedAt.$gte = filters.updatedAfter;
                if (filters.updatedBefore)
                    matchStage.updatedAt.$lte = filters.updatedBefore;
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
            if ((_h = filters.tags) === null || _h === void 0 ? void 0 : _h.length) {
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
                pipeline.push({
                    $lookup: {
                        from: 'organizations',
                        localField: 'organization',
                        foreignField: '_id',
                        as: 'orgInfo'
                    }
                }, {
                    $lookup: {
                        from: 'projects',
                        localField: 'project',
                        foreignField: '_id',
                        as: 'projectInfo'
                    }
                }, {
                    $lookup: {
                        from: 'projectsites',
                        localField: 'projectSite',
                        foreignField: '_id',
                        as: 'siteInfo'
                    }
                }, {
                    $lookup: {
                        from: 'users',
                        localField: 'creator',
                        foreignField: '_id',
                        as: 'creatorInfo'
                    }
                });
            }
            // Sorting
            const sortStage = {};
            if (filters.sortBy) {
                sortStage[filters.sortBy] = filters.sortOrder === 'asc' ? 1 : -1;
            }
            else {
                sortStage.createdAt = -1; // Default sort by newest
            }
            pipeline.push({ $sort: sortStage });
            // Pagination
            const page = filters.page || 1;
            const limit = Math.min(filters.limit || 20, 100);
            const skip = (page - 1) * limit;
            pipeline.push({ $skip: skip }, { $limit: limit });
            return pipeline;
        });
    }
    static getSearchCount(filters, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const pipeline = yield this.buildSearchPipeline(filters, { includeRelated: false }, userId);
            // Remove pagination stages and add count
            const countPipeline = pipeline
                .filter(stage => !stage.$skip && !stage.$limit)
                .concat([{ $count: 'total' }]);
            const countResult = yield report_model_1.default.aggregate(countPipeline);
            return ((_a = countResult[0]) === null || _a === void 0 ? void 0 : _a.total) || 0;
        });
    }
    static generateAggregations(filters, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const baseQuery = { archived: { $ne: true } };
            // Apply basic filters for aggregations (exclude the field being aggregated)
            if (filters.organizationId) {
                baseQuery.organization = new mongoose_1.default.Types.ObjectId(filters.organizationId);
            }
            const [reportTypeAgg, statusAgg, organizationAgg, projectAgg, creatorAgg, dateDistribution] = yield Promise.all([
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
                byOrganization: this.arrayToObject(organizationAgg),
                byProject: this.arrayToObject(projectAgg),
                byCreator: this.arrayToObject(creatorAgg),
                dateDistribution
            };
        });
    }
    static getFacetCounts(field, baseQuery) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield report_model_1.default.aggregate([
                { $match: baseQuery },
                { $group: { _id: `${field}`, count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 50 }
            ]);
        });
    }
    static getEntityFacets(localField, fromCollection, nameField, baseQuery) {
        return __awaiter(this, void 0, void 0, function* () {
            const results = yield report_model_1.default.aggregate([
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
        });
    }
    static getArrayFacets(field, baseQuery) {
        return __awaiter(this, void 0, void 0, function* () {
            const results = yield report_model_1.default.aggregate([
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
        });
    }
    static getDateDistribution(baseQuery) {
        return __awaiter(this, void 0, void 0, function* () {
            const results = yield report_model_1.default.aggregate([
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
        });
    }
    static generateSearchSuggestions(searchTerm) {
        return __awaiter(this, void 0, void 0, function* () {
            // Generate suggestions based on common report terms, tags, etc.
            const suggestions = [];
            try {
                // Get common tags that match the search term
                const tagSuggestions = yield report_model_1.default.aggregate([
                    { $match: { archived: { $ne: true } } },
                    { $unwind: '$metadata.tags' },
                    { $match: { 'metadata.tags': { $regex: searchTerm, $options: 'i' } } },
                    { $group: { _id: '$metadata.tags', count: { $sum: 1 } } },
                    { $sort: { count: -1 } },
                    { $limit: 5 }
                ]);
                suggestions.push(...tagSuggestions.map(s => s._id));
                // Get common report titles that partially match
                const titleSuggestions = yield report_model_1.default.aggregate([
                    { $match: {
                            archived: { $ne: true },
                            title: { $regex: searchTerm, $options: 'i' }
                        } },
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
            }
            catch (error) {
                console.error('Failed to generate search suggestions:', error);
                return [];
            }
        });
    }
    static generateCacheKey(filters, options) {
        const crypto = require('crypto');
        const keyData = JSON.stringify({ filters, options }, Object.keys({ filters, options }).sort());
        return crypto.createHash('md5').update(keyData).digest('hex');
    }
    static formatReportTypeFacets(facets) {
        const labels = {
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
    static formatStatusFacets(facets) {
        const labels = {
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
    static arrayToObject(array) {
        return array.reduce((obj, item) => {
            obj[item._id] = item.count;
            return obj;
        }, {});
    }
    static convertToCSV(data) {
        if (!data.length)
            return '';
        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => headers.map(header => {
                const value = row[header];
                // Escape quotes and wrap in quotes if contains comma
                const escaped = String(value).replace(/"/g, '""');
                return escaped.includes(',') ? `"${escaped}"` : escaped;
            }).join(','))
        ];
        return csvContent.join('\n');
    }
    static convertToExcel(data) {
        // This would require a library like 'exceljs' or 'xlsx'
        // For now, return CSV as buffer
        const csvData = this.convertToCSV(data);
        return Buffer.from(csvData, 'utf8');
    }
    /**
     * Build search index for better performance
     */
    static buildSearchIndex() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Create text index for content search
                yield report_model_1.default.collection.createIndex({
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
                yield report_model_1.default.collection.createIndex({
                    organization: 1,
                    reportType: 1,
                    status: 1,
                    createdAt: -1
                });
                yield report_model_1.default.collection.createIndex({
                    project: 1,
                    reportType: 1,
                    createdAt: -1
                });
                yield report_model_1.default.collection.createIndex({
                    creator: 1,
                    status: 1,
                    createdAt: -1
                });
                console.log('Report search indexes created successfully');
            }
            catch (error) {
                console.error('Failed to build search indexes:', error);
            }
        });
    }
    /**
     * Analyze search patterns for optimization
     */
    static analyzeSearchPatterns() {
        return __awaiter(this, void 0, void 0, function* () {
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
        });
    }
}
exports.ReportSearchService = ReportSearchService;
exports.default = ReportSearchService;
//# sourceMappingURL=reportSearch.service.js.map