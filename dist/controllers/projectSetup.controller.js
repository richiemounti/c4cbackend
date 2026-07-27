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
exports.getProjectSiteSetupProgressSummary = exports.getProjectSetupProgressSummary = exports.removeSiteSetupTaskFile = exports.removeProjectSetupTaskFile = exports.updateSiteSetupTaskData = exports.updateProjectSetupTaskData = exports.completeSiteSetupTask = exports.completeProjectSetupTask = exports.getProjectSiteSetup = exports.getProjectSetup = exports.initializeSiteSetup = exports.initializeSetup = void 0;
const projectSetupTask_model_1 = __importDefault(require("../models/projectSetupTask.model"));
const projectSiteSetupTask_model_1 = __importDefault(require("../models/projectSiteSetupTask.model"));
const project_model_1 = __importDefault(require("../models/project.model"));
const projectSite_model_1 = __importDefault(require("../models/projectSite.model"));
const projectSetup_service_1 = require("../services/projectSetup.service");
const cloudinaryStorage_service_1 = require("../services/cloudinaryStorage.service");
const reviewHelpers_1 = require("../utils/reviewHelpers");
// Using the existing types/express/index.d.ts definition
// No need to redeclare the User interface here
// Type guard to check if user is defined
/**
 * Type guard to check if user is authenticated
 * This tells TypeScript that when this function returns true,
 * req.user is definitely defined and of type Express.User
 */
function isUserAuthenticated(req) {
    return req.user !== undefined;
}
/**
 * Helper function to check if a field is empty based on data type
 */
function isFieldEmpty(data, dataType) {
    // Handle null or undefined
    if (data === null || data === undefined) {
        return true;
    }
    switch (dataType) {
        case 'string':
            // Empty if string is empty or only whitespace
            return typeof data === 'string' && data.trim() === '';
        case 'number':
            // Empty if not a valid number
            return isNaN(data) || data === null || data === undefined;
        case 'boolean':
            // ✅ FIX: Boolean is NEVER considered empty (both true and false are valid values)
            // Only null/undefined should be considered empty
            return data === null || data === undefined;
        case 'array':
            // Empty if not an array or array has no elements
            return !Array.isArray(data) || data.length === 0;
        case 'object':
            // Empty if object has no keys or is null
            if (typeof data !== 'object' || data === null)
                return true;
            return Object.keys(data).length === 0;
        case 'file':
            // Check for both single file and files array
            if (data && data.files && Array.isArray(data.files)) {
                return data.files.length === 0;
            }
            return !data || !data.filename;
        case 'date':
            // Empty if no date value
            return !data || data === '';
        default:
            // For unknown types, check if falsy BUT exclude false boolean
            if (typeof data === 'boolean')
                return false;
            return !data;
    }
}
/**
 * Returns true if the error is a MongoDB duplicate key error (code 11000).
 * Used to handle concurrent initialize requests gracefully — when two requests
 * race to create the same setup document, only one wins at the DB level and
 * the other gets this error. We catch it and return the existing doc instead
 * of letting it bubble up as a 500.
 */
function isDuplicateKeyError(err) {
    return (err === null || err === void 0 ? void 0 : err.code) === 11000;
}
/**
 * Boolean fields that conditionally trigger a file upload when the user selects "Yes".
 * Empty in the Youth Impact setup — no boolean fields require an accompanying file upload.
 */
const CONDITIONAL_UPLOAD_BOOLEAN_FIELDS = [];
/**
 * Initialize setup tasks for a project
 * @route POST /api/v1/projects/:projectId/setup/initialize
 * @access Private
 */
const initializeSetup = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { projectId } = req.params;
        const userId = req.user._id;
        const project = yield project_model_1.default.findById(projectId);
        if (!project) {
            const error = new Error('Project not found');
            error.statusCode = 404;
            throw error;
        }
        const isCreator = project.creator.toString() === userId.toString();
        const hasProjectAccess = req.user.hasProjectAccess(project._id);
        const isConnectGoStaff = req.user.isConnectGoStaff;
        if (!isCreator && !hasProjectAccess && !isConnectGoStaff) {
            const error = new Error('Not authorized to modify this project');
            error.statusCode = 403;
            throw error;
        }
        // CONCURRENCY GUARD
        // Two simultaneous requests (double-click, parallel component mounts) both
        // pass the auth check and both call initializeProjectSetup. The unique index
        // on `project` means only one insert succeeds at the DB level. The loser gets
        // a duplicate key error (11000) — we catch it and return the already-created
        // document instead of surfacing a 500.
        try {
            const projectSetup = yield (0, projectSetup_service_1.initializeProjectSetup)(projectId, userId);
            return res.status(201).json({
                success: true,
                message: 'Project setup initialized successfully',
                data: projectSetup,
            });
        }
        catch (initError) {
            if (isDuplicateKeyError(initError)) {
                const existing = yield projectSetupTask_model_1.default.findOne({ project: projectId });
                return res.status(200).json({
                    success: true,
                    message: 'Project setup already initialized',
                    data: existing,
                });
            }
            throw initError;
        }
    }
    catch (error) {
        next(error);
    }
});
exports.initializeSetup = initializeSetup;
/**
 * Initialize setup tasks for a project site
 * @route POST /api/v1/project-sites/:siteId/setup/initialize
 * @access Private
 */
const initializeSiteSetup = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { siteId } = req.params;
        const userId = req.user._id;
        const projectSite = yield projectSite_model_1.default.findById(siteId);
        if (!projectSite) {
            const error = new Error('Project site not found');
            error.statusCode = 404;
            throw error;
        }
        const isCreator = projectSite.creator.toString() === userId.toString();
        const hasProjectAccess = req.user.hasProjectAccess(projectSite.project);
        const isConnectGoStaff = req.user.isConnectGoStaff;
        if (!isCreator && !hasProjectAccess && !isConnectGoStaff) {
            const error = new Error('Not authorized to modify this project site');
            error.statusCode = 403;
            throw error;
        }
        // CONCURRENCY GUARD — same pattern as initializeSetup above
        try {
            const projectSiteSetup = yield (0, projectSetup_service_1.initializeProjectSiteSetup)(siteId, projectSite.project, userId);
            return res.status(201).json({
                success: true,
                message: 'Project site setup initialized successfully',
                data: projectSiteSetup,
            });
        }
        catch (initError) {
            if (isDuplicateKeyError(initError)) {
                const existing = yield projectSiteSetupTask_model_1.default.findOne({ projectSite: siteId });
                return res.status(200).json({
                    success: true,
                    message: 'Project site setup already initialized',
                    data: existing,
                });
            }
            throw initError;
        }
    }
    catch (error) {
        next(error);
    }
});
exports.initializeSiteSetup = initializeSiteSetup;
/**
 * Get project setup tasks
 * @route GET /api/v1/projects/:projectId/setup
 * @access Private
 */
const getProjectSetup = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { projectId } = req.params;
        const userId = req.user._id;
        const project = yield project_model_1.default.findById(projectId);
        if (!project) {
            const error = new Error('Project not found');
            error.statusCode = 404;
            throw error;
        }
        const hasProjectAccess = req.user.hasProjectAccess(project._id);
        const isConnectGoStaff = req.user.isConnectGoStaff;
        if (!hasProjectAccess && !isConnectGoStaff) {
            const error = new Error('Not authorized to access this project');
            error.statusCode = 403;
            throw error;
        }
        let projectSetup = yield projectSetupTask_model_1.default.findOne({ project: projectId });
        // AUTO-INIT FOR PRE-EXISTING PROJECTS
        // Projects created before the setup feature was added have no setup document.
        // Rather than returning isInitialized: false and forcing the client to make a
        // second POST request (which itself has a race condition), we initialize here
        // transparently on the first GET. The duplicate-key catch handles two
        // simultaneous GETs both finding nothing and both trying to create.
        if (!projectSetup) {
            try {
                projectSetup = yield (0, projectSetup_service_1.initializeProjectSetup)(projectId, userId);
            }
            catch (initError) {
                if (isDuplicateKeyError(initError)) {
                    // Another concurrent request just created it — fetch and continue
                    projectSetup = yield projectSetupTask_model_1.default.findOne({ project: projectId });
                }
                else {
                    throw initError;
                }
            }
        }
        // Final safety check — should never happen in practice
        if (!projectSetup) {
            return res.status(200).json({
                success: true,
                message: 'Project setup not initialized',
                data: { isInitialized: false, progress: 0, tasks: [] },
            });
        }
        // Log boolean tasks for debugging (kept from your original)
        projectSetup.tasks.forEach((task) => {
            if (task.dataType === 'boolean') {
                console.log(`📤 GET - Boolean Task: ${task.fieldName}`);
                console.log(`   responseData:`, task.responseData);
                console.log(`   Type:`, typeof task.responseData);
            }
        });
        // Process file URLs with correct resource type
        const tasks = yield Promise.all(projectSetup.tasks.map((task) => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            const taskObj = task.toObject();
            // Helper to generate signed URLs for an array of file objects
            const generateSignedUrls = (files) => __awaiter(void 0, void 0, void 0, function* () {
                return Promise.all(files.map((file) => __awaiter(void 0, void 0, void 0, function* () {
                    try {
                        let resourceType = 'raw';
                        if (file.mimeType) {
                            if (file.mimeType.startsWith('image/') || file.mimeType === 'application/pdf') {
                                resourceType = 'image';
                            }
                            else if (file.mimeType.startsWith('video/') || file.mimeType.startsWith('audio/')) {
                                resourceType = 'video';
                            }
                        }
                        const url = yield (0, cloudinaryStorage_service_1.getSignedUrl)(file.filename, 60, resourceType);
                        return Object.assign(Object.assign({}, file), { signedUrl: url, fileUrl: url });
                    }
                    catch (err) {
                        console.error(`Error generating signed URL for file: ${err}`);
                        return file;
                    }
                })));
            });
            if (task.dataType === 'file' && task.responseData) {
                if (task.responseData.files && Array.isArray(task.responseData.files)) {
                    taskObj.responseData = Object.assign(Object.assign({}, task.responseData), { files: yield generateSignedUrls(task.responseData.files) });
                }
                else if (task.responseData.filename) {
                    try {
                        let resourceType = 'raw';
                        if (task.responseData.mimeType) {
                            if (task.responseData.mimeType.startsWith('image/') || task.responseData.mimeType === 'application/pdf') {
                                resourceType = 'image';
                            }
                            else if (task.responseData.mimeType.startsWith('video/') || task.responseData.mimeType.startsWith('audio/')) {
                                resourceType = 'video';
                            }
                        }
                        const url = yield (0, cloudinaryStorage_service_1.getSignedUrl)(task.responseData.filename, 60, resourceType);
                        taskObj.responseData = Object.assign(Object.assign({}, task.responseData), { signedUrl: url, fileUrl: url });
                    }
                    catch (err) {
                        console.error(`Error generating signed URL for file: ${err}`);
                    }
                }
            }
            else if (task.dataType === 'boolean' &&
                CONDITIONAL_UPLOAD_BOOLEAN_FIELDS.includes(task.fieldName) &&
                ((_a = task.responseData) === null || _a === void 0 ? void 0 : _a.files) &&
                Array.isArray(task.responseData.files)) {
                // Generate signed URLs for conditional-upload boolean fields (stored as { confirmed, files })
                taskObj.responseData = Object.assign(Object.assign({}, task.responseData), { files: yield generateSignedUrls(task.responseData.files) });
            }
            return taskObj;
        })));
        return res.status(200).json({
            success: true,
            data: {
                isInitialized: true,
                progress: projectSetup.progress,
                isComplete: projectSetup.isComplete,
                completedAt: projectSetup.completedAt,
                tasks: tasks,
                _id: projectSetup._id,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getProjectSetup = getProjectSetup;
/**
 * Get project site setup tasks
 * @route GET /api/v1/project-sites/:siteId/setup
 * @access Private
 */
const getProjectSiteSetup = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { siteId } = req.params;
        const userId = req.user._id;
        const projectSite = yield projectSite_model_1.default.findById(siteId);
        if (!projectSite) {
            const error = new Error('Project site not found');
            error.statusCode = 404;
            throw error;
        }
        const hasProjectAccess = req.user.hasProjectAccess(projectSite.project);
        const isConnectGoStaff = req.user.isConnectGoStaff;
        if (!hasProjectAccess && !isConnectGoStaff) {
            const error = new Error('Not authorized to access this project site');
            error.statusCode = 403;
            throw error;
        }
        let siteSetup = yield projectSiteSetupTask_model_1.default.findOne({ projectSite: siteId });
        // AUTO-INIT FOR PRE-EXISTING SITES — same pattern as getProjectSetup above
        if (!siteSetup) {
            try {
                siteSetup = yield (0, projectSetup_service_1.initializeProjectSiteSetup)(siteId, projectSite.project, userId);
            }
            catch (initError) {
                if (isDuplicateKeyError(initError)) {
                    siteSetup = yield projectSiteSetupTask_model_1.default.findOne({ projectSite: siteId });
                }
                else {
                    throw initError;
                }
            }
        }
        // Final safety check
        if (!siteSetup) {
            return res.status(200).json({
                success: true,
                message: 'Project site setup not initialized',
                data: { isInitialized: false, progress: 0, tasks: [] },
            });
        }
        // Process file URLs — multi-file support + conditional-upload boolean fields
        const tasks = yield Promise.all(siteSetup.tasks.map((task) => __awaiter(void 0, void 0, void 0, function* () {
            var _a;
            const taskObj = task.toObject();
            // Helper to generate signed URLs for an array of file objects
            const generateSignedUrls = (files) => __awaiter(void 0, void 0, void 0, function* () {
                return Promise.all(files.map((file) => __awaiter(void 0, void 0, void 0, function* () {
                    try {
                        let resourceType = 'raw';
                        if (file.mimeType) {
                            if (file.mimeType.startsWith('image/') || file.mimeType === 'application/pdf') {
                                resourceType = 'image';
                            }
                            else if (file.mimeType.startsWith('video/') || file.mimeType.startsWith('audio/')) {
                                resourceType = 'video';
                            }
                        }
                        const url = yield (0, cloudinaryStorage_service_1.getSignedUrl)(file.filename, 60, resourceType);
                        return Object.assign(Object.assign({}, file), { signedUrl: url, fileUrl: url });
                    }
                    catch (err) {
                        console.error(`Error generating signed URL for file: ${err}`);
                        return file;
                    }
                })));
            });
            if (task.dataType === 'file' && task.responseData) {
                if (task.responseData.files && Array.isArray(task.responseData.files)) {
                    taskObj.responseData = Object.assign(Object.assign({}, task.responseData), { files: yield generateSignedUrls(task.responseData.files) });
                }
                else if (task.responseData.filename) {
                    // Single file fallback (backward compatibility)
                    try {
                        const url = yield (0, cloudinaryStorage_service_1.getSignedUrl)(task.responseData.filename);
                        taskObj.responseData = Object.assign(Object.assign({}, task.responseData), { signedUrl: url });
                    }
                    catch (err) {
                        console.error(`Error generating signed URL for file: ${err}`);
                    }
                }
            }
            else if (task.dataType === 'boolean' &&
                CONDITIONAL_UPLOAD_BOOLEAN_FIELDS.includes(task.fieldName) &&
                ((_a = task.responseData) === null || _a === void 0 ? void 0 : _a.files) &&
                Array.isArray(task.responseData.files)) {
                // Generate signed URLs for conditional-upload boolean fields (stored as { confirmed, files })
                taskObj.responseData = Object.assign(Object.assign({}, task.responseData), { files: yield generateSignedUrls(task.responseData.files) });
            }
            return taskObj;
        })));
        return res.status(200).json({
            success: true,
            data: {
                isInitialized: true,
                progress: siteSetup.progress,
                isComplete: siteSetup.isComplete,
                completedAt: siteSetup.completedAt,
                tasks: tasks,
                _id: siteSetup._id,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getProjectSiteSetup = getProjectSiteSetup;
/**
 * Mark a project setup task as completed
 * @route PUT /api/v1/project-setup/:setupId/tasks/:taskId/complete
 * @access Private
 */
const completeProjectSetupTask = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Verify user is authenticated
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { setupId, taskId } = req.params;
        const userId = req.user._id;
        const { responseData } = req.body;
        // Get the setup to check permissions and the task details
        const projectSetup = yield projectSetupTask_model_1.default.findById(setupId);
        if (!projectSetup) {
            const error = new Error('Project setup not found');
            error.statusCode = 404;
            throw error;
        }
        // Find the specific task to get its data type
        const task = projectSetup.tasks.find(task => task._id.toString() === taskId);
        if (!task) {
            const error = new Error('Task not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if user has permission to modify this project
        const project = yield project_model_1.default.findById(projectSetup.project);
        if (!project) {
            const error = new Error('Project not found');
            error.statusCode = 404;
            throw error;
        }
        const hasProjectAccess = req.user.hasProjectAccess(project._id);
        const isConnectGoStaff = req.user.isConnectGoStaff;
        if (!hasProjectAccess && !isConnectGoStaff) {
            const error = new Error('Not authorized to modify this project setup');
            error.statusCode = 403;
            throw error;
        }
        // ✅ UPDATED: Handle multiple file uploads
        let processedResponseData = responseData;
        if (task.dataType === 'file') {
            const files = req.files;
            if (files && files.length > 0) {
                // Upload all files to Cloudinary
                const uploadedFiles = yield Promise.all(files.map(file => (0, cloudinaryStorage_service_1.uploadFile)(file, `project-setup/${projectSetup.project}/task-${taskId}`)));
                // Store array of file metadata
                processedResponseData = {
                    files: uploadedFiles.map(uf => ({
                        filename: uf.filename,
                        fileUrl: uf.fileUrl,
                        size: uf.size,
                        mimeType: uf.mimeType,
                        originalName: uf.originalName,
                    })),
                    uploadedAt: new Date(),
                };
            }
        }
        else if (task.dataType === 'boolean' && CONDITIONAL_UPLOAD_BOOLEAN_FIELDS.includes(task.fieldName)) {
            // Boolean field that conditionally triggers a file upload when the user selects Yes
            if (processedResponseData === true || processedResponseData === 'true') {
                const files = req.files;
                if (files && files.length > 0) {
                    const uploadedFiles = yield Promise.all(files.map(file => (0, cloudinaryStorage_service_1.uploadFile)(file, `project-setup/${projectSetup.project}/task-${taskId}`)));
                    processedResponseData = {
                        confirmed: true,
                        files: uploadedFiles.map(uf => ({
                            filename: uf.filename,
                            fileUrl: uf.fileUrl,
                            size: uf.size,
                            mimeType: uf.mimeType,
                            originalName: uf.originalName,
                        })),
                        uploadedAt: new Date(),
                    };
                }
                // Yes but no files → store plain true; user can add files via Update later
            }
            // false → processedResponseData stays as false
        }
        const updatedSetup = yield (0, projectSetup_service_1.completeSetupTask)(setupId, taskId, userId, processedResponseData, false);
        // ✅ AUTO-TRIGGER: Create review for completed task
        try {
            // Find the task index
            const taskIndex = updatedSetup.tasks.findIndex((t) => t._id.toString() === taskId);
            if (taskIndex !== -1) {
                // Populate project with organization
                const populatedSetup = yield projectSetupTask_model_1.default.findById(setupId).populate({
                    path: 'project',
                    populate: { path: 'organization' }
                });
                if (populatedSetup) {
                    yield (0, reviewHelpers_1.createProjectSetupTaskReview)(populatedSetup, taskIndex, userId);
                    console.log(`✅ Review created for project setup task: ${task.fieldLabel}`);
                }
            }
        }
        catch (reviewError) {
            // Log error but don't fail the request
            console.error('Failed to create review for project setup task:', reviewError);
        }
        res.status(200).json({
            success: true,
            message: 'Project setup task completed successfully',
            data: {
                progress: updatedSetup.progress,
                isComplete: updatedSetup.isComplete,
                tasks: updatedSetup.tasks
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.completeProjectSetupTask = completeProjectSetupTask;
/**
 * Mark a project site setup task as completed
 * @route PUT /api/v1/project-site-setup/:setupId/tasks/:taskId/complete
 * @access Private
 */
const completeSiteSetupTask = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Verify user is authenticated
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { setupId, taskId } = req.params;
        const userId = req.user._id;
        const { responseData } = req.body;
        // Get the setup to check permissions and task details
        const siteSetup = yield projectSiteSetupTask_model_1.default.findById(setupId);
        if (!siteSetup) {
            const error = new Error('Project site setup not found');
            error.statusCode = 404;
            throw error;
        }
        // Find the specific task to get its data type
        const task = siteSetup.tasks.find(task => task._id.toString() === taskId);
        if (!task) {
            const error = new Error('Task not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if user has permission to modify this project site
        const hasProjectAccess = req.user.hasProjectAccess(siteSetup.project);
        const isConnectGoStaff = req.user.isConnectGoStaff;
        if (!hasProjectAccess && !isConnectGoStaff) {
            const error = new Error('Not authorized to modify this project site setup');
            error.statusCode = 403;
            throw error;
        }
        // ✅ UPDATED: Handle multiple file uploads
        let processedResponseData = responseData;
        if (task.dataType === 'file') {
            const files = req.files;
            if (files && files.length > 0) {
                // Upload all files to Cloudinary
                const uploadedFiles = yield Promise.all(files.map(file => (0, cloudinaryStorage_service_1.uploadFile)(file, `project-site-setup/${siteSetup.projectSite}/task-${taskId}`)));
                // Store array of file metadata
                processedResponseData = {
                    files: uploadedFiles.map(uf => ({
                        filename: uf.filename,
                        fileUrl: uf.fileUrl,
                        size: uf.size,
                        mimeType: uf.mimeType,
                        originalName: uf.originalName,
                    })),
                    uploadedAt: new Date(),
                };
            }
        }
        else if (task.dataType === 'boolean' && CONDITIONAL_UPLOAD_BOOLEAN_FIELDS.includes(task.fieldName)) {
            // Boolean field that conditionally triggers a file upload when the user selects Yes
            if (processedResponseData === true || processedResponseData === 'true') {
                const files = req.files;
                if (files && files.length > 0) {
                    const uploadedFiles = yield Promise.all(files.map(file => (0, cloudinaryStorage_service_1.uploadFile)(file, `project-site-setup/${siteSetup.projectSite}/task-${taskId}`)));
                    processedResponseData = {
                        confirmed: true,
                        files: uploadedFiles.map(uf => ({
                            filename: uf.filename,
                            fileUrl: uf.fileUrl,
                            size: uf.size,
                            mimeType: uf.mimeType,
                            originalName: uf.originalName,
                        })),
                        uploadedAt: new Date(),
                    };
                }
                // Yes but no files → store plain true; user can add files via Update later
            }
            // false → processedResponseData stays as false
        }
        const updatedSetup = yield (0, projectSetup_service_1.completeSetupTask)(setupId, taskId, userId, processedResponseData, true);
        // ✅ AUTO-TRIGGER: Create review for completed site setup task
        try {
            // Find the task index
            const taskIndex = updatedSetup.tasks.findIndex((t) => t._id.toString() === taskId);
            if (taskIndex !== -1) {
                // Populate project and projectSite with organization
                const populatedSetup = yield projectSiteSetupTask_model_1.default.findById(setupId).populate({
                    path: 'project',
                    populate: { path: 'organization' }
                });
                if (populatedSetup) {
                    yield (0, reviewHelpers_1.createProjectSiteSetupTaskReview)(populatedSetup, taskIndex, userId);
                    console.log(`✅ Review created for project site setup task: ${task.fieldLabel}`);
                }
            }
        }
        catch (reviewError) {
            // Log error but don't fail the request
            console.error('Failed to create review for project site setup task:', reviewError);
        }
        res.status(200).json({
            success: true,
            message: 'Project site setup task completed successfully',
            data: {
                progress: updatedSetup.progress,
                isComplete: updatedSetup.isComplete,
                tasks: updatedSetup.tasks
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.completeSiteSetupTask = completeSiteSetupTask;
/**
 * Update task data without marking as complete
 * @route PATCH /api/v1/project-setup/:setupId/tasks/:taskId/data
 * @access Private
 */
const updateProjectSetupTaskData = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { setupId, taskId } = req.params;
        const userId = req.user._id;
        const { responseData } = req.body;
        const projectSetup = yield projectSetupTask_model_1.default.findById(setupId);
        if (!projectSetup) {
            const error = new Error('Project setup not found');
            error.statusCode = 404;
            throw error;
        }
        const task = projectSetup.tasks.find(task => task._id.toString() === taskId);
        if (!task) {
            const error = new Error('Task not found');
            error.statusCode = 404;
            throw error;
        }
        const project = yield project_model_1.default.findById(projectSetup.project);
        if (!project) {
            const error = new Error('Project not found');
            error.statusCode = 404;
            throw error;
        }
        const hasProjectAccess = req.user.hasProjectAccess(project._id);
        const isConnectGoStaff = req.user.isConnectGoStaff;
        if (!hasProjectAccess && !isConnectGoStaff) {
            const error = new Error('Not authorized to modify this project setup');
            error.statusCode = 403;
            throw error;
        }
        // ✅ NEW: Handle multiple file uploads with APPEND logic
        let processedResponseData = responseData;
        if (task.dataType === 'file') {
            const files = req.files;
            if (files && files.length > 0) {
                // Upload all NEW files to Cloudinary
                const uploadedFiles = yield Promise.all(files.map(file => (0, cloudinaryStorage_service_1.uploadFile)(file, `project-setup/${projectSetup.project}/task-${taskId}`)));
                const newFiles = uploadedFiles.map(uf => ({
                    filename: uf.filename,
                    fileUrl: uf.fileUrl,
                    size: uf.size,
                    mimeType: uf.mimeType,
                    originalName: uf.originalName,
                }));
                // ✅ APPEND new files to existing files instead of replacing
                const existingFiles = ((_a = task.responseData) === null || _a === void 0 ? void 0 : _a.files) || [];
                processedResponseData = {
                    files: [...existingFiles, ...newFiles],
                    uploadedAt: new Date(),
                };
            }
            else {
                // No new files uploaded, keep existing data
                processedResponseData = task.responseData;
            }
        }
        else if (task.dataType === 'boolean' && CONDITIONAL_UPLOAD_BOOLEAN_FIELDS.includes(task.fieldName)) {
            // Boolean field that conditionally triggers a file upload when the user selects Yes
            if (processedResponseData === true || processedResponseData === 'true') {
                const files = req.files;
                if (files && files.length > 0) {
                    const uploadedFiles = yield Promise.all(files.map(file => (0, cloudinaryStorage_service_1.uploadFile)(file, `project-setup/${projectSetup.project}/task-${taskId}`)));
                    const newFiles = uploadedFiles.map(uf => ({
                        filename: uf.filename,
                        fileUrl: uf.fileUrl,
                        size: uf.size,
                        mimeType: uf.mimeType,
                        originalName: uf.originalName,
                    }));
                    // APPEND to any previously uploaded files
                    const existingFiles = ((_b = task.responseData) === null || _b === void 0 ? void 0 : _b.files) || [];
                    processedResponseData = {
                        confirmed: true,
                        files: [...existingFiles, ...newFiles],
                        uploadedAt: new Date(),
                    };
                }
                else {
                    // Yes with no new files — preserve existing confirmed state if present
                    if ((_c = task.responseData) === null || _c === void 0 ? void 0 : _c.confirmed) {
                        processedResponseData = task.responseData;
                    }
                    // else stays as plain true
                }
            }
            // false → processedResponseData stays as false (clears any previously confirmed state)
        }
        // ✅ FIX: Add logging for debugging boolean values
        if (task.dataType === 'boolean') {
            console.log(`📝 Updating boolean task: ${task.fieldName}`);
            console.log(`   Incoming responseData:`, processedResponseData);
            console.log(`   Type:`, typeof processedResponseData);
        }
        // ✅ Check if field is empty and mark as incomplete
        const isEmpty = isFieldEmpty(processedResponseData, task.dataType);
        console.log(`   Is Empty: ${isEmpty}`);
        if (isEmpty && task.isCompleted) {
            task.isCompleted = false;
            task.completedAt = undefined;
            task.completedBy = undefined;
        }
        // ✅ FIX: Set responseData - ensure false boolean values are preserved
        task.responseData = processedResponseData;
        // ✅ Mark as modified for Mongoose
        task.markModified('responseData');
        projectSetup.lastUpdatedBy = userId;
        projectSetup.calculateProgress();
        yield projectSetup.save();
        // ✅ FIX: Add logging after save
        if (task.dataType === 'boolean') {
            console.log(`   Saved responseData:`, task.responseData);
            console.log(`   Task completed: ${task.isCompleted}`);
        }
        // ✅ BACKFILL: Create review if task is completed but has no existing review
        // Handles tasks that were completed before the review feature was introduced
        if (task.isCompleted) {
            try {
                const reviewAlreadyExists = yield (0, reviewHelpers_1.reviewExistsForModuleItem)('project_setup', projectSetup._id, taskId);
                if (!reviewAlreadyExists) {
                    console.log(`🔄 Backfilling review for project setup task: ${task.fieldLabel}`);
                    const populatedSetup = yield projectSetupTask_model_1.default.findById(setupId).populate({
                        path: 'project',
                        populate: { path: 'organization' }
                    });
                    if (populatedSetup) {
                        const taskIndex = populatedSetup.tasks.findIndex((t) => t._id.toString() === taskId);
                        if (taskIndex !== -1) {
                            yield (0, reviewHelpers_1.createProjectSetupTaskReview)(populatedSetup, taskIndex, userId);
                            console.log(`✅ Backfill review created for project setup task: ${task.fieldLabel}`);
                        }
                    }
                }
            }
            catch (reviewError) {
                // Don't fail the request if review creation fails
                console.error('Failed to backfill review for project setup task:', reviewError);
            }
        }
        res.status(200).json({
            success: true,
            message: 'Project setup task data updated successfully',
            data: {
                task: projectSetup.tasks.find((t) => t._id.toString() === taskId)
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.updateProjectSetupTaskData = updateProjectSetupTaskData;
/**
 * Update task data without marking as complete
 * @route PATCH /api/v1/project-site-setup/:setupId/tasks/:taskId/data
 * @access Private
 */
const updateSiteSetupTaskData = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c;
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { setupId, taskId } = req.params;
        const userId = req.user._id;
        const { responseData } = req.body;
        const siteSetup = yield projectSiteSetupTask_model_1.default.findById(setupId);
        if (!siteSetup) {
            const error = new Error('Project site setup not found');
            error.statusCode = 404;
            throw error;
        }
        const task = siteSetup.tasks.find(task => task._id.toString() === taskId);
        if (!task) {
            const error = new Error('Task not found');
            error.statusCode = 404;
            throw error;
        }
        const hasProjectAccess = req.user.hasProjectAccess(siteSetup.project);
        const isConnectGoStaff = req.user.isConnectGoStaff;
        if (!hasProjectAccess && !isConnectGoStaff) {
            const error = new Error('Not authorized to modify this project site setup');
            error.statusCode = 403;
            throw error;
        }
        // ✅ NEW: Handle multiple file uploads with APPEND logic
        let processedResponseData = responseData;
        if (task.dataType === 'file') {
            const files = req.files;
            if (files && files.length > 0) {
                // Upload all NEW files to Cloudinary
                const uploadedFiles = yield Promise.all(files.map(file => (0, cloudinaryStorage_service_1.uploadFile)(file, `project-site-setup/${siteSetup.projectSite}/task-${taskId}`)));
                const newFiles = uploadedFiles.map(uf => ({
                    filename: uf.filename,
                    fileUrl: uf.fileUrl,
                    size: uf.size,
                    mimeType: uf.mimeType,
                    originalName: uf.originalName,
                }));
                // ✅ APPEND new files to existing files instead of replacing
                const existingFiles = ((_a = task.responseData) === null || _a === void 0 ? void 0 : _a.files) || [];
                processedResponseData = {
                    files: [...existingFiles, ...newFiles],
                    uploadedAt: new Date(),
                };
            }
            else {
                // No new files uploaded, keep existing data
                processedResponseData = task.responseData;
            }
        }
        else if (task.dataType === 'boolean' && CONDITIONAL_UPLOAD_BOOLEAN_FIELDS.includes(task.fieldName)) {
            // Boolean field that conditionally triggers a file upload when the user selects Yes
            if (processedResponseData === true || processedResponseData === 'true') {
                const files = req.files;
                if (files && files.length > 0) {
                    const uploadedFiles = yield Promise.all(files.map(file => (0, cloudinaryStorage_service_1.uploadFile)(file, `project-site-setup/${siteSetup.projectSite}/task-${taskId}`)));
                    const newFiles = uploadedFiles.map(uf => ({
                        filename: uf.filename,
                        fileUrl: uf.fileUrl,
                        size: uf.size,
                        mimeType: uf.mimeType,
                        originalName: uf.originalName,
                    }));
                    // APPEND to any previously uploaded files
                    const existingFiles = ((_b = task.responseData) === null || _b === void 0 ? void 0 : _b.files) || [];
                    processedResponseData = {
                        confirmed: true,
                        files: [...existingFiles, ...newFiles],
                        uploadedAt: new Date(),
                    };
                }
                else {
                    // Yes with no new files — preserve existing confirmed state if present
                    if ((_c = task.responseData) === null || _c === void 0 ? void 0 : _c.confirmed) {
                        processedResponseData = task.responseData;
                    }
                    // else stays as plain true
                }
            }
            // false → processedResponseData stays as false (clears any previously confirmed state)
        }
        // ✅ FIX: Add logging for debugging boolean values
        if (task.dataType === 'boolean') {
            console.log(`📝 Updating boolean task: ${task.fieldName}`);
            console.log(`   Incoming responseData:`, processedResponseData);
            console.log(`   Type:`, typeof processedResponseData);
        }
        // ✅ Check if field is empty and mark as incomplete
        const isEmpty = isFieldEmpty(processedResponseData, task.dataType);
        console.log(`   Is Empty: ${isEmpty}`);
        if (isEmpty && task.isCompleted) {
            task.set('isCompleted', false);
            task.set('completedAt', null);
            task.set('completedBy', null);
        }
        // ✅ FIX: Set responseData - ensure false boolean values are preserved
        task.responseData = processedResponseData;
        // ✅ Mark as modified for Mongoose
        task.markModified('responseData');
        task.updatedAt = new Date();
        siteSetup.lastUpdatedBy = userId;
        siteSetup.calculateProgress();
        yield siteSetup.save();
        // ✅ FIX: Add logging after save
        if (task.dataType === 'boolean') {
            console.log(`   Saved responseData:`, task.responseData);
            console.log(`   Task completed: ${task.isCompleted}`);
        }
        // ✅ BACKFILL: Create review if task is completed but has no existing review
        // Handles tasks that were completed before the review feature was introduced
        if (task.isCompleted) {
            try {
                const reviewAlreadyExists = yield (0, reviewHelpers_1.reviewExistsForModuleItem)('project_site_setup', siteSetup._id, taskId);
                if (!reviewAlreadyExists) {
                    console.log(`🔄 Backfilling review for site setup task: ${task.fieldLabel}`);
                    const populatedSetup = yield projectSiteSetupTask_model_1.default.findById(setupId).populate({
                        path: 'project',
                        populate: { path: 'organization' }
                    });
                    if (populatedSetup) {
                        const taskIndex = populatedSetup.tasks.findIndex((t) => t._id.toString() === taskId);
                        if (taskIndex !== -1) {
                            yield (0, reviewHelpers_1.createProjectSiteSetupTaskReview)(populatedSetup, taskIndex, userId);
                            console.log(`✅ Backfill review created for site setup task: ${task.fieldLabel}`);
                        }
                    }
                }
            }
            catch (reviewError) {
                // Don't fail the request if review creation fails
                console.error('Failed to backfill review for site setup task:', reviewError);
            }
        }
        res.status(200).json({
            success: true,
            message: 'Project site setup task data updated successfully',
            data: {
                task: siteSetup.tasks.find((t) => t._id.toString() === taskId)
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.updateSiteSetupTaskData = updateSiteSetupTaskData;
/**
 * Remove a specific file from task
 * @route DELETE /api/v1/project-setup/:setupId/tasks/:taskId/files/:filename
 * @access Private
 */
const removeProjectSetupTaskFile = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { setupId, taskId, filename } = req.params;
        const userId = req.user._id;
        const decodedFilename = decodeURIComponent(filename);
        const projectSetup = yield projectSetupTask_model_1.default.findById(setupId);
        if (!projectSetup) {
            const error = new Error('Project setup not found');
            error.statusCode = 404;
            throw error;
        }
        const task = projectSetup.tasks.find(task => task._id.toString() === taskId);
        if (!task) {
            const error = new Error('Task not found');
            error.statusCode = 404;
            throw error;
        }
        const project = yield project_model_1.default.findById(projectSetup.project);
        if (!project) {
            const error = new Error('Project not found');
            error.statusCode = 404;
            throw error;
        }
        const hasProjectAccess = req.user.hasProjectAccess(project._id);
        const isConnectGoStaff = req.user.isConnectGoStaff;
        if (!hasProjectAccess && !isConnectGoStaff) {
            const error = new Error('Not authorized to modify this project setup');
            error.statusCode = 403;
            throw error;
        }
        if ((_a = task.responseData) === null || _a === void 0 ? void 0 : _a.files) {
            const fileToRemove = task.responseData.files.find((file) => file.filename === decodedFilename);
            if (!fileToRemove) {
                const error = new Error('File not found in task');
                error.statusCode = 404;
                throw error;
            }
            console.log(`📝 Before deletion - File count: ${task.responseData.files.length}`);
            console.log(`📝 Files:`, task.responseData.files.map((f) => f.filename));
            // ✅ FIX: Filter out the file
            task.responseData.files = task.responseData.files.filter((file) => file.filename !== decodedFilename);
            console.log(`📝 After deletion - File count: ${task.responseData.files.length}`);
            console.log(`📝 Files:`, task.responseData.files.map((f) => f.filename));
            // ✅ FIX: Delete from Cloudinary
            try {
                let resourceType = 'raw';
                if (fileToRemove.mimeType) {
                    if (fileToRemove.mimeType.startsWith('image/') || fileToRemove.mimeType === 'application/pdf') {
                        resourceType = 'image';
                    }
                    else if (fileToRemove.mimeType.startsWith('video/') || fileToRemove.mimeType.startsWith('audio/')) {
                        resourceType = 'video';
                    }
                }
                console.log(`Attempting to delete file from Cloudinary:`);
                console.log(`  Public ID: ${decodedFilename}`);
                console.log(`  Resource Type: ${resourceType}`);
                yield (0, cloudinaryStorage_service_1.deleteFile)(decodedFilename, resourceType);
                console.log(`✅ File deleted from Cloudinary: ${decodedFilename}`);
            }
            catch (err) {
                console.error('Error deleting file from Cloudinary:', err);
            }
            // ✅ FIX: Mark the entire responseData as modified for Mongoose to detect changes
            task.markModified('responseData');
            // Check if now empty and mark as incomplete
            if (task.responseData.files.length === 0 && task.isCompleted) {
                task.isCompleted = false;
                task.completedAt = undefined;
                task.completedBy = undefined;
            }
            projectSetup.lastUpdatedBy = userId;
            projectSetup.calculateProgress();
            // ✅ FIX: Save and wait for confirmation
            const savedSetup = yield projectSetup.save();
            console.log(`💾 Saved to database - File count: ${((_d = (_c = (_b = savedSetup.tasks.find((t) => t._id.toString() === taskId)) === null || _b === void 0 ? void 0 : _b.responseData) === null || _c === void 0 ? void 0 : _c.files) === null || _d === void 0 ? void 0 : _d.length) || 0}`);
            res.status(200).json({
                success: true,
                message: 'File removed successfully',
                data: {
                    task: savedSetup.tasks.find((t) => t._id.toString() === taskId),
                    deletedFile: fileToRemove.originalName || decodedFilename
                }
            });
        }
        else {
            const error = new Error('No files found in task');
            error.statusCode = 404;
            throw error;
        }
    }
    catch (error) {
        next(error);
    }
});
exports.removeProjectSetupTaskFile = removeProjectSetupTaskFile;
/**
 * Remove a specific file from project site task
 * @route DELETE /api/v1/project-site-setup/:setupId/tasks/:taskId/files/:filename
 * @access Private
 */
const removeSiteSetupTaskFile = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { setupId, taskId, filename } = req.params;
        const userId = req.user._id;
        const decodedFilename = decodeURIComponent(filename);
        const siteSetup = yield projectSiteSetupTask_model_1.default.findById(setupId);
        if (!siteSetup) {
            const error = new Error('Project site setup not found');
            error.statusCode = 404;
            throw error;
        }
        const task = siteSetup.tasks.find(task => task._id.toString() === taskId);
        if (!task) {
            const error = new Error('Task not found');
            error.statusCode = 404;
            throw error;
        }
        const hasProjectAccess = req.user.hasProjectAccess(siteSetup.project);
        const isConnectGoStaff = req.user.isConnectGoStaff;
        if (!hasProjectAccess && !isConnectGoStaff) {
            const error = new Error('Not authorized to modify this project site setup');
            error.statusCode = 403;
            throw error;
        }
        if ((_a = task.responseData) === null || _a === void 0 ? void 0 : _a.files) {
            const fileToRemove = task.responseData.files.find((file) => file.filename === decodedFilename);
            if (!fileToRemove) {
                const error = new Error('File not found in task');
                error.statusCode = 404;
                throw error;
            }
            console.log(`📝 Before deletion - File count: ${task.responseData.files.length}`);
            console.log(`📝 Files:`, task.responseData.files.map((f) => f.filename));
            // Filter out the file
            task.responseData.files = task.responseData.files.filter((file) => file.filename !== decodedFilename);
            console.log(`📝 After deletion - File count: ${task.responseData.files.length}`);
            console.log(`📝 Files:`, task.responseData.files.map((f) => f.filename));
            // Delete from Cloudinary
            try {
                let resourceType = 'raw';
                if (fileToRemove.mimeType) {
                    if (fileToRemove.mimeType.startsWith('image/') || fileToRemove.mimeType === 'application/pdf') {
                        resourceType = 'image';
                    }
                    else if (fileToRemove.mimeType.startsWith('video/') || fileToRemove.mimeType.startsWith('audio/')) {
                        resourceType = 'video';
                    }
                }
                console.log(`Attempting to delete file from Cloudinary:`);
                console.log(`  Public ID: ${decodedFilename}`);
                console.log(`  Resource Type: ${resourceType}`);
                yield (0, cloudinaryStorage_service_1.deleteFile)(decodedFilename, resourceType);
                console.log(`✅ File deleted from Cloudinary: ${decodedFilename}`);
            }
            catch (err) {
                console.error('Error deleting file from Cloudinary:', err);
            }
            // ✅ FIX: Mark the entire responseData as modified for Mongoose to detect changes
            task.markModified('responseData');
            // Check if now empty and mark as incomplete if it was completed
            if (task.responseData.files.length === 0 && task.isCompleted) {
                task.set('isCompleted', false);
                task.set('completedAt', null);
                task.set('completedBy', null);
            }
            siteSetup.lastUpdatedBy = userId;
            task.updatedAt = new Date();
            siteSetup.calculateProgress();
            // ✅ FIX: Save and wait for confirmation
            const savedSetup = yield siteSetup.save();
            console.log(`💾 Saved to database - File count: ${((_d = (_c = (_b = savedSetup.tasks.find((t) => t._id.toString() === taskId)) === null || _b === void 0 ? void 0 : _b.responseData) === null || _c === void 0 ? void 0 : _c.files) === null || _d === void 0 ? void 0 : _d.length) || 0}`);
            res.status(200).json({
                success: true,
                message: 'File removed successfully',
                data: {
                    task: savedSetup.tasks.find((t) => t._id.toString() === taskId),
                    deletedFile: fileToRemove.originalName || decodedFilename
                }
            });
        }
        else {
            const error = new Error('No files found in task');
            error.statusCode = 404;
            throw error;
        }
    }
    catch (error) {
        next(error);
    }
});
exports.removeSiteSetupTaskFile = removeSiteSetupTaskFile;
/**
 * Get project setup progress summary
 * @route GET /api/v1/projects/:projectId/setup/progress
 * @access Private
 */
const getProjectSetupProgressSummary = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Verify user is authenticated
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { projectId } = req.params;
        // Check if project exists
        const project = yield project_model_1.default.findById(projectId);
        if (!project) {
            const error = new Error('Project not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if user has permission to access this project
        const hasProjectAccess = req.user.hasProjectAccess(project._id);
        const isConnectGoStaff = req.user.isConnectGoStaff;
        if (!hasProjectAccess && !isConnectGoStaff) {
            const error = new Error('Not authorized to access this project');
            error.statusCode = 403;
            throw error;
        }
        // Get the project setup progress
        const progress = yield (0, projectSetup_service_1.getProjectSetupProgress)(projectId);
        res.status(200).json({
            success: true,
            data: progress
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getProjectSetupProgressSummary = getProjectSetupProgressSummary;
/**
 * Get project site setup progress summary
 * @route GET /api/v1/project-sites/:siteId/setup/progress
 * @access Private
 */
const getProjectSiteSetupProgressSummary = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Verify user is authenticated
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const { siteId } = req.params;
        // Check if project site exists
        const projectSite = yield projectSite_model_1.default.findById(siteId);
        if (!projectSite) {
            const error = new Error('Project site not found');
            error.statusCode = 404;
            throw error;
        }
        // Check if user has permission to access this project site
        const hasProjectAccess = req.user.hasProjectAccess(projectSite.project);
        const isConnectGoStaff = req.user.isConnectGoStaff;
        if (!hasProjectAccess && !isConnectGoStaff) {
            const error = new Error('Not authorized to access this project site');
            error.statusCode = 403;
            throw error;
        }
        // Get the project site setup progress
        const progress = yield (0, projectSetup_service_1.getProjectSiteSetupProgress)(siteId);
        res.status(200).json({
            success: true,
            data: progress
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getProjectSiteSetupProgressSummary = getProjectSiteSetupProgressSummary;
//# sourceMappingURL=projectSetup.controller.js.map