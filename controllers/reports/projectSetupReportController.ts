// controllers/reports/projectSetupReportController.ts
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Report from "../../models/report.model";
import { CustomError } from "../../middlewares/error.middleware";
import ProjectSetupReportService from "../../services/reports/projectSetupReport.service";
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
 * Generate Project Setup Report
 * @route POST /api/v1/reports/project-setup/:projectId
 * @access Private
 */
export const generateProjectSetupReport = async (
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
    const { saveReport = true } = req.body;

    // Generate report data using service
    const reportData = await ProjectSetupReportService.generateReport(
      projectId, 
      req.user._id.toString()
    );

    // Optionally save report to database
    let savedReport = null;
    if (saveReport) {
      // Generate title with new options-based approach
      const reportTitle = generateReportTitle('project_setup', {
        projectInfo: {
          name: reportData.projectInfo.name,
          _id: reportData.projectInfo.id
        },
        scope: 'project',
        date: new Date()
      });

      savedReport = new Report({
        reportType: 'project_setup',
        title: reportTitle,
        entityType: 'project',
        entityId: projectId,
        organization: reportData.organizationInfo.id,
        project: projectId,
        reportData: reportData,
        creator: req.user._id,
        metadata: {
          ...reportData.generationMetadata,
          projectInfo: reportData.projectInfo,
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
      message: 'Project setup report generated successfully',
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

/**
 * Get Project Setup Summary Stats
 * @route GET /api/v1/reports/project-setup/:projectId/summary
 * @access Private
 */
export const getProjectSetupSummary = async (
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

    const summary = await ProjectSetupReportService.generateSummaryStats(projectId);

    res.status(200).json({
      success: true,
      data: summary
    });

  } catch (error) {
    next(error);
  }
};