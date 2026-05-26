// controllers/reports/riskRegisterReportController.ts
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Report from "../../models/report.model";
import { CustomError } from "../../middlewares/error.middleware";
import RiskRegisterReportService from "../../services/reports/riskRegisterReport.service";
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
 * Generate Risk Register Report
 * @route POST /api/v1/reports/risk-register/:projectId
 * @access Private
 */
export const generateRiskRegisterReport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.log('🚀 Starting risk register report generation...');
  
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

    console.log('📊 Request details:', {
      projectId,
      saveReport,
      filters,
      userId: req.user._id.toString()
    });

    // Add timeout wrapper for the service call
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Report generation timed out after 30 seconds')), 30000);
    });

    console.log('🔄 Calling RiskRegisterReportService.generateReport...');
    
    // Race between actual generation and timeout
    const reportData = await Promise.race([
      RiskRegisterReportService.generateReport(
        projectId,
        req.user._id.toString(),
        filters
      ),
      timeoutPromise
    ]) as any; // Type assertion since Promise.race loses typing

    console.log('✅ Report data generated successfully');
    console.log('📈 Report summary:', {
      totalRisks: reportData?.executiveSummary?.totalRisks || 0,
      projectName: reportData?.projectInfo?.name || 'Unknown'
    });

    // Save report if requested
    let savedReport = null;
    if (saveReport) {
      console.log('💾 Saving report to database...');
      
      const reportTitle = generateReportTitle('risk_register', reportData.projectInfo.name);
      
      savedReport = new Report({
        reportType: 'risk_register',
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
            totalItems: reportData.executiveSummary.totalRisks,
            completedItems: reportData.executiveSummary.risksByStatus.closed,
            completionPercentage: reportData.executiveSummary.totalRisks > 0 
              ? Math.round((reportData.executiveSummary.risksByStatus.closed / reportData.executiveSummary.totalRisks) * 100)
              : 0
          }
        }
      });

      await savedReport.save();
      console.log('💾 Report saved with ID:', savedReport._id);
    }

    console.log('🎉 Risk register report generation completed successfully');

    res.status(200).json({
      success: true,
      message: 'Risk register report generated successfully',
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
    console.error('❌ Error in generateRiskRegisterReport:', error);
    
    // Log more details about the error
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    next(error);
  }
};