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
exports.deleteConsultationPlan = exports.getConsultationPlansByProject = exports.checkConsultationPlanStatus = exports.completeConsultationPlan = exports.getStakeholderGroupsForSite = exports.getConsultationPlanBySite = exports.createOrUpdateConsultationPlan = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const tocConsultationPlan_model_1 = __importDefault(require("../models/tocConsultationPlan.model"));
const project_model_1 = __importDefault(require("../models/project.model"));
const projectSite_model_1 = __importDefault(require("../models/projectSite.model"));
const stakeholderGroup_model_1 = __importDefault(require("../models/stakeholderGroup.model"));
// Type guard to check if user is authenticated
function isUserAuthenticated(req) {
    return req.user !== undefined;
}
/**
 * Create or update a consultation plan for a project site
 * @route POST /api/v1/toc-consultation-plans
 * @access Private
 */
const createOrUpdateConsultationPlan = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        // Verify user is authenticated
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { projectId, projectSiteId, stakeholderGroups, consultationQuestions, plannedConsultationDates } = req.body;
        // Validate required fields
        if (!projectId || !projectSiteId) {
            const error = new Error('Project ID and Project Site ID are required');
            error.statusCode = 400;
            throw error;
        }
        // Check if project exists
        const project = yield project_model_1.default.findById(projectId);
        if (!project) {
            const error = new Error('Project not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if project site exists and belongs to project
        const projectSite = yield projectSite_model_1.default.findById(projectSiteId);
        if (!projectSite) {
            const error = new Error('Project site not found');
            error.statusCode = 404;
            throw error;
        }
        if (projectSite.project.toString() !== projectId) {
            const error = new Error('Project site does not belong to this project');
            error.statusCode = 400;
            throw error;
        }
        // Validate stakeholder groups if provided
        if (stakeholderGroups && Array.isArray(stakeholderGroups)) {
            for (const sg of stakeholderGroups) {
                if (sg.stakeholderGroup) {
                    const stakeholderExists = yield stakeholderGroup_model_1.default.findById(sg.stakeholderGroup);
                    if (!stakeholderExists) {
                        const error = new Error(`Stakeholder group ${sg.stakeholderGroup} not found`);
                        error.statusCode = 404;
                        throw error;
                    }
                }
            }
        }
        // Check if consultation plan already exists
        let consultationPlan = yield tocConsultationPlan_model_1.default.findOne({
            project: projectId,
            projectSite: projectSiteId
        });
        if (consultationPlan) {
            // Update existing plan
            if (stakeholderGroups)
                consultationPlan.stakeholderGroups = stakeholderGroups;
            if (consultationQuestions)
                consultationPlan.consultationQuestions = consultationQuestions;
            if (plannedConsultationDates)
                consultationPlan.plannedConsultationDates = plannedConsultationDates;
            consultationPlan.lastUpdatedBy = req.user._id;
            yield consultationPlan.save({ session });
        }
        else {
            // Create new plan
            const newConsultationPlanArray = yield tocConsultationPlan_model_1.default.create([{
                    project: projectId,
                    projectSite: projectSiteId,
                    stakeholderGroups: stakeholderGroups || [],
                    consultationQuestions: consultationQuestions || {},
                    plannedConsultationDates: plannedConsultationDates || {},
                    creator: req.user._id,
                    lastUpdatedBy: req.user._id
                }], { session });
            consultationPlan = newConsultationPlanArray[0];
        }
        yield session.commitTransaction();
        session.endSession();
        // Populate the response with reference data
        const populatedPlan = yield tocConsultationPlan_model_1.default.findById(consultationPlan._id)
            .populate('project', 'name')
            .populate('projectSite', 'name location')
            .populate('stakeholderGroups.stakeholderGroup', 'name description')
            .populate('creator', 'name email')
            .populate('lastUpdatedBy', 'name email');
        const isNewPlan = !consultationPlan;
        res.status(isNewPlan ? 201 : 200).json({
            success: true,
            message: isNewPlan ? 'Consultation plan created successfully' : 'Consultation plan updated successfully',
            data: populatedPlan
        });
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        next(error);
    }
});
exports.createOrUpdateConsultationPlan = createOrUpdateConsultationPlan;
/**
 * Get consultation plan for a specific project site
 * @route GET /api/v1/toc-consultation-plans/site/:siteId
 * @access Private
 */
const getConsultationPlanBySite = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { siteId } = req.params;
        // Check if project site exists
        const projectSite = yield projectSite_model_1.default.findById(siteId);
        if (!projectSite) {
            const error = new Error('Project site not found');
            error.statusCode = 404;
            throw error;
        }
        // Find consultation plan
        const consultationPlan = yield tocConsultationPlan_model_1.default.findOne({ projectSite: siteId })
            .populate('project', 'name')
            .populate('projectSite', 'name location')
            .populate('stakeholderGroups.stakeholderGroup', 'name description')
            .populate('creator', 'name email')
            .populate('lastUpdatedBy', 'name email');
        if (!consultationPlan) {
            return res.status(200).json({
                success: true,
                message: 'No consultation plan found for this site',
                data: null
            });
        }
        res.status(200).json({
            success: true,
            data: consultationPlan
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid site ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getConsultationPlanBySite = getConsultationPlanBySite;
/**
 * Get available stakeholder groups for a project site (using proper stakeholder mapping logic)
 * @route GET /api/v1/toc-consultation-plans/site/:siteId/stakeholder-groups
 * @access Private
 */
const getStakeholderGroupsForSite = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { siteId } = req.params;
        // Check if project site exists
        const projectSite = yield projectSite_model_1.default.findById(siteId);
        if (!projectSite) {
            const error = new Error('Project site not found');
            error.statusCode = 404;
            throw error;
        }
        // Use the same query pattern as stakeholderMapping.controller.ts
        const query = {
            project: projectSite.project,
            projectSite: siteId
        };
        // Fetch stakeholder groups with the same logic as stakeholderMapping
        const stakeholderGroups = yield stakeholderGroup_model_1.default.find(query)
            .populate('category', 'name')
            .populate('creator', 'name')
            .populate('lastUpdatedBy', 'name')
            .sort({ category: 1, name: 1 });
        // Get existing consultation plan to show current selections
        const existingPlan = yield tocConsultationPlan_model_1.default.findOne({
            projectSite: siteId
        }).select('stakeholderGroups');
        // Format response with selection status (same as before but with category data)
        const stakeholderGroupsWithStatus = stakeholderGroups.map(group => {
            const existing = existingPlan === null || existingPlan === void 0 ? void 0 : existingPlan.stakeholderGroups.find(sg => sg.stakeholderGroup.toString() === group._id.toString());
            return {
                _id: group._id,
                name: group.name,
                description: group.description,
                category: group.category,
                isSelected: (existing === null || existing === void 0 ? void 0 : existing.isSelected) || false,
                notes: (existing === null || existing === void 0 ? void 0 : existing.notes) || ''
            };
        });
        // Group by category for easier frontend processing (same as stakeholderMapping)
        const groupsByCategory = {};
        stakeholderGroupsWithStatus.forEach(group => {
            var _a;
            const categoryName = ((_a = group.category) === null || _a === void 0 ? void 0 : _a.name) || 'Uncategorized';
            if (!groupsByCategory[categoryName]) {
                groupsByCategory[categoryName] = [];
            }
            groupsByCategory[categoryName].push(group);
        });
        res.status(200).json({
            success: true,
            count: stakeholderGroupsWithStatus.length,
            data: {
                stakeholderGroups: stakeholderGroupsWithStatus,
                groupsByCategory
            }
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid site ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getStakeholderGroupsForSite = getStakeholderGroupsForSite;
/**
 * Mark consultation plan as completed
 * @route PUT /api/v1/toc-consultation-plans/:planId/complete
 * @access Private
 */
const completeConsultationPlan = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Verify user is authenticated
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { planId } = req.params;
        // Find the consultation plan and ensure it's a lean document
        const consultationPlan = yield tocConsultationPlan_model_1.default.findById(planId).lean();
        if (!consultationPlan) {
            const error = new Error('Consultation plan not found');
            error.statusCode = 404;
            throw error;
        }
        // FIXED: More robust validation checks
        const hasSelectedStakeholders = Array.isArray(consultationPlan.stakeholderGroups) &&
            consultationPlan.stakeholderGroups.length > 0 &&
            consultationPlan.stakeholderGroups.some(sg => sg.isSelected === true);
        // Safe check for consultation questions
        const hasAnsweredQuestions = consultationPlan.consultationQuestions &&
            typeof consultationPlan.consultationQuestions === 'object' &&
            Object.values(consultationPlan.consultationQuestions).some(q => q !== null &&
                q !== undefined &&
                typeof q === 'string' &&
                q.trim().length > 0);
        // FIXED: Better date validation
        const dates = consultationPlan.plannedConsultationDates;
        const hasPlannedDates = dates && ((dates.startDate != null && dates.startDate !== undefined) ||
            (dates.endDate != null && dates.endDate !== undefined) ||
            (dates.dateDescription &&
                typeof dates.dateDescription === 'string' &&
                dates.dateDescription.trim().length > 0));
        console.log('Validation Debug:', {
            hasSelectedStakeholders,
            stakeholderGroups: consultationPlan.stakeholderGroups,
            hasAnsweredQuestions,
            questions: consultationPlan.consultationQuestions,
            hasPlannedDates,
            dates: consultationPlan.plannedConsultationDates
        });
        const completionCheck = {
            canComplete: hasSelectedStakeholders && hasAnsweredQuestions && hasPlannedDates,
            missing: {
                stakeholderGroups: !hasSelectedStakeholders,
                consultationQuestions: !hasAnsweredQuestions,
                plannedDates: !hasPlannedDates
            }
        };
        // Check if requirements are met before completing
        if (!completionCheck.canComplete) {
            const error = new Error('Cannot complete consultation plan. Missing required sections.');
            error.statusCode = 400;
            error.details = completionCheck.missing;
            throw error;
        }
        // Now update using findByIdAndUpdate to ensure atomic operation
        const updatedPlan = yield tocConsultationPlan_model_1.default.findByIdAndUpdate(planId, {
            status: 'completed',
            isCompleted: true,
            completedAt: new Date(),
            lastUpdatedBy: req.user._id
        }, { new: true, runValidators: true });
        // Populate response
        const populatedPlan = yield tocConsultationPlan_model_1.default.findById(updatedPlan._id)
            .populate('project', 'name')
            .populate('projectSite', 'name location')
            .populate('stakeholderGroups.stakeholderGroup', 'name description')
            .populate('creator', 'name email')
            .populate('lastUpdatedBy', 'name email');
        res.status(200).json({
            success: true,
            message: 'Consultation plan marked as completed successfully',
            data: populatedPlan
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid plan ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.completeConsultationPlan = completeConsultationPlan;
/**
 * Check if consultation plan is completed for a site (used by TOC stages)
 * @route GET /api/v1/toc-consultation-plans/site/:siteId/status
 * @access Private
 */
const checkConsultationPlanStatus = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { siteId } = req.params;
        // Check if project site exists
        const projectSite = yield projectSite_model_1.default.findById(siteId);
        if (!projectSite) {
            const error = new Error('Project site not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if consultation plan is completed
        const completedPlan = yield tocConsultationPlan_model_1.default.findOne({
            projectSite: new mongoose_1.default.Types.ObjectId(siteId),
            isCompleted: true
        });
        res.status(200).json({
            success: true,
            data: {
                isCompleted: !!completedPlan,
                hasConsultationPlan: !!completedPlan,
                projectSite: {
                    _id: projectSite._id,
                    name: projectSite.name
                }
            }
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid site ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.checkConsultationPlanStatus = checkConsultationPlanStatus;
/**
 * Get all consultation plans for a project
 * @route GET /api/v1/toc-consultation-plans/project/:projectId
 * @access Private
 */
const getConsultationPlansByProject = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { projectId } = req.params;
        // Check if project exists
        const project = yield project_model_1.default.findById(projectId);
        if (!project) {
            const error = new Error('Project not found');
            error.statusCode = 404;
            throw error;
        }
        // Find all consultation plans for this project
        const consultationPlans = yield tocConsultationPlan_model_1.default.find({ project: projectId })
            .populate('project', 'name')
            .populate('projectSite', 'name location')
            .populate('stakeholderGroups.stakeholderGroup', 'name')
            .populate('creator', 'name')
            .populate('lastUpdatedBy', 'name')
            .sort({ 'projectSite.name': 1 });
        // Add summary statistics
        const summary = {
            totalPlans: consultationPlans.length,
            completedPlans: consultationPlans.filter(plan => plan.isCompleted).length,
            draftPlans: consultationPlans.filter(plan => !plan.isCompleted).length
        };
        res.status(200).json({
            success: true,
            count: consultationPlans.length,
            summary,
            data: consultationPlans
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid project ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getConsultationPlansByProject = getConsultationPlansByProject;
/**
 * Delete a consultation plan
 * @route DELETE /api/v1/toc-consultation-plans/:planId
 * @access Private
 */
const deleteConsultationPlan = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Verify user is authenticated
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { planId } = req.params;
        // Find and delete the consultation plan
        const consultationPlan = yield tocConsultationPlan_model_1.default.findByIdAndDelete(planId);
        if (!consultationPlan) {
            const error = new Error('Consultation plan not found');
            error.statusCode = 404;
            throw error;
        }
        res.status(200).json({
            success: true,
            message: 'Consultation plan deleted successfully'
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid plan ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.deleteConsultationPlan = deleteConsultationPlan;
exports.default = {
    createOrUpdateConsultationPlan: exports.createOrUpdateConsultationPlan,
    getConsultationPlanBySite: exports.getConsultationPlanBySite,
    getStakeholderGroupsForSite: exports.getStakeholderGroupsForSite,
    completeConsultationPlan: exports.completeConsultationPlan,
    checkConsultationPlanStatus: exports.checkConsultationPlanStatus,
    getConsultationPlansByProject: exports.getConsultationPlansByProject,
    deleteConsultationPlan: exports.deleteConsultationPlan
};
//# sourceMappingURL=tocConsultationPlan.controller.js.map