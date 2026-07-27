"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/surveyResponse.routes.ts - UPDATED FOR MOUNTING
const express_1 = require("express");
const surveyResponse_controller_1 = require("../controllers/surveyResponse.controller");
const upload_middleware_1 = require("../middlewares/upload.middleware");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const surveyResponseRouter = (0, express_1.Router)({ mergeParams: true });
// Routes mounted at /surveys/:surveyId/responses
// The :surveyId parameter is passed from parent router
// Survey response management routes
surveyResponseRouter.post('/start', surveyResponse_controller_1.startSurveyResponse); // POST /surveys/:surveyId/responses/start
surveyResponseRouter.post('/consent-declined', surveyResponse_controller_1.recordConsentDeclined); // ADD THIS LINE - POST /surveys/:surveyId/responses/consent-declined
surveyResponseRouter.get('/', auth_middleware_1.default, surveyResponse_controller_1.getSurveyResponses); // GET /surveys/:surveyId/responses
surveyResponseRouter.get('/statistics', auth_middleware_1.default, surveyResponse_controller_1.getSurveyStatistics); // GET /surveys/:surveyId/responses/statistics
surveyResponseRouter.get('/export', auth_middleware_1.default, surveyResponse_controller_1.exportSurveyResponses); // GET /surveys/:surveyId/responses/export
// Individual response operations (these expect :responseId)
surveyResponseRouter.get('/:responseId', surveyResponse_controller_1.getSurveyResponse); // GET /surveys/:surveyId/responses/:responseId
surveyResponseRouter.post('/:responseId/answers', upload_middleware_1.upload.single('file'), surveyResponse_controller_1.submitAnswer); // POST /surveys/:surveyId/responses/:responseId/answers
surveyResponseRouter.put('/:responseId/progress', surveyResponse_controller_1.updateProgress); // PUT /surveys/:surveyId/responses/:responseId/progress
surveyResponseRouter.put('/:responseId/complete', surveyResponse_controller_1.completeSurveyResponse); // PUT /surveys/:surveyId/responses/:responseId/complete
exports.default = surveyResponseRouter;
//# sourceMappingURL=surveyResponse.routes.js.map