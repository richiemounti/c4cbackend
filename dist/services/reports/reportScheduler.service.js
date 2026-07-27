"use strict";
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
exports.ReportSchedulerService = void 0;
const report_model_1 = __importDefault(require("../../models/report.model"));
const reportWorkflow_service_1 = __importDefault(require("./reportWorkflow.service"));
const projectSetupReport_service_1 = __importDefault(require("./projectSetupReport.service"));
const projectSiteSetupReport_service_1 = __importDefault(require("./projectSiteSetupReport.service"));
const stakeholderMappingReport_service_1 = __importDefault(require("./stakeholderMappingReport.service"));
const theoryOfChangeReport_service_1 = __importDefault(require("./theoryOfChangeReport.service"));
const riskRegisterReport_service_1 = __importDefault(require("./riskRegisterReport.service"));
class ReportSchedulerService {
    /**
     * Main scheduler function - processes all pending report operations
     */
    static runScheduler() {
        return __awaiter(this, void 0, void 0, function* () {
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
                const results = {
                    processed: 0,
                    successful: 0,
                    failed: 0,
                    skipped: 0,
                    errors: []
                };
                // Process scheduled regenerations
                if (this.config.enableScheduledRegeneration) {
                    const scheduledResults = yield this.processScheduledRegenerations();
                    this.mergeResults(results, scheduledResults);
                }
                // Process automatic regenerations (expired reports)
                if (this.config.enableAutoRegeneration) {
                    const autoResults = yield this.processAutoRegenerations();
                    this.mergeResults(results, autoResults);
                }
                // Clean up old workflow history entries
                yield this.cleanupOldWorkflowHistory();
                // Update scheduler statistics
                yield this.updateSchedulerStats(results, Date.now() - startTime);
                console.log(`Scheduler completed. Processed: ${results.processed}, Successful: ${results.successful}, Failed: ${results.failed}`);
                return results;
            }
            catch (error) {
                console.error('Scheduler error:', error);
                throw error;
            }
            finally {
                this.isRunning = false;
            }
        });
    }
    /**
     * Process reports with scheduled regeneration dates
     */
    static processScheduledRegenerations() {
        return __awaiter(this, void 0, void 0, function* () {
            const results = {
                processed: 0,
                successful: 0,
                failed: 0,
                skipped: 0,
                errors: []
            };
            try {
                const scheduledReports = yield report_model_1.default.find({
                    'metadata.scheduledRegeneration.scheduledDate': { $lte: new Date() },
                    'metadata.scheduledRegeneration.status': 'scheduled',
                    archived: { $ne: true }
                }).limit(this.config.batchSize);
                console.log(`Found ${scheduledReports.length} scheduled regenerations to process`);
                for (const report of scheduledReports) {
                    if (this.currentJobs >= this.config.maxConcurrentJobs) {
                        results.skipped++;
                        continue;
                    }
                    results.processed++;
                    try {
                        yield this.regenerateReportWithRetry(report, 'scheduled');
                        results.successful++;
                        // Update scheduled regeneration status
                        if (report.metadata.scheduledRegeneration) {
                            report.metadata.scheduledRegeneration.status = 'completed';
                            report.metadata.scheduledRegeneration.lastAttempt = new Date();
                            // Calculate next scheduled date if recurring
                            if (report.metadata.scheduledRegeneration.recurring) {
                                report.calculateNextScheduledDate();
                            }
                            yield report.save();
                        }
                    }
                    catch (error) {
                        results.failed++;
                        results.errors.push({
                            reportId: report._id.toString(),
                            error: error.message,
                            reportType: report.reportType
                        });
                        // Update failure status
                        if (report.metadata.scheduledRegeneration) {
                            report.metadata.scheduledRegeneration.status = 'failed';
                            report.metadata.scheduledRegeneration.lastAttempt = new Date();
                            yield report.save();
                        }
                    }
                }
            }
            catch (error) {
                console.error('Error processing scheduled regenerations:', error);
            }
            return results;
        });
    }
    /**
     * Process reports that need automatic regeneration due to age/expiration
     */
    static processAutoRegenerations() {
        return __awaiter(this, void 0, void 0, function* () {
            const results = {
                processed: 0,
                successful: 0,
                failed: 0,
                skipped: 0,
                errors: []
            };
            try {
                // Find reports that are expired and eligible for regeneration
                const expiredReports = yield report_model_1.default.find({
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
                }).limit(this.config.batchSize);
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
                        yield this.regenerateReportWithRetry(report, 'automatic');
                        results.successful++;
                    }
                    catch (error) {
                        results.failed++;
                        results.errors.push({
                            reportId: report._id.toString(),
                            error: error.message,
                            reportType: report.reportType
                        });
                    }
                }
            }
            catch (error) {
                console.error('Error processing auto regenerations:', error);
            }
            return results;
        });
    }
    /**
     * Regenerate a report with retry logic
     */
    static regenerateReportWithRetry(report, triggerType) {
        return __awaiter(this, void 0, void 0, function* () {
            this.currentJobs++;
            try {
                let attempts = 0;
                let lastError = null;
                while (attempts < this.config.retryAttempts) {
                    try {
                        // Update report status to indicate regeneration in progress
                        yield reportWorkflow_service_1.default.transitionReportStatus(report._id.toString(), 'regenerating', 'system', { notes: `${triggerType} regeneration started` });
                        // Generate new report data
                        const newReportData = yield this.generateReportData(report);
                        // Update the report with new data
                        report.reportData = newReportData;
                        report.metadata.regeneratedAt = new Date();
                        report.metadata.regeneratedBy = 'system';
                        report.metadata.regenerationAttempts = (report.metadata.regenerationAttempts || 0) + 1;
                        report.metadata.lastRegenerationError = undefined;
                        yield report.save();
                        // Transition back to generated status
                        yield reportWorkflow_service_1.default.transitionReportStatus(report._id.toString(), 'generated', 'system', { notes: `${triggerType} regeneration completed successfully` });
                        console.log(`Successfully regenerated report ${report._id} (${triggerType})`);
                        return;
                    }
                    catch (error) {
                        attempts++;
                        lastError = error;
                        if (attempts < this.config.retryAttempts) {
                            console.log(`Regeneration attempt ${attempts} failed for report ${report._id}, retrying in ${this.config.retryDelay}ms...`);
                            yield this.delay(this.config.retryDelay);
                        }
                    }
                }
                // All retry attempts failed
                report.metadata.lastRegenerationError = lastError === null || lastError === void 0 ? void 0 : lastError.message;
                report.metadata.lastRegenerationAttempt = new Date();
                report.metadata.regenerationAttempts = (report.metadata.regenerationAttempts || 0) + attempts;
                yield report.save();
                // Transition back to previous status if stuck in regenerating
                if (report.status === 'regenerating') {
                    yield reportWorkflow_service_1.default.transitionReportStatus(report._id.toString(), 'generated', 'system', { notes: `${triggerType} regeneration failed after ${attempts} attempts` });
                }
                throw new Error(`Failed to regenerate report after ${attempts} attempts: ${lastError === null || lastError === void 0 ? void 0 : lastError.message}`);
            }
            finally {
                this.currentJobs--;
            }
        });
    }
    /**
     * Generate report data based on report type
     */
    static generateReportData(report) {
        return __awaiter(this, void 0, void 0, function* () {
            const entityId = report.entityId.toString();
            const userId = 'system';
            switch (report.reportType) {
                case 'project_setup':
                    return yield projectSetupReport_service_1.default.generateReport(entityId, userId);
                case 'project_site_setup':
                    return yield projectSiteSetupReport_service_1.default.generateReport(entityId, userId);
                case 'stakeholder_mapping':
                    const stakeholderFilters = report.filters || {};
                    return yield stakeholderMappingReport_service_1.default.generateReport(report.project.toString(), userId, stakeholderFilters);
                case 'theory_of_change':
                    const tocFilters = report.filters || {};
                    return yield theoryOfChangeReport_service_1.default.generateReport(report.project.toString(), userId, tocFilters);
                case 'risk_register':
                    const riskFilters = report.filters || {};
                    return yield riskRegisterReport_service_1.default.generateReport(report.project.toString(), userId, riskFilters);
                default:
                    throw new Error(`Unknown report type: ${report.reportType}`);
            }
        });
    }
    /**
     * Check if a report needs regeneration based on business rules
     */
    static checkIfReportNeedsRegeneration(report) {
        const reasons = [];
        let needsRegeneration = false;
        // Age-based regeneration rules
        const expirationRules = {
            'project_setup': 90,
            'project_site_setup': 90,
            'stakeholder_mapping': 180,
            'theory_of_change': 365,
            'risk_register': 60
        };
        const maxAge = expirationRules[report.reportType] || 90;
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
    static cleanupOldWorkflowHistory() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const maxHistoryEntries = 50;
                const cutoffDate = new Date(Date.now() - (365 * 24 * 60 * 60 * 1000)); // 1 year ago
                yield report_model_1.default.updateMany({
                    $or: [
                        { 'metadata.workflowHistory.50': { $exists: true } }, // More than 50 entries
                        { 'metadata.workflowHistory.transitionedAt': { $lt: cutoffDate } } // Old entries
                    ]
                }, [
                    {
                        $set: {
                            'metadata.workflowHistory': {
                                $slice: ['$metadata.workflowHistory', -maxHistoryEntries]
                            }
                        }
                    }
                ]);
                console.log('Cleaned up old workflow history entries');
            }
            catch (error) {
                console.error('Error cleaning up workflow history:', error);
            }
        });
    }
    /**
     * Update scheduler statistics for monitoring
     */
    static updateSchedulerStats(results, executionTime) {
        return __awaiter(this, void 0, void 0, function* () {
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
            }
            catch (error) {
                console.error('Error updating scheduler stats:', error);
            }
        });
    }
    /**
     * Utility methods
     */
    static mergeResults(target, source) {
        target.processed += source.processed;
        target.successful += source.successful;
        target.failed += source.failed;
        target.skipped += source.skipped;
        target.errors.push(...source.errors);
    }
    static delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Configuration management
     */
    static updateConfig(newConfig) {
        this.config = Object.assign(Object.assign({}, this.config), newConfig);
        console.log('Scheduler configuration updated:', this.config);
    }
    static getConfig() {
        return Object.assign({}, this.config);
    }
    /**
     * Manual trigger methods for specific operations
     */
    static processSpecificReport(reportId_1) {
        return __awaiter(this, arguments, void 0, function* (reportId, triggerType = 'automatic') {
            const report = yield report_model_1.default.findById(reportId);
            if (!report) {
                throw new Error('Report not found');
            }
            yield this.regenerateReportWithRetry(report, triggerType);
        });
    }
    static processReportsForOrganization(organizationId) {
        return __awaiter(this, void 0, void 0, function* () {
            const results = {
                processed: 0,
                successful: 0,
                failed: 0,
                skipped: 0,
                errors: []
            };
            const reports = yield report_model_1.default.find({
                organization: organizationId,
                archived: { $ne: true },
                status: { $in: ['generated', 'approved'] }
            }).limit(this.config.batchSize);
            for (const report of reports) {
                const regenerationCheck = this.checkIfReportNeedsRegeneration(report);
                if (!regenerationCheck.needsRegeneration) {
                    results.skipped++;
                    continue;
                }
                results.processed++;
                try {
                    yield this.regenerateReportWithRetry(report, 'automatic');
                    results.successful++;
                }
                catch (error) {
                    results.failed++;
                    results.errors.push({
                        reportId: report._id.toString(),
                        error: error.message,
                        reportType: report.reportType
                    });
                }
            }
            return results;
        });
    }
    /**
     * Health check method for monitoring
     */
    static getHealthStatus() {
        return {
            isRunning: this.isRunning,
            currentJobs: this.currentJobs,
            maxJobs: this.config.maxConcurrentJobs,
            config: this.getConfig()
        };
    }
}
exports.ReportSchedulerService = ReportSchedulerService;
ReportSchedulerService.config = {
    batchSize: 10,
    maxConcurrentJobs: 3,
    retryAttempts: 3,
    retryDelay: 5000, // 5 seconds
    enableAutoRegeneration: true,
    enableScheduledRegeneration: true
};
ReportSchedulerService.isRunning = false;
ReportSchedulerService.currentJobs = 0;
exports.default = ReportSchedulerService;
//# sourceMappingURL=reportScheduler.service.js.map