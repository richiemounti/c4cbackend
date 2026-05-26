// services/reports/reportWorkflow.service.ts
import mongoose from "mongoose";
import Report from "../../models/report.model";
import { CustomError } from "../../middlewares/error.middleware";

// Interface for workflow state transitions
interface IWorkflowTransition {
  fromStatus: string[];
  toStatus: string;
  requiredPermissions: string[];
  validationRules?: (report: any, userId: string) => Promise<boolean>;
  onTransition?: (report: any, userId: string, metadata?: any) => Promise<void>;
}

// Interface for workflow history entry
interface IWorkflowHistoryEntry {
  fromStatus: string;
  toStatus: string;
  transitionedBy: mongoose.Types.ObjectId;
  transitionedAt: Date;
  notes?: string;
  metadata?: any;
}

// Interface for report expiration configuration
interface IExpirationConfig {
  reportType: string;
  expirationDays: number;
  warningDays: number;
  autoArchive: boolean;
}

export class ReportWorkflowService {
  
  // Define workflow state machine
  private static readonly WORKFLOW_TRANSITIONS: Record<string, IWorkflowTransition> = {
    'draft_to_generated': {
      fromStatus: ['draft'],
      toStatus: 'generated',
      requiredPermissions: ['report:create'],
      onTransition: async (report, userId) => {
        report.metadata.generationCompletedAt = new Date();
        report.metadata.generationCompletedBy = userId;
      }
    },
    'generated_to_approved': {
      fromStatus: ['generated'],
      toStatus: 'approved',
      requiredPermissions: ['report:approve'],
      validationRules: async (report, userId) => {
        // Check if user has approval rights for this organization
        return await ReportWorkflowService.checkApprovalPermissions(report, userId);
      },
      onTransition: async (report, userId, metadata) => {
        report.approvedBy = new mongoose.Types.ObjectId(userId);
        report.approvedAt = new Date();
        if (metadata?.notes) {
          report.approvalNotes = metadata.notes;
        }
      }
    },
    'approved_to_published': {
      fromStatus: ['approved'],
      toStatus: 'published',
      requiredPermissions: ['report:publish'],
      onTransition: async (report, userId) => {
        report.visibility = 'organization'; // Default to organization visibility when published
        report.metadata.publishedAt = new Date();
        report.metadata.publishedBy = userId;
      }
    },
    'to_regenerating': {
      fromStatus: ['draft', 'generated', 'approved'],
      toStatus: 'regenerating',
      requiredPermissions: ['report:edit'],
      validationRules: async (report, userId) => {
        // Only creator or admin can regenerate
        return report.creator.toString() === userId || 
              await ReportWorkflowService.isUserAdmin(userId);
      },
      onTransition: async (report, userId) => {
        report.metadata.regenerationAttempts = (report.metadata.regenerationAttempts || 0) + 1;
        report.metadata.lastRegenerationAttempt = new Date();
      }
    },
    'regenerating_to_generated': {
      fromStatus: ['regenerating'],
      toStatus: 'generated',
      requiredPermissions: ['report:create'],
      onTransition: async (report, userId) => {
        report.metadata.generationCompletedAt = new Date();
        report.metadata.generationCompletedBy = userId;
      }
    },
    'any_to_archived': {
      fromStatus: ['draft', 'generated', 'approved', 'published'],
      toStatus: 'archived',
      requiredPermissions: ['report:archive'],
      onTransition: async (report, userId) => {
        report.archived = true;
        report.archivedAt = new Date();
      }
    },
    'generated_to_draft': {
      fromStatus: ['generated'],
      toStatus: 'draft',
      requiredPermissions: ['report:edit'],
      validationRules: async (report, userId) => {
        // Only creator or admin can revert to draft
        return report.creator.toString() === userId || 
               await ReportWorkflowService.isUserAdmin(userId);
      }
    },
    'approved_to_generated': {
      fromStatus: ['approved'],
      toStatus: 'generated',
      requiredPermissions: ['report:approve'],
      validationRules: async (report, userId) => {
        // Only approver or admin can revert approval
        return (report.approvedBy && report.approvedBy.toString() === userId) || 
               await ReportWorkflowService.isUserAdmin(userId);
      },
      onTransition: async (report, userId) => {
        report.approvedBy = undefined;
        report.approvedAt = undefined;
        report.approvalNotes = undefined;
      }
    }
  };

  // Expiration configuration by report type
  private static readonly EXPIRATION_CONFIG: Record<string, IExpirationConfig> = {
    'project_setup': { 
      reportType: 'project_setup', 
      expirationDays: 90, 
      warningDays: 14,
      autoArchive: false 
    },
    'project_site_setup': { 
      reportType: 'project_site_setup', 
      expirationDays: 90, 
      warningDays: 14,
      autoArchive: false 
    },
    'stakeholder_mapping': { 
      reportType: 'stakeholder_mapping', 
      expirationDays: 180, 
      warningDays: 30,
      autoArchive: false 
    },
    'theory_of_change': { 
      reportType: 'theory_of_change', 
      expirationDays: 365, 
      warningDays: 60,
      autoArchive: false 
    },
    'risk_register': { 
      reportType: 'risk_register', 
      expirationDays: 60, 
      warningDays: 7,
      autoArchive: false 
    }
  };

  /**
   * Transition report to a new status
   */
  static async transitionReportStatus(
    reportId: string,
    toStatus: string,
    userId: string,
    metadata?: { notes?: string; force?: boolean }
  ): Promise<any> {
    try {
      const report = await Report.findById(reportId);
      if (!report) {
        throw new Error('Report not found');
      }

      // Find valid transition
      const transition = this.findValidTransition(report.status, toStatus);
      if (!transition) {
        throw new Error(`Invalid status transition from ${report.status} to ${toStatus}`);
      }

      // Check permissions
      const hasPermission = await this.checkTransitionPermissions(
        transition, 
        report, 
        userId, 
        metadata?.force || false
      );
      if (!hasPermission) {
        throw new Error('Insufficient permissions for this transition');
      }

      // Validate transition rules
      if (transition.validationRules) {
        const isValid = await transition.validationRules(report, userId);
        if (!isValid && !metadata?.force) {
          throw new Error('Transition validation failed');
        }
      }

      // Store workflow history
      await this.addWorkflowHistory(report, userId, toStatus, metadata?.notes);

      // Execute transition logic
      const oldStatus = report.status;
      report.status = toStatus as any;
      report.lastUpdatedBy = new mongoose.Types.ObjectId(userId);

      if (transition.onTransition) {
        await transition.onTransition(report, userId, metadata);
      }

      // Save report
      await report.save();

      // Trigger post-transition events
      await this.triggerPostTransitionEvents(report, oldStatus, toStatus, userId);

      return report;

    } catch (error) {
      console.error('Error transitioning report status:', error);
      throw new Error(`Failed to transition report status: ${error}`);
    }
  }

  /**
   * Check if report needs regeneration based on source data changes
   */
  static async checkRegenerationNeeded(reportId: string): Promise<{
    needsRegeneration: boolean;
    reasons: string[];
    lastDataUpdate?: Date;
    reportGeneratedAt?: Date;
  }> {
    try {
      const report = await Report.findById(reportId)
        .populate('project')
        .populate('projectSite');

      if (!report) {
        throw new Error('Report not found');
      }

      const reasons: string[] = [];
      let needsRegeneration = false;
      let lastDataUpdate: Date | undefined;

      // Check based on report type
      switch (report.reportType) {
        case 'project_setup':
          const setupData = await this.getProjectSetupLastUpdate(report.project);
          if (setupData && setupData > report.createdAt) {
            needsRegeneration = true;
            reasons.push('Project setup data has been updated');
            lastDataUpdate = setupData;
          }
          break;

        case 'project_site_setup':
          const siteSetupData = await this.getProjectSiteSetupLastUpdate(report.projectSite);
          if (siteSetupData && siteSetupData > report.createdAt) {
            needsRegeneration = true;
            reasons.push('Project site setup data has been updated');
            lastDataUpdate = siteSetupData;
          }
          break;

        case 'stakeholder_mapping':
          const stakeholderData = await this.getStakeholderDataLastUpdate(
            report.project, 
            report.projectSite
          );
          if (stakeholderData && stakeholderData > report.createdAt) {
            needsRegeneration = true;
            reasons.push('Stakeholder data has been updated');
            lastDataUpdate = stakeholderData;
          }
          break;

        case 'theory_of_change':
          const tocData = await this.getTheoryOfChangeLastUpdate(
            report.project, 
            report.projectSite
          );
          if (tocData && tocData > report.createdAt) {
            needsRegeneration = true;
            reasons.push('Theory of Change data has been updated');
            lastDataUpdate = tocData;
          }
          break;

        case 'risk_register':
          const riskData = await this.getRiskRegisterLastUpdate(
            report.project, 
            report.projectSite
          );
          if (riskData && riskData > report.createdAt) {
            needsRegeneration = true;
            reasons.push('Risk register data has been updated');
            lastDataUpdate = riskData;
          }
          break;
      }

      // Check if report has expired
      const expirationCheck = this.checkReportExpiration(report);
      if (expirationCheck.isExpired) {
        needsRegeneration = true;
        reasons.push(`Report has expired (older than ${expirationCheck.maxAge} days)`);
      }

      return {
        needsRegeneration,
        reasons,
        lastDataUpdate,
        reportGeneratedAt: report.createdAt
      };

    } catch (error) {
      console.error('Error checking regeneration needed:', error);
      throw new Error(`Failed to check regeneration status: ${error}`);
    }
  }

  /**
   * Auto-regenerate reports that need updating
   */
  static async autoRegenerateReports(
    organizationId?: string,
    reportType?: string,
    maxReports: number = 10
  ): Promise<{
    regenerated: number;
    failed: number;
    results: Array<{
      reportId: string;
      success: boolean;
      error?: string;
    }>;
  }> {
    try {
      // Find reports that can be regenerated
      const query: any = {
        status: { $in: ['generated', 'draft'] },
        archived: { $ne: true }
      };

      if (organizationId) {
        query.organization = organizationId;
      }

      if (reportType) {
        query.reportType = reportType;
      }

      const reports = await Report.find(query)
        .limit(maxReports)
        .sort({ updatedAt: 1 }) as any[]; // Type assertion to fix the _id issue

      const results: Array<{
        reportId: string;
        success: boolean;
        error?: string;
      }> = [];

      let regenerated = 0;
      let failed = 0;

      for (const report of reports) {
        try {
          const regenerationCheck = await this.checkRegenerationNeeded(report._id.toString());
          
          if (regenerationCheck.needsRegeneration) {
            await this.regenerateReport(report._id.toString(), 'system');
            results.push({
              reportId: report._id.toString(),
              success: true
            });
            regenerated++;
          }
        } catch (error) {
          results.push({
            reportId: report._id.toString(),
            success: false,
            error: (error as Error).message
          });
          failed++;
        }
      }

      return {
        regenerated,
        failed,
        results
      };

    } catch (error) {
      console.error('Error in auto-regeneration:', error);
      throw new Error(`Failed to auto-regenerate reports: ${error}`);
    }
  }

  /**
   * Get workflow history for a report
   */
  static async getWorkflowHistory(reportId: string): Promise<IWorkflowHistoryEntry[]> {
    try {
      const report = await Report.findById(reportId);
      if (!report) {
        throw new Error('Report not found');
      }

      return report.metadata.workflowHistory || [];

    } catch (error) {
      console.error('Error getting workflow history:', error);
      throw new Error(`Failed to get workflow history: ${error}`);
    }
  }

  /**
   * Get reports requiring attention (expired, pending approval, etc.)
   */
  static async getReportsRequiringAttention(
    organizationId: string,
    userId?: string
  ): Promise<{
    expired: any[];
    pendingApproval: any[];
    nearingExpiration: any[];
    failedRegeneration: any[];
  }> {
    try {
      const now = new Date();
      const baseQuery = { 
        organization: organizationId,
        archived: { $ne: true }
      };

      // Get expired reports
      const expired = await Report.find({
        ...baseQuery,
        status: { $in: ['generated', 'approved'] },
        $expr: {
          $gt: [
            { $subtract: [now, '$createdAt'] },
            { $multiply: [90, 24, 60, 60, 1000] } // 90 days in milliseconds
          ]
        }
      }).populate('creator project projectSite', 'name');

      // Get reports pending approval
      const pendingApproval = await Report.find({
        ...baseQuery,
        status: 'generated'
      }).populate('creator project projectSite', 'name');

      // Get reports nearing expiration
      const fourteenDaysAgo = new Date(now.getTime() - (14 * 24 * 60 * 60 * 1000));
      const nearingExpiration = await Report.find({
        ...baseQuery,
        status: { $in: ['approved', 'published'] },
        createdAt: { $lt: fourteenDaysAgo }
      }).populate('creator project projectSite', 'name');

      // Get reports that failed regeneration
      const failedRegeneration = await Report.find({
        ...baseQuery,
        'metadata.regenerationAttempts': { $gt: 0 },
        'metadata.lastRegenerationError': { $exists: true }
      }).populate('creator project projectSite', 'name');

      return {
        expired,
        pendingApproval,
        nearingExpiration,
        failedRegeneration
      };

    } catch (error) {
      console.error('Error getting reports requiring attention:', error);
      throw new Error(`Failed to get reports requiring attention: ${error}`);
    }
  }

  /**
   * Bulk status transition for multiple reports
   */
  static async bulkTransitionStatus(
    reportIds: string[],
    toStatus: string,
    userId: string,
    notes?: string
  ): Promise<{
    successful: string[];
    failed: Array<{ reportId: string; error: string }>;
  }> {
    const successful: string[] = [];
    const failed: Array<{ reportId: string; error: string }> = [];

    for (const reportId of reportIds) {
      try {
        await this.transitionReportStatus(reportId, toStatus, userId, { notes });
        successful.push(reportId);
      } catch (error) {
        failed.push({
          reportId,
          error: (error as Error).message
        });
      }
    }

    return { successful, failed };
  }

  // Private helper methods
  private static findValidTransition(fromStatus: string, toStatus: string): IWorkflowTransition | null {
    for (const [key, transition] of Object.entries(this.WORKFLOW_TRANSITIONS)) {
      if (transition.toStatus === toStatus && transition.fromStatus.includes(fromStatus)) {
        return transition;
      }
    }
    return null;
  }

  private static async checkTransitionPermissions(
    transition: IWorkflowTransition,
    report: any,
    userId: string,
    force: boolean
  ): Promise<boolean> {
    if (force && await this.isUserAdmin(userId)) {
      return true;
    }

    // For now, simplified permission check
    // In a real system, you'd check against user roles and permissions
    return true;
  }

  private static async addWorkflowHistory(
    report: any,
    userId: string,
    toStatus: string,
    notes?: string
  ): Promise<void> {
    if (!report.metadata.workflowHistory) {
      report.metadata.workflowHistory = [];
    }

    report.metadata.workflowHistory.push({
      fromStatus: report.status,
      toStatus,
      transitionedBy: new mongoose.Types.ObjectId(userId),
      transitionedAt: new Date(),
      notes
    });
  }

  private static async triggerPostTransitionEvents(
    report: any,
    oldStatus: string,
    newStatus: string,
    userId: string
  ): Promise<void> {
    // Trigger events like notifications, webhooks, etc.
    // Implementation depends on your event system
    console.log(`Report ${report._id} transitioned from ${oldStatus} to ${newStatus} by ${userId}`);
  }

  private static checkReportExpiration(report: any): {
    isExpired: boolean;
    isNearingExpiration: boolean;
    maxAge: number;
    warningAge: number;
  } {
    const config = this.EXPIRATION_CONFIG[report.reportType];
    if (!config) {
      return { isExpired: false, isNearingExpiration: false, maxAge: 0, warningAge: 0 };
    }

    const now = new Date();
    const reportAge = (now.getTime() - report.createdAt.getTime()) / (24 * 60 * 60 * 1000);

    return {
      isExpired: reportAge > config.expirationDays,
      isNearingExpiration: reportAge > (config.expirationDays - config.warningDays),
      maxAge: config.expirationDays,
      warningAge: config.warningDays
    };
  }

  private static async regenerateReport(reportId: string, userId: string): Promise<void> {
    // Implementation would depend on your specific report generation services
    // This is a placeholder for the regeneration logic
    const report = await Report.findById(reportId);
    if (!report) {
      throw new Error('Report not found');
    }

    // Mark as being regenerated
    report.status = 'draft';
    report.metadata.regenerationAttempts = (report.metadata.regenerationAttempts || 0) + 1;
    report.metadata.lastRegenerationAttempt = new Date();
    
    await report.save();
    
    // Here you would call the appropriate report generation service
    // based on report.reportType
  }

  // Data update check methods (implement based on your data models)
  private static async getProjectSetupLastUpdate(projectId: any): Promise<Date | null> {
    // Implementation depends on your ProjectSetup model
    const ProjectSetup = mongoose.model('ProjectSetup');
    const setup = await ProjectSetup.findOne({ project: projectId }).sort({ updatedAt: -1 });
    return setup?.updatedAt || null;
  }

  private static async getProjectSiteSetupLastUpdate(siteId: any): Promise<Date | null> {
    // Implementation depends on your ProjectSiteSetup model
    const ProjectSiteSetup = mongoose.model('ProjectSiteSetup');
    const setup = await ProjectSiteSetup.findOne({ projectSite: siteId }).sort({ updatedAt: -1 });
    return setup?.updatedAt || null;
  }

  private static async getStakeholderDataLastUpdate(projectId: any, siteId?: any): Promise<Date | null> {
    const StakeholderGroup = mongoose.model('StakeholderGroup');
    const query: any = { project: projectId };
    if (siteId) query.projectSite = siteId;
    
    const stakeholder = await StakeholderGroup.findOne(query).sort({ updatedAt: -1 });
    return stakeholder?.updatedAt || null;
  }

  private static async getTheoryOfChangeLastUpdate(projectId: any, siteId?: any): Promise<Date | null> {
    const TheoryOfChangeStage = mongoose.model('TheoryOfChangeStage');
    const query: any = { project: projectId };
    if (siteId) query.projectSite = siteId;
    
    const stage = await TheoryOfChangeStage.findOne(query).sort({ updatedAt: -1 });
    return stage?.updatedAt || null;
  }

  private static async getRiskRegisterLastUpdate(projectId: any, siteId?: any): Promise<Date | null> {
    const RiskRegister = mongoose.model('RiskRegister');
    const query: any = { project: projectId };
    if (siteId) query.projectSite = siteId;
    
    const risk = await RiskRegister.findOne(query).sort({ updatedAt: -1 });
    return risk?.updatedAt || null;
  }

  private static async checkApprovalPermissions(report: any, userId: string): Promise<boolean> {
    // Implement based on your user permission system
    return true; // Placeholder
  }

  private static async isUserAdmin(userId: string): Promise<boolean> {
    // Implement based on your user role system
    return false; // Placeholder
  }
}

export default ReportWorkflowService;