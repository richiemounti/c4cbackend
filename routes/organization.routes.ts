// routes/organization.routes.ts
import { Router } from "express";
import {
  createOrganization,
  getOrganizations,
  getMyOrganizations,
  getOrganization,
  updateOrganization,
  archiveOrganization,
  restoreOrganization,
  deleteOrganization
} from "../controllers/organization.controller";

import authorize from "../middlewares/auth.middleware";
import { hasPermission } from "../middlewares/role.middleware";

const organizationRouter = Router();

// Public routes - require authentication but no specific permissions
organizationRouter.get('/', authorize, getOrganizations);

// Get organizations for the currently logged-in user
organizationRouter.get('/my-organizations', authorize, getMyOrganizations);

// Create organization - requires 'create_organization' permission (only managers and ConnectGo staff)
organizationRouter.post('/', 
  authorize, 
  hasPermission(['create_organization', 'manage_all']), 
  createOrganization
);

// Get organization by ID
organizationRouter.get('/:id', authorize, getOrganization);

// Update organization
organizationRouter.put('/:id', authorize, updateOrganization);

// Archive organization (soft delete)
organizationRouter.delete('/:id', authorize, archiveOrganization);

// Restore archived organization
organizationRouter.post('/:id/restore', authorize, restoreOrganization);

// Permanently delete organization (ConnectGo staff only)
organizationRouter.delete('/:id/permanent', 
  authorize, 
  hasPermission(['delete_data']), 
  deleteOrganization
);

export default organizationRouter;