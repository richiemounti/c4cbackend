"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/consentForm.routes.ts - ADD PUBLIC ROUTE
const express_1 = require("express");
const consentForm_controller_1 = require("../controllers/consentForm.controller");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const consentFormRouter = (0, express_1.Router)();
// PUBLIC ROUTE - must be before auth middleware
consentFormRouter.get('/public/:consentFormId', consentForm_controller_1.getPublicConsentForm);
// Protected routes
consentFormRouter.post('/', auth_middleware_1.default, consentForm_controller_1.createConsentForm);
consentFormRouter.get('/', auth_middleware_1.default, consentForm_controller_1.getConsentForms);
consentFormRouter.get('/:id', auth_middleware_1.default, consentForm_controller_1.getConsentForm);
consentFormRouter.put('/:id', auth_middleware_1.default, consentForm_controller_1.updateConsentForm);
consentFormRouter.delete('/:id', auth_middleware_1.default, consentForm_controller_1.archiveConsentForm);
// Helper routes
consentFormRouter.get('/available/:projectId', auth_middleware_1.default, consentForm_controller_1.getAvailableConsentFormsForProject);
consentFormRouter.post('/:id/clone', auth_middleware_1.default, consentForm_controller_1.cloneConsentForm);
exports.default = consentFormRouter;
//# sourceMappingURL=consentForm.routes.js.map