// services/reports/backgroundGeneration.service.ts
import Queue from 'bull';
import mongoose from 'mongoose';
import Report from '../../models/report.model';
import ProjectSetupReportService from './projectSetupReport.service';
import ProjectSiteSetupReportService from './projectSiteSetupReport.service';
import StakeholderMappingReportService from './stakeholderMappingReport.service';
import TheoryOfChangeReportService from './theoryOfChangeReport.service';
import RiskRegisterReportService from './riskRegisterReport.service';
import ReportCacheService from './reportCache.service';
import ReportPersistenceService from './reportPersistence.service';

// Job data interfaces
interface IReportGenerationJob {
  reportType: string;
  entityType: 'project' | 'project_site';
  entityId: string;
  userId: string;
  options: {
    saveReport?: boolean;
    cacheResult?: boolean;
    priority?: 'low' | 'normal' | 'high' | 'critical';
    filters?: any;
    reportDimension?: string;
  };
  metadata: {
    requestId: string;
    organizationId: string;
    projectId: string;
    requestedAt: Date;
    estimatedSize: 'small' | 'medium' | 'large';
  };
}

interface IBatchGenerationJob {
  reports: Array<{
    reportType: string;
    entityType: 'project' | 'project_site';
    entityId: string;
    filters?: any;
  }>;
  userId: string;
  organizationId: string;
  options: {
    saveReports?: boolean;
    cacheResults?: boolean;
  };
}

interface IReportRegenerationJob {
  reportId: string;
  reason: 'scheduled' | 'data_updated' | 'manual' | 'expired';
  userId: string;
  options: {
    createBackup?: boolean;
    notifyUsers?: boolean;
  };
}

export class BackgroundReportGenerationService {
  private static reportQueue: Queue.Queue<IReportGenerationJob>;
  private static batchQueue: Queue.Queue<IBatchGenerationJob>;
  private static regenerationQueue: Queue.Queue<IReportRegenerationJob>;
  
  private static readonly QUEUE_OPTIONS = {
    redis: {
      port: parseInt(process.env.REDIS_PORT || '6379'),
      host: process.env.REDIS_HOST || 'localhost',
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0')
    },
    defaultJobOptions: {
      removeOnComplete: 50,
      removeOnFail: 20,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    }
  };

  private static readonly JOB_PRIORITIES = {
    low: 10,
    normal: 0,
    high: -10,
    critical: -20
  };

  /**
   * Initialize background generation service
   */
  static async initialize(): Promise<void> {
    try {
      // Initialize queues
      this.reportQueue = new Queue('report generation', this.QUEUE_OPTIONS);
      this.batchQueue = new Queue('batch generation', this.QUEUE_OPTIONS);
      this.regenerationQueue = new Queue('report regeneration', this.QUEUE_OPTIONS);

      // Setup job processors
      this.setupReportProcessor();
      this.setupBatchProcessor();
      this.setupRegenerationProcessor();

      // Setup queue monitoring
      this.setupQueueMonitoring();

      // Setup periodic cleanup
      this.setupPeriodicCleanup();

      console.log('Background report generation service initialized');
    } catch (error) {
      console.error('Failed to initialize background generation service:', error);
      throw error;
    }
  }

  /**
   * Queue single report generation
   */
  static async queueReportGeneration(
    reportType: string,
    entityType: 'project' | 'project_site',
    entityId: string,
    userId: string,
    options: {
      saveReport?: boolean;
      cacheResult?: boolean;
      priority?: 'low' | 'normal' | 'high' | 'critical';
      filters?: any;
      reportDimension?: string;
      delay?: number;
    } = {}
  ): Promise<{ jobId: string; estimatedDuration: number }> {
    try {
      const jobData: IReportGenerationJob = {
        reportType,
        entityType,
        entityId,
        userId,
        options: {
          saveReport: options.saveReport ?? true,
          cacheResult: options.cacheResult ?? true,
          priority: options.priority || 'normal',
          filters: options.filters,
          reportDimension: options.reportDimension
        },
        metadata: {
          requestId: this.generateRequestId(),
          organizationId: await this.getOrganizationId(entityType, entityId),
          projectId: await this.getProjectId(entityType, entityId),
          requestedAt: new Date(),
          estimatedSize: this.estimateReportSize(reportType, options.filters)
        }
      };

      const jobOptions = {
        priority: this.JOB_PRIORITIES[options.priority || 'normal'],
        delay: options.delay || 0,
        attempts: reportType === 'theory_of_change' ? 5 : 3 // ToC reports might need more attempts
      };

      const job = await this.reportQueue.add('generate-report', jobData, jobOptions);
      
      const estimatedDuration = this.estimateJobDuration(jobData);

      return {
        jobId: job.id as string,
        estimatedDuration
      };

    } catch (error) {
      console.error('Failed to queue report generation:', error);
      throw new Error(`Failed to queue report generation: ${error}`);
    }
  }

  /**
   * Queue batch report generation
   */
  static async queueBatchGeneration(
    reports: Array<{
      reportType: string;
      entityType: 'project' | 'project_site';
      entityId: string;
      filters?: any;
    }>,
    userId: string,
    organizationId: string,
    options: {
      saveReports?: boolean;
      cacheResults?: boolean;
      priority?: 'low' | 'normal' | 'high';
    } = {}
  ): Promise<{ jobId: string; estimatedDuration: number }> {
    try {
      const jobData: IBatchGenerationJob = {
        reports,
        userId,
        organizationId,
        options: {
          saveReports: options.saveReports ?? true,
          cacheResults: options.cacheResults ?? true
        }
      };

      const jobOptions = {
        priority: this.JOB_PRIORITIES[options.priority || 'normal']
      };

      const job = await this.batchQueue.add('generate-batch', jobData, jobOptions);
      
      const estimatedDuration = reports.length * 30000; // Rough estimate: 30 seconds per report

      return {
        jobId: job.id as string,
        estimatedDuration
      };

    } catch (error) {
      console.error('Failed to queue batch generation:', error);
      throw new Error(`Failed to queue batch generation: ${error}`);
    }
  }

  /**
   * Queue report regeneration
   */
  static async queueReportRegeneration(
    reportId: string,
    reason: 'scheduled' | 'data_updated' | 'manual' | 'expired',
    userId: string,
    options: {
      createBackup?: boolean;
      notifyUsers?: boolean;
      priority?: 'low' | 'normal' | 'high';
    } = {}
  ): Promise<{ jobId: string }> {
    try {
      const jobData: IReportRegenerationJob = {
        reportId,
        reason,
        userId,
        options: {
          createBackup: options.createBackup ?? true,
          notifyUsers: options.notifyUsers ?? false
        }
      };

      const jobOptions = {
        priority: this.JOB_PRIORITIES[options.priority || 'normal']
      };

      const job = await this.regenerationQueue.add('regenerate-report', jobData, jobOptions);

      return {
        jobId: job.id as string
      };

    } catch (error) {
      console.error('Failed to queue report regeneration:', error);
      throw new Error(`Failed to queue report regeneration: ${error}`);
    }
  }

  /**
   * Get job status
   */
  static async getJobStatus(jobId: string, queueType: 'report' | 'batch' | 'regeneration' = 'report'): Promise<any> {
    try {
      let queue;
      switch (queueType) {
        case 'batch':
          queue = this.batchQueue;
          break;
        case 'regeneration':
          queue = this.regenerationQueue;
          break;
        default:
          queue = this.reportQueue;
      }

      const job = await queue.getJob(jobId);
      if (!job) {
        return { status: 'not_found' };
      }

      const state = await job.getState();
      const progress = job.progress();

      return {
        id: job.id,
        status: state,
        progress,
        data: job.data,
        createdAt: new Date(job.timestamp),
        processedOn: job.processedOn ? new Date(job.processedOn) : null,
        finishedOn: job.finishedOn ? new Date(job.finishedOn) : null,
        failedReason: job.failedReason
      };

    } catch (error) {
      console.error('Failed to get job status:', error);
      return { status: 'error', error: error };
    }
  }

  /**
   * Cancel job
   */
  static async cancelJob(jobId: string, queueType: 'report' | 'batch' | 'regeneration' = 'report'): Promise<boolean> {
    try {
      let queue;
      switch (queueType) {
        case 'batch':
          queue = this.batchQueue;
          break;
        case 'regeneration':
          queue = this.regenerationQueue;
          break;
        default:
          queue = this.reportQueue;
      }

      const job = await queue.getJob(jobId);
      if (!job) {
        return false;
      }

      await job.remove();
      return true;

    } catch (error) {
      console.error('Failed to cancel job:', error);
      return false;
    }
  }

  /**
   * Get queue statistics
   */
  static async getQueueStats(): Promise<any> {
    try {
      const [reportStats, batchStats, regenerationStats] = await Promise.all([
        this.getQueueCounts(this.reportQueue),
        this.getQueueCounts(this.batchQueue),
        this.getQueueCounts(this.regenerationQueue)
      ]);

      return {
        report: reportStats,
        batch: batchStats,
        regeneration: regenerationStats,
        timestamp: new Date()
      };

    } catch (error) {
      console.error('Failed to get queue stats:', error);
      return null;
    }
  }

  // Private methods
  private static setupReportProcessor(): void {
    this.reportQueue.process('generate-report', 5, async (job: Queue.Job<IReportGenerationJob>) => {
      const { reportType, entityType, entityId, userId, options, metadata } = job.data;

      try {
        // Update progress
        job.progress(10);

        // Check if cached result exists
        if (options.cacheResult) {
          const cachedResult = await ReportCacheService.getCachedReportData(
            `${reportType}:${entityId}:${JSON.stringify(options.filters)}`
          );
          if (cachedResult) {
            job.progress(100);
            return { 
              success: true, 
              source: 'cache', 
              data: cachedResult,
              reportId: cachedResult.reportId
            };
          }
        }

        job.progress(25);

        // Generate report based on type
        let reportData;
        switch (reportType) {
          case 'project_setup':
            reportData = await ProjectSetupReportService.generateReport(entityId, userId);
            break;
          case 'project_site_setup':
            reportData = await ProjectSiteSetupReportService.generateReport(entityId, userId);
            break;
          case 'stakeholder_mapping':
            reportData = await StakeholderMappingReportService.generateReport(
              metadata.projectId, 
              userId, 
              options.filters || { scope: 'all' }
            );
            break;
          case 'theory_of_change':
            reportData = await TheoryOfChangeReportService.generateReport(
              metadata.projectId, 
              userId, 
              options.filters || { scope: 'all' }
            );
            break;
          case 'risk_register':
            reportData = await RiskRegisterReportService.generateReport(
              metadata.projectId, 
              userId, 
              options.filters || { scope: 'all' }
            );
            break;
          default:
            throw new Error(`Unknown report type: ${reportType}`);
        }

        job.progress(75);

        // Save report if requested
        let savedReport = null;
        if (options.saveReport) {
          savedReport = await ReportPersistenceService.saveReport(
            reportType,
            entityType,
            entityId,
            reportData,
            userId,
            {
              autoTitle: true,
              visibility: 'organization',
              status: 'generated'
            }
          );
        }

        job.progress(90);

        // Cache result if requested
        if (options.cacheResult) {
          const cacheKey = `${reportType}:${entityId}:${JSON.stringify(options.filters)}`;
          await ReportCacheService.cacheReportData(cacheKey, {
            ...reportData,
            reportId: savedReport?._id
          });
        }

        job.progress(100);

        return {
          success: true,
          source: 'generated',
          data: reportData,
          reportId: savedReport?._id,
          generatedAt: new Date()
        };

      } catch (error) {
        console.error('Report generation job failed:', error);
        throw error;
      }
    });
  }

  private static setupBatchProcessor(): void {
    this.batchQueue.process('generate-batch', 2, async (job: Queue.Job<IBatchGenerationJob>) => {
      const { reports, userId, organizationId, options } = job.data;
      const results: any[] = [];
      const errors: any[] = [];

      try {
        job.progress(5);

        for (let i = 0; i < reports.length; i++) {
          const report = reports[i];
          const progress = Math.round(((i + 1) / reports.length) * 90) + 5;

          try {
            // Queue individual report generation
            const { jobId } = await this.queueReportGeneration(
              report.reportType,
              report.entityType,
              report.entityId,
              userId,
              {
                saveReport: options.saveReports,
                cacheResult: options.cacheResults,
                priority: 'normal',
                filters: report.filters
              }
            );

            results.push({
              reportType: report.reportType,
              entityId: report.entityId,
              jobId,
              status: 'queued'
            });

          } catch (error) {
            errors.push({
              reportType: report.reportType,
              entityId: report.entityId,
              error: (error as Error).message
            });
          }

          job.progress(progress);
        }

        job.progress(100);

        return {
          success: true,
          results,
          errors,
          summary: {
            total: reports.length,
            queued: results.length,
            failed: errors.length
          }
        };

      } catch (error) {
        console.error('Batch generation job failed:', error);
        throw error;
      }
    });
  }

  private static setupRegenerationProcessor(): void {
    this.regenerationQueue.process('regenerate-report', 3, async (job: Queue.Job<IReportRegenerationJob>) => {
      const { reportId, reason, userId, options } = job.data;

      try {
        job.progress(10);

        // Get existing report
        const existingReport = await Report.findById(reportId);
        if (!existingReport) {
          throw new Error('Report not found');
        }

        job.progress(25);

        // Create backup if requested
        if (options.createBackup) {
          const ReportSnapshotService = (await import('./reportSnapshot.service')).default;
          await ReportSnapshotService.createSnapshot(
            reportId,
            userId,
            'automatic',
            `Backup before regeneration (${reason})`,
            true
          );
        }

        job.progress(40);

        // Regenerate report data
        let newReportData;
        switch (existingReport.reportType) {
          case 'project_setup':
            newReportData = await ProjectSetupReportService.generateReport(
              existingReport.entityId.toString(), 
              userId
            );
            break;
          case 'project_site_setup':
            newReportData = await ProjectSiteSetupReportService.generateReport(
              existingReport.entityId.toString(), 
              userId
            );
            break;
          case 'stakeholder_mapping':
            newReportData = await StakeholderMappingReportService.generateReport(
                existingReport.project.toString(), 
                userId, 
                {
                    scope: 'all',
                    ...existingReport.filters
                } as any // Type assertion to handle filter compatibility
            );
            break;
          case 'theory_of_change':
            newReportData = await TheoryOfChangeReportService.generateReport(
              existingReport.project.toString(), 
              userId, 
              existingReport.filters || { scope: 'all' }
            );
            break;
          case 'risk_register':
            newReportData = await RiskRegisterReportService.generateReport(
                existingReport.project.toString(), 
                userId, 
                {
                    scope: 'all',
                    ...existingReport.filters
                } as any // Type assertion to handle filter compatibility
            );
            break;
          default:
            throw new Error(`Unknown report type: ${existingReport.reportType}`);
        }

        job.progress(75);

        // Update report with new data
        existingReport.reportData = newReportData;
                existingReport.metadata = {
            ...existingReport.metadata,
            regeneratedAt: new Date(),
            regeneratedBy: userId
        } as any;

        (existingReport.metadata as any).regenerationHistory = [
            ...((existingReport.metadata as any).regenerationHistory || []),
            {
                reason,
                regeneratedAt: new Date(),
                regeneratedBy: userId
            }
        ];
        existingReport.lastUpdatedBy = new mongoose.Types.ObjectId(userId);

        await existingReport.save();

        job.progress(90);

        // Invalidate caches
        await ReportCacheService.invalidateReport(reportId);

        job.progress(100);

        return {
          success: true,
          reportId,
          regeneratedAt: new Date(),
          reason
        };

      } catch (error) {
        console.error('Report regeneration job failed:', error);
        throw error;
      }
    });
  }

  private static setupQueueMonitoring(): void {
    // Monitor for failed jobs
    this.reportQueue.on('failed', (job, err) => {
      console.error(`Report generation job ${job.id} failed:`, err);
    });

    this.batchQueue.on('failed', (job, err) => {
      console.error(`Batch generation job ${job.id} failed:`, err);
    });

    this.regenerationQueue.on('failed', (job, err) => {
      console.error(`Regeneration job ${job.id} failed:`, err);
    });

    // Monitor for completed jobs
    this.reportQueue.on('completed', (job, result) => {
      console.log(`Report generation job ${job.id} completed successfully`);
    });
  }

  private static setupPeriodicCleanup(): void {
    // Clean up completed/failed jobs every hour
    setInterval(async () => {
      try {
        await Promise.all([
          this.reportQueue.clean(24 * 60 * 60 * 1000, 'completed'),
          this.reportQueue.clean(24 * 60 * 60 * 1000, 'failed'),
          this.batchQueue.clean(24 * 60 * 60 * 1000, 'completed'),
          this.batchQueue.clean(24 * 60 * 60 * 1000, 'failed'),
          this.regenerationQueue.clean(24 * 60 * 60 * 1000, 'completed'),
          this.regenerationQueue.clean(24 * 60 * 60 * 1000, 'failed')
        ]);
      } catch (error) {
        console.error('Queue cleanup failed:', error);
      }
    }, 60 * 60 * 1000); // Every hour
  }

  private static async getQueueCounts(queue: Queue.Queue): Promise<any> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed()
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length
    };
  }

  private static generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static async getOrganizationId(entityType: string, entityId: string): Promise<string> {
    if (entityType === 'project') {
      const Project = mongoose.model('Project');
      const project = await Project.findById(entityId).select('organization');
      return project?.organization.toString() || '';
    } else {
      const ProjectSite = mongoose.model('ProjectSite');
      const site = await ProjectSite.findById(entityId).populate('project', 'organization');
      return (site?.project as any)?.organization.toString() || '';
    }
  }

  private static async getProjectId(entityType: string, entityId: string): Promise<string> {
    if (entityType === 'project') {
      return entityId;
    } else {
      const ProjectSite = mongoose.model('ProjectSite');
      const site = await ProjectSite.findById(entityId).select('project');
      return site?.project.toString() || '';
    }
  }

  private static estimateReportSize(reportType: string, filters?: any): 'small' | 'medium' | 'large' {
    if (reportType === 'theory_of_change' || reportType === 'stakeholder_mapping') {
      return filters?.scope === 'all' ? 'large' : 'medium';
    }
    return reportType === 'risk_register' ? 'medium' : 'small';
  }

  private static estimateJobDuration(jobData: IReportGenerationJob): number {
    const baseDurations = {
      project_setup: 15000,
      project_site_setup: 10000,
      stakeholder_mapping: 30000,
      theory_of_change: 45000,
      risk_register: 25000
    };

    const baseDuration = baseDurations[jobData.reportType as keyof typeof baseDurations] || 20000;
    
    // Adjust based on estimated size
    const sizeMultiplier = {
      small: 1,
      medium: 1.5,
      large: 2.5
    };

    return baseDuration * sizeMultiplier[jobData.metadata.estimatedSize];
  }

  /**
   * Graceful shutdown
   */
  static async shutdown(): Promise<void> {
    try {
      await Promise.all([
        this.reportQueue.close(),
        this.batchQueue.close(),
        this.regenerationQueue.close()
      ]);
      console.log('Background generation service shut down gracefully');
    } catch (error) {
      console.error('Error during background generation service shutdown:', error);
    }
  }
}

export default BackgroundReportGenerationService;