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
exports.generateStakeholderMappingReport = void 0;
const report_model_1 = __importDefault(require("../../models/report.model"));
const projectSite_model_1 = __importDefault(require("../../models/projectSite.model"));
const stakeholderMappingReport_service_1 = __importDefault(require("../../services/reports/stakeholderMappingReport.service"));
const reportTitleGenerator_1 = require("../../utils/reportTitleGenerator");
// Type guard for authenticated user
function isUserAuthenticated(req) {
    return req.user !== undefined;
}
/**
 * Generate Stakeholder Mapping Report
 * @route POST /api/v1/reports/stakeholder-mapping/:projectId
 * @access Private
 */
const generateStakeholderMappingReport = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { projectId } = req.params;
        const { saveReport = true, filters = {} } = req.body;
        // Generate report data with filters
        const reportData = yield stakeholderMappingReport_service_1.default.generateReport(projectId, req.user._id.toString(), filters);
        // Save report if requested
        let savedReport = null;
        if (saveReport) {
            // Determine scope for title generation
            let titleScope = 'all';
            if (filters.scope === 'project') {
                titleScope = 'project';
            }
            else if (filters.scope === 'site') {
                if (filters.siteIds && filters.siteIds.length > 1) {
                    titleScope = 'all_sites';
                }
                else {
                    titleScope = 'site';
                }
            }
            else {
                titleScope = 'all';
            }
            // Get site info if single site
            let siteInfo = undefined;
            if (titleScope === 'site' && filters.siteIds && filters.siteIds.length === 1) {
                const site = yield projectSite_model_1.default.findById(filters.siteIds[0]).select('name');
                if (site) {
                    siteInfo = {
                        name: site.name,
                        _id: site._id.toString()
                    };
                }
            }
            // Generate title with new options-based approach
            const reportTitle = (0, reportTitleGenerator_1.generateReportTitle)('stakeholder_mapping', {
                projectInfo: {
                    name: reportData.projectInfo.name,
                    _id: reportData.projectInfo.id
                },
                siteInfo,
                scope: titleScope,
                siteIds: filters.siteIds,
                date: new Date()
            });
            savedReport = new report_model_1.default({
                reportType: 'stakeholder_mapping',
                title: reportTitle,
                entityType: filters.scope === 'site' ? 'project_site' : 'project',
                entityId: filters.scope === 'site' && ((_a = filters.siteIds) === null || _a === void 0 ? void 0 : _a.length) === 1
                    ? filters.siteIds[0]
                    : projectId,
                organization: reportData.organizationInfo.id,
                project: projectId,
                projectSite: filters.scope === 'site' && ((_b = filters.siteIds) === null || _b === void 0 ? void 0 : _b.length) === 1
                    ? filters.siteIds[0]
                    : undefined,
                reportData: reportData,
                filters: filters,
                creator: req.user._id,
                metadata: Object.assign(Object.assign({}, reportData.generationMetadata), { projectInfo: reportData.projectInfo, summary: {
                        totalItems: reportData.summary.totalStakeholders,
                        completedItems: reportData.summary.completedStakeholders,
                        completionPercentage: reportData.summary.completionPercentage
                    } })
            });
            yield savedReport.save();
        }
        res.status(200).json({
            success: true,
            message: 'Stakeholder mapping report generated successfully',
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
exports.generateStakeholderMappingReport = generateStakeholderMappingReport;
//# sourceMappingURL=stakeholderMappingReportController.js.map