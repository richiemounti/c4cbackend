// routes/sniSurvey.routes.ts — mounted at /api/v1/sni/surveys
import { Router } from "express";
import {
    createSniSurvey,
    getSniSurveys,
    getSniSurvey,
    getSniSurveyStructure,
    updateSniSurvey,
    archiveSniSurvey,
    cloneSniSurveyForProject,
    startSniPreview,
    getSniTemplates,
    getSniSurveysForProject,
    publishSniSurvey,
    closeSniSurvey,
} from "../controllers/sniSurvey.controller";
import authorize from "../middlewares/auth.middleware";
import { isConnectGoStaff, hasPermission, hasProjectAccess } from "../middlewares/role.middleware";
import { exportSniSurveyData } from "../controllers/sniExport.controller";
import sniSurveyResponseRouter from "./sniSurveyResponse.routes";
import sniSectionRouter from "./sniSection.routes";
import sniQuestionRouter from "./sniQuestion.routes";

const sniSurveyRouter = Router();

// ─── Client-facing activation surface ──────────────────────────────────────
// Registered BEFORE the /:id catch-all routes below — /templates is a single
// path segment and would otherwise be captured by GET /:id (Express matches
// routes in registration order; "templates" would be read as an id and hit
// getSniSurvey, throwing a CastError). /project/:projectId doesn't have this
// problem (two segments, distinct first literal) but is kept alongside for
// readability.
sniSurveyRouter.get('/templates', authorize, getSniTemplates);
sniSurveyRouter.get('/project/:projectId', authorize, hasProjectAccess(), getSniSurveysForProject);
sniSurveyRouter.post(
    '/:id/publish',
    authorize,
    hasPermission(['create_projects', 'configure_projects', 'manage_org_projects', 'manage_all']),
    publishSniSurvey
);
sniSurveyRouter.post(
    '/:id/close',
    authorize,
    hasPermission(['create_projects', 'configure_projects', 'manage_org_projects', 'manage_all']),
    closeSniSurvey
);

// ─── Authoring CRUD — staff-only ────────────────────────────────────────────
// (brief §3: clients never see a survey builder for SNI)
sniSurveyRouter.post('/', authorize, isConnectGoStaff(), createSniSurvey);
sniSurveyRouter.get('/', authorize, isConnectGoStaff(), getSniSurveys);
sniSurveyRouter.get('/:id', authorize, isConnectGoStaff(), getSniSurvey);
sniSurveyRouter.get('/:id/structure', authorize, isConnectGoStaff(), getSniSurveyStructure);
sniSurveyRouter.put('/:id', authorize, isConnectGoStaff(), updateSniSurvey);
sniSurveyRouter.delete('/:id', authorize, isConnectGoStaff(), archiveSniSurvey);

// Activation (clone template -> project) — the client-facing step of the
// brief's journey, gated by the SNI billing check inside the controller
// (staff bypass the paywall there, same pattern as project creation).
sniSurveyRouter.post(
    '/:templateId/clone',
    authorize,
    hasPermission(['create_projects', 'configure_projects', 'manage_org_projects', 'manage_all']),
    cloneSniSurveyForProject
);

// Preview — part of the client journey too now (project-access-or-staff
// checked inside the controller, since previewing a template directly is
// still staff-only but previewing an activated project survey isn't).
sniSurveyRouter.post('/:surveyId/preview/start', authorize, startSniPreview);

// Export — project access (or staff) required, checked inside the controller
// (mirrors exportSurveyResponses's own userHasProjectAccess-or-staff pattern).
// alter_id only by default, never real names — see sniExport.controller.ts.
sniSurveyRouter.get('/:surveyId/export', authorize, exportSniSurveyData);

// Response-taking (respondent-facing, intentionally not staff-gated — see
// sniSurveyResponse.routes.ts's own header comment).
sniSurveyRouter.use('/:surveyId/responses', sniSurveyResponseRouter);

// Content sub-resources
sniSurveyRouter.use('/:surveyId/sections', sniSectionRouter);
sniSurveyRouter.use('/:surveyId/questions', sniQuestionRouter);

export default sniSurveyRouter;
