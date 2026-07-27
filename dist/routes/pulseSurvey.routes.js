"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const pulseSurvey_controller_1 = require("../controllers/pulseSurvey.controller");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const pulseRouter = express_1.default.Router();
pulseRouter.use(auth_middleware_1.default);
// ============ TEMPLATES ============
pulseRouter.post('/', pulseSurvey_controller_1.pulseSurveyController.createOrUpdatePulseSurvey);
pulseRouter.get('/', pulseSurvey_controller_1.pulseSurveyController.getAllPulseSurveys);
// ============ RESPONSES ============
// These must come before /:moduleType
pulseRouter.post('/responses', pulseSurvey_controller_1.pulseSurveyController.submitPulseSurveyResponse);
pulseRouter.get('/responses', pulseSurvey_controller_1.pulseSurveyController.getPulseSurveyResponses);
// ============ ANALYTICS ============
pulseRouter.get('/analytics', pulseSurvey_controller_1.pulseSurveyController.getPulseSurveyAnalytics);
// ============ CHECK REQUIRED ============
pulseRouter.get('/check-required/:moduleType/:moduleReference', pulseSurvey_controller_1.pulseSurveyController.checkPulseSurveyRequired);
// ============ DYNAMIC — must be last ============
pulseRouter.get('/:moduleType', pulseSurvey_controller_1.pulseSurveyController.getPulseSurveyByModule);
pulseRouter.delete('/:id', pulseSurvey_controller_1.pulseSurveyController.archivePulseSurvey);
exports.default = pulseRouter;
//# sourceMappingURL=pulseSurvey.routes.js.map