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
exports.deleteStakeholderReport = exports.archiveStakeholderReport = exports.approveStakeholderReport = exports.getStakeholderReport = exports.getStakeholderReports = exports.generateStakeholderReport = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const stakeholderReport_model_1 = __importDefault(require("../models/stakeholderReport.model"));
const stakeholderGroup_model_1 = __importDefault(require("../models/stakeholderGroup.model"));
const project_model_1 = __importDefault(require("../models/project.model"));
const projectSite_model_1 = __importDefault(require("../models/projectSite.model"));
const category_model_1 = __importDefault(require("../models/category.model"));
// Type guard to check if user is defined
function isUserAuthenticated(req) {
    return req.user !== undefined;
}
/**
 * Generate a new stakeholder report
 * @route POST /api/v1/reports/stakeholders
 * @access Private
 */
const generateStakeholderReport = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const { projectId, projectSiteId, title, description, filters } = req.body;
        // Validate required fields
        if (!projectId || !title) {
            const error = new Error('Project ID and title are required');
            error.statusCode = 400;
            throw error;
        }
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        // Check if project exists
        const project = yield project_model_1.default.findById(projectId);
        if (!project) {
            const error = new Error('Project not found');
            error.statusCode = 404;
            throw error;
        }
        // If project site is specified, check if it exists
        if (projectSiteId) {
            const projectSite = yield projectSite_model_1.default.findById(projectSiteId);
            if (!projectSite) {
                const error = new Error('Project site not found');
                error.statusCode = 404;
                throw error;
            }
            // Check if site belongs to the project
            if (projectSite.project.toString() !== projectId) {
                const error = new Error('Project site does not belong to this project');
                error.statusCode = 400;
                throw error;
            }
        }
        // Build query for stakeholder groups
        const query = {
            project: projectId,
            completionStatus: 'completed', // Only include completed stakeholder groups
            archived: { $ne: true }
        };
        if (projectSiteId) {
            query.projectSite = projectSiteId;
        }
        // Apply additional filters if provided
        if (filters) {
            if (filters.categories && filters.categories.length > 0) {
                const categoryDocs = yield category_model_1.default.find({ name: { $in: filters.categories } });
                query.category = { $in: categoryDocs.map(c => c._id) };
            }
            if (filters.connectionStrength) {
                query['tasks.taskType'] = 'connections';
                if (filters.connectionStrength.min !== undefined) {
                    query['tasks.rating'] = { $gte: filters.connectionStrength.min };
                }
                if (filters.connectionStrength.max !== undefined) {
                    if (query['tasks.rating']) {
                        query['tasks.rating'].$lte = filters.connectionStrength.max;
                    }
                    else {
                        query['tasks.rating'] = { $lte: filters.connectionStrength.max };
                    }
                }
            }
            if (filters.risks && filters.risks.length > 0) {
                query['tasks'] = {
                    $elemMatch: {
                        taskType: 'risks',
                        'responses.optionId': { $in: filters.risks }
                    }
                };
            }
            if (filters.includeArchived) {
                delete query.archived;
            }
        }
        // Get stakeholder groups
        const stakeholderGroups = yield stakeholderGroup_model_1.default.find(query)
            .populate('category', 'name')
            .populate('project', 'name')
            .populate('projectSite', 'name')
            .sort('name');
        // Prepare stakeholder data for storage
        const stakeholderData = stakeholderGroups.map(group => {
            return {
                stakeholderGroup: group._id,
                name: group.name,
                category: typeof group.category === 'object' && group.category !== null && 'name' in group.category
                    ? group.category.name
                    : group.category,
                tasks: group.tasks.map(task => ({
                    taskType: task.taskType,
                    responses: task.responses.map(response => ({
                        option: response.optionId,
                        description: response.description
                    })),
                    rating: task.rating
                }))
            };
        });
        // Create the report
        const report = new stakeholderReport_model_1.default({
            project: projectId,
            projectSite: projectSiteId,
            title,
            description,
            stakeholderData,
            filters: filters || {},
            creator: req.user._id,
            status: 'draft'
        });
        yield report.save({ session });
        yield session.commitTransaction();
        session.endSession();
        res.status(201).json({
            success: true,
            message: 'Stakeholder report generated successfully',
            data: report
        });
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        next(error);
    }
});
exports.generateStakeholderReport = generateStakeholderReport;
/**
 * Get all stakeholder reports
 * @route GET /api/v1/reports/stakeholders
 * @access Private
 */
const getStakeholderReports = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Build query
        const query = { archived: { $ne: true } };
        // Filter by project if provided
        if (req.query.projectId) {
            query.project = req.query.projectId;
        }
        // Filter by project site if provided
        if (req.query.projectSiteId) {
            query.projectSite = req.query.projectSiteId;
        }
        // Filter by status if provided
        if (req.query.status) {
            query.status = req.query.status;
        }
        // Get reports
        const reports = yield stakeholderReport_model_1.default.find(query)
            .populate('project', 'name')
            .populate('projectSite', 'name')
            .populate('creator', 'name')
            .populate('approvedBy', 'name')
            .sort('-createdAt');
        res.status(200).json({
            success: true,
            count: reports.length,
            data: reports
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getStakeholderReports = getStakeholderReports;
/**
 * Get a single stakeholder report
 * @route GET /api/v1/reports/stakeholders/:id
 * @access Private
 */
const getStakeholderReport = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const report = yield stakeholderReport_model_1.default.findById(id)
            .populate('project', 'name')
            .populate('projectSite', 'name')
            .populate('creator', 'name')
            .populate('approvedBy', 'name');
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
exports.getStakeholderReport = getStakeholderReport;
/**
 * Approve a stakeholder report
 * @route PUT /api/v1/reports/stakeholders/:id/approve
 * @access Private
 */
const approveStakeholderReport = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const report = yield stakeholderReport_model_1.default.findById(id);
        if (!report) {
            const error = new Error('Report not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if report is already approved
        if (report.status === 'approved') {
            const error = new Error('Report is already approved');
            error.statusCode = 400;
            throw error;
        }
        // Update report status
        report.status = 'approved';
        report.approvedBy = req.user._id;
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
exports.approveStakeholderReport = approveStakeholderReport;
/**
 * Archive a stakeholder report
 * @route PUT /api/v1/reports/stakeholders/:id/archive
 * @access Private
 */
const archiveStakeholderReport = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const report = yield stakeholderReport_model_1.default.findById(id);
        if (!report) {
            const error = new Error('Report not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if report is already archived
        if (report.archived) {
            const error = new Error('Report is already archived');
            error.statusCode = 400;
            throw error;
        }
        // Archive report
        report.archived = true;
        report.archivedAt = new Date();
        report.status = 'archived';
        yield report.save();
        res.status(200).json({
            success: true,
            message: 'Report archived successfully',
            data: report
        });
    }
    catch (error) {
        next(error);
    }
});
exports.archiveStakeholderReport = archiveStakeholderReport;
/**
 * Delete a stakeholder report
 * @route DELETE /api/v1/reports/stakeholders/:id
 * @access Private
 */
const deleteStakeholderReport = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const report = yield stakeholderReport_model_1.default.findById(id);
        if (!report) {
            const error = new Error('Report not found');
            error.statusCode = 404;
            throw error;
        }
        // Delete report
        yield stakeholderReport_model_1.default.findByIdAndDelete(id);
        res.status(200).json({
            success: true,
            message: 'Report deleted successfully',
            data: null
        });
    }
    catch (error) {
        next(error);
    }
});
exports.deleteStakeholderReport = deleteStakeholderReport;
//# sourceMappingURL=stakeholderReport.controller.js.map