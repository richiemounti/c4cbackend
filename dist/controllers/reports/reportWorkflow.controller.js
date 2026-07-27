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
exports.getReportsRequiringAttention = exports.getWorkflowHistory = exports.regenerateReport = exports.checkRegenerationStatus = exports.scheduleRegeneration = exports.getExpirationStatus = exports.getWorkflowConfig = exports.bulkStatusTransition = exports.autoRegenerateReports = exports.transitionReportStatus = void 0;
const reportWorkflow_service_1 = __importDefault(require("../../services/reports/reportWorkflow.service"));
const report_model_1 = __importDefault(require("../../models/report.model"));
const projectSetupReport_service_1 = __importDefault(require("../../services/reports/projectSetupReport.service"));
const projectSiteSetupReport_service_1 = __importDefault(require("../../services/reports/projectSiteSetupReport.service"));
const stakeholderMappingReport_service_1 = __importDefault(require("../../services/reports/stakeholderMappingReport.service"));
const theoryOfChangeReport_service_1 = __importDefault(require("../../services/reports/theoryOfChangeReport.service"));
const riskRegisterReport_service_1 = __importDefault(require("../../services/reports/riskRegisterReport.service"));
// Type guard for authenticated user
function isUserAuthenticated(req) {
    return req.user !== undefined;
}
/**
 * Transition report status (approve, publish, archive, etc.)
 * @route PUT /api/v1/reports/:reportId/status
 * @access Private
 */
const transitionReportStatus = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { reportId } = req.params;
        const { status, notes, force = false } = req.body;
        if (!status) {
            const error = new Error('Status is required');
            error.statusCode = 400;
            throw error;
        }
        const updatedReport = yield reportWorkflow_service_1.default.transitionReportStatus(reportId, status, req.user._id.toString(), { notes, force });
        res.status(200).json({
            success: true,
            message: `Report status transitioned to ${status}`,
            data: updatedReport
        });
    }
    catch (error) {
        next(error);
    }
});
exports.transitionReportStatus = transitionReportStatus;
/**
 * Auto-regenerate stale reports
 * @route POST /api/v1/reports/auto-regenerate
 * @access Private (Admin only)
 */
const autoRegenerateReports = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        // Check if user has admin privileges
        if (!req.user.isConnectGoStaff && !['admin', 'manager'].includes(req.user.primaryRole || '')) {
            const error = new Error('Admin privileges required');
            error.statusCode = 403;
            throw error;
        }
        const { organizationId, reportType, maxReports = 10 } = req.body;
        const results = yield reportWorkflow_service_1.default.autoRegenerateReports(organizationId, reportType, maxReports);
        res.status(200).json({
            success: true,
            message: `Auto-regeneration completed. ${results.regenerated} reports regenerated, ${results.failed} failed`,
            data: results
        });
    }
    catch (error) {
        next(error);
    }
});
exports.autoRegenerateReports = autoRegenerateReports;
/**
 * Bulk status transition for multiple reports
 * @route PUT /api/v1/reports/bulk-status
 * @access Private
 */
const bulkStatusTransition = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { reportIds, status, notes } = req.body;
        if (!reportIds || !Array.isArray(reportIds) || reportIds.length === 0) {
            const error = new Error('Report IDs array is required');
            error.statusCode = 400;
            throw error;
        }
        if (!status) {
            const error = new Error('Status is required');
            error.statusCode = 400;
            throw error;
        }
        // Limit bulk operations to prevent abuse
        if (reportIds.length > 50) {
            const error = new Error('Maximum 50 reports can be updated at once');
            error.statusCode = 400;
            throw error;
        }
        const results = yield reportWorkflow_service_1.default.bulkTransitionStatus(reportIds, status, req.user._id.toString(), notes);
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
    }
    catch (error) {
        next(error);
    }
});
exports.bulkStatusTransition = bulkStatusTransition;
/**
 * Get workflow configuration and available transitions
 * @route GET /api/v1/reports/:reportId/workflow-config
 * @access Private
 */
const getWorkflowConfig = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { reportId } = req.params;
        const report = yield report_model_1.default.findById(reportId);
        if (!report) {
            const error = new Error('Report not found');
            error.statusCode = 404;
            throw error;
        }
        // Define available transitions based on current status
        const availableTransitions = {
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
    }
    catch (error) {
        next(error);
    }
});
exports.getWorkflowConfig = getWorkflowConfig;
/**
 * Get report expiration status and warnings
 * @route GET /api/v1/reports/:reportId/expiration-status
 * @access Private
 */
const getExpirationStatus = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { reportId } = req.params;
        const report = yield report_model_1.default.findById(reportId);
        if (!report) {
            const error = new Error('Report not found');
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
        const config = expirationConfig[report.reportType];
        const now = new Date();
        const reportAge = Math.floor((now.getTime() - report.createdAt.getTime()) / (24 * 60 * 60 * 1000));
        const status = {
            reportId,
            reportType: report.reportType,
            createdAt: report.createdAt,
            ageInDays: reportAge,
            maxAgeInDays: (config === null || config === void 0 ? void 0 : config.days) || 90,
            warningPeriodDays: (config === null || config === void 0 ? void 0 : config.warning) || 14,
            isExpired: config ? reportAge > config.days : false,
            isNearingExpiration: config ? reportAge > (config.days - config.warning) : false,
            daysUntilExpiration: config ? Math.max(0, config.days - reportAge) : null,
            recommendedAction: null
        };
        // Determine recommended action
        if (status.isExpired) {
            status.recommendedAction = 'immediate_regeneration';
        }
        else if (status.isNearingExpiration) {
            status.recommendedAction = 'schedule_regeneration';
        }
        else {
            status.recommendedAction = 'no_action_needed';
        }
        res.status(200).json({
            success: true,
            data: status
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getExpirationStatus = getExpirationStatus;
/**
 * Schedule automatic report regeneration
 * @route POST /api/v1/reports/:reportId/schedule-regeneration
 * @access Private
 */
const scheduleRegeneration = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { reportId } = req.params;
        const { scheduledDate, recurring = false, frequency } = req.body;
        if (!scheduledDate) {
            const error = new Error('Scheduled date is required');
            error.statusCode = 400;
            throw error;
        }
        const report = yield report_model_1.default.findById(reportId);
        if (!report) {
            const error = new Error('Report not found');
            error.statusCode = 404;
            throw error;
        }
        // Check permissions
        const isCreator = report.creator.toString() === req.user._id.toString();
        const isAdmin = req.user.isConnectGoStaff || ['admin', 'manager'].includes(req.user.primaryRole || '');
        if (!isCreator && !isAdmin) {
            const error = new Error('Not authorized to schedule regeneration for this report');
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
        yield report.save();
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
    }
    catch (error) {
        next(error);
    }
});
exports.scheduleRegeneration = scheduleRegeneration;
/**
 * Check if report needs regeneration
 * @route GET /api/v1/reports/:reportId/regeneration-status
 * @access Private
 */
const checkRegenerationStatus = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { reportId } = req.params;
        const regenerationStatus = yield reportWorkflow_service_1.default.checkRegenerationNeeded(reportId);
        res.status(200).json({
            success: true,
            data: regenerationStatus
        });
    }
    catch (error) {
        next(error);
    }
});
exports.checkRegenerationStatus = checkRegenerationStatus;
/**
 * Trigger report regeneration
 * @route POST /api/v1/reports/:reportId/regenerate
 * @access Private
 */
const regenerateReport = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { reportId } = req.params;
        const { force = false } = req.body;
        // Get the existing report to check if regeneration is needed
        const initialReport = yield report_model_1.default.findById(reportId);
        if (!initialReport) {
            const error = new Error('Report not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if user has permission to regenerate
        const isCreator = initialReport.creator.toString() === req.user._id.toString();
        const isAdmin = req.user.isConnectGoStaff || ['admin', 'manager'].includes(req.user.primaryRole || '');
        if (!isCreator && !isAdmin && !force) {
            const error = new Error('Not authorized to regenerate this report');
            error.statusCode = 403;
            throw error;
        }
        // Check if regeneration is needed
        if (!force) {
            const regenerationCheck = yield reportWorkflow_service_1.default.checkRegenerationNeeded(reportId);
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
        if (initialReport.status !== 'regenerating') {
            yield reportWorkflow_service_1.default.transitionReportStatus(reportId, 'regenerating', req.user._id.toString(), { notes: 'Report regeneration initiated' });
        }
        else {
            console.log(`Report ${reportId} already in regenerating status, continuing...`);
        }
        // RE-FETCH the report after status transition to get the updated version
        const report = yield report_model_1.default.findById(reportId);
        if (!report) {
            const error = new Error('Report not found after status transition');
            error.statusCode = 404;
            throw error;
        }
        // Here you would trigger the appropriate report generation service
        // based on the report type
        let regeneratedReport;
        switch (report.reportType) {
            case 'project_setup':
                regeneratedReport = yield projectSetupReport_service_1.default.generateReport(report.entityId.toString(), req.user._id.toString());
                break;
            case 'project_site_setup':
                regeneratedReport = yield projectSiteSetupReport_service_1.default.generateReport(report.entityId.toString(), req.user._id.toString());
                break;
            case 'stakeholder_mapping':
                const stakeholderFilters = Object.assign({ scope: 'all' }, (report.filters || {}));
                regeneratedReport = yield stakeholderMappingReport_service_1.default.generateReport(report.project.toString(), req.user._id.toString(), stakeholderFilters);
                break;
            case 'theory_of_change':
                regeneratedReport = yield theoryOfChangeReport_service_1.default.generateReport(report.project.toString(), req.user._id.toString(), report.filters || {});
                break;
            case 'risk_register':
                const riskFilters = Object.assign({ scope: 'all' }, (report.filters || {}));
                regeneratedReport = yield riskRegisterReport_service_1.default.generateReport(report.project.toString(), req.user._id.toString(), riskFilters);
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
        yield report.save();
        // Transition back to generated status
        const finalReport = yield reportWorkflow_service_1.default.transitionReportStatus(reportId, 'generated', req.user._id.toString(), { notes: 'Report regeneration completed' });
        res.status(200).json({
            success: true,
            message: 'Report regenerated successfully',
            data: {
                regenerated: true,
                report: finalReport
            }
        });
    }
    catch (error) {
        // If regeneration fails, update the report with error details
        // and transition back to generated or draft status
        try {
            const report = yield report_model_1.default.findById(req.params.reportId);
            if (report) {
                report.metadata.lastRegenerationError = error.message;
                report.metadata.lastRegenerationAttempt = new Date();
                yield report.save();
                // Transition back to generated status on failure
                // Type assertion for status comparison since TypeScript interface might not include 'regenerating'
                if (report.status === 'regenerating') {
                    // Get userId - check if user is still authenticated
                    const userId = isUserAuthenticated(req)
                        ? req.user._id.toString()
                        : report.creator.toString();
                    yield reportWorkflow_service_1.default.transitionReportStatus(req.params.reportId, 'generated', userId, { notes: `Report regeneration failed: ${error.message}` });
                }
            }
        }
        catch (saveError) {
            console.error('Failed to save regeneration error:', saveError);
        }
        next(error);
    }
});
exports.regenerateReport = regenerateReport;
/**
 * Get workflow history for a report
 * @route GET /api/v1/reports/:reportId/workflow-history
 * @access Private
 */
const getWorkflowHistory = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { reportId } = req.params;
        const history = yield reportWorkflow_service_1.default.getWorkflowHistory(reportId);
        res.status(200).json({
            success: true,
            data: {
                reportId,
                workflowHistory: history
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getWorkflowHistory = getWorkflowHistory;
/**
 * Get reports requiring attention (expired, pending approval, etc.)
 * @route GET /api/v1/reports/attention-required
 * @access Private
 */
const getReportsRequiringAttention = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { organizationId } = req.query;
        // For non-admin users, default to their organization
        let orgId = organizationId;
        if (!req.user.isConnectGoStaff && !orgId) {
            // You would need to get user's organization from your user model
            // orgId = req.user.organization?.toString();
        }
        if (!orgId) {
            const error = new Error('Organization ID is required');
            error.statusCode = 400;
            throw error;
        }
        const attentionReports = yield reportWorkflow_service_1.default.getReportsRequiringAttention(orgId, req.user._id.toString());
        res.status(200).json({
            success: true,
            data: attentionReports
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getReportsRequiringAttention = getReportsRequiringAttention;
//# sourceMappingURL=reportWorkflow.controller.js.map