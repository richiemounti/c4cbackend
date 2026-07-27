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
exports.getProjectSetupSummary = exports.generateProjectSetupReport = void 0;
const report_model_1 = __importDefault(require("../../models/report.model"));
const projectSetupReport_service_1 = __importDefault(require("../../services/reports/projectSetupReport.service"));
const reportTitleGenerator_1 = require("../../utils/reportTitleGenerator");
// Type guard for authenticated user
function isUserAuthenticated(req) {
    return req.user !== undefined;
}
/**
 * Generate Project Setup Report
 * @route POST /api/v1/reports/project-setup/:projectId
 * @access Private
 */
const generateProjectSetupReport = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { projectId } = req.params;
        const { saveReport = true } = req.body;
        // Generate report data using service
        const reportData = yield projectSetupReport_service_1.default.generateReport(projectId, req.user._id.toString());
        // Optionally save report to database
        let savedReport = null;
        if (saveReport) {
            // Generate title with new options-based approach
            const reportTitle = (0, reportTitleGenerator_1.generateReportTitle)('project_setup', {
                projectInfo: {
                    name: reportData.projectInfo.name,
                    _id: reportData.projectInfo.id
                },
                scope: 'project',
                date: new Date()
            });
            savedReport = new report_model_1.default({
                reportType: 'project_setup',
                title: reportTitle,
                entityType: 'project',
                entityId: projectId,
                organization: reportData.organizationInfo.id,
                project: projectId,
                reportData: reportData,
                creator: req.user._id,
                metadata: Object.assign(Object.assign({}, reportData.generationMetadata), { projectInfo: reportData.projectInfo, summary: {
                        totalItems: reportData.setupProgress.totalTasks,
                        completedItems: reportData.setupProgress.completedTasks,
                        completionPercentage: reportData.setupProgress.overallProgress
                    } })
            });
            yield savedReport.save();
        }
        res.status(200).json({
            success: true,
            message: 'Project setup report generated successfully',
            data: {
                reportData,
                savedReport: savedReport ? {
                    _id: savedReport._id,
                    status: savedReport.status,
                    createdAt: savedReport.createdAt
                } : null
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.generateProjectSetupReport = generateProjectSetupReport;
/**
 * Get Project Setup Summary Stats
 * @route GET /api/v1/reports/project-setup/:projectId/summary
 * @access Private
 */
const getProjectSetupSummary = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { projectId } = req.params;
        const summary = yield projectSetupReport_service_1.default.generateSummaryStats(projectId);
        res.status(200).json({
            success: true,
            data: summary
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getProjectSetupSummary = getProjectSetupSummary;
//# sourceMappingURL=projectSetupReportController.js.map