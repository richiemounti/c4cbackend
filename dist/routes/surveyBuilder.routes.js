"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/surveyBuilder.routes.ts
const express_1 = require("express");
const surveyBuilder_controller_1 = require("../controllers/surveyBuilder.controller");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const surveyBuilderRouter = (0, express_1.Router)();
// Apply authorization to all routes
surveyBuilderRouter.use(auth_middleware_1.default);
// Module 1: Question Filtering Routes
surveyBuilderRouter.get('/questions/filtered', surveyBuilder_controller_1.getFilteredQuestionsForSurvey);
surveyBuilderRouter.get('/context/:stakeholderGroupId/:stageId', surveyBuilder_controller_1.getSurveyBuilderContext);
// Module 2: Enhanced Survey Creation Routes
surveyBuilderRouter.post('/surveys', surveyBuilder_controller_1.createCategorizedSurvey);
surveyBuilderRouter.get('/surveys/stakeholder/:stakeholderGroupId', surveyBuilder_controller_1.getSurveysByStakeholder);
surveyBuilderRouter.get('/surveys/project/:projectId/stage/:stageId', surveyBuilder_controller_1.getSurveysByProjectAndStage);
// Survey Management Routes
surveyBuilderRouter.put('/surveys/:surveyId/category', surveyBuilder_controller_1.updateSurveyCategory);
surveyBuilderRouter.post('/surveys/:surveyId/clone', surveyBuilder_controller_1.cloneSurveyWithCategory);
// Statistics and Analytics
surveyBuilderRouter.get('/stats/stakeholder/:stakeholderGroupId', surveyBuilder_controller_1.getStakeholderSurveyStats);
exports.default = surveyBuilderRouter;
//# sourceMappingURL=surveyBuilder.routes.js.map