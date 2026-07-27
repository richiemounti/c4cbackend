"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackgroundReportGenerationService = void 0;
// services/reports/backgroundGeneration.service.ts
const bull_1 = __importDefault(require("bull"));
const mongoose_1 = __importDefault(require("mongoose"));
const report_model_1 = __importDefault(require("../../models/report.model"));
const projectSetupReport_service_1 = __importDefault(require("./projectSetupReport.service"));
const projectSiteSetupReport_service_1 = __importDefault(require("./projectSiteSetupReport.service"));
const stakeholderMappingReport_service_1 = __importDefault(require("./stakeholderMappingReport.service"));
const theoryOfChangeReport_service_1 = __importDefault(require("./theoryOfChangeReport.service"));
const riskRegisterReport_service_1 = __importDefault(require("./riskRegisterReport.service"));
const reportCache_service_1 = __importDefault(require("./reportCache.service"));
const reportPersistence_service_1 = __importDefault(require("./reportPersistence.service"));
class BackgroundReportGenerationService {
    /**
     * Initialize background generation service
     */
    static initialize() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Initialize queues
                this.reportQueue = new bull_1.default('report generation', this.QUEUE_OPTIONS);
                this.batchQueue = new bull_1.default('batch generation', this.QUEUE_OPTIONS);
                this.regenerationQueue = new bull_1.default('report regeneration', this.QUEUE_OPTIONS);
                // Setup job processors
                this.setupReportProcessor();
                this.setupBatchProcessor();
                this.setupRegenerationProcessor();
                // Setup queue monitoring
                this.setupQueueMonitoring();
                // Setup periodic cleanup
                this.setupPeriodicCleanup();
                console.log('Background report generation service initialized');
            }
            catch (error) {
                console.error('Failed to initialize background generation service:', error);
                throw error;
            }
        });
    }
    /**
     * Queue single report generation
     */
    static queueReportGeneration(reportType_1, entityType_1, entityId_1, userId_1) {
        return __awaiter(this, arguments, void 0, function* (reportType, entityType, entityId, userId, options = {}) {
            var _a, _b;
            try {
                const jobData = {
                    reportType,
                    entityType,
                    entityId,
                    userId,
                    options: {
                        saveReport: (_a = options.saveReport) !== null && _a !== void 0 ? _a : true,
                        cacheResult: (_b = options.cacheResult) !== null && _b !== void 0 ? _b : true,
                        priority: options.priority || 'normal',
                        filters: options.filters,
                        reportDimension: options.reportDimension
                    },
                    metadata: {
                        requestId: this.generateRequestId(),
                        organizationId: yield this.getOrganizationId(entityType, entityId),
                        projectId: yield this.getProjectId(entityType, entityId),
                        requestedAt: new Date(),
                        estimatedSize: this.estimateReportSize(reportType, options.filters)
                    }
                };
                const jobOptions = {
                    priority: this.JOB_PRIORITIES[options.priority || 'normal'],
                    delay: options.delay || 0,
                    attempts: reportType === 'theory_of_change' ? 5 : 3 // ToC reports might need more attempts
                };
                const job = yield this.reportQueue.add('generate-report', jobData, jobOptions);
                const estimatedDuration = this.estimateJobDuration(jobData);
                return {
                    jobId: job.id,
                    estimatedDuration
                };
            }
            catch (error) {
                console.error('Failed to queue report generation:', error);
                throw new Error(`Failed to queue report generation: ${error}`);
            }
        });
    }
    /**
     * Queue batch report generation
     */
    static queueBatchGeneration(reports_1, userId_1, organizationId_1) {
        return __awaiter(this, arguments, void 0, function* (reports, userId, organizationId, options = {}) {
            var _a, _b;
            try {
                const jobData = {
                    reports,
                    userId,
                    organizationId,
                    options: {
                        saveReports: (_a = options.saveReports) !== null && _a !== void 0 ? _a : true,
                        cacheResults: (_b = options.cacheResults) !== null && _b !== void 0 ? _b : true
                    }
                };
                const jobOptions = {
                    priority: this.JOB_PRIORITIES[options.priority || 'normal']
                };
                const job = yield this.batchQueue.add('generate-batch', jobData, jobOptions);
                const estimatedDuration = reports.length * 30000; // Rough estimate: 30 seconds per report
                return {
                    jobId: job.id,
                    estimatedDuration
                };
            }
            catch (error) {
                console.error('Failed to queue batch generation:', error);
                throw new Error(`Failed to queue batch generation: ${error}`);
            }
        });
    }
    /**
     * Queue report regeneration
     */
    static queueReportRegeneration(reportId_1, reason_1, userId_1) {
        return __awaiter(this, arguments, void 0, function* (reportId, reason, userId, options = {}) {
            var _a, _b;
            try {
                const jobData = {
                    reportId,
                    reason,
                    userId,
                    options: {
                        createBackup: (_a = options.createBackup) !== null && _a !== void 0 ? _a : true,
                        notifyUsers: (_b = options.notifyUsers) !== null && _b !== void 0 ? _b : false
                    }
                };
                const jobOptions = {
                    priority: this.JOB_PRIORITIES[options.priority || 'normal']
                };
                const job = yield this.regenerationQueue.add('regenerate-report', jobData, jobOptions);
                return {
                    jobId: job.id
                };
            }
            catch (error) {
                console.error('Failed to queue report regeneration:', error);
                throw new Error(`Failed to queue report regeneration: ${error}`);
            }
        });
    }
    /**
     * Get job status
     */
    static getJobStatus(jobId_1) {
        return __awaiter(this, arguments, void 0, function* (jobId, queueType = 'report') {
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
                const job = yield queue.getJob(jobId);
                if (!job) {
                    return { status: 'not_found' };
                }
                const state = yield job.getState();
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
            }
            catch (error) {
                console.error('Failed to get job status:', error);
                return { status: 'error', error: error };
            }
        });
    }
    /**
     * Cancel job
     */
    static cancelJob(jobId_1) {
        return __awaiter(this, arguments, void 0, function* (jobId, queueType = 'report') {
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
                const job = yield queue.getJob(jobId);
                if (!job) {
                    return false;
                }
                yield job.remove();
                return true;
            }
            catch (error) {
                console.error('Failed to cancel job:', error);
                return false;
            }
        });
    }
    /**
     * Get queue statistics
     */
    static getQueueStats() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const [reportStats, batchStats, regenerationStats] = yield Promise.all([
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
            }
            catch (error) {
                console.error('Failed to get queue stats:', error);
                return null;
            }
        });
    }
    // Private methods
    static setupReportProcessor() {
        this.reportQueue.process('generate-report', 5, (job) => __awaiter(this, void 0, void 0, function* () {
            const { reportType, entityType, entityId, userId, options, metadata } = job.data;
            try {
                // Update progress
                job.progress(10);
                // Check if cached result exists
                if (options.cacheResult) {
                    const cachedResult = yield reportCache_service_1.default.getCachedReportData(`${reportType}:${entityId}:${JSON.stringify(options.filters)}`);
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
                        reportData = yield projectSetupReport_service_1.default.generateReport(entityId, userId);
                        break;
                    case 'project_site_setup':
                        reportData = yield projectSiteSetupReport_service_1.default.generateReport(entityId, userId);
                        break;
                    case 'stakeholder_mapping':
                        reportData = yield stakeholderMappingReport_service_1.default.generateReport(metadata.projectId, userId, options.filters || { scope: 'all' });
                        break;
                    case 'theory_of_change':
                        reportData = yield theoryOfChangeReport_service_1.default.generateReport(metadata.projectId, userId, options.filters || { scope: 'all' });
                        break;
                    case 'risk_register':
                        reportData = yield riskRegisterReport_service_1.default.generateReport(metadata.projectId, userId, options.filters || { scope: 'all' });
                        break;
                    default:
                        throw new Error(`Unknown report type: ${reportType}`);
                }
                job.progress(75);
                // Save report if requested
                let savedReport = null;
                if (options.saveReport) {
                    savedReport = yield reportPersistence_service_1.default.saveReport(reportType, entityType, entityId, reportData, userId, {
                        autoTitle: true,
                        visibility: 'organization',
                        status: 'generated'
                    });
                }
                job.progress(90);
                // Cache result if requested
                if (options.cacheResult) {
                    const cacheKey = `${reportType}:${entityId}:${JSON.stringify(options.filters)}`;
                    yield reportCache_service_1.default.cacheReportData(cacheKey, Object.assign(Object.assign({}, reportData), { reportId: savedReport === null || savedReport === void 0 ? void 0 : savedReport._id }));
                }
                job.progress(100);
                return {
                    success: true,
                    source: 'generated',
                    data: reportData,
                    reportId: savedReport === null || savedReport === void 0 ? void 0 : savedReport._id,
                    generatedAt: new Date()
                };
            }
            catch (error) {
                console.error('Report generation job failed:', error);
                throw error;
            }
        }));
    }
    static setupBatchProcessor() {
        this.batchQueue.process('generate-batch', 2, (job) => __awaiter(this, void 0, void 0, function* () {
            const { reports, userId, organizationId, options } = job.data;
            const results = [];
            const errors = [];
            try {
                job.progress(5);
                for (let i = 0; i < reports.length; i++) {
                    const report = reports[i];
                    const progress = Math.round(((i + 1) / reports.length) * 90) + 5;
                    try {
                        // Queue individual report generation
                        const { jobId } = yield this.queueReportGeneration(report.reportType, report.entityType, report.entityId, userId, {
                            saveReport: options.saveReports,
                            cacheResult: options.cacheResults,
                            priority: 'normal',
                            filters: report.filters
                        });
                        results.push({
                            reportType: report.reportType,
                            entityId: report.entityId,
                            jobId,
                            status: 'queued'
                        });
                    }
                    catch (error) {
                        errors.push({
                            reportType: report.reportType,
                            entityId: report.entityId,
                            error: error.message
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
            }
            catch (error) {
                console.error('Batch generation job failed:', error);
                throw error;
            }
        }));
    }
    static setupRegenerationProcessor() {
        this.regenerationQueue.process('regenerate-report', 3, (job) => __awaiter(this, void 0, void 0, function* () {
            const { reportId, reason, userId, options } = job.data;
            try {
                job.progress(10);
                // Get existing report
                const existingReport = yield report_model_1.default.findById(reportId);
                if (!existingReport) {
                    throw new Error('Report not found');
                }
                job.progress(25);
                // Create backup if requested
                if (options.createBackup) {
                    const ReportSnapshotService = (yield Promise.resolve().then(() => __importStar(require('./reportSnapshot.service')))).default;
                    yield ReportSnapshotService.createSnapshot(reportId, userId, 'automatic', `Backup before regeneration (${reason})`, true);
                }
                job.progress(40);
                // Regenerate report data
                let newReportData;
                switch (existingReport.reportType) {
                    case 'project_setup':
                        newReportData = yield projectSetupReport_service_1.default.generateReport(existingReport.entityId.toString(), userId);
                        break;
                    case 'project_site_setup':
                        newReportData = yield projectSiteSetupReport_service_1.default.generateReport(existingReport.entityId.toString(), userId);
                        break;
                    case 'stakeholder_mapping':
                        newReportData = yield stakeholderMappingReport_service_1.default.generateReport(existingReport.project.toString(), userId, Object.assign({ scope: 'all' }, existingReport.filters) // Type assertion to handle filter compatibility
                        );
                        break;
                    case 'theory_of_change':
                        newReportData = yield theoryOfChangeReport_service_1.default.generateReport(existingReport.project.toString(), userId, existingReport.filters || { scope: 'all' });
                        break;
                    case 'risk_register':
                        newReportData = yield riskRegisterReport_service_1.default.generateReport(existingReport.project.toString(), userId, Object.assign({ scope: 'all' }, existingReport.filters) // Type assertion to handle filter compatibility
                        );
                        break;
                    default:
                        throw new Error(`Unknown report type: ${existingReport.reportType}`);
                }
                job.progress(75);
                // Update report with new data
                existingReport.reportData = newReportData;
                existingReport.metadata = Object.assign(Object.assign({}, existingReport.metadata), { regeneratedAt: new Date(), regeneratedBy: userId });
                existingReport.metadata.regenerationHistory = [
                    ...(existingReport.metadata.regenerationHistory || []),
                    {
                        reason,
                        regeneratedAt: new Date(),
                        regeneratedBy: userId
                    }
                ];
                existingReport.lastUpdatedBy = new mongoose_1.default.Types.ObjectId(userId);
                yield existingReport.save();
                job.progress(90);
                // Invalidate caches
                yield reportCache_service_1.default.invalidateReport(reportId);
                job.progress(100);
                return {
                    success: true,
                    reportId,
                    regeneratedAt: new Date(),
                    reason
                };
            }
            catch (error) {
                console.error('Report regeneration job failed:', error);
                throw error;
            }
        }));
    }
    static setupQueueMonitoring() {
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
    static setupPeriodicCleanup() {
        // Clean up completed/failed jobs every hour
        setInterval(() => __awaiter(this, void 0, void 0, function* () {
            try {
                yield Promise.all([
                    this.reportQueue.clean(24 * 60 * 60 * 1000, 'completed'),
                    this.reportQueue.clean(24 * 60 * 60 * 1000, 'failed'),
                    this.batchQueue.clean(24 * 60 * 60 * 1000, 'completed'),
                    this.batchQueue.clean(24 * 60 * 60 * 1000, 'failed'),
                    this.regenerationQueue.clean(24 * 60 * 60 * 1000, 'completed'),
                    this.regenerationQueue.clean(24 * 60 * 60 * 1000, 'failed')
                ]);
            }
            catch (error) {
                console.error('Queue cleanup failed:', error);
            }
        }), 60 * 60 * 1000); // Every hour
    }
    static getQueueCounts(queue) {
        return __awaiter(this, void 0, void 0, function* () {
            const [waiting, active, completed, failed, delayed] = yield Promise.all([
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
        });
    }
    static generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    static getOrganizationId(entityType, entityId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (entityType === 'project') {
                const Project = mongoose_1.default.model('Project');
                const project = yield Project.findById(entityId).select('organization');
                return (project === null || project === void 0 ? void 0 : project.organization.toString()) || '';
            }
            else {
                const ProjectSite = mongoose_1.default.model('ProjectSite');
                const site = yield ProjectSite.findById(entityId).populate('project', 'organization');
                return ((_a = site === null || site === void 0 ? void 0 : site.project) === null || _a === void 0 ? void 0 : _a.organization.toString()) || '';
            }
        });
    }
    static getProjectId(entityType, entityId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (entityType === 'project') {
                return entityId;
            }
            else {
                const ProjectSite = mongoose_1.default.model('ProjectSite');
                const site = yield ProjectSite.findById(entityId).select('project');
                return (site === null || site === void 0 ? void 0 : site.project.toString()) || '';
            }
        });
    }
    static estimateReportSize(reportType, filters) {
        if (reportType === 'theory_of_change' || reportType === 'stakeholder_mapping') {
            return (filters === null || filters === void 0 ? void 0 : filters.scope) === 'all' ? 'large' : 'medium';
        }
        return reportType === 'risk_register' ? 'medium' : 'small';
    }
    static estimateJobDuration(jobData) {
        const baseDurations = {
            project_setup: 15000,
            project_site_setup: 10000,
            stakeholder_mapping: 30000,
            theory_of_change: 45000,
            risk_register: 25000
        };
        const baseDuration = baseDurations[jobData.reportType] || 20000;
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
    static shutdown() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield Promise.all([
                    this.reportQueue.close(),
                    this.batchQueue.close(),
                    this.regenerationQueue.close()
                ]);
                console.log('Background generation service shut down gracefully');
            }
            catch (error) {
                console.error('Error during background generation service shutdown:', error);
            }
        });
    }
}
exports.BackgroundReportGenerationService = BackgroundReportGenerationService;
BackgroundReportGenerationService.QUEUE_OPTIONS = {
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
BackgroundReportGenerationService.JOB_PRIORITIES = {
    low: 10,
    normal: 0,
    high: -10,
    critical: -20
};
exports.default = BackgroundReportGenerationService;
//# sourceMappingURL=backgroundGeneration.service.js.map