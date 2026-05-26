// controllers/reports/projectSiteSetupReportController.ts
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Report from "../../models/report.model";
import { CustomError } from "../../middlewares/error.middleware";
import ProjectSiteSetupReportService from "../../services/reports/projectSiteSetupReport.service";
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
 * Generate Project Site Setup Report
 * @route POST /api/v1/reports/project-site-setup/:siteId
 * @access Private
 */
export const generateProjectSiteSetupReport = async (
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

    const { siteId } = req.params;
    const { saveReport = true } = req.body;

    // Generate report data
    const reportData = await ProjectSiteSetupReportService.generateReport(
      siteId,
      req.user._id.toString()
    );

    // Save report if requested
    let savedReport = null;
    if (saveReport) {
      // Generate title with new options-based approach
      const reportTitle = generateReportTitle('project_site_setup', {
        projectInfo: {
          name: reportData.projectInfo.name,
          _id: reportData.projectInfo.id
        },
        siteInfo: {
          name: reportData.siteInfo.name,
          _id: reportData.siteInfo.id
        },
        scope: 'site',
        date: new Date()
      });
      
      savedReport = new Report({
        reportType: 'project_site_setup',
        title: reportTitle,
        entityType: 'project_site',
        entityId: siteId,
        organization: reportData.organizationInfo.id,
        project: reportData.projectInfo.id,
        projectSite: siteId,
        reportData: reportData,
        creator: req.user._id,
        metadata: {
          ...reportData.generationMetadata,
          siteInfo: reportData.siteInfo,
          summary: {
            totalItems: reportData.setupProgress.totalTasks,
            completedItems: reportData.setupProgress.completedTasks,
            completionPercentage: reportData.setupProgress.overallProgress
          }
        }
      });

      await savedReport.save();
    }

    res.status(200).json({
      success: true,
      message: 'Project site setup report generated successfully',
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