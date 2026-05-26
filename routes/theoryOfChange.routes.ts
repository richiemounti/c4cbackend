// routes/theoryOfChange.routes.ts
import { Router } from "express";
import {
  initializeStage,
  getStageProgress,
  getStagesByProject,
  completeStage,
  getWorkplan,
  getLogicModel,
  getStageStatusWithConsultation  
} from "../controllers/theoryOfChange.controller";

import {
  createAction,
  getActionsByStage,
  getActionsByStakeholder,
  getActionById,           // NEW
  getActionsByProject,     // NEW
  getAvailableSubThemes,   // NEW
  updateAction,
  deleteAction
} from "../controllers/stakeholderAction.controller";

import {
  defineOutcome,
  getImpactRisks,
  getImpactsByStage,
  getImpactsByStakeholder,
  getImpactById,
  getAvailableSubThemes as getAvailableSubThemesForImpacts,
  updateImpact,
  deleteImpact
} from "../controllers/socialImpact.controller";

import authorize from "../middlewares/auth.middleware";
import { hasProjectAccess } from "../middlewares/role.middleware";

const tocRouter = Router();

// Stage routes
tocRouter.post('/stages/initialize', authorize, initializeStage);
tocRouter.get('/stages/project/:projectId', authorize, getStagesByProject);
tocRouter.get('/stages/project/:projectId/site/:siteId', authorize, getStagesByProject);
tocRouter.get('/stages/:stageId', authorize, getStageProgress);
tocRouter.put('/stages/:stageId/complete', authorize, completeStage);
tocRouter.get('/status/:projectId/:projectSiteId?', authorize, getStageStatusWithConsultation);

// Stage 1 - Stakeholder Action routes
tocRouter.post('/actions', authorize, createAction);
tocRouter.get('/actions/stage/:stageId', authorize, getActionsByStage);
tocRouter.get('/actions/stage/:stageId/stakeholder/:stakeholderGroupId', authorize, getActionsByStakeholder);
tocRouter.get('/actions/project/:projectId', authorize, getActionsByProject);  // NEW
tocRouter.get('/actions/:actionId', authorize, getActionById);                 // NEW
tocRouter.put('/actions/:actionId', authorize, updateAction);
tocRouter.delete('/actions/:actionId', authorize, deleteAction);

// NEW: Helper route for getting available subthemes for actions
tocRouter.post('/actions/available-subthemes', authorize, getAvailableSubThemes);

// Stage 2 - Social Impact routes
tocRouter.post('/impacts', authorize, defineOutcome);
tocRouter.get('/impacts/:impactId/risks', authorize, getImpactRisks);
tocRouter.get('/impacts/stage/:stageId', authorize, getImpactsByStage);
tocRouter.get('/impacts/stage/:stageId/stakeholder/:stakeholderGroupId', authorize, getImpactsByStakeholder);
tocRouter.get('/impacts/:impactId', authorize, getImpactById);                // NEW
tocRouter.put('/impacts/:impactId', authorize, updateImpact);
tocRouter.delete('/impacts/:impactId', authorize, deleteImpact);

// NEW: Helper route for getting available subthemes for impacts
tocRouter.post('/impacts/available-subthemes', authorize, getAvailableSubThemesForImpacts);

// Output routes
tocRouter.get('/outputs/workplan/:stageId', authorize, getWorkplan);
tocRouter.get('/outputs/logic-model/:stageId', authorize, getLogicModel);

export default tocRouter;