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
exports.ReportPersistenceService = void 0;
// services/reports/reportPersistence.service.ts
const mongoose_1 = __importDefault(require("mongoose"));
const report_model_1 = __importDefault(require("../../models/report.model"));
const project_model_1 = __importDefault(require("../../models/project.model"));
const projectSite_model_1 = __importDefault(require("../../models/projectSite.model"));
class ReportPersistenceService {
    /**
     * Save a generated report to the database
     */
    static saveReport(reportType_1, entityType_1, entityId_1, reportData_1, userId_1) {
        return __awaiter(this, arguments, void 0, function* (reportType, entityType, entityId, reportData, userId, options = {}) {
            try {
                // Get entity information
                const entityInfo = yield this.getEntityInfo(entityType, entityId);
                // Generate automatic title if requested
                const title = options.autoTitle
                    ? this.generateAutoTitle(reportType, entityInfo)
                    : `${reportType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Report`;
                // Check for existing reports to determine version
                const existingReports = yield report_model_1.default.find({
                    reportType,
                    entityType,
                    entityId,
                    archived: { $ne: true }
                }).sort({ version: -1 }).limit(1);
                const nextVersion = existingReports.length > 0
                    ? (existingReports[0].version || 1) + 1
                    : 1;
                // Create new report document
                const reportDoc = new report_model_1.default({
                    reportType,
                    title,
                    description: options.description,
                    entityId,
                    entityType,
                    organization: entityInfo.organizationId,
                    project: entityInfo.projectId,
                    projectSite: entityInfo.projectSiteId,
                    reportData,
                    status: options.status || 'generated',
                    version: options.version || nextVersion,
                    visibility: options.visibility || 'organization',
                    creator: userId,
                    metadata: Object.assign(Object.assign({}, reportData.generationMetadata || reportData.reportMetadata), { entityInfo, saveOptions: options, tags: options.tags || [] })
                });
                // Save report
                const savedReport = yield reportDoc.save();
                // Populate references for return
                yield savedReport.populate([
                    { path: 'creator', select: 'name email' },
                    { path: 'project', select: 'name status' },
                    { path: 'projectSite', select: 'name' },
                    { path: 'organization', select: 'name' }
                ]);
                return savedReport;
            }
            catch (error) {
                console.error('Error saving report:', error);
                throw new Error(`Failed to save report: ${error}`);
            }
        });
    }
    /**
     * Get report by ID with full population
     */
    static getReportById(reportId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const report = yield report_model_1.default.findById(reportId)
                    .populate('creator', 'name email')
                    .populate('approvedBy', 'name email')
                    .populate('project', 'name status description')
                    .populate('projectSite', 'name region city')
                    .populate('organization', 'name country city');
                if (!report) {
                    throw new Error('Report not found');
                }
                // Check if user has access to this report
                if (userId) {
                    const hasAccess = yield this.checkReportAccess(report, userId);
                    if (!hasAccess) {
                        throw new Error('Access denied to this report');
                    }
                }
                return report;
            }
            catch (error) {
                console.error('Error getting report:', error);
                throw new Error(`Failed to get report: ${error}`);
            }
        });
    }
    /**
     * Get reports with advanced filtering and pagination
     */
    static getReports() {
        return __awaiter(this, arguments, void 0, function* (filters = {}, pagination = {}) {
            try {
                // Build query
                const query = this.buildReportQuery(filters);
                // Pagination setup
                const page = pagination.page || 1;
                const limit = pagination.limit || 10;
                const skip = (page - 1) * limit;
                // Sorting
                const sort = {};
                const sortBy = pagination.sortBy || 'createdAt';
                sort[sortBy] = pagination.sortOrder === 'asc' ? 1 : -1;
                // Execute query with population
                const [reports, totalCount] = yield Promise.all([
                    report_model_1.default.find(query)
                        .populate('creator', 'name email')
                        .populate('approvedBy', 'name email')
                        .populate('project', 'name status')
                        .populate('projectSite', 'name')
                        .populate('organization', 'name')
                        .sort(sort)
                        .skip(skip)
                        .limit(limit),
                    report_model_1.default.countDocuments(query)
                ]);
                return {
                    reports,
                    totalCount,
                    pagination: {
                        currentPage: page,
                        totalPages: Math.ceil(totalCount / limit),
                        totalCount,
                        hasNext: page < Math.ceil(totalCount / limit),
                        hasPrev: page > 1,
                        limit
                    }
                };
            }
            catch (error) {
                console.error('Error getting reports:', error);
                throw new Error(`Failed to get reports: ${error}`);
            }
        });
    }
    /**
     * Update report status and metadata
     */
    static updateReportStatus(reportId, status, userId, notes) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const report = yield report_model_1.default.findById(reportId);
                if (!report) {
                    throw new Error('Report not found');
                }
                // Update status
                report.status = status;
                report.lastUpdatedBy = new mongoose_1.default.Types.ObjectId(userId);
                // Handle approval workflow
                if (status === 'approved') {
                    report.markAsApproved(new mongoose_1.default.Types.ObjectId(userId), notes);
                }
                // Save and return updated report
                yield report.save();
                yield report.populate([
                    { path: 'creator', select: 'name email' },
                    { path: 'approvedBy', select: 'name email' },
                    { path: 'lastUpdatedBy', select: 'name email' }
                ]);
                return report;
            }
            catch (error) {
                console.error('Error updating report status:', error);
                throw new Error(`Failed to update report status: ${error}`);
            }
        });
    }
    /**
     * Archive/Delete report
     */
    static archiveReport(reportId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const report = yield report_model_1.default.findById(reportId);
                if (!report) {
                    throw new Error('Report not found');
                }
                // Check permissions
                const canDelete = report.creator.toString() === userId ||
                    (yield this.isUserAdmin(userId));
                if (!canDelete) {
                    throw new Error('Not authorized to delete this report');
                }
                // Archive the report
                report.archived = true;
                report.archivedAt = new Date();
                report.lastUpdatedBy = new mongoose_1.default.Types.ObjectId(userId);
                yield report.save();
            }
            catch (error) {
                console.error('Error archiving report:', error);
                throw new Error(`Failed to archive report: ${error}`);
            }
        });
    }
    /**
     * Get report versions for an entity
     */
    static getReportVersions(reportType, entityType, entityId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const reports = yield report_model_1.default.find({
                    reportType,
                    entityType,
                    entityId,
                    archived: { $ne: true }
                })
                    .populate('creator', 'name email')
                    .populate('approvedBy', 'name email')
                    .sort({ version: -1 });
                return reports;
            }
            catch (error) {
                console.error('Error getting report versions:', error);
                throw new Error(`Failed to get report versions: ${error}`);
            }
        });
    }
    /**
     * Track report export/download
     */
    static trackReportExport(reportId, format, userId, fileSize) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const report = yield report_model_1.default.findById(reportId);
                if (!report) {
                    throw new Error('Report not found');
                }
                // Add export record
                report.addExportRecord(format, new mongoose_1.default.Types.ObjectId(userId), fileSize);
                yield report.save();
            }
            catch (error) {
                console.error('Error tracking report export:', error);
                throw new Error(`Failed to track report export: ${error}`);
            }
        });
    }
    /**
     * Get report analytics/statistics
     */
    static getReportAnalytics() {
        return __awaiter(this, arguments, void 0, function* (filters = {}, timeRange = {}) {
            try {
                const matchQuery = this.buildReportQuery(filters);
                if (timeRange.startDate || timeRange.endDate) {
                    matchQuery.createdAt = {};
                    if (timeRange.startDate)
                        matchQuery.createdAt.$gte = timeRange.startDate;
                    if (timeRange.endDate)
                        matchQuery.createdAt.$lte = timeRange.endDate;
                }
                const analytics = yield report_model_1.default.aggregate([
                    { $match: matchQuery },
                    {
                        $group: {
                            _id: null,
                            totalReports: { $sum: 1 },
                            reportsByType: {
                                $push: {
                                    type: '$reportType',
                                    status: '$status',
                                    createdAt: '$createdAt'
                                }
                            },
                            avgGenerationTime: {
                                $avg: '$metadata.generationTime'
                            },
                            totalExports: {
                                $sum: { $size: { $ifNull: ['$metadata.exportHistory', []] } }
                            }
                        }
                    }
                ]);
                // Process the results
                const result = (analytics === null || analytics === void 0 ? void 0 : analytics[0]) || {
                    totalReports: 0,
                    reportsByType: [],
                    avgGenerationTime: 0,
                    totalExports: 0
                };
                // Count reports by type and status
                const byType = {};
                const byStatus = {};
                const recentActivity = [];
                result.reportsByType.forEach((report) => {
                    byType[report.type] = (byType[report.type] || 0) + 1;
                    byStatus[report.status] = (byStatus[report.status] || 0) + 1;
                    // Track recent activity (last 7 days)
                    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                    if (new Date(report.createdAt) > weekAgo) {
                        recentActivity.push(report);
                    }
                });
                return {
                    summary: {
                        totalReports: result.totalReports,
                        avgGenerationTime: Math.round(result.avgGenerationTime || 0),
                        totalExports: result.totalExports,
                        recentActivity: recentActivity.length
                    },
                    breakdown: {
                        byType,
                        byStatus
                    },
                    trends: {
                        recentActivity: recentActivity.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    }
                };
            }
            catch (error) {
                console.error('Error getting report analytics:', error);
                throw new Error(`Failed to get report analytics: ${error}`);
            }
        });
    }
    /**
     * Helper: Get entity information
     */
    static getEntityInfo(entityType, entityId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (entityType === 'project') {
                    const project = yield project_model_1.default.findById(entityId).populate('organization');
                    if (!project)
                        throw new Error('Project not found');
                    return {
                        projectId: project._id,
                        projectName: project.name,
                        organizationId: project.organization._id,
                        organizationName: project.organization.name,
                        projectSiteId: null,
                        projectSiteName: null
                    };
                }
                else {
                    const site = yield projectSite_model_1.default.findById(entityId).populate({
                        path: 'project',
                        populate: { path: 'organization' }
                    });
                    if (!site)
                        throw new Error('Project site not found');
                    return {
                        projectId: site.project._id,
                        projectName: site.project.name,
                        organizationId: site.project.organization._id,
                        organizationName: site.project.organization.name,
                        projectSiteId: site._id,
                        projectSiteName: site.name
                    };
                }
            }
            catch (error) {
                throw new Error(`Failed to get entity info: ${error}`);
            }
        });
    }
    /**
     * Helper: Generate automatic title
     */
    static generateAutoTitle(reportType, entityInfo) {
        const reportTypeName = reportType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const entityName = entityInfo.projectSiteName || entityInfo.projectName;
        const date = new Date().toLocaleDateString();
        return `${reportTypeName} - ${entityName} (${date})`;
    }
    /**
     * Helper: Build MongoDB query from filters
     */
    static buildReportQuery(filters) {
        const query = { archived: { $ne: true } };
        if (filters.reportType)
            query.reportType = filters.reportType;
        if (filters.entityType)
            query.entityType = filters.entityType;
        if (filters.entityId)
            query.entityId = filters.entityId;
        if (filters.organizationId)
            query.organization = filters.organizationId;
        if (filters.projectId)
            query.project = new mongoose_1.default.Types.ObjectId(filters.projectId[0]);
        if (filters.createdBy)
            query.creator = filters.createdBy;
        if (filters.status && filters.status.length > 0) {
            query.status = { $in: filters.status };
        }
        if (filters.visibility && filters.visibility.length > 0) {
            query.visibility = { $in: filters.visibility };
        }
        if (filters.tags && filters.tags.length > 0) {
            query['metadata.tags'] = { $in: filters.tags };
        }
        if (filters.dateRange) {
            query.createdAt = {};
            if (filters.dateRange.startDate) {
                query.createdAt.$gte = filters.dateRange.startDate;
            }
            if (filters.dateRange.endDate) {
                query.createdAt.$lte = filters.dateRange.endDate;
            }
        }
        if (filters.searchTerm) {
            query.$or = [
                { title: { $regex: filters.searchTerm, $options: 'i' } },
                { description: { $regex: filters.searchTerm, $options: 'i' } }
            ];
        }
        return query;
    }
    /**
     * Helper: Check if user has access to report
     */
    static checkReportAccess(report, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Creator always has access
            if (report.creator._id.toString() === userId)
                return true;
            // Check visibility
            if (report.visibility === 'public')
                return true;
            if (report.visibility === 'private')
                return false;
            // For organization visibility, check if user belongs to same organization
            // This would need to be implemented based on your user-organization relationship
            return true; // Placeholder - implement based on your auth system
        });
    }
    /**
     * Helper: Check if user is admin
     */
    static isUserAdmin(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Implement based on your user role system
            // This is a placeholder
            return false;
        });
    }
}
exports.ReportPersistenceService = ReportPersistenceService;
exports.default = ReportPersistenceService;
//# sourceMappingURL=reportPersistence.service.js.map