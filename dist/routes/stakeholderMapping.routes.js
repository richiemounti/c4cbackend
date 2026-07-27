"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/stakeholderMapping.routes.ts
const express_1 = require("express");
const stakeholderMapping_controller_1 = require("../controllers/stakeholderMapping.controller");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const role_middleware_1 = require("../middlewares/role.middleware");
const stakeholderMappingRouter = (0, express_1.Router)();
// All routes require authentication
stakeholderMappingRouter.use(auth_middleware_1.default);
// Get stakeholder groups for a project
stakeholderMappingRouter.get('/project/:projectId', (0, role_middleware_1.hasProjectAccess)(), stakeholderMapping_controller_1.getStakeholderGroups);
// Get stakeholder groups for a project site
stakeholderMappingRouter.get('/project/:projectId/site/:siteId', (0, role_middleware_1.hasProjectAccess)(), stakeholderMapping_controller_1.getStakeholderGroups);
// Get stakeholder groups by category for a project
stakeholderMappingRouter.get('/project/:projectId/category/:categoryId', (0, role_middleware_1.hasProjectAccess)(), stakeholderMapping_controller_1.getStakeholderGroupsByCategory);
// Get stakeholder groups by category for a project site
stakeholderMappingRouter.get('/project/:projectId/site/:siteId/category/:categoryId', (0, role_middleware_1.hasProjectAccess)(), stakeholderMapping_controller_1.getStakeholderGroupsByCategory);
// Get key insights for a project
stakeholderMappingRouter.get('/project/:projectId/key-insights', (0, role_middleware_1.hasProjectAccess)(), stakeholderMapping_controller_1.getKeyInsights);
// Get key insights for a project site
stakeholderMappingRouter.get('/project/:projectId/site/:siteId/key-insights', (0, role_middleware_1.hasProjectAccess)(), stakeholderMapping_controller_1.getKeyInsights);
// Get completion statistics for a project
stakeholderMappingRouter.get('/stats/project/:projectId', (0, role_middleware_1.hasProjectAccess)(), stakeholderMapping_controller_1.getCompletionStats);
// Get completion statistics for a project site
stakeholderMappingRouter.get('/stats/project/:projectId/site/:siteId', (0, role_middleware_1.hasProjectAccess)(), stakeholderMapping_controller_1.getCompletionStats);
// Get task options for a category and task type
stakeholderMappingRouter.get('/taskOptions/:categoryId/:taskType', stakeholderMapping_controller_1.getTaskOptions);
// Get a single stakeholder group
stakeholderMappingRouter.get('/:id', stakeholderMapping_controller_1.getStakeholderGroup);
// Create a new stakeholder group
stakeholderMappingRouter.post('/', (0, role_middleware_1.hasPermission)(['create_projects', 'configure_projects', 'manage_org_projects', 'manage_all', 'stakeholder_mapping']), stakeholderMapping_controller_1.createStakeholderGroupController);
// Update a stakeholder group
stakeholderMappingRouter.put('/:id', (0, role_middleware_1.hasPermission)(['create_projects', 'configure_projects', 'manage_org_projects', 'manage_all', 'stakeholder_mapping']), stakeholderMapping_controller_1.updateStakeholderGroup);
// Delete a stakeholder group
stakeholderMappingRouter.delete('/:id', (0, role_middleware_1.hasPermission)(['create_projects', 'configure_projects', 'manage_org_projects', 'manage_all', 'stakeholder_mapping']), stakeholderMapping_controller_1.deleteStakeholderGroup);
// Add or update a task for a stakeholder group
stakeholderMappingRouter.post('/:id/tasks/:taskType', (0, role_middleware_1.hasPermission)(['create_projects', 'configure_projects', 'manage_org_projects', 'manage_all', 'stakeholder_mapping']), stakeholderMapping_controller_1.updateTask);
exports.default = stakeholderMappingRouter;
//# sourceMappingURL=stakeholderMapping.routes.js.map