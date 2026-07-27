"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const project_controller_1 = require("../controllers/project.controller");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const role_middleware_1 = require("../middlewares/role.middleware");
const organizationProjectsRouter = (0, express_1.Router)({ mergeParams: true });
// Get all projects for a specific organization
organizationProjectsRouter.get('/', auth_middleware_1.default, (0, role_middleware_1.hasOrganizationAccess)(), // Validates access to organization from params.organizationId
project_controller_1.getOrganizationProjects);
exports.default = organizationProjectsRouter;
//# sourceMappingURL=organization-projects.routes.js.map