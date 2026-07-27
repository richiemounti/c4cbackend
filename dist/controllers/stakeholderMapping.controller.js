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
exports.getKeyInsights = exports.bulkUpdateStakeholderThemes = exports.getStakeholderGroupThemes = exports.updateStakeholderGroupThemes = exports.getCompletionStats = exports.updateTask = exports.getTaskOptions = exports.deleteStakeholderGroup = exports.updateStakeholderGroup = exports.createStakeholderGroupController = exports.getStakeholderGroup = exports.getStakeholderGroupsByCategory = exports.getStakeholderGroups = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const stakeholderGroup_model_1 = __importDefault(require("../models/stakeholderGroup.model"));
const project_model_1 = __importDefault(require("../models/project.model"));
const projectSite_model_1 = __importDefault(require("../models/projectSite.model"));
const category_model_1 = __importDefault(require("../models/category.model"));
const stakeholderMapping_service_1 = require("../services/stakeholderMapping.service");
const reviewHelpers_1 = require("../utils/reviewHelpers");
// Type guard to check if user is defined
function isUserAuthenticated(req) {
    return req.user !== undefined;
}
/**
 * Get all stakeholder groups for a project or project site
 * @route GET /api/v1/stakeholderMapping/project/:projectId
 * @route GET /api/v1/stakeholderMapping/project/:projectId/site/:siteId
 * @access Private
 */
const getStakeholderGroups = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { projectId, siteId } = req.params;
        // Build the query
        const query = { project: projectId };
        if (siteId) {
            query.projectSite = siteId;
        }
        // Check if project exists
        const project = yield project_model_1.default.findById(projectId);
        if (!project) {
            const error = new Error('Project not found');
            error.statusCode = 404;
            throw error;
        }
        // If site is specified, check if it exists
        if (siteId) {
            const site = yield projectSite_model_1.default.findById(siteId);
            if (!site) {
                const error = new Error('Project site not found');
                error.statusCode = 404;
                throw error;
            }
            // Check if site belongs to the project
            if (site.project.toString() !== projectId) {
                const error = new Error('Project site does not belong to this project');
                error.statusCode = 400;
                throw error;
            }
        }
        // Fetch stakeholder groups
        const stakeholderGroups = yield stakeholderGroup_model_1.default.find(query)
            .populate('category', 'name')
            .populate('creator', 'name')
            .populate('lastUpdatedBy', 'name')
            .sort({ category: 1, name: 1 });
        // Group by category for easier frontend processing
        const groupsByCategory = {};
        stakeholderGroups.forEach(group => {
            const categoryName = group.category.name;
            if (!groupsByCategory[categoryName]) {
                groupsByCategory[categoryName] = [];
            }
            groupsByCategory[categoryName].push(group);
        });
        res.status(200).json({
            success: true,
            count: stakeholderGroups.length,
            data: {
                stakeholderGroups,
                groupsByCategory
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getStakeholderGroups = getStakeholderGroups;
/**
 * Get stakeholder groups by category for a project or project site
 * @route GET /api/v1/stakeholderMapping/project/:projectId/category/:categoryId
 * @route GET /api/v1/stakeholderMapping/project/:projectId/site/:siteId/category/:categoryId
 * @access Private
 */
const getStakeholderGroupsByCategory = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { projectId, siteId, categoryId } = req.params;
        // Build the query
        const query = {
            project: projectId,
            category: categoryId
        };
        if (siteId) {
            query.projectSite = siteId;
        }
        // Check if project exists
        const project = yield project_model_1.default.findById(projectId);
        if (!project) {
            const error = new Error('Project not found');
            error.statusCode = 404;
            throw error;
        }
        // If site is specified, check if it exists
        if (siteId) {
            const site = yield projectSite_model_1.default.findById(siteId);
            if (!site) {
                const error = new Error('Project site not found');
                error.statusCode = 404;
                throw error;
            }
            // Check if site belongs to the project
            if (site.project.toString() !== projectId) {
                const error = new Error('Project site does not belong to this project');
                error.statusCode = 400;
                throw error;
            }
        }
        // Check if category exists
        const category = yield category_model_1.default.findById(categoryId);
        if (!category) {
            const error = new Error('Category not found');
            error.statusCode = 404;
            throw error;
        }
        // Fetch stakeholder groups
        const stakeholderGroups = yield stakeholderGroup_model_1.default.find(query)
            .populate('creator', 'name')
            .populate('lastUpdatedBy', 'name')
            .sort('name');
        res.status(200).json({
            success: true,
            count: stakeholderGroups.length,
            categoryName: category.name,
            data: stakeholderGroups
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getStakeholderGroupsByCategory = getStakeholderGroupsByCategory;
/**
 * Get a single stakeholder group by ID
 * @route GET /api/v1/stakeholderMapping/:id
 * @access Private
 */
const getStakeholderGroup = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        // Fetch the stakeholder group
        const stakeholderGroup = yield stakeholderGroup_model_1.default.findById(id)
            .populate('category', 'name')
            .populate('project', 'name')
            .populate('projectSite', 'name')
            .populate('creator', 'name')
            .populate('lastUpdatedBy', 'name');
        if (!stakeholderGroup) {
            const error = new Error('Stakeholder group not found');
            error.statusCode = 404;
            throw error;
        }
        res.status(200).json({
            success: true,
            data: stakeholderGroup
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid stakeholder group ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getStakeholderGroup = getStakeholderGroup;
/**
 * Create a new stakeholder group
 * @route POST /api/v1/stakeholderMapping
 * @access Private
 */
const createStakeholderGroupController = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const { projectId, projectSiteId, categoryId, name, description, estimatedPopulation } = req.body;
        // Validate required fields
        if (!projectId || !categoryId || !name) {
            const error = new Error('Project ID, category ID, and name are required');
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
        // Check if category exists
        const category = yield category_model_1.default.findById(categoryId);
        if (!category) {
            const error = new Error('Category not found');
            error.statusCode = 404;
            throw error;
        }
        // Ensure task options exist for this category
        // Before calling initializeCategoryTaskOptions, add a user check
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        // Helper function to convert ObjectId to string
        function objectIdToString(id) {
            return id.toString();
        }
        try {
            yield (0, stakeholderMapping_service_1.initializeTaskPrompts)(objectIdToString(req.user._id));
            yield (0, stakeholderMapping_service_1.initializeCategoryTaskOptions)(categoryId, category.name, objectIdToString(req.user._id));
        }
        catch (error) {
            console.error('Error initializing category task options:', error);
            // Continue even if this fails, as it may already be initialized
        }
        // Create the stakeholder group
        const stakeholderGroup = yield (0, stakeholderMapping_service_1.createStakeholderGroup)({
            project: projectId,
            projectSite: projectSiteId,
            category: categoryId,
            name,
            description,
            estimatedPopulation,
            creator: objectIdToString(req.user._id)
        });
        yield session.commitTransaction();
        session.endSession();
        res.status(201).json({
            success: true,
            message: 'Stakeholder group created successfully',
            data: stakeholderGroup
        });
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        next(error);
    }
});
exports.createStakeholderGroupController = createStakeholderGroupController;
/**
 * Update a stakeholder group's basic information
 * @route PUT /api/v1/stakeholderMapping/:id
 * @access Private
 */
const updateStakeholderGroup = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { name, description } = req.body;
        // Before calling initializeCategoryTaskOptions, add a user check
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        // Find the stakeholder group
        const stakeholderGroup = yield stakeholderGroup_model_1.default.findById(id);
        if (!stakeholderGroup) {
            const error = new Error('Stakeholder group not found');
            error.statusCode = 404;
            throw error;
        }
        // Update fields
        if (name)
            stakeholderGroup.name = name;
        if (description !== undefined)
            stakeholderGroup.description = description;
        // Update last updated by
        stakeholderGroup.lastUpdatedBy = req.user._id;
        // Save the stakeholder group
        yield stakeholderGroup.save();
        res.status(200).json({
            success: true,
            message: 'Stakeholder group updated successfully',
            data: stakeholderGroup
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid stakeholder group ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        // Handle unique constraint violation
        if (error instanceof Error && error.name === 'MongoError' && error.code === 11000) {
            const customError = new Error('A stakeholder group with this name already exists for this category in this project/site');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.updateStakeholderGroup = updateStakeholderGroup;
/**
 * Delete a stakeholder group
 * @route DELETE /api/v1/stakeholderMapping/:id
 * @access Private
 */
const deleteStakeholderGroup = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        // Find the stakeholder group
        const stakeholderGroup = yield stakeholderGroup_model_1.default.findById(id);
        if (!stakeholderGroup) {
            const error = new Error('Stakeholder group not found');
            error.statusCode = 404;
            throw error;
        }
        // Delete the stakeholder group
        yield stakeholderGroup_model_1.default.findByIdAndDelete(id);
        res.status(200).json({
            success: true,
            message: 'Stakeholder group deleted successfully',
            data: {}
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid stakeholder group ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.deleteStakeholderGroup = deleteStakeholderGroup;
/**
 * Get task options for a specific category and task type
 * @route GET /api/v1/stakeholderMapping/taskOptions/:categoryId/:taskType
 * @access Private
 */
const getTaskOptions = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { categoryId, taskType } = req.params;
        // Before calling initializeCategoryTaskOptions, add a user check
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        // Check if category exists
        const category = yield category_model_1.default.findById(categoryId);
        if (!category) {
            const error = new Error('Category not found');
            error.statusCode = 404;
            throw error;
        }
        // Validate task type
        const validTaskTypes = ['connections', 'power', 'wellbeing', 'roles', 'risks', 'benefits'];
        if (!validTaskTypes.includes(taskType)) {
            const error = new Error(`Invalid task type: ${taskType}`);
            error.statusCode = 400;
            throw error;
        }
        // Helper function to convert ObjectId to string
        function objectIdToString(id) {
            return id.toString();
        }
        // Try to initialize task prompts
        try {
            yield (0, stakeholderMapping_service_1.initializeTaskPrompts)(objectIdToString(req.user._id));
        }
        catch (error) {
            console.error('Error initializing task prompts:', error);
            // Continue even if this fails, as it may already be initialized
        }
        // Try to initialize options if they don't exist
        try {
            yield (0, stakeholderMapping_service_1.initializeCategoryTaskOptions)(categoryId, category.name, objectIdToString(req.user._id));
        }
        catch (error) {
            console.error('Error initializing category task options:', error);
            // Continue even if this fails, as it may already be initialized
        }
        // Get task options
        const options = yield (0, stakeholderMapping_service_1.getTaskOptionsForCategory)(categoryId, taskType);
        // Get task prompt
        const prompt = yield (0, stakeholderMapping_service_1.getTaskPrompt)(taskType);
        res.status(200).json({
            success: true,
            count: options.length,
            data: {
                options,
                prompt
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getTaskOptions = getTaskOptions;
/**
 * Add or update a task for a stakeholder group
 * @route POST /api/v1/stakeholderMapping/:id/tasks/:taskType
 * @access Private
 */
const updateTask = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id, taskType } = req.params;
        const { responses, rating, tags } = req.body;
        // Before calling initializeCategoryTaskOptions, add a user check
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        // Validate task type
        const validTaskTypes = ['connections', 'power', 'wellbeing', 'roles', 'risks', 'benefits'];
        if (!validTaskTypes.includes(taskType)) {
            const error = new Error(`Invalid task type: ${taskType}`);
            error.statusCode = 400;
            throw error;
        }
        // Validate response structure including isKeyInsight
        for (const response of responses) {
            if (!response.optionId || typeof response.optionId !== 'string') {
                const error = new Error('Each response must have a valid optionId');
                error.statusCode = 400;
                throw error;
            }
            // Allow empty description, but validate type if provided and not empty
            if (response.description !== undefined && response.description !== null && typeof response.description !== 'string') {
                const error = new Error('Each response description must be a string');
                error.statusCode = 400;
                throw error;
            }
            // Validate isKeyInsight if provided
            if (response.isKeyInsight !== undefined && typeof response.isKeyInsight !== 'boolean') {
                const error = new Error('isKeyInsight must be a boolean value');
                error.statusCode = 400;
                throw error;
            }
        }
        // Validate rating
        if (rating === undefined || rating < 1 || rating > 5) {
            const error = new Error('Rating must be a number between 1 and 5');
            error.statusCode = 400;
            throw error;
        }
        // NEW: Validate tags if provided
        if (tags !== undefined) {
            if (!Array.isArray(tags)) {
                const error = new Error('Tags must be an array of strings');
                error.statusCode = 400;
                throw error;
            }
            // Validate individual tags
            const invalidTags = tags.filter(tag => typeof tag !== 'string' || tag.trim().length === 0 || tag.length > 100);
            if (invalidTags.length > 0) {
                const error = new Error('Tags must be non-empty strings with max 100 characters');
                error.statusCode = 400;
                throw error;
            }
        }
        // Helper function to convert ObjectId to string
        function objectIdToString(id) {
            return id.toString();
        }
        // Update the task
        const updatedStakeholderGroup = yield (0, stakeholderMapping_service_1.updateStakeholderTask)(id, taskType, { responses, rating, tags }, objectIdToString(req.user._id));
        // ============================================================================
        // 🆕 ADD AUTO-TRIGGER HERE (AFTER updateStakeholderTask)
        // ============================================================================
        // AUTO-TRIGGER: Create review for completed task
        try {
            // Find the task index for the updated task
            const taskIndex = updatedStakeholderGroup.tasks.findIndex((t) => t.taskType === taskType);
            if (taskIndex !== -1) {
                // Populate necessary fields for review creation
                const populatedStakeholderGroup = yield stakeholderGroup_model_1.default.findById(id)
                    .populate({
                    path: 'project',
                    populate: { path: 'organization' }
                })
                    .populate('projectSite')
                    .populate('category');
                if (populatedStakeholderGroup) {
                    // Import the review helper at the top of the file
                    // import { createStakeholderGroupTaskReview } from '../utils/reviewHelpers';
                    yield (0, reviewHelpers_1.createStakeholderGroupTaskReview)(populatedStakeholderGroup, taskIndex, req.user._id);
                    console.log(`✅ Review auto-created for stakeholder mapping task: ${taskType} - ${updatedStakeholderGroup.name}`);
                }
            }
        }
        catch (reviewError) {
            // Non-blocking - log error but don't fail the request
            console.error('Failed to create review for stakeholder mapping task:', reviewError);
        }
        // ============================================================================
        // END OF AUTO-TRIGGER
        // ============================================================================
        res.status(200).json({
            success: true,
            message: 'Task updated successfully',
            data: updatedStakeholderGroup
        });
    }
    catch (error) {
        next(error);
    }
});
exports.updateTask = updateTask;
/**
 * Get stakeholder completion statistics
 * @route GET /api/v1/stakeholderMapping/stats/project/:projectId
 * @route GET /api/v1/stakeholderMapping/stats/project/:projectId/site/:siteId
 * @access Private
 */
const getCompletionStats = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { projectId, siteId } = req.params;
        // Check if project exists
        const project = yield project_model_1.default.findById(projectId);
        if (!project) {
            const error = new Error('Project not found');
            error.statusCode = 404;
            throw error;
        }
        // If site is specified, check if it exists
        if (siteId) {
            const site = yield projectSite_model_1.default.findById(siteId);
            if (!site) {
                const error = new Error('Project site not found');
                error.statusCode = 404;
                throw error;
            }
            // Check if site belongs to the project
            if (site.project.toString() !== projectId) {
                const error = new Error('Project site does not belong to this project');
                error.statusCode = 400;
                throw error;
            }
        }
        // Get statistics
        const stats = yield (0, stakeholderMapping_service_1.getStakeholderCompletionStats)(projectId, siteId);
        res.status(200).json({
            success: true,
            data: stats
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getCompletionStats = getCompletionStats;
// Add these functions to your stakeholderMapping.controller.ts
/**
 * Update stakeholder group theme associations
 * @route PUT /api/v1/stakeholderMapping/:id/themes
 * @access Private
 */
const updateStakeholderGroupThemes = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { themeIds } = req.body;
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        // Validate themeIds is an array
        if (!Array.isArray(themeIds)) {
            const error = new Error('themeIds must be an array');
            error.statusCode = 400;
            throw error;
        }
        // Find the stakeholder group
        const stakeholderGroup = yield stakeholderGroup_model_1.default.findById(id);
        if (!stakeholderGroup) {
            const error = new Error('Stakeholder group not found');
            error.statusCode = 404;
            throw error;
        }
        // Validate that all themes exist (if any provided)
        if (themeIds.length > 0) {
            const Theme = yield Promise.resolve().then(() => __importStar(require('../models/theme.model'))).then(m => m.default);
            const themes = yield Theme.find({ _id: { $in: themeIds } });
            if (themes.length !== themeIds.length) {
                const error = new Error('One or more themes not found');
                error.statusCode = 404;
                throw error;
            }
        }
        // Update themes (empty array means no restrictions - can work with any themes)
        stakeholderGroup.themes = themeIds;
        stakeholderGroup.lastUpdatedBy = req.user._id;
        yield stakeholderGroup.save();
        // Populate and return updated stakeholder group
        const updatedStakeholderGroup = yield stakeholderGroup_model_1.default.findById(id)
            .populate('themes', 'name description')
            .populate('category', 'name')
            .populate('creator', 'name')
            .populate('lastUpdatedBy', 'name');
        res.status(200).json({
            success: true,
            message: 'Stakeholder group themes updated successfully',
            data: updatedStakeholderGroup
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid stakeholder group ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.updateStakeholderGroupThemes = updateStakeholderGroupThemes;
/**
 * Get stakeholder group with associated themes
 * @route GET /api/v1/stakeholderMapping/:id/themes
 * @access Private
 */
const getStakeholderGroupThemes = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        // Fetch the stakeholder group with themes populated
        const stakeholderGroup = yield stakeholderGroup_model_1.default.findById(id)
            .populate('themes', 'name description')
            .populate('category', 'name')
            .populate('project', 'name')
            .populate('projectSite', 'name');
        if (!stakeholderGroup) {
            const error = new Error('Stakeholder group not found');
            error.statusCode = 404;
            throw error;
        }
        // Also get all available themes for the UI
        const Theme = yield Promise.resolve().then(() => __importStar(require('../models/theme.model'))).then(m => m.default);
        const allThemes = yield Theme.find({ archived: { $ne: true } }).select('name description');
        res.status(200).json({
            success: true,
            data: {
                stakeholderGroup,
                associatedThemes: stakeholderGroup.themes || [],
                allThemes,
                hasRestrictions: stakeholderGroup.themes && stakeholderGroup.themes.length > 0
            }
        });
    }
    catch (error) {
        // Handle invalid MongoDB ID format
        if (error instanceof Error && error.name === 'CastError') {
            const customError = new Error('Invalid stakeholder group ID format');
            customError.statusCode = 400;
            return next(customError);
        }
        next(error);
    }
});
exports.getStakeholderGroupThemes = getStakeholderGroupThemes;
/**
 * Bulk update theme associations for multiple stakeholder groups
 * @route PUT /api/v1/stakeholderMapping/bulk-themes
 * @access Private
 */
const bulkUpdateStakeholderThemes = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const session = yield mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const { stakeholderThemeMap } = req.body; // Array of { stakeholderGroupId, themeIds }
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        if (!Array.isArray(stakeholderThemeMap)) {
            const error = new Error('stakeholderThemeMap must be an array');
            error.statusCode = 400;
            throw error;
        }
        const updatePromises = stakeholderThemeMap.map((item) => __awaiter(void 0, void 0, void 0, function* () {
            const { stakeholderGroupId, themeIds } = item;
            if (!Array.isArray(themeIds)) {
                throw new Error(`themeIds must be an array for stakeholder ${stakeholderGroupId}`);
            }
            const stakeholderGroup = yield stakeholderGroup_model_1.default.findById(stakeholderGroupId);
            if (!stakeholderGroup) {
                throw new Error(`Stakeholder group ${stakeholderGroupId} not found`);
            }
            // Validate themes exist (if any provided)
            if (themeIds.length > 0) {
                const Theme = yield Promise.resolve().then(() => __importStar(require('../models/theme.model'))).then(m => m.default);
                const themes = yield Theme.find({ _id: { $in: themeIds } });
                if (themes.length !== themeIds.length) {
                    throw new Error(`Some themes not found for stakeholder ${stakeholderGroupId}`);
                }
            }
            stakeholderGroup.themes = themeIds;
            stakeholderGroup.lastUpdatedBy = req.user._id;
            return stakeholderGroup.save({ session });
        }));
        yield Promise.all(updatePromises);
        yield session.commitTransaction();
        session.endSession();
        res.status(200).json({
            success: true,
            message: `Successfully updated themes for ${stakeholderThemeMap.length} stakeholder groups`,
            data: {
                updatedCount: stakeholderThemeMap.length
            }
        });
    }
    catch (error) {
        yield session.abortTransaction();
        session.endSession();
        next(error);
    }
});
exports.bulkUpdateStakeholderThemes = bulkUpdateStakeholderThemes;
// controllers/stakeholderMapping.controller.ts - Add this new function
/**
 * Get all key insights for a project or project site
 * @route GET /api/v1/stakeholderMapping/project/:projectId/key-insights
 * @route GET /api/v1/stakeholderMapping/project/:projectId/site/:siteId/key-insights
 * @access Private
 */
const getKeyInsights = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { projectId, siteId } = req.params;
        // Build the query
        const query = { project: projectId };
        if (siteId) {
            query.projectSite = siteId;
        }
        // Check if project exists
        const project = yield project_model_1.default.findById(projectId);
        if (!project) {
            const error = new Error('Project not found');
            error.statusCode = 404;
            throw error;
        }
        // If site is specified, check if it exists
        if (siteId) {
            const site = yield projectSite_model_1.default.findById(siteId);
            if (!site) {
                const error = new Error('Project site not found');
                error.statusCode = 404;
                throw error;
            }
            if (site.project.toString() !== projectId) {
                const error = new Error('Project site does not belong to this project');
                error.statusCode = 400;
                throw error;
            }
        }
        // Fetch stakeholder groups
        const stakeholderGroups = yield stakeholderGroup_model_1.default.find(query)
            .populate('category', 'name')
            .populate('creator', 'name');
        // Extract key insights from all stakeholder groups
        const keyInsights = [];
        stakeholderGroups.forEach(group => {
            group.tasks.forEach(task => {
                const keyInsightResponses = task.responses.filter((response) => response.isKeyInsight === true);
                if (keyInsightResponses.length > 0) {
                    keyInsights.push({
                        stakeholderGroup: {
                            id: group._id,
                            name: group.name,
                            category: group.category.name
                        },
                        taskType: task.taskType,
                        rating: task.rating,
                        tags: task.tags,
                        insights: keyInsightResponses,
                        updatedAt: task.updatedAt
                    });
                }
            });
        });
        // Sort by most recent
        keyInsights.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        res.status(200).json({
            success: true,
            count: keyInsights.length,
            data: keyInsights
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getKeyInsights = getKeyInsights;
//# sourceMappingURL=stakeholderMapping.controller.js.map