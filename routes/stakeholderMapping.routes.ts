// routes/stakeholderMapping.routes.ts
import { Router } from "express";
import {
  getStakeholderGroups,
  getStakeholderGroupsByCategory,
  getStakeholderGroup,
  createStakeholderGroupController,
  updateStakeholderGroup,
  deleteStakeholderGroup,
  getTaskOptions,
  updateTask,
  getCompletionStats,
  getKeyInsights
} from "../controllers/stakeholderMapping.controller";

import authorize from "../middlewares/auth.middleware";
import { hasProjectAccess, hasPermission } from "../middlewares/role.middleware";

const stakeholderMappingRouter = Router();

// All routes require authentication
stakeholderMappingRouter.use(authorize);

// Get stakeholder groups for a project
stakeholderMappingRouter.get(
  '/project/:projectId',
  hasProjectAccess(),
  getStakeholderGroups
);

// Get stakeholder groups for a project site
stakeholderMappingRouter.get(
  '/project/:projectId/site/:siteId',
  hasProjectAccess(),
  getStakeholderGroups
);

// Get stakeholder groups by category for a project
stakeholderMappingRouter.get(
  '/project/:projectId/category/:categoryId',
  hasProjectAccess(),
  getStakeholderGroupsByCategory
);

// Get stakeholder groups by category for a project site
stakeholderMappingRouter.get(
  '/project/:projectId/site/:siteId/category/:categoryId',
  hasProjectAccess(),
  getStakeholderGroupsByCategory
);

// Get key insights for a project
stakeholderMappingRouter.get(
  '/project/:projectId/key-insights',
  hasProjectAccess(),
  getKeyInsights
);

// Get key insights for a project site
stakeholderMappingRouter.get(
  '/project/:projectId/site/:siteId/key-insights',
  hasProjectAccess(),
  getKeyInsights
);

// Get completion statistics for a project
stakeholderMappingRouter.get(
  '/stats/project/:projectId',
  hasProjectAccess(),
  getCompletionStats
);

// Get completion statistics for a project site
stakeholderMappingRouter.get(
  '/stats/project/:projectId/site/:siteId',
  hasProjectAccess(),
  getCompletionStats
);

// Get task options for a category and task type
stakeholderMappingRouter.get(
  '/taskOptions/:categoryId/:taskType',
  getTaskOptions
);

// Get a single stakeholder group
stakeholderMappingRouter.get(
  '/:id',
  getStakeholderGroup
);

// Create a new stakeholder group
stakeholderMappingRouter.post(
  '/',
  hasPermission(['create_projects', 'configure_projects', 'manage_org_projects', 'manage_all', 'stakeholder_mapping']),
  createStakeholderGroupController
);

// Update a stakeholder group
stakeholderMappingRouter.put(
  '/:id',
  hasPermission(['create_projects', 'configure_projects', 'manage_org_projects', 'manage_all', 'stakeholder_mapping']),
  updateStakeholderGroup
);

// Delete a stakeholder group
stakeholderMappingRouter.delete(
  '/:id',
  hasPermission(['create_projects', 'configure_projects', 'manage_org_projects', 'manage_all', 'stakeholder_mapping']),
  deleteStakeholderGroup
);

// Add or update a task for a stakeholder group
stakeholderMappingRouter.post(
  '/:id/tasks/:taskType',
  hasPermission(['create_projects', 'configure_projects', 'manage_org_projects', 'manage_all', 'stakeholder_mapping']),
  updateTask
);

export default stakeholderMappingRouter;