// controllers/reports/theoryOfChangeReportController.ts - UPDATED VERSION
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Report from "../../models/report.model";
import { CustomError } from "../../middlewares/error.middleware";
import TheoryOfChangeReportService from "../../services/reports/theoryOfChangeReport.service";
import { generateReportTitle } from "../../utils/reportTitleGenerator";
import ProjectSite from "../../models/projectSite.model";

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
 * Generate Stage 1 Data Report (Data-focused)
 * @route POST /api/v1/reports/theory-of-change/:projectId/stage1
 * @access Private
 */
export const generateStage1Report = async (
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

    // Generate Stage 1 report
    const reportData = await TheoryOfChangeReportService.generateStage1Report(
      projectId,
      req.user._id.toString(),
      filters
    );

    // Save report if requested
    let savedReport = null;
    if (saveReport) {
      // Get site info if applicable
      let siteInfo;
      if (filters.scope === 'site' && filters.siteIds?.length === 1) {
        const site = await ProjectSite.findById(filters.siteIds[0]);
        if (site) {
          siteInfo = { name: site.name, _id: site._id.toString() };
        }
      }

      const reportTitle = generateReportTitle('theory_of_change', {
        projectInfo: reportData.projectInfo,
        siteInfo,
        scope: filters.scope || 'all_sites',
        siteIds: filters.siteIds,
        reportDimension: 'stage1',
        date: new Date()
      });

      savedReport = new Report({
        reportType: 'theory_of_change' as any,
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
          generatedAt: reportData.reportMetadata.generatedAt,
          generatedBy: reportData.reportMetadata.generatedBy,
          dataVersion: reportData.reportMetadata.version,
          projectInfo: reportData.projectInfo,
          reportDimension: 'stage1',
          summary: {
            totalItems: reportData.stage1Data.totalActions,
            completedItems: reportData.stage1Data.progressSummary.completedActions,
            completionPercentage: Math.round(
              (reportData.stage1Data.progressSummary.completedActions / reportData.stage1Data.totalActions) * 100
            )
          }
        }
      });

      await savedReport.save();
    }

    res.status(200).json({
      success: true,
      message: 'Stage 1 report generated successfully',
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
 * Generate Workplan Report (Stage 1 - Actions/Outputs)
 * @route POST /api/v1/reports/theory-of-change/:projectId/workplan
 * @access Private
 */
export const generateWorkplanReport = async (
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

    // Generate workplan report (visual-focused)
    const reportData = await TheoryOfChangeReportService.generateWorkplanReport(
      projectId,
      req.user._id.toString(),
      filters
    );

    // Save report if requested
    let savedReport = null;
    if (saveReport) {
      // Get site info if applicable
      let siteInfo;
      if (filters.scope === 'site' && filters.siteIds?.length === 1) {
        const site = await ProjectSite.findById(filters.siteIds[0]);
        if (site) {
          siteInfo = { name: site.name, _id: site._id.toString() };
        }
      }

      const reportTitle = generateReportTitle('theory_of_change', {
        projectInfo: reportData.projectInfo,
        siteInfo,
        scope: filters.scope || 'all_sites',
        siteIds: filters.siteIds,
        reportDimension: 'workplan',
        date: new Date()
      });

      savedReport = new Report({
        reportType: 'theory_of_change' as any,
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
          generatedAt: reportData.reportMetadata.generatedAt,
          generatedBy: reportData.reportMetadata.generatedBy,
          dataVersion: reportData.reportMetadata.version,
          projectInfo: reportData.projectInfo,
          reportDimension: 'workplan',
          summary: {
            totalItems: reportData.outputs.totalActions,
            completedItems: reportData.outputs.ganttTimeline.filter(
              item => item.status === 'completed'
            ).length,
            completionPercentage: reportData.outputs.timelineAnalysis.averageProgress
          }
        }
      });

      await savedReport.save();
    }

    res.status(200).json({
      success: true,
      message: 'Workplan report generated successfully',
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
 * Generate Outcome Report (Stage 2 - Impacts/Outcomes)
 * @route POST /api/v1/reports/theory-of-change/:projectId/outcome
 * @access Private
 */
export const generateOutcomeReport = async (
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
      filters = {},
    } = req.body;


    // Generate outcome report
    const reportData = await TheoryOfChangeReportService.generateOutcomeReport(
      projectId,
      req.user._id.toString(),
      filters
    );

    // Save report if requested
    let savedReport = null;
    if (saveReport) {
      // Get site info if applicable
      let siteInfo;
      if (filters.scope === 'site' && filters.siteIds?.length === 1) {
        const site = await ProjectSite.findById(filters.siteIds[0]);
        if (site) {
          siteInfo = { name: site.name, _id: site._id.toString() };
        }
      }

      const reportTitle = generateReportTitle('theory_of_change', {
        projectInfo: reportData.projectInfo,
        siteInfo,
        scope: filters.scope || 'all_sites',
        siteIds: filters.siteIds,
        reportDimension: 'outcome',
        date: new Date()
      });

      savedReport = new Report({
        reportType: 'theory_of_change' as any,
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
        filters: { ...filters },
        creator: req.user._id,
        metadata: {
          generatedAt: reportData.reportMetadata.generatedAt,
          generatedBy: reportData.reportMetadata.generatedBy,
          dataVersion: reportData.reportMetadata.version,
          projectInfo: reportData.projectInfo,
          reportDimension: 'outcome',
          summary: {
            totalItems: reportData.outcomes.totalImpacts,
            completedItems: reportData.outcomes.impacts.filter(
              (i: any) => i.status === 'achieved'
            ).length,
            completionPercentage: Math.round(
              (reportData.outcomes.byStakeholder.reduce(
                (sum: number, s: any) => sum + s.achievementRate, 0
              ) / reportData.outcomes.byStakeholder.length) || 0
            )
          }
        }
      });

      await savedReport.save();
    }

    res.status(200).json({
      success: true,
      message: 'Outcome report generated successfully',
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
 * Generate Consultation Plan Report (Site Selection Phase)
 * @route POST /api/v1/reports/theory-of-change/:projectId/site/:siteId/consultation-plan
 * @access Private
 */
export const generateConsultationPlanReport = async (
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

    const { projectId, siteId } = req.params;
    const { saveReport = true } = req.body;

    // Generate consultation plan report
    const reportData = await TheoryOfChangeReportService.generateConsultationPlanReport(
      projectId,
      siteId,
      req.user._id.toString()
    );

    // Save report if requested
    let savedReport = null;
    if (saveReport) {
      const reportTitle = `Consultation Plan Report - ${reportData.siteInfo.name} - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

      savedReport = new Report({
        reportType: 'theory_of_change' as any,
        title: reportTitle,
        entityType: 'project_site',
        entityId: siteId,
        organization: reportData.projectInfo.id, // Will need to fetch actual org
        project: projectId,
        projectSite: siteId,
        reportData: reportData,
        filters: {},
        creator: req.user._id,
        metadata: {
          generatedAt: reportData.reportMetadata.generatedAt,
          generatedBy: reportData.reportMetadata.generatedBy,
          dataVersion: reportData.reportMetadata.version,
          projectInfo: reportData.projectInfo,
          siteInfo: reportData.siteInfo,
          reportDimension: 'consultation_plan',
          summary: {
            totalItems: reportData.consultationPlan.selectedStakeholders.length,
            completedItems: reportData.consultationPlan.completionStatus.completedSections.length,
            completionPercentage: reportData.consultationPlan.completionStatus.completionPercentage
          }
        }
      });

      await savedReport.save();
    }

    res.status(200).json({
      success: true,
      message: 'Consultation plan report generated successfully',
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
 * Generate Full Theory of Change Report (Both Stages)
 * @route POST /api/v1/reports/theory-of-change/:projectId/full
 * @access Private
 */
export const generateFullToCReport = async (
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
      filters = {},
    } = req.body;

    // Generate both reports
    const workplanReport = await TheoryOfChangeReportService.generateWorkplanReport(
      projectId,
      req.user._id.toString(),
      filters
    );

    const outcomeReport = await TheoryOfChangeReportService.generateOutcomeReport(
      projectId,
      req.user._id.toString(),
      filters
    );
    // Combine into full report
    const fullReportData = {
      reportType: 'toc_full',
      projectInfo: workplanReport.projectInfo,
      organizationInfo: workplanReport.organizationInfo,
      scope: workplanReport.scope,
      reportMetadata: {
        generatedAt: new Date(),
        generatedBy: req.user._id.toString(),
        version: '2.0',
        appliedFilters: filters
      },
      
      // Stage 1 - Outputs/Actions
      stage1: {
        summary: {
          exists: workplanReport.outputs.totalActions > 0,
          totalActions: workplanReport.outputs.totalActions,
          actionsWithDates: workplanReport.outputs.actionsWithDates,
          actionsWithEstimatedDates: workplanReport.outputs.actionsWithEstimatedDates,
          averageProgress: workplanReport.outputs.timelineAnalysis.averageProgress
        },
        outputs: workplanReport.outputs,
        siteBreakdown: workplanReport.siteBreakdown,
        aggregatedView: workplanReport.aggregatedView
      },
      
      // Stage 2 - Outcomes/Impacts
      stage2: {
        summary: {
          exists: outcomeReport.outcomes.totalImpacts > 0,
          totalImpacts: outcomeReport.outcomes.totalImpacts,
          impactsWithRisks: outcomeReport.outcomes.impactsWithRisks,
          averageAchievementRate: outcomeReport.outcomes.byStakeholder.length > 0
            ? Math.round(
                outcomeReport.outcomes.byStakeholder.reduce(
                  (sum: number, s: any) => sum + s.achievementRate, 0
                ) / outcomeReport.outcomes.byStakeholder.length
              )
            : 0
        },
        outcomes: outcomeReport.outcomes,
        siteBreakdown: outcomeReport.siteBreakdown,
        aggregatedView: outcomeReport.aggregatedView
      }
    };

    // Save report if requested
    let savedReport = null;
    if (saveReport) {
      // Get site info if applicable
      let siteInfo;
      if (filters.scope === 'site' && filters.siteIds?.length === 1) {
        const site = await ProjectSite.findById(filters.siteIds[0]);
        if (site) {
          siteInfo = { name: site.name, _id: site._id.toString() };
        }
      }

      const reportTitle = generateReportTitle('theory_of_change', {
        projectInfo: fullReportData.projectInfo,
        siteInfo,
        scope: filters.scope || 'all_sites',
        siteIds: filters.siteIds,
        reportDimension: 'full',
        date: new Date()
      });

      savedReport = new Report({
        reportType: 'theory_of_change' as any,
        title: reportTitle,
        entityType: filters.scope === 'site' ? 'project_site' : 'project',
        entityId: filters.scope === 'site' && filters.siteIds?.length === 1 
          ? filters.siteIds[0] 
          : projectId,
        organization: fullReportData.organizationInfo.id,
        project: projectId,
        projectSite: filters.scope === 'site' && filters.siteIds?.length === 1 
          ? filters.siteIds[0] 
          : undefined,
        reportData: fullReportData,
        filters: { ...filters },
        creator: req.user._id,
        metadata: {
          generatedAt: fullReportData.reportMetadata.generatedAt,
          generatedBy: fullReportData.reportMetadata.generatedBy,
          dataVersion: fullReportData.reportMetadata.version,
          projectInfo: fullReportData.projectInfo,
          reportDimension: 'full',
          summary: {
            totalItems: fullReportData.stage1.summary.totalActions + 
                       fullReportData.stage2.summary.totalImpacts,
            completedItems: workplanReport.outputs.ganttTimeline.filter(
              item => item.status === 'completed'
            ).length + outcomeReport.outcomes.impacts.filter(
              (i: any) => i.status === 'achieved'
            ).length,
            completionPercentage: Math.round(
              (fullReportData.stage1.summary.averageProgress + 
               fullReportData.stage2.summary.averageAchievementRate) / 2
            )
          }
        }
      });

      await savedReport.save();
    }

    res.status(200).json({
      success: true,
      message: 'Full Theory of Change report generated successfully',
      data: {
        reportData: fullReportData,
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
 * Get Gantt Chart Data (Lightweight endpoint for visualization)
 * @route GET /api/v1/reports/theory-of-change/:projectId/gantt
 * @access Private
 */
export const getGanttChartData = async (
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
    const filters = req.query as any;

    // Convert query params to proper filter format
    const reportFilters = {
      scope: filters.scope || 'all',
      siteIds: filters.siteIds ? (Array.isArray(filters.siteIds) ? filters.siteIds : [filters.siteIds]) : undefined,
      stakeholderIds: filters.stakeholderIds ? (Array.isArray(filters.stakeholderIds) ? filters.stakeholderIds : [filters.stakeholderIds]) : undefined,
      themeIds: filters.themeIds ? (Array.isArray(filters.themeIds) ? filters.themeIds : [filters.themeIds]) : undefined
    };

    // Generate lightweight workplan report (just for Gantt data)
    const workplanReport = await TheoryOfChangeReportService.generateWorkplanReport(
      projectId,
      req.user._id.toString(),
      reportFilters
    );

    res.status(200).json({
      success: true,
      data: {
        ganttTimeline: workplanReport.outputs.ganttTimeline,
        timelineAnalysis: workplanReport.outputs.timelineAnalysis,
        workloadDistribution: workplanReport.outputs.workloadDistribution
      }
    });

  } catch (error) {
    next(error);
  }
};

export default {
  generateStage1Report,
  generateWorkplanReport,
  generateOutcomeReport,
  generateConsultationPlanReport,
  generateFullToCReport,
  getGanttChartData
};