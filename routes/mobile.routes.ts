// routes/mobile.routes.ts
import { Router } from 'express';
import {
    getMobileProfile,
    getMobileProjectSurveys,
    downloadSurveyPackage,
    getSyncStatus,
    batchUploadResponses
} from '../controllers/mobile.controller';
import authorize from '../middlewares/auth.middleware';

const mobileRouter = Router();

// Every mobile route requires a valid JWT — no exceptions
mobileRouter.use(authorize);

// ─── Profile ──────────────────────────────────────────────────────────────────
// Returns the authenticated user + their organisations + accessible projects.
// Called immediately after login to seed the app home screen.
mobileRouter.get('/me', getMobileProfile);

// ─── Projects & Surveys ───────────────────────────────────────────────────────
// List of published surveys for a specific project (lightweight — no questions).
mobileRouter.get('/projects/:projectId/surveys', getMobileProjectSurveys);

// Full survey package download (survey + consent + sections + questions).
// Single request so the device can go offline immediately after.
mobileRouter.get('/surveys/:id/download', downloadSurveyPackage);

// ─── Sync ─────────────────────────────────────────────────────────────────────
// Returns updatedAt timestamps for all accessible surveys.
// Device compares against locally stored packageVersion to detect stale cache.
mobileRouter.get('/sync/status', getSyncStatus);

// Batch upload of offline-collected responses.
// Per-entry idempotency via clientGeneratedId prevents duplicate inserts on retry.
mobileRouter.post('/responses/batch', batchUploadResponses);

export default mobileRouter;