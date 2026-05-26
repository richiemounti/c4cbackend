// controllers/reports/reportWorkflow.controller.ts
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import { CustomError } from "../../middlewares/error.middleware";
import ReportWorkflowService from "../../services/reports/reportWorkflow.service";
import Report from "../../models/report.model";
import ProjectSetupReportService from "../../services/reports/projectSetupReport.service";
import ProjectSiteSetupReportService from "../../services/reports/projectSiteSetupReport.service";
import StakeholderMappingReportService from "../../services/reports/stakeholderMappingReport.service";
import TheoryOfChangeReportService from "../../services/reports/theoryOfChangeReport.service";
import RiskRegisterReportService from "../../services/reports/riskRegisterReport.service";

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
 * Transition report status (approve, publish, archive, etc.)
 * @route PUT /api/v1/reports/:reportId/status
 * @access Private
 */
export const transitionReportStatus = async (
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
    const { status, notes, force = false } = req.body;

    if (!status) {
      const error = new Error('Status is required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const updatedReport = await ReportWorkflowService.transitionReportStatus(
      reportId,
      status,
      req.user._id.toString(),
      { notes, force }
    );

    res.status(200).json({
      success: true,
      message: `Report status transitioned to ${status}`,
      data: updatedReport
    });

  } catch (error) {
    next(error);
  }
};


/**
 * Auto-regenerate stale reports
 * @route POST /api/v1/reports/auto-regenerate
 * @access Private (Admin only)
 */
export const autoRegenerateReports = async (
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

    const { 
      organizationId, 
      reportType, 
      maxReports = 10 
    } = req.body;

    const results = await ReportWorkflowService.autoRegenerateReports(
      organizationId,
      reportType,
      maxReports
    );

    res.status(200).json({
      success: true,
      message: `Auto-regeneration completed. ${results.regenerated} reports regenerated, ${results.failed} failed`,
      data: results
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Bulk status transition for multiple reports
 * @route PUT /api/v1/reports/bulk-status
 * @access Private
 */
export const bulkStatusTransition = async (
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

    const { reportIds, status, notes } = req.body;

    if (!reportIds || !Array.isArray(reportIds) || reportIds.length === 0) {
      const error = new Error('Report IDs array is required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    if (!status) {
      const error = new Error('Status is required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Limit bulk operations to prevent abuse
    if (reportIds.length > 50) {
      const error = new Error('Maximum 50 reports can be updated at once') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const results = await ReportWorkflowService.bulkTransitionStatus(
      reportIds,
      status,
      req.user._id.toString(),
      notes
    );

    res.status(200).json({
      success: true,
      message: `Bulk status transition completed. ${results.successful.length} successful, ${results.failed.length} failed`,
      data: {
        successful: results.successful,
        failed: results.failed,
        summary: {
          total: reportIds.length,
          successful: results.successful.length,
          failed: results.failed.length
        }
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get workflow configuration and available transitions
 * @route GET /api/v1/reports/:reportId/workflow-config
 * @access Private
 */
export const getWorkflowConfig = async (
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

    const report = await Report.findById(reportId);
    if (!report) {
      const error = new Error('Report not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Define available transitions based on current status
    const availableTransitions: Record<string, string[]> = {
      'draft': ['generated', 'archived'],
      'generated': ['draft', 'approved', 'archived'],
      'approved': ['generated', 'published', 'archived'],
      'published': ['archived'],
      'archived': [] // No transitions from archived state
    };

    // Get user permissions (simplified - implement based on your auth system)
    const userPermissions = {
      canEdit: report.creator.toString() === req.user._id.toString() || req.user.isConnectGoStaff,
      canApprove: req.user.isConnectGoStaff || ['admin', 'manager'].includes(req.user.primaryRole || ''),
      canPublish: req.user.isConnectGoStaff || ['admin', 'manager'].includes(req.user.primaryRole || ''),
      canArchive: report.creator.toString() === req.user._id.toString() || req.user.isConnectGoStaff
    };

    // Filter available transitions based on permissions
    let allowedTransitions = availableTransitions[report.status] || [];
    
    if (!userPermissions.canEdit) {
      allowedTransitions = allowedTransitions.filter(t => t !== 'draft');
    }
    if (!userPermissions.canApprove) {
      allowedTransitions = allowedTransitions.filter(t => t !== 'approved');
    }
    if (!userPermissions.canPublish) {
      allowedTransitions = allowedTransitions.filter(t => t !== 'published');
    }
    if (!userPermissions.canArchive) {
      allowedTransitions = allowedTransitions.filter(t => t !== 'archived');
    }

    res.status(200).json({
      success: true,
      data: {
        reportId,
        currentStatus: report.status,
        availableTransitions: allowedTransitions,
        userPermissions,
        workflowSteps: {
          draft: 'Initial state for report creation and editing',
          generated: 'Report has been generated and is ready for review',
          approved: 'Report has been approved by authorized personnel',
          published: 'Report is published and available to stakeholders',
          archived: 'Report has been archived and is no longer active'
        }
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get report expiration status and warnings
 * @route GET /api/v1/reports/:reportId/expiration-status
 * @access Private
 */
export const getExpirationStatus = async (
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

    const report = await Report.findById(reportId);
    if (!report) {
      const error = new Error('Report not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Calculate expiration status
    const expirationConfig = {
      'project_setup': { days: 90, warning: 14 },
      'project_site_setup': { days: 90, warning: 14 },
      'stakeholder_mapping': { days: 180, warning: 30 },
      'theory_of_change': { days: 365, warning: 60 },
      'risk_register': { days: 60, warning: 7 }
    };

    const config = expirationConfig[report.reportType as keyof typeof expirationConfig];
    const now = new Date();
    const reportAge = Math.floor((now.getTime() - report.createdAt.getTime()) / (24 * 60 * 60 * 1000));

    const status = {
      reportId,
      reportType: report.reportType,
      createdAt: report.createdAt,
      ageInDays: reportAge,
      maxAgeInDays: config?.days || 90,
      warningPeriodDays: config?.warning || 14,
      isExpired: config ? reportAge > config.days : false,
      isNearingExpiration: config ? reportAge > (config.days - config.warning) : false,
      daysUntilExpiration: config ? Math.max(0, config.days - reportAge) : null,
      recommendedAction: null as string | null
    };

    // Determine recommended action
    if (status.isExpired) {
      status.recommendedAction = 'immediate_regeneration';
    } else if (status.isNearingExpiration) {
      status.recommendedAction = 'schedule_regeneration';
    } else {
      status.recommendedAction = 'no_action_needed';
    }

    res.status(200).json({
      success: true,
      data: status
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Schedule automatic report regeneration
 * @route POST /api/v1/reports/:reportId/schedule-regeneration
 * @access Private
 */
export const scheduleRegeneration = async (
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
    const { scheduledDate, recurring = false, frequency } = req.body;

    if (!scheduledDate) {
      const error = new Error('Scheduled date is required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const report = await Report.findById(reportId);
    if (!report) {
      const error = new Error('Report not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check permissions
    const isCreator = report.creator.toString() === req.user._id.toString();
    const isAdmin = req.user.isConnectGoStaff || ['admin', 'manager'].includes(req.user.primaryRole || '');

    if (!isCreator && !isAdmin) {
      const error = new Error('Not authorized to schedule regeneration for this report') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Update report metadata with scheduling information
    report.metadata.scheduledRegeneration = {
      scheduledDate: new Date(scheduledDate),
      scheduledBy: req.user._id,
      recurring,
      frequency: recurring ? frequency : undefined,
      status: 'scheduled'
    };

    await report.save();

    // Here you would integrate with your job scheduling system (e.g., Bull Queue, Agenda, etc.)
    // For now, we'll just acknowledge the scheduling

    res.status(200).json({
      success: true,
      message: 'Report regeneration scheduled successfully',
      data: {
        reportId,
        scheduledDate: new Date(scheduledDate),
        recurring,
        frequency: recurring ? frequency : undefined
      }
    });

  } catch (error) {
    next(error);
  }
}; 



/**
 * Check if report needs regeneration
 * @route GET /api/v1/reports/:reportId/regeneration-status
 * @access Private
 */
export const checkRegenerationStatus = async (
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

    const regenerationStatus = await ReportWorkflowService.checkRegenerationNeeded(reportId);

    res.status(200).json({
      success: true,
      data: regenerationStatus
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Trigger report regeneration
 * @route POST /api/v1/reports/:reportId/regenerate
 * @access Private
 */
export const regenerateReport = async (
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
    const { force = false } = req.body;

    // Get the existing report to check if regeneration is needed
    const initialReport = await Report.findById(reportId);
    if (!initialReport) {
      const error = new Error('Report not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if user has permission to regenerate
    const isCreator = initialReport.creator.toString() === req.user._id.toString();
    const isAdmin = req.user.isConnectGoStaff || ['admin', 'manager'].includes(req.user.primaryRole || '');

    if (!isCreator && !isAdmin && !force) {
      const error = new Error('Not authorized to regenerate this report') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Check if regeneration is needed
    if (!force) {
      const regenerationCheck = await ReportWorkflowService.checkRegenerationNeeded(reportId);
      if (!regenerationCheck.needsRegeneration) {
        return res.status(200).json({
          success: true,
          message: 'Report does not need regeneration',
          data: {
            regenerated: false,
            reasons: ['Report is up to date']
          }
        });
      }
    }

    // ONLY transition to regenerating if not already in that status
    if ((initialReport.status as string) !== 'regenerating') {
      await ReportWorkflowService.transitionReportStatus(
        reportId,
        'regenerating',
        req.user._id.toString(),
        { notes: 'Report regeneration initiated' }
      );
    } else {
      console.log(`Report ${reportId} already in regenerating status, continuing...`);
    }

    // RE-FETCH the report after status transition to get the updated version
    const report = await Report.findById(reportId);
    if (!report) {
      const error = new Error('Report not found after status transition') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Here you would trigger the appropriate report generation service
    // based on the report type
    let regeneratedReport;
    
    switch (report.reportType) {
      case 'project_setup':
        regeneratedReport = await ProjectSetupReportService.generateReport(
          report.entityId.toString(), 
          req.user._id.toString()
        );
        break;
      case 'project_site_setup':
        regeneratedReport = await ProjectSiteSetupReportService.generateReport(
          report.entityId.toString(), 
          req.user._id.toString()
        );
        break;
      case 'stakeholder_mapping':
        const stakeholderFilters = {
          scope: 'all' as const,
          ...(report.filters || {})
        };
        regeneratedReport = await StakeholderMappingReportService.generateReport(
          report.project.toString(), 
          req.user._id.toString(),
          stakeholderFilters
        );
        break;
      case 'theory_of_change':
        regeneratedReport = await TheoryOfChangeReportService.generateReport(
          report.project.toString(), 
          req.user._id.toString(),
          report.filters || {}
        );
        break;
      case 'risk_register':
        const riskFilters = {
          scope: 'all' as const,
          ...(report.filters || {})
        };
        regeneratedReport = await RiskRegisterReportService.generateReport(
          report.project.toString(), 
          req.user._id.toString(),
          riskFilters
        );
        break;
      default:
        throw new Error(`Unknown report type: ${report.reportType}`);
    }
    
    // Update the report with new data
    report.reportData = regeneratedReport || report.reportData;
    report.metadata.regeneratedAt = new Date();
    report.metadata.regeneratedBy = req.user._id.toString();
    report.metadata.regenerationAttempts = (report.metadata.regenerationAttempts || 0) + 1;
    report.metadata.lastRegenerationError = undefined; // Clear any previous errors
    
    await report.save();

    // Transition back to generated status
    const finalReport = await ReportWorkflowService.transitionReportStatus(
      reportId,
      'generated',
      req.user._id.toString(),
      { notes: 'Report regeneration completed' }
    );

    res.status(200).json({
      success: true,
      message: 'Report regenerated successfully',
      data: {
        regenerated: true,
        report: finalReport
      }
    });

  } catch (error) {
    // If regeneration fails, update the report with error details
    // and transition back to generated or draft status
    try {
      const report = await Report.findById(req.params.reportId);
      if (report) {
        report.metadata.lastRegenerationError = (error as Error).message;
        report.metadata.lastRegenerationAttempt = new Date();
        await report.save();
        
        // Transition back to generated status on failure
        // Type assertion for status comparison since TypeScript interface might not include 'regenerating'
        if ((report.status as string) === 'regenerating') {
          // Get userId - check if user is still authenticated
          const userId = isUserAuthenticated(req) 
            ? req.user._id.toString() 
            : report.creator.toString();
            
          await ReportWorkflowService.transitionReportStatus(
            req.params.reportId,
            'generated',
            userId,
            { notes: `Report regeneration failed: ${(error as Error).message}` }
          );
        }
      }
    } catch (saveError) {
      console.error('Failed to save regeneration error:', saveError);
    }
    
    next(error);
  }
};


/**
 * Get workflow history for a report
 * @route GET /api/v1/reports/:reportId/workflow-history
 * @access Private
 */
export const getWorkflowHistory = async (
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

    const history = await ReportWorkflowService.getWorkflowHistory(reportId);

    res.status(200).json({
      success: true,
      data: {
        reportId,
        workflowHistory: history
      }
    });

  } catch (error) {
    next(error);
  }
};

/**
 * Get reports requiring attention (expired, pending approval, etc.)
 * @route GET /api/v1/reports/attention-required
 * @access Private
 */
export const getReportsRequiringAttention = async (
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

    const { organizationId } = req.query;

    // For non-admin users, default to their organization
    let orgId = organizationId as string;
    if (!req.user.isConnectGoStaff && !orgId) {
      // You would need to get user's organization from your user model
      // orgId = req.user.organization?.toString();
    }

    if (!orgId) {
      const error = new Error('Organization ID is required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const attentionReports = await ReportWorkflowService.getReportsRequiringAttention(
      orgId,
      req.user._id.toString()
    );

    res.status(200).json({
      success: true,
      data: attentionReports
    });

  } catch (error) {
    next(error);
  }
};

