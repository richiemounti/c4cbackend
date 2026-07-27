"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/mobile.routes.ts
const express_1 = require("express");
const mobile_controller_1 = require("../controllers/mobile.controller");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const mobileRouter = (0, express_1.Router)();
// Every mobile route requires a valid JWT — no exceptions
mobileRouter.use(auth_middleware_1.default);
// ─── Profile ──────────────────────────────────────────────────────────────────
// Returns the authenticated user + their organisations + accessible projects.
// Called immediately after login to seed the app home screen.
mobileRouter.get('/me', mobile_controller_1.getMobileProfile);
// ─── Projects & Surveys ───────────────────────────────────────────────────────
// List of published surveys for a specific project (lightweight — no questions).
mobileRouter.get('/projects/:projectId/surveys', mobile_controller_1.getMobileProjectSurveys);
// Full survey package download (survey + consent + sections + questions).
// Single request so the device can go offline immediately after.
mobileRouter.get('/surveys/:id/download', mobile_controller_1.downloadSurveyPackage);
// ─── Sync ─────────────────────────────────────────────────────────────────────
// Returns updatedAt timestamps for all accessible surveys.
// Device compares against locally stored packageVersion to detect stale cache.
mobileRouter.get('/sync/status', mobile_controller_1.getSyncStatus);
// Batch upload of offline-collected responses.
// Per-entry idempotency via clientGeneratedId prevents duplicate inserts on retry.
mobileRouter.post('/responses/batch', mobile_controller_1.batchUploadResponses);
exports.default = mobileRouter;
//# sourceMappingURL=mobile.routes.js.map