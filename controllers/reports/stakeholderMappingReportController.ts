// controllers/reports/stakeholderMappingReportController.ts
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Report from "../../models/report.model";
import ProjectSite from "../../models/projectSite.model";
import { CustomError } from "../../middlewares/error.middleware";
import StakeholderMappingReportService from "../../services/reports/stakeholderMappingReport.service";
import { generateReportTitle } from "../../utils/reportTitleGenerator";

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
 * Generate Stakeholder Mapping Report
 * @route POST /api/v1/reports/stakeholder-mapping/:projectId
 * @access Private
 */
export const generateStakeholderMappingReport = async (
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

    const { projectId } = req.params;
    const { 
      saveReport = true,
      filters = {}
    } = req.body;

    // Generate report data with filters
    const reportData = await StakeholderMappingReportService.generateReport(
      projectId,
      req.user._id.toString(),
      filters
    );

    // Save report if requested
    let savedReport = null;
    if (saveReport) {
      // Determine scope for title generation
      let titleScope: 'project' | 'site' | 'all' | 'all_sites' = 'all';
      
      if (filters.scope === 'project') {
        titleScope = 'project';
      } else if (filters.scope === 'site') {
        if (filters.siteIds && filters.siteIds.length > 1) {
          titleScope = 'all_sites';
        } else {
          titleScope = 'site';
        }
      } else {
        titleScope = 'all';
      }

      // Get site info if single site
      let siteInfo = undefined;
      if (titleScope === 'site' && filters.siteIds && filters.siteIds.length === 1) {
        const site = await ProjectSite.findById(filters.siteIds[0]).select('name');
        if (site) {
          siteInfo = {
            name: site.name,
            _id: site._id.toString()
          };
        }
      }

      // Generate title with new options-based approach
      const reportTitle = generateReportTitle('stakeholder_mapping', {
        projectInfo: {
          name: reportData.projectInfo.name,
          _id: reportData.projectInfo.id
        },
        siteInfo,
        scope: titleScope,
        siteIds: filters.siteIds,
        date: new Date()
      });

      savedReport = new Report({
        reportType: 'stakeholder_mapping',
        title: reportTitle,
        entityType: filters.scope === 'site' ? 'project_site' : 'project',
        entityId: filters.scope === 'site' && filters.siteIds?.length === 1 
          ? filters.siteIds[0] 
          : projectId,
        organization: reportData.organizationInfo.id,
        project: projectId,
        projectSite: filters.scope === 'site' && filters.siteIds?.length === 1 
          ? filters.siteIds[0] 
          : undefined,
        reportData: reportData,
        filters: filters,
        creator: req.user._id,
        metadata: {
          ...reportData.generationMetadata,
          projectInfo: reportData.projectInfo,
          summary: {
            totalItems: reportData.summary.totalStakeholders,
            completedItems: reportData.summary.completedStakeholders,
            completionPercentage: reportData.summary.completionPercentage
          }
        }
      });

      await savedReport.save();
    }

    res.status(200).json({
      success: true,
      message: 'Stakeholder mapping report generated successfully',
      data: {
        reportData,
        savedReport: savedReport ? {
          _id: savedReport._id,
          status: savedReport.status,
          createdAt: savedReport.createdAt
        } : null
      }
    });

  } catch (error) {
    next(error);
  }
};