"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/taskUpdate.routes.ts
const express_1 = require("express");
const taskUpdate_controller_1 = require("../controllers/taskUpdate.controller");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const taskRouter = (0, express_1.Router)();
// Apply authentication middleware to all routes
/**
 * @route POST /api/v1/admin/tasks/update-project-tasks
 * @desc Apply all project task modifications
 * @access Private (Admin only)
 */
taskRouter.post('/update-project-tasks', auth_middleware_1.default, taskUpdate_controller_1.updateProjectTasks);
/**
 * @route POST /api/v1/admin/tasks/update-project-site-tasks
 * @desc Apply all project site task modifications
 * @access Private (Admin only)
 */
taskRouter.post('/update-project-site-tasks', auth_middleware_1.default, taskUpdate_controller_1.updateProjectSiteTasks);
/**
 * @route POST /api/v1/admin/tasks/update-task
 * @desc Update specific task globally
 * @access Private (Admin only)
 */
taskRouter.post('/update-task', auth_middleware_1.default, taskUpdate_controller_1.updateSpecificTask);
exports.default = taskRouter;
//# sourceMappingURL=taskUpdate.routes.js.map