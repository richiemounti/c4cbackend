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
exports.approveReport = exports.deleteReport = exports.getReportById = exports.getProjectReports = void 0;
const report_model_1 = __importDefault(require("../../models/report.model"));
// Type guard for authenticated user
function isUserAuthenticated(req) {
    return req.user !== undefined;
}
/**
 * Get all reports for a project with filtering and pagination
 * @route GET /api/v1/reports/project/:projectId
 * @access Private
 */
const getProjectReports = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { projectId } = req.params;
        const { reportType, status, page = '1', limit = '10', sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
        // Build query
        const query = {
            project: projectId,
            archived: { $ne: true }
        };
        if (reportType) {
            query.reportType = reportType;
        }
        if (status) {
            query.status = status;
        }
        // Pagination
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;
        // Sorting
        const sort = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;
        // Execute query
        const [reports, totalCount] = yield Promise.all([
            report_model_1.default.find(query)
                .populate('creator', 'name email')
                .populate('approvedBy', 'name email')
                .populate('project', 'name status')
                .populate('projectSite', 'name')
                .sort(sort)
                .skip(skip)
                .limit(limitNum),
            report_model_1.default.countDocuments(query)
        ]);
        res.status(200).json({
            success: true,
            data: {
                reports,
                pagination: {
                    currentPage: pageNum,
                    totalPages: Math.ceil(totalCount / limitNum),
                    totalCount,
                    hasNext: pageNum < Math.ceil(totalCount / limitNum),
                    hasPrev: pageNum > 1
                }
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getProjectReports = getProjectReports;
/**
 * Get a specific report by ID
 * @route GET /api/v1/reports/:reportId
 * @access Private
 */
const getReportById = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { reportId } = req.params;
        const report = yield report_model_1.default.findById(reportId)
            .populate('creator', 'name email')
            .populate('approvedBy', 'name email')
            .populate('project', 'name status')
            .populate('projectSite', 'name')
            .populate('organization', 'name');
        if (!report) {
            const error = new Error('Report not found');
            error.statusCode = 404;
            throw error;
        }
        res.status(200).json({
            success: true,
            data: report
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getReportById = getReportById;
/**
 * Delete/Archive a report
 * @route DELETE /api/v1/reports/:reportId
 * @access Private (Creator or Admin)
 */
const deleteReport = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
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
        // Check permissions - only creator or admin can delete
        const isCreator = report.creator.toString() === req.user._id.toString();
        const isAdmin = req.user.isConnectGoStaff || ['admin', 'manager'].includes(req.user.primaryRole || '');
        if (!isCreator && !isAdmin) {
            const error = new Error('Not authorized to delete this report');
            error.statusCode = 403;
            throw error;
        }
        // Archive instead of hard delete
        report.archived = true;
        report.archivedAt = new Date();
        yield report.save();
        res.status(200).json({
            success: true,
            message: 'Report archived successfully'
        });
    }
    catch (error) {
        next(error);
    }
});
exports.deleteReport = deleteReport;
/**
 * Approve a report
 * @route PUT /api/v1/reports/:reportId/approve
 * @access Private (Manager or Admin)
 */
const approveReport = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { reportId } = req.params;
        const { notes } = req.body;
        // Check permissions
        const canApprove = req.user.isConnectGoStaff || ['admin', 'manager'].includes(req.user.primaryRole || '');
        if (!canApprove) {
            const error = new Error('Not authorized to approve reports');
            error.statusCode = 403;
            throw error;
        }
        const report = yield report_model_1.default.findById(reportId);
        if (!report) {
            const error = new Error('Report not found');
            error.statusCode = 404;
            throw error;
        }
        report.markAsApproved(req.user._id, notes);
        yield report.save();
        res.status(200).json({
            success: true,
            message: 'Report approved successfully',
            data: report
        });
    }
    catch (error) {
        next(error);
    }
});
exports.approveReport = approveReport;
//# sourceMappingURL=reportController.js.map