// routes/projectSetup.routes.ts
import { Router } from "express";
import {
  initializeSetup,
  getProjectSetup,
  completeProjectSetupTask,
  getProjectSetupProgressSummary,
  initializeSiteSetup,
  getProjectSiteSetup,
  completeSiteSetupTask,
  getProjectSiteSetupProgressSummary,
  updateProjectSetupTaskData,
  updateSiteSetupTaskData,
  removeProjectSetupTaskFile,
  removeSiteSetupTaskFile
} from "../controllers/projectSetup.controller";

import authorize from "../middlewares/auth.middleware";
import { hasProjectAccess } from "../middlewares/role.middleware";
import { upload } from "../middlewares/upload.middleware";

const projectSetupRouter = Router();

// Project setup routes
projectSetupRouter.post(
  '/projects/:projectId/setup/initialize',
  authorize,
  initializeSetup
);

projectSetupRouter.get(
  '/projects/:projectId/setup',
  authorize,
  getProjectSetup
);

projectSetupRouter.get(
  '/projects/:projectId/setup/progress',
  authorize,
  getProjectSetupProgressSummary
);

// ✅ UPDATED: Allow multiple files
projectSetupRouter.put(
  '/project-setup/:setupId/tasks/:taskId/complete',
  authorize,
  upload.array('files', 5), // ✅ Changed to array
  completeProjectSetupTask
);

// ✅ UPDATED: Allow multiple files
projectSetupRouter.patch(
  '/project-setup/:setupId/tasks/:taskId/data',
  authorize,
  upload.array('files', 5), // ✅ Changed to array
  updateProjectSetupTaskData
);

// Add this route for file deletion
projectSetupRouter.delete(
  '/project-setup/:setupId/tasks/:taskId/files/:filename',
  authorize,
  removeProjectSetupTaskFile
);

projectSetupRouter.delete(
  '/project-site-setup/:setupId/tasks/:taskId/files/:filename',
  authorize,
  removeSiteSetupTaskFile // Similar implementation for sites
);

// Project site setup routes
projectSetupRouter.post(
  '/project-sites/:siteId/setup/initialize',
  authorize,
  initializeSiteSetup
);

projectSetupRouter.get(
  '/project-sites/:siteId/setup',
  authorize,
  getProjectSiteSetup
);

projectSetupRouter.get(
  '/project-sites/:siteId/setup/progress',
  authorize,
  getProjectSiteSetupProgressSummary
);

// ✅ UPDATED: Allow multiple files for site tasks too
projectSetupRouter.put(
  '/project-site-setup/:setupId/tasks/:taskId/complete',
  authorize,
  upload.array('files', 5), // ✅ Changed to array
  completeSiteSetupTask
);

// ✅ UPDATED: Allow multiple files for site tasks too
projectSetupRouter.patch(
  '/project-site-setup/:setupId/tasks/:taskId/data',
  authorize,
  upload.array('files', 5), // ✅ Changed to array
  updateSiteSetupTaskData
);

export default projectSetupRouter;