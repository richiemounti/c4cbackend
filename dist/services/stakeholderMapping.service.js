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
exports.getStakeholderCompletionStats = exports.updateStakeholderTask = exports.createStakeholderGroup = exports.getTaskPrompt = exports.getTaskOptionsForCategory = exports.initializeCategoryTaskOptions = exports.initializeTaskPrompts = void 0;
// services/stakeholderMapping.service.ts
const mongoose_1 = __importDefault(require("mongoose"));
const stakeholderGroup_model_1 = __importDefault(require("../models/stakeholderGroup.model"));
const stakeholderTaskOption_model_1 = __importDefault(require("../models/stakeholderTaskOption.model"));
const taskPrompt_model_1 = __importDefault(require("../models/taskPrompt.model"));
const stakeholderMapping_constants_1 = require("../constants/stakeholderMapping.constants");
/**
 * Initializes the default task prompts if they don't exist
 */
const initializeTaskPrompts = (creatorId) => __awaiter(void 0, void 0, void 0, function* () {
    // Build the prompts array from the shared constants so this stays in sync
    const defaultPrompts = Object.entries(stakeholderMapping_constants_1.TASK_PROMPTS).map(([taskType, config]) => ({
        taskType,
        promptText: config.promptText,
        tooltipText: config.tooltipText,
        ratingPrompt: config.ratingPrompt,
        ratingMin: config.ratingMin,
        ratingMax: config.ratingMax,
        ratingMinLabel: config.ratingMinLabel,
        ratingMaxLabel: config.ratingMaxLabel
    }));
    for (const prompt of defaultPrompts) {
        yield taskPrompt_model_1.default.findOneAndUpdate({ taskType: prompt.taskType }, Object.assign(Object.assign({}, prompt), { creator: creatorId }), { upsert: true, new: true });
    }
});
exports.initializeTaskPrompts = initializeTaskPrompts;
/**
 * Initializes the task options for a specific category
 */
const initializeCategoryTaskOptions = (categoryId, categoryName, creatorId) => __awaiter(void 0, void 0, void 0, function* () {
    // Use the shared CATEGORY_OPTIONS_MAP from constants — single source of truth
    const categoryOptions = stakeholderMapping_constants_1.CATEGORY_OPTIONS_MAP[categoryName];
    if (!categoryOptions) {
        throw new Error(`No predefined options found for category: ${categoryName}`);
    }
    // Create options for each task type
    for (const [taskType, options] of Object.entries(categoryOptions)) {
        let order = 0;
        for (const option of options) {
            yield stakeholderTaskOption_model_1.default.findOneAndUpdate({
                category: categoryId,
                taskType,
                optionId: option.optionId
            }, Object.assign(Object.assign({}, option), { category: categoryId, taskType, order: order++, creator: creatorId }), { upsert: true, new: true });
        }
    }
});
exports.initializeCategoryTaskOptions = initializeCategoryTaskOptions;
/**
 * Get all task options for a specific category and task type
 */
const getTaskOptionsForCategory = (categoryId, taskType) => __awaiter(void 0, void 0, void 0, function* () {
    const options = yield stakeholderTaskOption_model_1.default.find({
        category: categoryId,
        taskType,
        archived: { $ne: true }
    }).sort('order');
    return options;
});
exports.getTaskOptionsForCategory = getTaskOptionsForCategory;
/**
 * Get the task prompt for a specific task type
 */
const getTaskPrompt = (taskType) => __awaiter(void 0, void 0, void 0, function* () {
    const prompt = yield taskPrompt_model_1.default.findOne({ taskType });
    if (!prompt) {
        throw new Error(`No prompt found for task type: ${taskType}`);
    }
    return prompt;
});
exports.getTaskPrompt = getTaskPrompt;
/**
 * Create a new stakeholder group
 */
const createStakeholderGroup = (data) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const stakeholderGroup = new stakeholderGroup_model_1.default(Object.assign(Object.assign({}, data), { tasks: [], completionStatus: 'not_started', lastUpdatedBy: data.creator }));
        yield stakeholderGroup.save();
        return stakeholderGroup;
    }
    catch (error) {
        // Handle unique index violation
        if (error instanceof Error && error.name === 'MongoError' && error.code === 11000) {
            const customError = new Error('A stakeholder group with this name already exists for this category in this project/site');
            customError.statusCode = 400;
            throw customError;
        }
        throw error;
    }
});
exports.createStakeholderGroup = createStakeholderGroup;
/**
 * Add or update a task for a stakeholder group
 */
const updateStakeholderTask = (stakeholderGroupId, taskType, taskData, userId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Find the stakeholder group
        const stakeholderGroup = yield stakeholderGroup_model_1.default.findById(stakeholderGroupId);
        if (!stakeholderGroup) {
            const customError = new Error('Stakeholder group not found');
            customError.statusCode = 404;
            throw customError;
        }
        // Find the existing task or create a new one
        const taskIndex = stakeholderGroup.tasks.findIndex(t => t.taskType === taskType);
        if (taskIndex !== -1) {
            // Update existing task - use set to handle Mongoose document arrays properly
            stakeholderGroup.tasks[taskIndex].set('responses', taskData.responses);
            stakeholderGroup.tasks[taskIndex].set('rating', taskData.rating);
            if (taskData.tags !== undefined) {
                stakeholderGroup.tasks[taskIndex].set('tags', taskData.tags);
            }
            stakeholderGroup.tasks[taskIndex].set('updatedAt', new Date());
        }
        else {
            // Add new task
            stakeholderGroup.tasks.push({
                taskType,
                responses: taskData.responses,
                rating: taskData.rating,
                tags: taskData.tags || [],
                updatedAt: new Date()
            });
        }
        // Update last updated by
        stakeholderGroup.lastUpdatedBy = new mongoose_1.default.Types.ObjectId(userId);
        // Save the stakeholder group
        yield stakeholderGroup.save();
        return stakeholderGroup;
    }
    catch (error) {
        throw error;
    }
});
exports.updateStakeholderTask = updateStakeholderTask;
/**
 * Get stakeholder completion statistics for a project
 */
const getStakeholderCompletionStats = (projectId, projectSiteId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Build the query
        const query = { project: projectId };
        if (projectSiteId) {
            query.projectSite = projectSiteId;
        }
        // Get all stakeholder groups for this project/site
        const stakeholderGroups = yield stakeholderGroup_model_1.default.find(query)
            .populate('category', 'name');
        // Calculate totals
        const total = stakeholderGroups.length;
        const completed = stakeholderGroups.filter(sg => sg.completionStatus === 'completed').length;
        const inProgress = stakeholderGroups.filter(sg => sg.completionStatus === 'in_progress').length;
        const notStarted = stakeholderGroups.filter(sg => sg.completionStatus === 'not_started').length;
        // Group by category
        const byCategoryMap = new Map();
        stakeholderGroups.forEach(sg => {
            const categoryName = sg.category.name;
            if (!byCategoryMap.has(categoryName)) {
                byCategoryMap.set(categoryName, {
                    total: 0,
                    completed: 0,
                    inProgress: 0,
                    notStarted: 0
                });
            }
            const categoryStats = byCategoryMap.get(categoryName);
            categoryStats.total++;
            if (sg.completionStatus === 'completed') {
                categoryStats.completed++;
            }
            else if (sg.completionStatus === 'in_progress') {
                categoryStats.inProgress++;
            }
            else {
                categoryStats.notStarted++;
            }
        });
        // Convert map to object and calculate percentages
        const byCategoryStats = {};
        byCategoryMap.forEach((stats, category) => {
            byCategoryStats[category] = Object.assign(Object.assign({}, stats), { completionPercentage: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0 });
        });
        return {
            total,
            completed,
            inProgress,
            notStarted,
            completionPercentage: total > 0 ? Math.round((completed / total) * 100) : 0,
            byCategoryStats
        };
    }
    catch (error) {
        throw error;
    }
});
exports.getStakeholderCompletionStats = getStakeholderCompletionStats;
//# sourceMappingURL=stakeholderMapping.service.js.map