import { Router } from "express";
import {
  getProjectStakeholders,
  getStakeholdersByCategory,
  getStakeholder,
  createStakeholder,
  createStakeholders,
  updateStakeholder,
  deleteStakeholder,
  addStakeholderTask,
  getStakeholderCompletionStatus
} from "../controllers/stakeholder.controller";
import authorize from "../middlewares/auth.middleware";
import { hasProjectAccess, hasPermission } from "../middlewares/role.middleware";

const stakeholderRouter = Router();

// Get all stakeholders for a project
stakeholderRouter.get(
  '/project/:projectId',
  authorize,
  hasProjectAccess(),
  getProjectStakeholders
);

// Get stakeholder completion status for a project
stakeholderRouter.get(
  '/project/:projectId/status',
  authorize,
  hasProjectAccess(),
  getStakeholderCompletionStatus
);

// Get stakeholders by project and category
stakeholderRouter.get(
  '/project/:projectId/category/:category',
  authorize,
  hasProjectAccess(),
  getStakeholdersByCategory
);

// Get a single stakeholder
stakeholderRouter.get(
  '/:id',
  authorize,
  getStakeholder
);

// Create a new stakeholder
stakeholderRouter.post(
  '/',
  authorize,
  hasPermission(['create_projects', 'configure_projects', 'manage_org_projects']),
  createStakeholder
);

// Create multiple stakeholders in a batch
stakeholderRouter.post(
  '/batch',
  authorize,
  hasPermission(['create_projects', 'configure_projects', 'manage_org_projects']),
  createStakeholders
);

// Update a stakeholder
stakeholderRouter.put(
  '/:id',
  authorize,
  hasPermission(['create_projects', 'configure_projects', 'manage_org_projects']),
  updateStakeholder
);

// Delete a stakeholder
stakeholderRouter.delete(
  '/:id',
  authorize,
  hasPermission(['create_projects', 'configure_projects', 'manage_org_projects']),
  deleteStakeholder
);

// Add or update a task for a stakeholder
stakeholderRouter.post(
  '/:id/tasks',
  authorize,
  hasPermission(['create_projects', 'configure_projects', 'manage_org_projects']),
  addStakeholderTask
);

export default stakeholderRouter;