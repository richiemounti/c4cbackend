// services/reports/reportPersistence.service.ts
import mongoose from "mongoose";
import Report from "../../models/report.model";
import Project from "../../models/project.model";
import ProjectSite from "../../models/projectSite.model";
import Organization from "../../models/organization.model";

// Interface for report save options
interface IReportSaveOptions {
  autoTitle?: boolean;
  visibility?: 'private' | 'organization' | 'public';
  status?: 'draft' | 'generated' | 'approved' | 'published' | 'archived';
  version?: number;
  tags?: string[];
  description?: string;
}

// Interface for report query filters
interface IReportQueryFilters {
  reportType?: string;
  entityType?: 'project' | 'project_site';
  entityId?: string;
  organizationId?: string;
  projectId?: string;
  status?: string[];
  visibility?: string[];
  createdBy?: string;
  dateRange?: {
    startDate?: Date;
    endDate?: Date;
  };
  tags?: string[];
  searchTerm?: string;
}

export class ReportPersistenceService {
  /**
   * Save a generated report to the database
   */
  static async saveReport(
    reportType: string,
    entityType: 'project' | 'project_site',
    entityId: string,
    reportData: any,
    userId: string,
    options: IReportSaveOptions = {}
  ): Promise<any> {
    try {
      // Get entity information
      const entityInfo = await this.getEntityInfo(entityType, entityId);
      
      // Generate automatic title if requested
      const title = options.autoTitle 
        ? this.generateAutoTitle(reportType, entityInfo)
        : `${reportType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} Report`;

      // Check for existing reports to determine version
      const existingReports = await Report.find({
        reportType,
        entityType,
        entityId,
        archived: { $ne: true }
      }).sort({ version: -1 }).limit(1);

      const nextVersion = existingReports.length > 0 
        ? (existingReports[0].version || 1) + 1 
        : 1;

      // Create new report document
      const reportDoc = new Report({
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
        metadata: {
          ...reportData.generationMetadata || reportData.reportMetadata,
          entityInfo,
          saveOptions: options,
          tags: options.tags || []
        }
      });

      // Save report
      const savedReport = await reportDoc.save();
      
      // Populate references for return
      await savedReport.populate([
        { path: 'creator', select: 'name email' },
        { path: 'project', select: 'name status' },
        { path: 'projectSite', select: 'name' },
        { path: 'organization', select: 'name' }
      ]);

      return savedReport;

    } catch (error) {
      console.error('Error saving report:', error);
      throw new Error(`Failed to save report: ${error}`);
    }
  }

  /**
   * Get report by ID with full population
   */
  static async getReportById(reportId: string, userId?: string): Promise<any> {
    try {
      const report = await Report.findById(reportId)
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
        const hasAccess = await this.checkReportAccess(report, userId);
        if (!hasAccess) {
          throw new Error('Access denied to this report');
        }
      }

      return report;

    } catch (error) {
      console.error('Error getting report:', error);
      throw new Error(`Failed to get report: ${error}`);
    }
  }

  /**
   * Get reports with advanced filtering and pagination
   */
  static async getReports(
    filters: IReportQueryFilters = {},
    pagination: { page?: number; limit?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' } = {}
  ): Promise<{ reports: any[]; totalCount: number; pagination: any }> {
    try {
      // Build query
      const query = this.buildReportQuery(filters);

      // Pagination setup
      const page = pagination.page || 1;
      const limit = pagination.limit || 10;
      const skip = (page - 1) * limit;

      // Sorting
      const sort: any = {};
      const sortBy = pagination.sortBy || 'createdAt';
      sort[sortBy] = pagination.sortOrder === 'asc' ? 1 : -1;

      // Execute query with population
      const [reports, totalCount] = await Promise.all([
        Report.find(query)
          .populate('creator', 'name email')
          .populate('approvedBy', 'name email')
          .populate('project', 'name status')
          .populate('projectSite', 'name')
          .populate('organization', 'name')
          .sort(sort)
          .skip(skip)
          .limit(limit),
        Report.countDocuments(query)
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

    } catch (error) {
      console.error('Error getting reports:', error);
      throw new Error(`Failed to get reports: ${error}`);
    }
  }

  /**
   * Update report status and metadata
   */
  static async updateReportStatus(
    reportId: string,
    status: string,
    userId: string,
    notes?: string
  ): Promise<any> {
    try {
      const report = await Report.findById(reportId);
      if (!report) {
        throw new Error('Report not found');
      }

      // Update status
      report.status = status as any;
      report.lastUpdatedBy = new mongoose.Types.ObjectId(userId);

      // Handle approval workflow
      if (status === 'approved') {
        report.markAsApproved(new mongoose.Types.ObjectId(userId), notes);
      }

      // Save and return updated report
      await report.save();
      
      await report.populate([
        { path: 'creator', select: 'name email' },
        { path: 'approvedBy', select: 'name email' },
        { path: 'lastUpdatedBy', select: 'name email' }
      ]);

      return report;

    } catch (error) {
      console.error('Error updating report status:', error);
      throw new Error(`Failed to update report status: ${error}`);
    }
  }

  /**
   * Archive/Delete report
   */
  static async archiveReport(reportId: string, userId: string): Promise<void> {
    try {
      const report = await Report.findById(reportId);
      if (!report) {
        throw new Error('Report not found');
      }

      // Check permissions
      const canDelete = report.creator.toString() === userId || 
                       await this.isUserAdmin(userId);
      
      if (!canDelete) {
        throw new Error('Not authorized to delete this report');
      }

      // Archive the report
      report.archived = true;
      report.archivedAt = new Date();
      report.lastUpdatedBy = new mongoose.Types.ObjectId(userId);

      await report.save();

    } catch (error) {
      console.error('Error archiving report:', error);
      throw new Error(`Failed to archive report: ${error}`);
    }
  }

  /**
   * Get report versions for an entity
   */
  static async getReportVersions(
    reportType: string,
    entityType: 'project' | 'project_site',
    entityId: string
  ): Promise<any[]> {
    try {
      const reports = await Report.find({
        reportType,
        entityType,
        entityId,
        archived: { $ne: true }
      })
      .populate('creator', 'name email')
      .populate('approvedBy', 'name email')
      .sort({ version: -1 });

      return reports;

    } catch (error) {
      console.error('Error getting report versions:', error);
      throw new Error(`Failed to get report versions: ${error}`);
    }
  }

  /**
   * Track report export/download
   */
  static async trackReportExport(
    reportId: string,
    format: 'pdf' | 'excel' | 'csv',
    userId: string,
    fileSize?: number
  ): Promise<void> {
    try {
      const report = await Report.findById(reportId);
      if (!report) {
        throw new Error('Report not found');
      }

      // Add export record
      report.addExportRecord(format, new mongoose.Types.ObjectId(userId), fileSize);
      await report.save();

    } catch (error) {
      console.error('Error tracking report export:', error);
      throw new Error(`Failed to track report export: ${error}`);
    }
  }

  /**
   * Get report analytics/statistics
   */
  static async getReportAnalytics(
    filters: IReportQueryFilters = {},
    timeRange: { startDate?: Date; endDate?: Date } = {}
  ): Promise<any> {
    try {
      const matchQuery = this.buildReportQuery(filters);
      
      if (timeRange.startDate || timeRange.endDate) {
        matchQuery.createdAt = {};
        if (timeRange.startDate) matchQuery.createdAt.$gte = timeRange.startDate;
        if (timeRange.endDate) matchQuery.createdAt.$lte = timeRange.endDate;
      }

      const analytics = await Report.aggregate([
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
      const result = analytics?.[0] || {
        totalReports: 0,
        reportsByType: [],
        avgGenerationTime: 0,
        totalExports: 0
      };

      // Count reports by type and status
      const byType: Record<string, number> = {};
      const byStatus: Record<string, number> = {};
      const recentActivity: any[] = [];

      result.reportsByType.forEach((report: any) => {
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
          recentActivity: recentActivity.sort((a, b) => 
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
        }
      };

    } catch (error) {
      console.error('Error getting report analytics:', error);
      throw new Error(`Failed to get report analytics: ${error}`);
    }
  }

  /**
   * Helper: Get entity information
   */
  private static async getEntityInfo(
    entityType: 'project' | 'project_site',
    entityId: string
  ): Promise<any> {
    try {
      if (entityType === 'project') {
        const project = await Project.findById(entityId).populate('organization');
        if (!project) throw new Error('Project not found');
        
        return {
          projectId: project._id,
          projectName: project.name,
          organizationId: (project.organization as any)._id,
          organizationName: (project.organization as any).name,
          projectSiteId: null,
          projectSiteName: null
        };
      } else {
        const site = await ProjectSite.findById(entityId).populate({
          path: 'project',
          populate: { path: 'organization' }
        });
        if (!site) throw new Error('Project site not found');
        
        return {
          projectId: (site.project as any)._id,
          projectName: (site.project as any).name,
          organizationId: (site.project as any).organization._id,
          organizationName: (site.project as any).organization.name,
          projectSiteId: site._id,
          projectSiteName: site.name
        };
      }
    } catch (error) {
      throw new Error(`Failed to get entity info: ${error}`);
    }
  }

  /**
   * Helper: Generate automatic title
   */
  private static generateAutoTitle(reportType: string, entityInfo: any): string {
    const reportTypeName = reportType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const entityName = entityInfo.projectSiteName || entityInfo.projectName;
    const date = new Date().toLocaleDateString();
    
    return `${reportTypeName} - ${entityName} (${date})`;
  }

  /**
   * Helper: Build MongoDB query from filters
   */
  private static buildReportQuery(filters: IReportQueryFilters): any {
    const query: any = { archived: { $ne: true } };

    if (filters.reportType) query.reportType = filters.reportType;
    if (filters.entityType) query.entityType = filters.entityType;
    if (filters.entityId) query.entityId = filters.entityId;
    if (filters.organizationId) query.organization = filters.organizationId;
    if (filters.projectId) query.project = new mongoose.Types.ObjectId(filters.projectId[0]);
    if (filters.createdBy) query.creator = filters.createdBy;

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
  private static async checkReportAccess(report: any, userId: string): Promise<boolean> {
    // Creator always has access
    if (report.creator._id.toString() === userId) return true;

    // Check visibility
    if (report.visibility === 'public') return true;
    if (report.visibility === 'private') return false;

    // For organization visibility, check if user belongs to same organization
    // This would need to be implemented based on your user-organization relationship
    return true; // Placeholder - implement based on your auth system
  }

  /**
   * Helper: Check if user is admin
   */
  private static async isUserAdmin(userId: string): Promise<boolean> {
    // Implement based on your user role system
    // This is a placeholder
    return false;
  }
}

export default ReportPersistenceService;