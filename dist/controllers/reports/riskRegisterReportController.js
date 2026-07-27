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
exports.generateRiskRegisterReport = void 0;
const report_model_1 = __importDefault(require("../../models/report.model"));
const riskRegisterReport_service_1 = __importDefault(require("../../services/reports/riskRegisterReport.service"));
const reportTitleGenerator_1 = require("../../utils/reportTitleGenerator");
// Type guard for authenticated user
function isUserAuthenticated(req) {
    return req.user !== undefined;
}
/**
 * Generate Risk Register Report
 * @route POST /api/v1/reports/risk-register/:projectId
 * @access Private
 */
const generateRiskRegisterReport = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    console.log('🚀 Starting risk register report generation...');
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { projectId } = req.params;
        const { saveReport = true, filters = {} } = req.body;
        console.log('📊 Request details:', {
            projectId,
            saveReport,
            filters,
            userId: req.user._id.toString()
        });
        // Add timeout wrapper for the service call
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Report generation timed out after 30 seconds')), 30000);
        });
        console.log('🔄 Calling RiskRegisterReportService.generateReport...');
        // Race between actual generation and timeout
        const reportData = yield Promise.race([
            riskRegisterReport_service_1.default.generateReport(projectId, req.user._id.toString(), filters),
            timeoutPromise
        ]); // Type assertion since Promise.race loses typing
        console.log('✅ Report data generated successfully');
        console.log('📈 Report summary:', {
            totalRisks: ((_a = reportData === null || reportData === void 0 ? void 0 : reportData.executiveSummary) === null || _a === void 0 ? void 0 : _a.totalRisks) || 0,
            projectName: ((_b = reportData === null || reportData === void 0 ? void 0 : reportData.projectInfo) === null || _b === void 0 ? void 0 : _b.name) || 'Unknown'
        });
        // Save report if requested
        let savedReport = null;
        if (saveReport) {
            console.log('💾 Saving report to database...');
            const reportTitle = (0, reportTitleGenerator_1.generateReportTitle)('risk_register', reportData.projectInfo.name);
            savedReport = new report_model_1.default({
                reportType: 'risk_register',
                title: reportTitle,
                entityType: filters.scope === 'site' ? 'project_site' : 'project',
                entityId: filters.scope === 'site' && ((_c = filters.siteIds) === null || _c === void 0 ? void 0 : _c.length) === 1
                    ? filters.siteIds[0]
                    : projectId,
                organization: reportData.organizationInfo.id,
                project: projectId,
                projectSite: filters.scope === 'site' && ((_d = filters.siteIds) === null || _d === void 0 ? void 0 : _d.length) === 1
                    ? filters.siteIds[0]
                    : undefined,
                reportData: reportData,
                filters: filters,
                creator: req.user._id,
                metadata: Object.assign(Object.assign({}, reportData.generationMetadata), { projectInfo: reportData.projectInfo, summary: {
                        totalItems: reportData.executiveSummary.totalRisks,
                        completedItems: reportData.executiveSummary.risksByStatus.closed,
                        completionPercentage: reportData.executiveSummary.totalRisks > 0
                            ? Math.round((reportData.executiveSummary.risksByStatus.closed / reportData.executiveSummary.totalRisks) * 100)
                            : 0
                    } })
            });
            yield savedReport.save();
            console.log('💾 Report saved with ID:', savedReport._id);
        }
        console.log('🎉 Risk register report generation completed successfully');
        res.status(200).json({
            success: true,
            message: 'Risk register report generated successfully',
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
        console.error('❌ Error in generateRiskRegisterReport:', error);
        // Log more details about the error
        if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
        }
        next(error);
    }
});
exports.generateRiskRegisterReport = generateRiskRegisterReport;
//# sourceMappingURL=riskRegisterReportController.js.map