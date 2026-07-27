"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/projectSetup.routes.ts
const express_1 = require("express");
const projectSetup_controller_1 = require("../controllers/projectSetup.controller");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const upload_middleware_1 = require("../middlewares/upload.middleware");
const projectSetupRouter = (0, express_1.Router)();
// Project setup routes
projectSetupRouter.post('/projects/:projectId/setup/initialize', auth_middleware_1.default, projectSetup_controller_1.initializeSetup);
projectSetupRouter.get('/projects/:projectId/setup', auth_middleware_1.default, projectSetup_controller_1.getProjectSetup);
projectSetupRouter.get('/projects/:projectId/setup/progress', auth_middleware_1.default, projectSetup_controller_1.getProjectSetupProgressSummary);
// ✅ UPDATED: Allow multiple files
projectSetupRouter.put('/project-setup/:setupId/tasks/:taskId/complete', auth_middleware_1.default, upload_middleware_1.upload.array('files', 5), // ✅ Changed to array
projectSetup_controller_1.completeProjectSetupTask);
// ✅ UPDATED: Allow multiple files
projectSetupRouter.patch('/project-setup/:setupId/tasks/:taskId/data', auth_middleware_1.default, upload_middleware_1.upload.array('files', 5), // ✅ Changed to array
projectSetup_controller_1.updateProjectSetupTaskData);
// Add this route for file deletion
projectSetupRouter.delete('/project-setup/:setupId/tasks/:taskId/files/:filename', auth_middleware_1.default, projectSetup_controller_1.removeProjectSetupTaskFile);
projectSetupRouter.delete('/project-site-setup/:setupId/tasks/:taskId/files/:filename', auth_middleware_1.default, projectSetup_controller_1.removeSiteSetupTaskFile // Similar implementation for sites
);
// Project site setup routes
projectSetupRouter.post('/project-sites/:siteId/setup/initialize', auth_middleware_1.default, projectSetup_controller_1.initializeSiteSetup);
projectSetupRouter.get('/project-sites/:siteId/setup', auth_middleware_1.default, projectSetup_controller_1.getProjectSiteSetup);
projectSetupRouter.get('/project-sites/:siteId/setup/progress', auth_middleware_1.default, projectSetup_controller_1.getProjectSiteSetupProgressSummary);
// ✅ UPDATED: Allow multiple files for site tasks too
projectSetupRouter.put('/project-site-setup/:setupId/tasks/:taskId/complete', auth_middleware_1.default, upload_middleware_1.upload.array('files', 5), // ✅ Changed to array
projectSetup_controller_1.completeSiteSetupTask);
// ✅ UPDATED: Allow multiple files for site tasks too
projectSetupRouter.patch('/project-site-setup/:setupId/tasks/:taskId/data', auth_middleware_1.default, upload_middleware_1.upload.array('files', 5), // ✅ Changed to array
projectSetup_controller_1.updateSiteSetupTaskData);
exports.default = projectSetupRouter;
//# sourceMappingURL=projectSetup.routes.js.map