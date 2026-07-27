"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/survey.routes.ts - CLEAN VERSION WITH MOUNTED SUB-ROUTES
const express_1 = require("express");
const survey_controller_1 = require("../controllers/survey.controller");
// Import the dedicated route files
const surveyQuestion_routes_1 = __importDefault(require("./surveyQuestion.routes"));
const surveyResponse_routes_1 = __importDefault(require("./surveyResponse.routes"));
const surveySection_routes_1 = __importDefault(require("./surveySection.routes"));
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const role_middleware_1 = require("../middlewares/role.middleware");
const surveyTranslation_routes_1 = __importDefault(require("./surveyTranslation.routes"));
const surveyRouter = (0, express_1.Router)();
// ===============================
// CORE SURVEY CRUD ROUTES (handled by survey controller)
// ===============================
surveyRouter.post('/', auth_middleware_1.default, survey_controller_1.createSurvey);
surveyRouter.get('/', auth_middleware_1.default, survey_controller_1.getSurveys);
surveyRouter.get('/:id', auth_middleware_1.default, survey_controller_1.getSurvey);
surveyRouter.put('/:id', auth_middleware_1.default, survey_controller_1.updateSurvey);
surveyRouter.delete('/:id', auth_middleware_1.default, survey_controller_1.archiveSurvey);
surveyRouter.post('/:id/restore', auth_middleware_1.default, survey_controller_1.restoreSurvey);
surveyRouter.delete('/:id/permanent', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), survey_controller_1.deleteSurvey);
surveyRouter.post('/:id/clone', auth_middleware_1.default, survey_controller_1.cloneSurvey);
// ===============================
// SAMPLING CALCULATOR ROUTES
// ===============================
surveyRouter.post('/:id/calculate-sample-size', auth_middleware_1.default, survey_controller_1.calculateSampleSize);
surveyRouter.get('/:id/sample-size', auth_middleware_1.default, survey_controller_1.getSampleSizeCalculation);
// ===============================
// SURVEY STRUCTURE ROUTES (handled by survey controller)
// ===============================
surveyRouter.get('/:id/structure', auth_middleware_1.default, survey_controller_1.getSurveyStructure);
surveyRouter.get('/:id/sections', auth_middleware_1.default, survey_controller_1.getSurveySections);
surveyRouter.get('/:id/questions', auth_middleware_1.default, survey_controller_1.getSurveyQuestions);
surveyRouter.get('/:id/consent-form/public', survey_controller_1.getPublicSurveyConsentForm);
surveyRouter.get('/:id/public-data', survey_controller_1.getPublicSurveyData);
surveyRouter.put('/:id/consent-form', auth_middleware_1.default, survey_controller_1.attachConsentFormToSurvey);
// ===============================
// SURVEY BUILDER ROUTES (handled by survey controller)
// ===============================
surveyRouter.get('/builder/questions/filtered', auth_middleware_1.default, survey_controller_1.getFilteredQuestionsForSurvey);
surveyRouter.get('/builder/context/:stakeholderGroupId/:stageId', auth_middleware_1.default, survey_controller_1.getSurveyBuilderContext);
// ===============================
// ENHANCED SURVEY MANAGEMENT ROUTES (handled by survey controller)
// ===============================
surveyRouter.get('/stakeholder/:stakeholderGroupId', auth_middleware_1.default, survey_controller_1.getSurveysByStakeholder);
surveyRouter.get('/project/:projectId/stage/:stageId', auth_middleware_1.default, survey_controller_1.getSurveysByProjectAndStage);
surveyRouter.put('/:surveyId/category', auth_middleware_1.default, survey_controller_1.updateSurveyCategory);
surveyRouter.get('/stats/stakeholder/:stakeholderGroupId', auth_middleware_1.default, survey_controller_1.getStakeholderSurveyStats);
// ===============================
// MOUNT SUB-ROUTES FOR DEDICATED CONTROLLERS
// ===============================
// Mount survey question routes - these handle /surveys/:surveyId/questions/* 
// The surveyQuestionRouter expects :surveyId parameter
surveyRouter.use('/:surveyId/questions', surveyQuestion_routes_1.default);
// Mount survey section routes - these handle /surveys/:surveyId/sections/*
// The sectionRouter expects :surveyId parameter  
surveyRouter.use('/:surveyId/sections', surveySection_routes_1.default);
// Mount survey response routes - these handle /surveys/:surveyId/responses/*
// The surveyResponseRouter expects :surveyId parameter
surveyRouter.use('/:surveyId/responses', surveyResponse_routes_1.default);
// Mount survey translation routes - these handle /surveys/:surveyId/translations/*
surveyRouter.use('/:surveyId/translations', surveyTranslation_routes_1.default);
exports.default = surveyRouter;
//# sourceMappingURL=survey.routes.js.map