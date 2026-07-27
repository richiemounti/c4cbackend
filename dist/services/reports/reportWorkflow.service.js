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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportWorkflowService = void 0;
// services/reports/reportWorkflow.service.ts
const mongoose_1 = __importDefault(require("mongoose"));
const report_model_1 = __importDefault(require("../../models/report.model"));
class ReportWorkflowService {
    /**
     * Transition report to a new status
     */
    static transitionReportStatus(reportId, toStatus, userId, metadata) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const report = yield report_model_1.default.findById(reportId);
                if (!report) {
                    throw new Error('Report not found');
                }
                // Find valid transition
                const transition = this.findValidTransition(report.status, toStatus);
                if (!transition) {
                    throw new Error(`Invalid status transition from ${report.status} to ${toStatus}`);
                }
                // Check permissions
                const hasPermission = yield this.checkTransitionPermissions(transition, report, userId, (metadata === null || metadata === void 0 ? void 0 : metadata.force) || false);
                if (!hasPermission) {
                    throw new Error('Insufficient permissions for this transition');
                }
                // Validate transition rules
                if (transition.validationRules) {
                    const isValid = yield transition.validationRules(report, userId);
                    if (!isValid && !(metadata === null || metadata === void 0 ? void 0 : metadata.force)) {
                        throw new Error('Transition validation failed');
                    }
                }
                // Store workflow history
                yield this.addWorkflowHistory(report, userId, toStatus, metadata === null || metadata === void 0 ? void 0 : metadata.notes);
                // Execute transition logic
                const oldStatus = report.status;
                report.status = toStatus;
                report.lastUpdatedBy = new mongoose_1.default.Types.ObjectId(userId);
                if (transition.onTransition) {
                    yield transition.onTransition(report, userId, metadata);
                }
                // Save report
                yield report.save();
                // Trigger post-transition events
                yield this.triggerPostTransitionEvents(report, oldStatus, toStatus, userId);
                return report;
            }
            catch (error) {
                console.error('Error transitioning report status:', error);
                throw new Error(`Failed to transition report status: ${error}`);
            }
        });
    }
    /**
     * Check if report needs regeneration based on source data changes
     */
    static checkRegenerationNeeded(reportId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const report = yield report_model_1.default.findById(reportId)
                    .populate('project')
                    .populate('projectSite');
                if (!report) {
                    throw new Error('Report not found');
                }
                const reasons = [];
                let needsRegeneration = false;
                let lastDataUpdate;
                // Check based on report type
                switch (report.reportType) {
                    case 'project_setup':
                        const setupData = yield this.getProjectSetupLastUpdate(report.project);
                        if (setupData && setupData > report.createdAt) {
                            needsRegeneration = true;
                            reasons.push('Project setup data has been updated');
                            lastDataUpdate = setupData;
                        }
                        break;
                    case 'project_site_setup':
                        const siteSetupData = yield this.getProjectSiteSetupLastUpdate(report.projectSite);
                        if (siteSetupData && siteSetupData > report.createdAt) {
                            needsRegeneration = true;
                            reasons.push('Project site setup data has been updated');
                            lastDataUpdate = siteSetupData;
                        }
                        break;
                    case 'stakeholder_mapping':
                        const stakeholderData = yield this.getStakeholderDataLastUpdate(report.project, report.projectSite);
                        if (stakeholderData && stakeholderData > report.createdAt) {
                            needsRegeneration = true;
                            reasons.push('Stakeholder data has been updated');
                            lastDataUpdate = stakeholderData;
                        }
                        break;
                    case 'theory_of_change':
                        const tocData = yield this.getTheoryOfChangeLastUpdate(report.project, report.projectSite);
                        if (tocData && tocData > report.createdAt) {
                            needsRegeneration = true;
                            reasons.push('Theory of Change data has been updated');
                            lastDataUpdate = tocData;
                        }
                        break;
                    case 'risk_register':
                        const riskData = yield this.getRiskRegisterLastUpdate(report.project, report.projectSite);
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
            }
            catch (error) {
                console.error('Error checking regeneration needed:', error);
                throw new Error(`Failed to check regeneration status: ${error}`);
            }
        });
    }
    /**
     * Auto-regenerate reports that need updating
     */
    static autoRegenerateReports(organizationId_1, reportType_1) {
        return __awaiter(this, arguments, void 0, function* (organizationId, reportType, maxReports = 10) {
            try {
                // Find reports that can be regenerated
                const query = {
                    status: { $in: ['generated', 'draft'] },
                    archived: { $ne: true }
                };
                if (organizationId) {
                    query.organization = organizationId;
                }
                if (reportType) {
                    query.reportType = reportType;
                }
                const reports = yield report_model_1.default.find(query)
                    .limit(maxReports)
                    .sort({ updatedAt: 1 }); // Type assertion to fix the _id issue
                const results = [];
                let regenerated = 0;
                let failed = 0;
                for (const report of reports) {
                    try {
                        const regenerationCheck = yield this.checkRegenerationNeeded(report._id.toString());
                        if (regenerationCheck.needsRegeneration) {
                            yield this.regenerateReport(report._id.toString(), 'system');
                            results.push({
                                reportId: report._id.toString(),
                                success: true
                            });
                            regenerated++;
                        }
                    }
                    catch (error) {
                        results.push({
                            reportId: report._id.toString(),
                            success: false,
                            error: error.message
                        });
                        failed++;
                    }
                }
                return {
                    regenerated,
                    failed,
                    results
                };
            }
            catch (error) {
                console.error('Error in auto-regeneration:', error);
                throw new Error(`Failed to auto-regenerate reports: ${error}`);
            }
        });
    }
    /**
     * Get workflow history for a report
     */
    static getWorkflowHistory(reportId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const report = yield report_model_1.default.findById(reportId);
                if (!report) {
                    throw new Error('Report not found');
                }
                return report.metadata.workflowHistory || [];
            }
            catch (error) {
                console.error('Error getting workflow history:', error);
                throw new Error(`Failed to get workflow history: ${error}`);
            }
        });
    }
    /**
     * Get reports requiring attention (expired, pending approval, etc.)
     */
    static getReportsRequiringAttention(organizationId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const now = new Date();
                const baseQuery = {
                    organization: organizationId,
                    archived: { $ne: true }
                };
                // Get expired reports
                const expired = yield report_model_1.default.find(Object.assign(Object.assign({}, baseQuery), { status: { $in: ['generated', 'approved'] }, $expr: {
                        $gt: [
                            { $subtract: [now, '$createdAt'] },
                            { $multiply: [90, 24, 60, 60, 1000] } // 90 days in milliseconds
                        ]
                    } })).populate('creator project projectSite', 'name');
                // Get reports pending approval
                const pendingApproval = yield report_model_1.default.find(Object.assign(Object.assign({}, baseQuery), { status: 'generated' })).populate('creator project projectSite', 'name');
                // Get reports nearing expiration
                const fourteenDaysAgo = new Date(now.getTime() - (14 * 24 * 60 * 60 * 1000));
                const nearingExpiration = yield report_model_1.default.find(Object.assign(Object.assign({}, baseQuery), { status: { $in: ['approved', 'published'] }, createdAt: { $lt: fourteenDaysAgo } })).populate('creator project projectSite', 'name');
                // Get reports that failed regeneration
                const failedRegeneration = yield report_model_1.default.find(Object.assign(Object.assign({}, baseQuery), { 'metadata.regenerationAttempts': { $gt: 0 }, 'metadata.lastRegenerationError': { $exists: true } })).populate('creator project projectSite', 'name');
                return {
                    expired,
                    pendingApproval,
                    nearingExpiration,
                    failedRegeneration
                };
            }
            catch (error) {
                console.error('Error getting reports requiring attention:', error);
                throw new Error(`Failed to get reports requiring attention: ${error}`);
            }
        });
    }
    /**
     * Bulk status transition for multiple reports
     */
    static bulkTransitionStatus(reportIds, toStatus, userId, notes) {
        return __awaiter(this, void 0, void 0, function* () {
            const successful = [];
            const failed = [];
            for (const reportId of reportIds) {
                try {
                    yield this.transitionReportStatus(reportId, toStatus, userId, { notes });
                    successful.push(reportId);
                }
                catch (error) {
                    failed.push({
                        reportId,
                        error: error.message
                    });
                }
            }
            return { successful, failed };
        });
    }
    // Private helper methods
    static findValidTransition(fromStatus, toStatus) {
        for (const [key, transition] of Object.entries(this.WORKFLOW_TRANSITIONS)) {
            if (transition.toStatus === toStatus && transition.fromStatus.includes(fromStatus)) {
                return transition;
            }
        }
        return null;
    }
    static checkTransitionPermissions(transition, report, userId, force) {
        return __awaiter(this, void 0, void 0, function* () {
            if (force && (yield this.isUserAdmin(userId))) {
                return true;
            }
            // For now, simplified permission check
            // In a real system, you'd check against user roles and permissions
            return true;
        });
    }
    static addWorkflowHistory(report, userId, toStatus, notes) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!report.metadata.workflowHistory) {
                report.metadata.workflowHistory = [];
            }
            report.metadata.workflowHistory.push({
                fromStatus: report.status,
                toStatus,
                transitionedBy: new mongoose_1.default.Types.ObjectId(userId),
                transitionedAt: new Date(),
                notes
            });
        });
    }
    static triggerPostTransitionEvents(report, oldStatus, newStatus, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Trigger events like notifications, webhooks, etc.
            // Implementation depends on your event system
            console.log(`Report ${report._id} transitioned from ${oldStatus} to ${newStatus} by ${userId}`);
        });
    }
    static checkReportExpiration(report) {
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
    static regenerateReport(reportId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Implementation would depend on your specific report generation services
            // This is a placeholder for the regeneration logic
            const report = yield report_model_1.default.findById(reportId);
            if (!report) {
                throw new Error('Report not found');
            }
            // Mark as being regenerated
            report.status = 'draft';
            report.metadata.regenerationAttempts = (report.metadata.regenerationAttempts || 0) + 1;
            report.metadata.lastRegenerationAttempt = new Date();
            yield report.save();
            // Here you would call the appropriate report generation service
            // based on report.reportType
        });
    }
    // Data update check methods (implement based on your data models)
    static getProjectSetupLastUpdate(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Implementation depends on your ProjectSetup model
            const ProjectSetup = mongoose_1.default.model('ProjectSetup');
            const setup = yield ProjectSetup.findOne({ project: projectId }).sort({ updatedAt: -1 });
            return (setup === null || setup === void 0 ? void 0 : setup.updatedAt) || null;
        });
    }
    static getProjectSiteSetupLastUpdate(siteId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Implementation depends on your ProjectSiteSetup model
            const ProjectSiteSetup = mongoose_1.default.model('ProjectSiteSetup');
            const setup = yield ProjectSiteSetup.findOne({ projectSite: siteId }).sort({ updatedAt: -1 });
            return (setup === null || setup === void 0 ? void 0 : setup.updatedAt) || null;
        });
    }
    static getStakeholderDataLastUpdate(projectId, siteId) {
        return __awaiter(this, void 0, void 0, function* () {
            const StakeholderGroup = mongoose_1.default.model('StakeholderGroup');
            const query = { project: projectId };
            if (siteId)
                query.projectSite = siteId;
            const stakeholder = yield StakeholderGroup.findOne(query).sort({ updatedAt: -1 });
            return (stakeholder === null || stakeholder === void 0 ? void 0 : stakeholder.updatedAt) || null;
        });
    }
    static getTheoryOfChangeLastUpdate(projectId, siteId) {
        return __awaiter(this, void 0, void 0, function* () {
            const TheoryOfChangeStage = mongoose_1.default.model('TheoryOfChangeStage');
            const query = { project: projectId };
            if (siteId)
                query.projectSite = siteId;
            const stage = yield TheoryOfChangeStage.findOne(query).sort({ updatedAt: -1 });
            return (stage === null || stage === void 0 ? void 0 : stage.updatedAt) || null;
        });
    }
    static getRiskRegisterLastUpdate(projectId, siteId) {
        return __awaiter(this, void 0, void 0, function* () {
            const RiskRegister = mongoose_1.default.model('RiskRegister');
            const query = { project: projectId };
            if (siteId)
                query.projectSite = siteId;
            const risk = yield RiskRegister.findOne(query).sort({ updatedAt: -1 });
            return (risk === null || risk === void 0 ? void 0 : risk.updatedAt) || null;
        });
    }
    static checkApprovalPermissions(report, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Implement based on your user permission system
            return true; // Placeholder
        });
    }
    static isUserAdmin(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            // Implement based on your user role system
            return false; // Placeholder
        });
    }
}
exports.ReportWorkflowService = ReportWorkflowService;
_a = ReportWorkflowService;
// Define workflow state machine
ReportWorkflowService.WORKFLOW_TRANSITIONS = {
    'draft_to_generated': {
        fromStatus: ['draft'],
        toStatus: 'generated',
        requiredPermissions: ['report:create'],
        onTransition: (report, userId) => __awaiter(void 0, void 0, void 0, function* () {
            report.metadata.generationCompletedAt = new Date();
            report.metadata.generationCompletedBy = userId;
        })
    },
    'generated_to_approved': {
        fromStatus: ['generated'],
        toStatus: 'approved',
        requiredPermissions: ['report:approve'],
        validationRules: (report, userId) => __awaiter(void 0, void 0, void 0, function* () {
            // Check if user has approval rights for this organization
            return yield _a.checkApprovalPermissions(report, userId);
        }),
        onTransition: (report, userId, metadata) => __awaiter(void 0, void 0, void 0, function* () {
            report.approvedBy = new mongoose_1.default.Types.ObjectId(userId);
            report.approvedAt = new Date();
            if (metadata === null || metadata === void 0 ? void 0 : metadata.notes) {
                report.approvalNotes = metadata.notes;
            }
        })
    },
    'approved_to_published': {
        fromStatus: ['approved'],
        toStatus: 'published',
        requiredPermissions: ['report:publish'],
        onTransition: (report, userId) => __awaiter(void 0, void 0, void 0, function* () {
            report.visibility = 'organization'; // Default to organization visibility when published
            report.metadata.publishedAt = new Date();
            report.metadata.publishedBy = userId;
        })
    },
    'to_regenerating': {
        fromStatus: ['draft', 'generated', 'approved'],
        toStatus: 'regenerating',
        requiredPermissions: ['report:edit'],
        validationRules: (report, userId) => __awaiter(void 0, void 0, void 0, function* () {
            // Only creator or admin can regenerate
            return report.creator.toString() === userId ||
                (yield _a.isUserAdmin(userId));
        }),
        onTransition: (report, userId) => __awaiter(void 0, void 0, void 0, function* () {
            report.metadata.regenerationAttempts = (report.metadata.regenerationAttempts || 0) + 1;
            report.metadata.lastRegenerationAttempt = new Date();
        })
    },
    'regenerating_to_generated': {
        fromStatus: ['regenerating'],
        toStatus: 'generated',
        requiredPermissions: ['report:create'],
        onTransition: (report, userId) => __awaiter(void 0, void 0, void 0, function* () {
            report.metadata.generationCompletedAt = new Date();
            report.metadata.generationCompletedBy = userId;
        })
    },
    'any_to_archived': {
        fromStatus: ['draft', 'generated', 'approved', 'published'],
        toStatus: 'archived',
        requiredPermissions: ['report:archive'],
        onTransition: (report, userId) => __awaiter(void 0, void 0, void 0, function* () {
            report.archived = true;
            report.archivedAt = new Date();
        })
    },
    'generated_to_draft': {
        fromStatus: ['generated'],
        toStatus: 'draft',
        requiredPermissions: ['report:edit'],
        validationRules: (report, userId) => __awaiter(void 0, void 0, void 0, function* () {
            // Only creator or admin can revert to draft
            return report.creator.toString() === userId ||
                (yield _a.isUserAdmin(userId));
        })
    },
    'approved_to_generated': {
        fromStatus: ['approved'],
        toStatus: 'generated',
        requiredPermissions: ['report:approve'],
        validationRules: (report, userId) => __awaiter(void 0, void 0, void 0, function* () {
            // Only approver or admin can revert approval
            return (report.approvedBy && report.approvedBy.toString() === userId) ||
                (yield _a.isUserAdmin(userId));
        }),
        onTransition: (report, userId) => __awaiter(void 0, void 0, void 0, function* () {
            report.approvedBy = undefined;
            report.approvedAt = undefined;
            report.approvalNotes = undefined;
        })
    }
};
// Expiration configuration by report type
ReportWorkflowService.EXPIRATION_CONFIG = {
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
exports.default = ReportWorkflowService;
//# sourceMappingURL=reportWorkflow.service.js.map