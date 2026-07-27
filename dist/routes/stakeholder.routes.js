"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const stakeholder_controller_1 = require("../controllers/stakeholder.controller");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const role_middleware_1 = require("../middlewares/role.middleware");
const stakeholderRouter = (0, express_1.Router)();
// Get all stakeholders for a project
stakeholderRouter.get('/project/:projectId', auth_middleware_1.default, (0, role_middleware_1.hasProjectAccess)(), stakeholder_controller_1.getProjectStakeholders);
// Get stakeholder completion status for a project
stakeholderRouter.get('/project/:projectId/status', auth_middleware_1.default, (0, role_middleware_1.hasProjectAccess)(), stakeholder_controller_1.getStakeholderCompletionStatus);
// Get stakeholders by project and category
stakeholderRouter.get('/project/:projectId/category/:category', auth_middleware_1.default, (0, role_middleware_1.hasProjectAccess)(), stakeholder_controller_1.getStakeholdersByCategory);
// Get a single stakeholder
stakeholderRouter.get('/:id', auth_middleware_1.default, stakeholder_controller_1.getStakeholder);
// Create a new stakeholder
stakeholderRouter.post('/', auth_middleware_1.default, (0, role_middleware_1.hasPermission)(['create_projects', 'configure_projects', 'manage_org_projects']), stakeholder_controller_1.createStakeholder);
// Create multiple stakeholders in a batch
stakeholderRouter.post('/batch', auth_middleware_1.default, (0, role_middleware_1.hasPermission)(['create_projects', 'configure_projects', 'manage_org_projects']), stakeholder_controller_1.createStakeholders);
// Update a stakeholder
stakeholderRouter.put('/:id', auth_middleware_1.default, (0, role_middleware_1.hasPermission)(['create_projects', 'configure_projects', 'manage_org_projects']), stakeholder_controller_1.updateStakeholder);
// Delete a stakeholder
stakeholderRouter.delete('/:id', auth_middleware_1.default, (0, role_middleware_1.hasPermission)(['create_projects', 'configure_projects', 'manage_org_projects']), stakeholder_controller_1.deleteStakeholder);
// Add or update a task for a stakeholder
stakeholderRouter.post('/:id/tasks', auth_middleware_1.default, (0, role_middleware_1.hasPermission)(['create_projects', 'configure_projects', 'manage_org_projects']), stakeholder_controller_1.addStakeholderTask);
exports.default = stakeholderRouter;
//# sourceMappingURL=stakeholder.routes.js.map