"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectSiteRouter = exports.projectSitesRouter = void 0;
// Project Site Routes
const express_1 = require("express");
const projectSite_controller_1 = require("../controllers/projectSite.controller");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const role_middleware_1 = require("../middlewares/role.middleware");
// Create a router for project sites
const projectSiteRouter = (0, express_1.Router)();
exports.projectSiteRouter = projectSiteRouter;
// Routes for accessing sites through projects
// e.g., /api/v1/projects/:projectId/sites
exports.projectSitesRouter = (0, express_1.Router)({ mergeParams: true });
exports.projectSitesRouter.get('/', auth_middleware_1.default, (0, role_middleware_1.hasProjectAccess)(), // Check project access from projectId param
projectSite_controller_1.getProjectSites);
exports.projectSitesRouter.post('/', auth_middleware_1.default, (0, role_middleware_1.hasProjectAccess)(), // Check project access from projectId param
(0, role_middleware_1.hasPermission)(['create_projects', 'manage_org_projects', 'configure_projects', 'project_site_setup', 'manage_all']), projectSite_controller_1.createProjectSite);
// Direct routes for project sites
// e.g., /api/v1/project-sites/:id
projectSiteRouter.get('/:id', auth_middleware_1.default, (0, role_middleware_1.hasProjectAccess)(), // This middleware will need to check the project field of the site
projectSite_controller_1.getProjectSite);
projectSiteRouter.put('/:id', auth_middleware_1.default, (0, role_middleware_1.hasProjectAccess)(), // This middleware will need to check the project field of the site
(0, role_middleware_1.hasPermission)(['create_projects', 'manage_org_projects', 'configure_projects', 'project_site_setup']), projectSite_controller_1.updateProjectSite);
projectSiteRouter.delete('/:id', auth_middleware_1.default, (0, role_middleware_1.hasProjectAccess)(), // This middleware will need to check the project field of the site
(0, role_middleware_1.hasPermission)(['manage_org_projects']), projectSite_controller_1.archiveProjectSite);
projectSiteRouter.post('/:id/restore', auth_middleware_1.default, (0, role_middleware_1.hasProjectAccess)(), // This middleware will need to check the project field of the site
(0, role_middleware_1.hasPermission)(['manage_org_projects']), projectSite_controller_1.restoreProjectSite);
projectSiteRouter.delete('/:id/permanent', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), projectSite_controller_1.deleteProjectSite);
//# sourceMappingURL=projectSite.routes.js.map