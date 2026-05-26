// services/reports/reportScheduler.service.ts
import mongoose from "mongoose";
import Report from "../../models/report.model";
import ReportWorkflowService from "./reportWorkflow.service";
import ProjectSetupReportService from "./projectSetupReport.service";
import ProjectSiteSetupReportService from "./projectSiteSetupReport.service";
import StakeholderMappingReportService from "./stakeholderMappingReport.service";
import TheoryOfChangeReportService from "./theoryOfChangeReport.service";
import RiskRegisterReportService from "./riskRegisterReport.service";
import ReportPersistenceService from "./reportPersistence.service";

// Interface for batch processing results
interface IBatchProcessingResult {
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: Array<{
    reportId: string;
    error: string;
    reportType: string;
  }>;
}

// Interface for scheduler configuration
interface ISchedulerConfig {
  batchSize: number;
  maxConcurrentJobs: number;
  retryAttempts: number;
  retryDelay: number;
  enableAutoRegeneration: boolean;
  enableScheduledRegeneration: boolean;
}

export class ReportSchedulerService {
  private static config: ISchedulerConfig = {
    batchSize: 10,
    maxConcurrentJobs: 3,
    retryAttempts: 3,
    retryDelay: 5000, // 5 seconds
    enableAutoRegeneration: true,
    enableScheduledRegeneration: true
  };

  private static isRunning = false;
  private static currentJobs = 0;

  /**
   * Main scheduler function - processes all pending report operations
   */
  static async runScheduler(): Promise<IBatchProcessingResult> {
    if (this.isRunning) {
      console.log('Scheduler already running, skipping...');
      return {
        processed: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
        errors: []
      };
    }

    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      console.log('Starting report scheduler...');
      
      const results: IBatchProcessingResult = {
        processed: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
        errors: []
      };

      // Process scheduled regenerations
      if (this.config.enableScheduledRegeneration) {
        const scheduledResults = await this.processScheduledRegenerations();
        this.mergeResults(results, scheduledResults);
      }

      // Process automatic regenerations (expired reports)
      if (this.config.enableAutoRegeneration) {
        const autoResults = await this.processAutoRegenerations();
        this.mergeResults(results, autoResults);
      }

      // Clean up old workflow history entries
      await this.cleanupOldWorkflowHistory();

      // Update scheduler statistics
      await this.updateSchedulerStats(results, Date.now() - startTime);

      console.log(`Scheduler completed. Processed: ${results.processed}, Successful: ${results.successful}, Failed: ${results.failed}`);
      
      return results;

    } catch (error) {
      console.error('Scheduler error:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Process reports with scheduled regeneration dates
   */
  private static async processScheduledRegenerations(): Promise<IBatchProcessingResult> {
    const results: IBatchProcessingResult = {
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    try {
      const scheduledReports = await Report.find({
        'metadata.scheduledRegeneration.scheduledDate': { $lte: new Date() },
        'metadata.scheduledRegeneration.status': 'scheduled',
        archived: { $ne: true }
        }).limit(this.config.batchSize) as any[];

      console.log(`Found ${scheduledReports.length} scheduled regenerations to process`);

      for (const report of scheduledReports) {
        if (this.currentJobs >= this.config.maxConcurrentJobs) {
          results.skipped++;
          continue;
        }

        results.processed++;
        
        try {
          await this.regenerateReportWithRetry(report, 'scheduled');
          results.successful++;
          
          // Update scheduled regeneration status
          if (report.metadata.scheduledRegeneration) {
            report.metadata.scheduledRegeneration.status = 'completed';
            report.metadata.scheduledRegeneration.lastAttempt = new Date();
            
            // Calculate next scheduled date if recurring
            if (report.metadata.scheduledRegeneration.recurring) {
              report.calculateNextScheduledDate();
            }
            
            await report.save();
          }

        } catch (error) {
          results.failed++;
          results.errors.push({
            reportId: report._id.toString(),
            error: (error as Error).message,
            reportType: report.reportType
          });

          // Update failure status
          if (report.metadata.scheduledRegeneration) {
            report.metadata.scheduledRegeneration.status = 'failed';
            report.metadata.scheduledRegeneration.lastAttempt = new Date();
            await report.save();
          }
        }
      }

    } catch (error) {
      console.error('Error processing scheduled regenerations:', error);
    }

    return results;
  }

  /**
   * Process reports that need automatic regeneration due to age/expiration
   */
  private static async processAutoRegenerations(): Promise<IBatchProcessingResult> {
    const results: IBatchProcessingResult = {
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    try {
      // Find reports that are expired and eligible for regeneration
      const expiredReports = await Report.find({
        status: { $in: ['generated', 'approved'] },
        archived: { $ne: true },
        // Only regenerate if no recent regeneration attempts
        $or: [
          { 'metadata.lastRegenerationAttempt': { $exists: false } },
          { 
            'metadata.lastRegenerationAttempt': { 
              $lt: new Date(Date.now() - (24 * 60 * 60 * 1000)) // 24 hours ago
            }
          }
        ]
      }).limit(this.config.batchSize) as any[];

      // Filter by expiration rules
      const candidatesForRegeneration = expiredReports.filter(report => {
        const regenerationCheck = this.checkIfReportNeedsRegeneration(report);
        return regenerationCheck.needsRegeneration;
      });

      console.log(`Found ${candidatesForRegeneration.length} expired reports to regenerate`);

      for (const report of candidatesForRegeneration) {
        if (this.currentJobs >= this.config.maxConcurrentJobs) {
          results.skipped++;
          continue;
        }

        results.processed++;

        try {
          await this.regenerateReportWithRetry(report, 'automatic');
          results.successful++;

        } catch (error) {
          results.failed++;
          results.errors.push({
            reportId: report._id.toString(),
            error: (error as Error).message,
            reportType: report.reportType
          });
        }
      }

    } catch (error) {
      console.error('Error processing auto regenerations:', error);
    }

    return results;
  }

  /**
   * Regenerate a report with retry logic
   */
  private static async regenerateReportWithRetry(
    report: any, 
    triggerType: 'scheduled' | 'automatic'
  ): Promise<void> {
    this.currentJobs++;
    
    try {
      let attempts = 0;
      let lastError: Error | null = null;

      while (attempts < this.config.retryAttempts) {
        try {
          // Update report status to indicate regeneration in progress
          await ReportWorkflowService.transitionReportStatus(
            report._id.toString(),
            'regenerating',
            'system',
            { notes: `${triggerType} regeneration started` }
          );

          // Generate new report data
          const newReportData = await this.generateReportData(report);

          // Update the report with new data
          report.reportData = newReportData;
          report.metadata.regeneratedAt = new Date();
          report.metadata.regeneratedBy = 'system';
          report.metadata.regenerationAttempts = (report.metadata.regenerationAttempts || 0) + 1;
          report.metadata.lastRegenerationError = undefined;

          await report.save();

          // Transition back to generated status
          await ReportWorkflowService.transitionReportStatus(
            report._id.toString(),
            'generated',
            'system',
            { notes: `${triggerType} regeneration completed successfully` }
          );

          console.log(`Successfully regenerated report ${report._id} (${triggerType})`);
          return;

        } catch (error) {
          attempts++;
          lastError = error as Error;
          
          if (attempts < this.config.retryAttempts) {
            console.log(`Regeneration attempt ${attempts} failed for report ${report._id}, retrying in ${this.config.retryDelay}ms...`);
            await this.delay(this.config.retryDelay);
          }
        }
      }

      // All retry attempts failed
      report.metadata.lastRegenerationError = lastError?.message;
      report.metadata.lastRegenerationAttempt = new Date();
      report.metadata.regenerationAttempts = (report.metadata.regenerationAttempts || 0) + attempts;
      await report.save();

      // Transition back to previous status if stuck in regenerating
      if (report.status === 'regenerating') {
        await ReportWorkflowService.transitionReportStatus(
          report._id.toString(),
          'generated',
          'system',
          { notes: `${triggerType} regeneration failed after ${attempts} attempts` }
        );
      }

      throw new Error(`Failed to regenerate report after ${attempts} attempts: ${lastError?.message}`);

    } finally {
      this.currentJobs--;
    }
  }

  /**
   * Generate report data based on report type
   */
  private static async generateReportData(report: any): Promise<any> {
    const entityId = report.entityId.toString();
    const userId = 'system';

    switch (report.reportType) {
      case 'project_setup':
        return await ProjectSetupReportService.generateReport(entityId, userId);

      case 'project_site_setup':
        return await ProjectSiteSetupReportService.generateReport(entityId, userId);

      case 'stakeholder_mapping':
        const stakeholderFilters = report.filters || {};
        return await StakeholderMappingReportService.generateReport(
          report.project.toString(), 
          userId, 
          stakeholderFilters
        );

      case 'theory_of_change':
        const tocFilters = report.filters || {};
        return await TheoryOfChangeReportService.generateReport(
          report.project.toString(), 
          userId, 
          tocFilters
        );

      case 'risk_register':
        const riskFilters = report.filters || {};
        return await RiskRegisterReportService.generateReport(
          report.project.toString(), 
          userId, 
          riskFilters
        );

      default:
        throw new Error(`Unknown report type: ${report.reportType}`);
    }
  }

  /**
   * Check if a report needs regeneration based on business rules
   */
  private static checkIfReportNeedsRegeneration(report: any): {
    needsRegeneration: boolean;
    reasons: string[];
  } {
    const reasons: string[] = [];
    let needsRegeneration = false;

    // Age-based regeneration rules
    const expirationRules = {
      'project_setup': 90,
      'project_site_setup': 90,
      'stakeholder_mapping': 180,
      'theory_of_change': 365,
      'risk_register': 60
    };

    const maxAge = expirationRules[report.reportType as keyof typeof expirationRules] || 90;
    const reportAge = Math.floor((Date.now() - report.createdAt.getTime()) / (24 * 60 * 60 * 1000));

    if (reportAge > maxAge) {
      needsRegeneration = true;
      reasons.push(`Report is ${reportAge} days old, exceeds maximum age of ${maxAge} days`);
    }

    // Check if regeneration attempts are reasonable
    const maxAttempts = 5;
    const attemptCount = report.metadata.regenerationAttempts || 0;
    
    if (attemptCount >= maxAttempts) {
      needsRegeneration = false;
      reasons.push(`Too many regeneration attempts (${attemptCount}), skipping`);
    }

    // Check if last attempt was too recent (prevent spam regeneration)
    const lastAttempt = report.metadata.lastRegenerationAttempt;
    if (lastAttempt) {
      const timeSinceLastAttempt = Date.now() - lastAttempt.getTime();
      const minimumInterval = 6 * 60 * 60 * 1000; // 6 hours
      
      if (timeSinceLastAttempt < minimumInterval) {
        needsRegeneration = false;
        reasons.push('Recent regeneration attempt, waiting for minimum interval');
      }
    }

    return { needsRegeneration, reasons };
  }

  /**
   * Clean up old workflow history entries to prevent unbounded growth
   */
  private static async cleanupOldWorkflowHistory(): Promise<void> {
    try {
      const maxHistoryEntries = 50;
      const cutoffDate = new Date(Date.now() - (365 * 24 * 60 * 60 * 1000)); // 1 year ago

      await Report.updateMany(
        {
          $or: [
            { 'metadata.workflowHistory.50': { $exists: true } }, // More than 50 entries
            { 'metadata.workflowHistory.transitionedAt': { $lt: cutoffDate } } // Old entries
          ]
        },
        [
          {
            $set: {
              'metadata.workflowHistory': {
                $slice: ['$metadata.workflowHistory', -maxHistoryEntries]
              }
            }
          }
        ]
      );

      console.log('Cleaned up old workflow history entries');

    } catch (error) {
      console.error('Error cleaning up workflow history:', error);
    }
  }

  /**
   * Update scheduler statistics for monitoring
   */
  private static async updateSchedulerStats(
    results: IBatchProcessingResult, 
    executionTime: number
  ): Promise<void> {
    try {
      // You could store scheduler statistics in a dedicated collection
      // For now, just log them
      const stats = {
        timestamp: new Date(),
        executionTime,
        results,
        config: this.config
      };

      console.log('Scheduler stats:', JSON.stringify(stats, null, 2));

      // Optional: Store in database for monitoring dashboard
      // await SchedulerStats.create(stats);

    } catch (error) {
      console.error('Error updating scheduler stats:', error);
    }
  }

  /**
   * Utility methods
   */
  private static mergeResults(target: IBatchProcessingResult, source: IBatchProcessingResult): void {
    target.processed += source.processed;
    target.successful += source.successful;
    target.failed += source.failed;
    target.skipped += source.skipped;
    target.errors.push(...source.errors);
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Configuration management
   */
  static updateConfig(newConfig: Partial<ISchedulerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('Scheduler configuration updated:', this.config);
  }

  static getConfig(): ISchedulerConfig {
    return { ...this.config };
  }

  /**
   * Manual trigger methods for specific operations
   */
  static async processSpecificReport(reportId: string, triggerType: 'scheduled' | 'automatic' = 'automatic'): Promise<void> {
    const report = await Report.findById(reportId);
    if (!report) {
      throw new Error('Report not found');
    }

    await this.regenerateReportWithRetry(report, triggerType);
  }

  static async processReportsForOrganization(organizationId: string): Promise<IBatchProcessingResult> {
    const results: IBatchProcessingResult = {
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    const reports = await Report.find({
      organization: organizationId,
      archived: { $ne: true },
      status: { $in: ['generated', 'approved'] }
    }).limit(this.config.batchSize) as any[];

    for (const report of reports) {
      const regenerationCheck = this.checkIfReportNeedsRegeneration(report);
      
      if (!regenerationCheck.needsRegeneration) {
        results.skipped++;
        continue;
      }

      results.processed++;
      
      try {
        await this.regenerateReportWithRetry(report, 'automatic');
        results.successful++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          reportId: report._id.toString(),
          error: (error as Error).message,
          reportType: report.reportType
        });
      }
    }

    return results;
  }

  /**
   * Health check method for monitoring
   */
  static getHealthStatus(): {
    isRunning: boolean;
    currentJobs: number;
    maxJobs: number;
    config: ISchedulerConfig;
  } {
    return {
      isRunning: this.isRunning,
      currentJobs: this.currentJobs,
      maxJobs: this.config.maxConcurrentJobs,
      config: this.getConfig()
    };
  }
}

export default ReportSchedulerService;