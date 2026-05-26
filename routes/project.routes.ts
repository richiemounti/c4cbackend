// Modified Project Routes
import { Router } from "express";
import {
  createProject,
  getProjects,
  getProject,
  updateProject,
  archiveProject,
  restoreProject,
  deleteProject
} from "../controllers/project.controller";

import { projectSitesRouter } from "./projectSite.routes";

import authorize from "../middlewares/auth.middleware";
import { 
  hasPermission, 
  hasProjectAccess, 
  hasOrganizationAccess,
  isConnectGoStaff 
} from "../middlewares/role.middleware";

const projectRouter = Router();

// Get all projects (filtered by user's access)
projectRouter.get('/', authorize, getProjects);

// Create project (requires create_projects permission)
projectRouter.post('/', 
  authorize, 
  hasPermission(['create_projects', 'manage_org_projects', 'manage_all']),
  hasOrganizationAccess(),  // Check organization access from req.body.organization
  createProject
);

// Get single project by ID
projectRouter.get('/:id', 
  authorize, 
  hasProjectAccess(),  // Check project access
  getProject
);

// Update project
projectRouter.put('/:id', 
  authorize, 
  hasProjectAccess(),  // Check project access
  hasPermission(['create_projects', 'manage_org_projects', 'configure_projects']),
  updateProject
);

// Archive project (soft delete)
projectRouter.delete('/:id', 
  authorize, 
  hasProjectAccess(),  // Check project access
  hasPermission(['manage_org_projects', 'manage_all', 'manage_client_users', 'create_projects']),
  archiveProject
);

// Restore archived project
projectRouter.post('/:id/restore', 
  authorize, 
  hasProjectAccess(),  // Check project access
  hasPermission(['manage_org_projects', 'manage_all', 'manage_client_users', 'create_projects']),
  restoreProject
);

// Permanently delete project (ConnectGo staff only)
projectRouter.delete('/:id/permanent', 
  authorize, 
  isConnectGoStaff(),
  deleteProject
);

// Mount project sites routes
projectRouter.use('/:projectId/sites', projectSitesRouter);

export default projectRouter;