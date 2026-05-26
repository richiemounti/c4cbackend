// routes/survey.routes.ts - CLEAN VERSION WITH MOUNTED SUB-ROUTES
import { Router } from "express";
import {
  createSurvey,
  getSurveys,
  getSurvey,
  updateSurvey,
  archiveSurvey,
  restoreSurvey,
  deleteSurvey,
  cloneSurvey,
  getSurveySections,
  getSurveyQuestions,
  getSurveyStructure,
  // Survey Builder operations
  getFilteredQuestionsForSurvey,
  getSurveyBuilderContext,
  getSurveysByStakeholder,
  getSurveysByProjectAndStage,
  updateSurveyCategory,
  calculateSampleSize,
  getSampleSizeCalculation,
  getStakeholderSurveyStats,
  attachConsentFormToSurvey,
  getPublicSurveyConsentForm,
  getPublicSurveyData
} from "../controllers/survey.controller";

// Import the dedicated route files
import surveyQuestionRouter from "./surveyQuestion.routes";
import surveyResponseRouter from "./surveyResponse.routes";
import sectionRouter from "./surveySection.routes";

import authorize from "../middlewares/auth.middleware";
import { hasProjectAccess, isConnectGoStaff } from "../middlewares/role.middleware";
import surveyTranslationRouter from "./surveyTranslation.routes";

const surveyRouter = Router();

// ===============================
// CORE SURVEY CRUD ROUTES (handled by survey controller)
// ===============================

surveyRouter.post('/', authorize, createSurvey);
surveyRouter.get('/', authorize, getSurveys);
surveyRouter.get('/:id', authorize, getSurvey);
surveyRouter.put('/:id', authorize, updateSurvey);
surveyRouter.delete('/:id', authorize, archiveSurvey);
surveyRouter.post('/:id/restore', authorize, restoreSurvey);
surveyRouter.delete('/:id/permanent', authorize, isConnectGoStaff(), deleteSurvey);
surveyRouter.post('/:id/clone', authorize, cloneSurvey);

// ===============================
// SAMPLING CALCULATOR ROUTES
// ===============================

surveyRouter.post('/:id/calculate-sample-size', authorize, calculateSampleSize);
surveyRouter.get('/:id/sample-size', authorize, getSampleSizeCalculation);

// ===============================
// SURVEY STRUCTURE ROUTES (handled by survey controller)
// ===============================

surveyRouter.get('/:id/structure', authorize, getSurveyStructure);
surveyRouter.get('/:id/sections', authorize, getSurveySections);
surveyRouter.get('/:id/questions', authorize, getSurveyQuestions);

surveyRouter.get('/:id/consent-form/public', getPublicSurveyConsentForm);
surveyRouter.get('/:id/public-data', getPublicSurveyData);

surveyRouter.put('/:id/consent-form', authorize, attachConsentFormToSurvey);


// ===============================
// SURVEY BUILDER ROUTES (handled by survey controller)
// ===============================

surveyRouter.get('/builder/questions/filtered', authorize, getFilteredQuestionsForSurvey);
surveyRouter.get('/builder/context/:stakeholderGroupId/:stageId', authorize, getSurveyBuilderContext);

// ===============================
// ENHANCED SURVEY MANAGEMENT ROUTES (handled by survey controller)
// ===============================

surveyRouter.get('/stakeholder/:stakeholderGroupId', authorize, getSurveysByStakeholder);
surveyRouter.get('/project/:projectId/stage/:stageId', authorize, getSurveysByProjectAndStage);
surveyRouter.put('/:surveyId/category', authorize, updateSurveyCategory);
surveyRouter.get('/stats/stakeholder/:stakeholderGroupId', authorize, getStakeholderSurveyStats);

// ===============================
// MOUNT SUB-ROUTES FOR DEDICATED CONTROLLERS
// ===============================

// Mount survey question routes - these handle /surveys/:surveyId/questions/* 
// The surveyQuestionRouter expects :surveyId parameter
surveyRouter.use('/:surveyId/questions', surveyQuestionRouter);

// Mount survey section routes - these handle /surveys/:surveyId/sections/*
// The sectionRouter expects :surveyId parameter  
surveyRouter.use('/:surveyId/sections', sectionRouter);

// Mount survey response routes - these handle /surveys/:surveyId/responses/*
// The surveyResponseRouter expects :surveyId parameter
surveyRouter.use('/:surveyId/responses', surveyResponseRouter);

// Mount survey translation routes - these handle /surveys/:surveyId/translations/*
surveyRouter.use('/:surveyId/translations', surveyTranslationRouter);


export default surveyRouter;