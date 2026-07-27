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
exports.getDefaultProjectSiteSetupTasks = exports.getDefaultProjectSetupTasks = exports.getProjectSiteSetupProgress = exports.getProjectSetupProgress = exports.updateTaskData = exports.completeSetupTask = exports.initializeProjectSiteSetup = exports.initializeProjectSetup = void 0;
// services/projectSetup.service.ts
const mongoose_1 = __importDefault(require("mongoose"));
// Import models
const projectSetupTask_model_1 = __importDefault(require("../models/projectSetupTask.model"));
const projectSiteSetupTask_model_1 = __importDefault(require("../models/projectSiteSetupTask.model"));
const project_model_1 = __importDefault(require("../models/project.model"));
const projectSite_model_1 = __importDefault(require("../models/projectSite.model"));
// Create schema for task templates
const taskTemplateSchema = new mongoose_1.default.Schema({
    type: {
        type: String,
        enum: ['project', 'projectSite'],
        required: true
    },
    tasks: [
        {
            fieldName: String,
            dataType: String,
            description: String,
            userFacingCopy: String,
            fieldLabel: String,
            helperText: String,
            hoverText: String,
            isRequired: Boolean,
            sortOrder: Number,
            step: Number,
            stepNumber: Number,
            stepLabel: String,
            conditionalOn: {
                fieldName: String,
                value: mongoose_1.default.Schema.Types.Mixed
            },
            options: [String]
        }
    ],
    version: {
        type: String,
        default: '1.0.0'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});
// Register the model - mongoose.model will check if it exists first 
// and return the existing one if it does, or create a new one if it doesn't
const TaskTemplate = mongoose_1.default.model('TaskTemplate', taskTemplateSchema);
/**
 * Initialize project setup tasks for a new project
 * @param projectId MongoDB ObjectId of the project
 * @param userId MongoDB ObjectId of the user creating the setup
 */
const initializeProjectSetup = (projectId, userId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // First check if the project exists
        const project = yield project_model_1.default.findById(projectId);
        if (!project) {
            throw new Error('Project not found');
        }
        // Check if setup already exists
        const existingSetup = yield projectSetupTask_model_1.default.findOne({ project: projectId });
        if (existingSetup) {
            return existingSetup; // Setup already exists, return it
        }
        // Get default tasks from template
        const defaultTasks = yield (0, exports.getDefaultProjectSetupTasks)();
        // Create the project setup record
        const projectSetup = new projectSetupTask_model_1.default({
            project: projectId,
            tasks: defaultTasks,
            lastUpdatedBy: userId
        });
        // Skip calling calculateProgress directly, let the pre-save hook handle it
        // Save to database
        yield projectSetup.save();
        return projectSetup;
    }
    catch (error) {
        console.error('Error initializing project setup:', error);
        throw error;
    }
});
exports.initializeProjectSetup = initializeProjectSetup;
/**
 * Initialize project site setup tasks for a new project site
 * @param projectSiteId MongoDB ObjectId of the project site
 * @param projectId MongoDB ObjectId of the parent project
 * @param userId MongoDB ObjectId of the user creating the setup
 */
const initializeProjectSiteSetup = (projectSiteId, projectId, userId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // First check if the project site exists
        const projectSite = yield projectSite_model_1.default.findById(projectSiteId);
        if (!projectSite) {
            throw new Error('Project site not found');
        }
        // Check if setup already exists
        const existingSetup = yield projectSiteSetupTask_model_1.default.findOne({ projectSite: projectSiteId });
        if (existingSetup) {
            return existingSetup; // Setup already exists, return it
        }
        // Get default tasks from template
        const defaultTasks = yield (0, exports.getDefaultProjectSiteSetupTasks)();
        // Create the project site setup record
        const projectSiteSetup = new projectSiteSetupTask_model_1.default({
            projectSite: projectSiteId,
            project: projectId,
            tasks: defaultTasks,
            lastUpdatedBy: userId
        });
        // Skip calling calculateProgress directly, let the pre-save hook handle it
        // Save to database
        yield projectSiteSetup.save();
        return projectSiteSetup;
    }
    catch (error) {
        console.error('Error initializing project site setup:', error);
        throw error;
    }
});
exports.initializeProjectSiteSetup = initializeProjectSiteSetup;
/**
 * Update a task as completed
 * @param setupId ID of the setup record (project or site)
 * @param taskId ID of the task to update
 * @param userId ID of the user completing the task
 * @param responseData The data submitted by the user for this task
 * @param isProjectSite Whether this is for a project site (true) or project (false)
 */
const completeSetupTask = (setupId_1, taskId_1, userId_1, ...args_1) => __awaiter(void 0, [setupId_1, taskId_1, userId_1, ...args_1], void 0, function* (setupId, taskId, userId, responseData = null, isProjectSite = false) {
    try {
        if (isProjectSite) {
            // Project Site Setup handling
            const setup = yield projectSiteSetupTask_model_1.default.findById(setupId);
            if (!setup) {
                throw new Error('Project site setup not found');
            }
            // Convert userId to ObjectId if it's a string
            const userIdObj = typeof userId === 'string' ? new mongoose_1.default.Types.ObjectId(userId) : userId;
            // Use updateOne with $ operators to update the specific task in the array
            const result = yield projectSiteSetupTask_model_1.default.updateOne({
                _id: setupId,
                "tasks._id": taskId
            }, {
                $set: {
                    "tasks.$.isCompleted": true,
                    "tasks.$.completedAt": new Date(),
                    "tasks.$.completedBy": userIdObj,
                    "tasks.$.responseData": responseData
                },
                lastUpdatedBy: userIdObj
            });
            if (result.matchedCount === 0) {
                throw new Error('Task not found in setup');
            }
            // Fetch the updated document
            return yield projectSiteSetupTask_model_1.default.findById(setupId);
        }
        else {
            // Project Setup handling
            const setup = yield projectSetupTask_model_1.default.findById(setupId);
            if (!setup) {
                throw new Error('Project setup not found');
            }
            // Convert userId to ObjectId if it's a string
            const userIdObj = typeof userId === 'string' ? new mongoose_1.default.Types.ObjectId(userId) : userId;
            // Use updateOne with $ operators to update the specific task in the array
            const result = yield projectSetupTask_model_1.default.updateOne({
                _id: setupId,
                "tasks._id": taskId
            }, {
                $set: {
                    "tasks.$.isCompleted": true,
                    "tasks.$.completedAt": new Date(),
                    "tasks.$.completedBy": userIdObj,
                    "tasks.$.responseData": responseData
                },
                lastUpdatedBy: userIdObj
            });
            if (result.matchedCount === 0) {
                throw new Error('Task not found in setup');
            }
            // Fetch the updated document
            return yield projectSetupTask_model_1.default.findById(setupId);
        }
    }
    catch (error) {
        console.error(`Error completing ${isProjectSite ? 'project site' : 'project'} setup task:`, error);
        throw error;
    }
});
exports.completeSetupTask = completeSetupTask;
/**
 * Update task data without marking as complete
 * @param setupId ID of the setup record (project or site)
 * @param taskId ID of the task to update
 * @param userId ID of the user updating the task
 * @param responseData The data submitted by the user for this task
 * @param isProjectSite Whether this is for a project site (true) or project (false)
 */
const updateTaskData = (setupId_1, taskId_1, userId_1, responseData_1, ...args_1) => __awaiter(void 0, [setupId_1, taskId_1, userId_1, responseData_1, ...args_1], void 0, function* (setupId, taskId, userId, responseData, isProjectSite = false) {
    try {
        if (isProjectSite) {
            // Project Site Setup handling
            const setup = yield projectSiteSetupTask_model_1.default.findById(setupId);
            if (!setup) {
                throw new Error('Project site setup not found');
            }
            // Convert userId to ObjectId if it's a string
            const userIdObj = typeof userId === 'string' ? new mongoose_1.default.Types.ObjectId(userId) : userId;
            // Only update the responseData field, don't mark as completed
            const result = yield projectSiteSetupTask_model_1.default.updateOne({
                _id: setupId,
                "tasks._id": taskId
            }, {
                $set: {
                    "tasks.$.responseData": responseData
                },
                lastUpdatedBy: userIdObj
            });
            if (result.matchedCount === 0) {
                throw new Error('Task not found in setup');
            }
            // Fetch the updated document
            return yield projectSiteSetupTask_model_1.default.findById(setupId);
        }
        else {
            // Project Setup handling
            const setup = yield projectSetupTask_model_1.default.findById(setupId);
            if (!setup) {
                throw new Error('Project setup not found');
            }
            // Convert userId to ObjectId if it's a string
            const userIdObj = typeof userId === 'string' ? new mongoose_1.default.Types.ObjectId(userId) : userId;
            // Only update the responseData field, don't mark as completed
            const result = yield projectSetupTask_model_1.default.updateOne({
                _id: setupId,
                "tasks._id": taskId
            }, {
                $set: {
                    "tasks.$.responseData": responseData
                },
                lastUpdatedBy: userIdObj
            });
            if (result.matchedCount === 0) {
                throw new Error('Task not found in setup');
            }
            // Fetch the updated document
            return yield projectSetupTask_model_1.default.findById(setupId);
        }
    }
    catch (error) {
        console.error(`Error updating ${isProjectSite ? 'project site' : 'project'} task data:`, error);
        throw error;
    }
});
exports.updateTaskData = updateTaskData;
/**
 * Get setup progress for a project
 * @param projectId MongoDB ObjectId of the project
 */
const getProjectSetupProgress = (projectId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const projectSetup = yield projectSetupTask_model_1.default.findOne({ project: projectId });
        if (!projectSetup) {
            throw new Error('Project setup not found');
        }
        // Count completed and required tasks directly from the database
        const tasksList = projectSetup.get('tasks') || [];
        const tasksCompleted = tasksList.filter((t) => t.isCompleted).length;
        const requiredTasks = tasksList.filter((t) => t.isRequired);
        const requiredTasksCompleted = requiredTasks.filter((t) => t.isCompleted).length;
        return {
            progress: projectSetup.progress,
            isComplete: projectSetup.isComplete,
            completedAt: projectSetup.completedAt,
            tasksCompleted,
            totalTasks: tasksList.length,
            requiredTasksCompleted,
            totalRequiredTasks: requiredTasks.length
        };
    }
    catch (error) {
        console.error('Error getting project setup progress:', error);
        throw error;
    }
});
exports.getProjectSetupProgress = getProjectSetupProgress;
/**
 * Get site setup progress for a project site
 * @param projectSiteId MongoDB ObjectId of the project site
 */
const getProjectSiteSetupProgress = (projectSiteId) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const siteSetup = yield projectSiteSetupTask_model_1.default.findOne({ projectSite: projectSiteId });
        if (!siteSetup) {
            throw new Error('Project site setup not found');
        }
        // Count completed and required tasks directly from the database
        const tasksList = siteSetup.get('tasks') || [];
        const tasksCompleted = tasksList.filter((t) => t.isCompleted).length;
        const requiredTasks = tasksList.filter((t) => t.isRequired);
        const requiredTasksCompleted = requiredTasks.filter((t) => t.isCompleted).length;
        return {
            progress: siteSetup.progress,
            isComplete: siteSetup.isComplete,
            completedAt: siteSetup.completedAt,
            tasksCompleted,
            totalTasks: tasksList.length,
            requiredTasksCompleted,
            totalRequiredTasks: requiredTasks.length
        };
    }
    catch (error) {
        console.error('Error getting project site setup progress:', error);
        throw error;
    }
});
exports.getProjectSiteSetupProgress = getProjectSiteSetupProgress;
/**
 * Get default project setup tasks from template
 * @returns Array of default project setup tasks
 */
const getDefaultProjectSetupTasks = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Get the TaskTemplate model
        // We use mongoose.models to access the model that was created in the seed script
        // Get the latest project template
        const template = yield TaskTemplate.findOne({ type: 'project' })
            .sort('-createdAt')
            .lean();
        if (!template) {
            console.warn('No project task template found, returning default tasks');
            return getDefaultProjectSetupTasksFallback();
        }
        // Access tasks with safe checks using type assertion
        const templateTasks = template.tasks || [];
        return templateTasks.map((task) => {
            var _a, _b;
            // Use options exactly as stored in the template — no fallback parsing.
            // Previously this block comma-split the description field to generate
            // options, which caused free-text tag fields (e.g. approval_granted_by,
            // implementing_organisations) to render as checkboxes with junk options
            // derived from description sentences that happened to contain commas.
            const options = Array.isArray(task.options) && task.options.length > 0
                ? task.options
                : [];
            return Object.assign(Object.assign({ fieldName: task.fieldName || '', dataType: task.dataType || 'string', description: task.description || '', userFacingCopy: task.userFacingCopy || '', options: options, fieldLabel: task.fieldLabel || '', helperText: task.helperText || '', hoverText: task.hoverText || '', isRequired: Boolean(task.isRequired), sortOrder: Number(task.sortOrder) || 0, step: Number(task.step) || 1, stepNumber: (_a = task.stepNumber) !== null && _a !== void 0 ? _a : null, stepLabel: (_b = task.stepLabel) !== null && _b !== void 0 ? _b : null }, (task.conditionalOn ? { conditionalOn: task.conditionalOn } : {})), { isCompleted: false, completedAt: null, completedBy: null, responseData: null });
        });
    }
    catch (error) {
        console.error('Error getting default project setup tasks:', error);
        return getDefaultProjectSetupTasksFallback();
    }
});
exports.getDefaultProjectSetupTasks = getDefaultProjectSetupTasks;
/**
 * Get default project site setup tasks from template
 * @returns Array of default project site setup tasks
 */
const getDefaultProjectSiteSetupTasks = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Get the TaskTemplate model
        // We use mongoose.models to access the model that was created in the seed script
        // Get the latest project site template
        const template = yield TaskTemplate.findOne({ type: 'projectSite' })
            .sort('-createdAt')
            .lean();
        if (!template) {
            console.warn('No project site task template found, returning default tasks');
            return getDefaultProjectSiteSetupTasksFallback();
        }
        // Access tasks with safe checks using type assertion
        const templateTasks = template.tasks || [];
        // Create new task objects from template with completion fields
        return templateTasks.map((task) => {
            var _a, _b;
            // Use options exactly as stored in the template — no fallback parsing.
            // Previously this block comma-split the description field to generate
            // options, which caused free-text tag fields to render as checkboxes
            // with junk options derived from description sentences containing commas.
            const options = Array.isArray(task.options) && task.options.length > 0
                ? task.options
                : [];
            return Object.assign(Object.assign({ fieldName: task.fieldName || '', dataType: task.dataType || 'string', description: task.description || '', userFacingCopy: task.userFacingCopy || '', options: options, fieldLabel: task.fieldLabel || '', helperText: task.helperText || '', hoverText: task.hoverText || '', isRequired: Boolean(task.isRequired), sortOrder: Number(task.sortOrder) || 0, step: Number(task.step) || 1, stepNumber: (_a = task.stepNumber) !== null && _a !== void 0 ? _a : null, stepLabel: (_b = task.stepLabel) !== null && _b !== void 0 ? _b : null }, (task.conditionalOn ? { conditionalOn: task.conditionalOn } : {})), { isCompleted: false, completedAt: null, completedBy: null, responseData: null });
        });
    }
    catch (error) {
        console.error('Error getting default project site setup tasks:', error);
        return getDefaultProjectSiteSetupTasksFallback();
    }
});
exports.getDefaultProjectSiteSetupTasks = getDefaultProjectSiteSetupTasks;
/**
 * Fallback function for default project setup tasks
 * Used if the database query fails
 */
const getDefaultProjectSetupTasksFallback = () => {
    return [
        {
            fieldName: "projectName",
            dataType: "string",
            description: "The name of the project",
            userFacingCopy: "Enter a name for your project",
            isRequired: true,
            sortOrder: 1,
            step: 1,
            isCompleted: false,
            completedAt: null,
            completedBy: null,
            responseData: null
        },
        {
            fieldName: "projectDescription",
            dataType: "string",
            description: "A brief description of the project",
            userFacingCopy: "Provide a brief description of what this project is about",
            isRequired: true,
            sortOrder: 2,
            step: 1,
            isCompleted: false,
            completedAt: null,
            completedBy: null,
            responseData: null
        }
        // Add more fallback tasks as needed
    ];
};
/**
 * Fallback function for default project site setup tasks
 * Used if the database query fails
 */
const getDefaultProjectSiteSetupTasksFallback = () => {
    return [
        {
            fieldName: "siteName",
            dataType: "string",
            description: "The name of the project site",
            userFacingCopy: "Enter a name for this project site",
            isRequired: true,
            sortOrder: 1,
            step: 2,
            isCompleted: false,
            completedAt: null,
            completedBy: null,
            responseData: null
        },
        {
            fieldName: "siteLocation",
            dataType: "string",
            description: "The location of the project site",
            userFacingCopy: "Where is this site located?",
            isRequired: true,
            sortOrder: 2,
            step: 2,
            isCompleted: false,
            completedAt: null,
            completedBy: null,
            responseData: null
        }
        // Add more fallback tasks as needed
    ];
};
//# sourceMappingURL=projectSetup.service.js.map