// Project Site Routes
import { Router } from "express";
import {
  createProjectSite,
  getProjectSites,
  getProjectSite,
  updateProjectSite,
  archiveProjectSite,
  restoreProjectSite,
  deleteProjectSite
} from "../controllers/projectSite.controller";

import authorize from "../middlewares/auth.middleware";
import { 
  hasPermission, 
  hasProjectAccess,
  isConnectGoStaff 
} from "../middlewares/role.middleware";

// Create a router for project sites
const projectSiteRouter = Router();

// Routes for accessing sites through projects
// e.g., /api/v1/projects/:projectId/sites
export const projectSitesRouter = Router({ mergeParams: true });

projectSitesRouter.get('/', 
  authorize, 
  hasProjectAccess(),  // Check project access from projectId param
  getProjectSites
);

projectSitesRouter.post('/', 
  authorize, 
  hasProjectAccess(),  // Check project access from projectId param
  hasPermission(['create_projects', 'manage_org_projects', 'configure_projects', 'project_site_setup', 'manage_all']),
  createProjectSite
);

// Direct routes for project sites
// e.g., /api/v1/project-sites/:id
projectSiteRouter.get('/:id', 
  authorize, 
  hasProjectAccess(),  // This middleware will need to check the project field of the site
  getProjectSite
);

projectSiteRouter.put('/:id', 
  authorize, 
  hasProjectAccess(),  // This middleware will need to check the project field of the site
  hasPermission(['create_projects', 'manage_org_projects', 'configure_projects', 'project_site_setup']),
  updateProjectSite
);

projectSiteRouter.delete('/:id', 
  authorize, 
  hasProjectAccess(),  // This middleware will need to check the project field of the site
  hasPermission(['manage_org_projects']),
  archiveProjectSite
);

projectSiteRouter.post('/:id/restore', 
  authorize, 
  hasProjectAccess(),  // This middleware will need to check the project field of the site
  hasPermission(['manage_org_projects']),
  restoreProjectSite
);

projectSiteRouter.delete('/:id/permanent', 
  authorize, 
  isConnectGoStaff(),
  deleteProjectSite
);

export { projectSiteRouter };