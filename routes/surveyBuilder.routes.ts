// routes/surveyBuilder.routes.ts
import { Router } from "express";
import {
  getFilteredQuestionsForSurvey,
  getSurveyBuilderContext,
  createCategorizedSurvey,
  getSurveysByStakeholder,
  getSurveysByProjectAndStage,
  updateSurveyCategory,
  getStakeholderSurveyStats,
  cloneSurveyWithCategory
} from "../controllers/surveyBuilder.controller";

import authorize from "../middlewares/auth.middleware";
import { hasProjectAccess } from "../middlewares/role.middleware";

const surveyBuilderRouter = Router();

// Apply authorization to all routes
surveyBuilderRouter.use(authorize);

// Module 1: Question Filtering Routes
surveyBuilderRouter.get('/questions/filtered', getFilteredQuestionsForSurvey);
surveyBuilderRouter.get('/context/:stakeholderGroupId/:stageId', getSurveyBuilderContext);

// Module 2: Enhanced Survey Creation Routes
surveyBuilderRouter.post('/surveys', createCategorizedSurvey);
surveyBuilderRouter.get('/surveys/stakeholder/:stakeholderGroupId', getSurveysByStakeholder);
surveyBuilderRouter.get('/surveys/project/:projectId/stage/:stageId', getSurveysByProjectAndStage);

// Survey Management Routes
surveyBuilderRouter.put('/surveys/:surveyId/category', updateSurveyCategory);
surveyBuilderRouter.post('/surveys/:surveyId/clone', cloneSurveyWithCategory);

// Statistics and Analytics
surveyBuilderRouter.get('/stats/stakeholder/:stakeholderGroupId', getStakeholderSurveyStats);

export default surveyBuilderRouter;