import { Router } from "express";
import { getOrganizationProjects } from "../controllers/project.controller";
import authorize from "../middlewares/auth.middleware";
import { hasOrganizationAccess } from "../middlewares/role.middleware";

const organizationProjectsRouter = Router({ mergeParams: true });

// Get all projects for a specific organization
organizationProjectsRouter.get('/', 
  authorize, 
  hasOrganizationAccess(),  // Validates access to organization from params.organizationId
  getOrganizationProjects
);

export default organizationProjectsRouter;