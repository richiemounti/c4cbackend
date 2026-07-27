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
exports.updateSpecificTask = exports.updateProjectSiteTasks = exports.updateProjectTasks = void 0;
const taskUpdate_service_1 = __importDefault(require("../services/taskUpdate.service"));
// Type guard for authenticated user
function isUserAuthenticated(req) {
    return req.user !== undefined;
}
/**
 * Apply project task modifications
 * @route POST /api/v1/admin/tasks/update-project-tasks
 * @access Private (Admin only)
 */
const updateProjectTasks = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Verify user is authenticated and is admin
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        // Check if user has admin rights (adjust this based on your auth system)
        if (!req.user.isConnectGoStaff) {
            const error = new Error('Admin access required');
            error.statusCode = 403;
            throw error;
        }
        const { dryRun = true } = req.body;
        console.log(`Starting project task modifications (dryRun: ${dryRun})`);
        const results = yield taskUpdate_service_1.default.applyProjectTaskModifications(dryRun);
        const summary = {
            totalModifications: results.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            totalProjectsAffected: results.reduce((sum, r) => { var _a, _b; return sum + (((_a = r.setupResult) === null || _a === void 0 ? void 0 : _a.affectedProjects) || ((_b = r.setupResult) === null || _b === void 0 ? void 0 : _b.projectsUpdated) || 0); }, 0)
        };
        res.status(200).json({
            success: true,
            message: dryRun ? 'Project task modifications simulated successfully' : 'Project task modifications applied successfully',
            data: {
                dryRun,
                summary,
                details: results
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.updateProjectTasks = updateProjectTasks;
/**
 * Apply project site task modifications
 * @route POST /api/v1/admin/tasks/update-project-site-tasks
 * @access Private (Admin only)
 */
const updateProjectSiteTasks = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Verify user is authenticated and is admin
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        // Check if user has admin rights (adjust this based on your auth system)
        if (!req.user.isConnectGoStaff) {
            const error = new Error('Admin access required');
            error.statusCode = 403;
            throw error;
        }
        const { dryRun = true } = req.body;
        console.log(`Starting project site task modifications (dryRun: ${dryRun})`);
        const results = yield taskUpdate_service_1.default.applyProjectSiteTaskModifications(dryRun);
        const summary = {
            totalModifications: results.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            totalSitesAffected: results.reduce((sum, r) => { var _a, _b; return sum + (((_a = r.setupResult) === null || _a === void 0 ? void 0 : _a.affectedSites) || ((_b = r.setupResult) === null || _b === void 0 ? void 0 : _b.sitesUpdated) || 0); }, 0)
        };
        res.status(200).json({
            success: true,
            message: dryRun ? 'Project site task modifications simulated successfully' : 'Project site task modifications applied successfully',
            data: {
                dryRun,
                summary,
                details: results
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.updateProjectSiteTasks = updateProjectSiteTasks;
/**
 * Update specific task globally
 * @route POST /api/v1/admin/tasks/update-task
 * @access Private (Admin only)
 */
const updateSpecificTask = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        if (!req.user.isConnectGoStaff) {
            const error = new Error('Admin access required');
            error.statusCode = 403;
            throw error;
        }
        const { fieldName, updates, dryRun = true, onlyIncompleted = false, setupType = 'both' } = req.body;
        if (!fieldName) {
            const error = new Error('fieldName is required');
            error.statusCode = 400;
            throw error;
        }
        if (!updates || Object.keys(updates).length === 0) {
            const error = new Error('updates object is required');
            error.statusCode = 400;
            throw error;
        }
        const result = yield taskUpdate_service_1.default.updateTaskGlobally(fieldName, updates, { dryRun, onlyIncompleted, setupType });
        res.status(200).json({
            success: true,
            message: dryRun ? 'Task update simulated successfully' : 'Task updated successfully',
            data: {
                fieldName,
                updates,
                dryRun,
                result
            }
        });
    }
    catch (error) {
        next(error);
    }
});
exports.updateSpecificTask = updateSpecificTask;
//# sourceMappingURL=taskUpdate.controller.js.map