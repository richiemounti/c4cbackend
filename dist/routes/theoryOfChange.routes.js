"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/theoryOfChange.routes.ts
const express_1 = require("express");
const theoryOfChange_controller_1 = require("../controllers/theoryOfChange.controller");
const stakeholderAction_controller_1 = require("../controllers/stakeholderAction.controller");
const socialImpact_controller_1 = require("../controllers/socialImpact.controller");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const tocRouter = (0, express_1.Router)();
// Stage routes
tocRouter.post('/stages/initialize', auth_middleware_1.default, theoryOfChange_controller_1.initializeStage);
tocRouter.get('/stages/project/:projectId', auth_middleware_1.default, theoryOfChange_controller_1.getStagesByProject);
tocRouter.get('/stages/project/:projectId/site/:siteId', auth_middleware_1.default, theoryOfChange_controller_1.getStagesByProject);
tocRouter.get('/stages/:stageId', auth_middleware_1.default, theoryOfChange_controller_1.getStageProgress);
tocRouter.put('/stages/:stageId/complete', auth_middleware_1.default, theoryOfChange_controller_1.completeStage);
tocRouter.get('/status/:projectId/:projectSiteId?', auth_middleware_1.default, theoryOfChange_controller_1.getStageStatusWithConsultation);
// Stage 1 - Stakeholder Action routes
tocRouter.post('/actions', auth_middleware_1.default, stakeholderAction_controller_1.createAction);
tocRouter.get('/actions/stage/:stageId', auth_middleware_1.default, stakeholderAction_controller_1.getActionsByStage);
tocRouter.get('/actions/stage/:stageId/stakeholder/:stakeholderGroupId', auth_middleware_1.default, stakeholderAction_controller_1.getActionsByStakeholder);
tocRouter.get('/actions/project/:projectId', auth_middleware_1.default, stakeholderAction_controller_1.getActionsByProject); // NEW
tocRouter.get('/actions/:actionId', auth_middleware_1.default, stakeholderAction_controller_1.getActionById); // NEW
tocRouter.put('/actions/:actionId', auth_middleware_1.default, stakeholderAction_controller_1.updateAction);
tocRouter.delete('/actions/:actionId', auth_middleware_1.default, stakeholderAction_controller_1.deleteAction);
// NEW: Helper route for getting available subthemes for actions
tocRouter.post('/actions/available-subthemes', auth_middleware_1.default, stakeholderAction_controller_1.getAvailableSubThemes);
// Stage 2 - Social Impact routes
tocRouter.post('/impacts', auth_middleware_1.default, socialImpact_controller_1.defineOutcome);
tocRouter.get('/impacts/:impactId/risks', auth_middleware_1.default, socialImpact_controller_1.getImpactRisks);
tocRouter.get('/impacts/stage/:stageId', auth_middleware_1.default, socialImpact_controller_1.getImpactsByStage);
tocRouter.get('/impacts/stage/:stageId/stakeholder/:stakeholderGroupId', auth_middleware_1.default, socialImpact_controller_1.getImpactsByStakeholder);
tocRouter.get('/impacts/:impactId', auth_middleware_1.default, socialImpact_controller_1.getImpactById); // NEW
tocRouter.put('/impacts/:impactId', auth_middleware_1.default, socialImpact_controller_1.updateImpact);
tocRouter.delete('/impacts/:impactId', auth_middleware_1.default, socialImpact_controller_1.deleteImpact);
// NEW: Helper route for getting available subthemes for impacts
tocRouter.post('/impacts/available-subthemes', auth_middleware_1.default, socialImpact_controller_1.getAvailableSubThemes);
// Output routes
tocRouter.get('/outputs/workplan/:stageId', auth_middleware_1.default, theoryOfChange_controller_1.getWorkplan);
tocRouter.get('/outputs/logic-model/:stageId', auth_middleware_1.default, theoryOfChange_controller_1.getLogicModel);
exports.default = tocRouter;
//# sourceMappingURL=theoryOfChange.routes.js.map