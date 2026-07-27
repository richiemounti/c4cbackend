"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Modified Project Routes
const express_1 = require("express");
const project_controller_1 = require("../controllers/project.controller");
const projectSite_routes_1 = require("./projectSite.routes");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const role_middleware_1 = require("../middlewares/role.middleware");
const projectRouter = (0, express_1.Router)();
// Get all projects (filtered by user's access)
projectRouter.get('/', auth_middleware_1.default, project_controller_1.getProjects);
// Create project (requires create_projects permission)
projectRouter.post('/', auth_middleware_1.default, (0, role_middleware_1.hasPermission)(['create_projects', 'manage_org_projects', 'manage_all']), (0, role_middleware_1.hasOrganizationAccess)(), // Check organization access from req.body.organization
project_controller_1.createProject);
// Get single project by ID
projectRouter.get('/:id', auth_middleware_1.default, (0, role_middleware_1.hasProjectAccess)(), // Check project access
project_controller_1.getProject);
// Update project
projectRouter.put('/:id', auth_middleware_1.default, (0, role_middleware_1.hasProjectAccess)(), // Check project access
(0, role_middleware_1.hasPermission)(['create_projects', 'manage_org_projects', 'configure_projects']), project_controller_1.updateProject);
// Archive project (soft delete)
projectRouter.delete('/:id', auth_middleware_1.default, (0, role_middleware_1.hasProjectAccess)(), // Check project access
(0, role_middleware_1.hasPermission)(['manage_org_projects', 'manage_all', 'manage_client_users', 'create_projects']), project_controller_1.archiveProject);
// Restore archived project
projectRouter.post('/:id/restore', auth_middleware_1.default, (0, role_middleware_1.hasProjectAccess)(), // Check project access
(0, role_middleware_1.hasPermission)(['manage_org_projects', 'manage_all', 'manage_client_users', 'create_projects']), project_controller_1.restoreProject);
// Permanently delete project (ConnectGo staff only)
projectRouter.delete('/:id/permanent', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), project_controller_1.deleteProject);
// Mount project sites routes
projectRouter.use('/:projectId/sites', projectSite_routes_1.projectSitesRouter);
exports.default = projectRouter;
//# sourceMappingURL=project.routes.js.map