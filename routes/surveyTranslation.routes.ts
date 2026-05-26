// routes/surveyTranslation.routes.ts
import { Router } from "express";
import {
  createSurveyTranslation,
  getSurveyTranslations,
  getPublishedTranslations,
  getTranslationStatistics
} from "../controllers/surveyTranslation.controller";

import authorize from "../middlewares/auth.middleware";

const surveyTranslationRouter = Router({ mergeParams: true });

// Mounted at /surveys/:surveyId/translations
surveyTranslationRouter.post('/', authorize, createSurveyTranslation);
surveyTranslationRouter.get('/', authorize, getSurveyTranslations);
surveyTranslationRouter.get('/published', getPublishedTranslations); // public - respondents
surveyTranslationRouter.get('/statistics', authorize, getTranslationStatistics);

export default surveyTranslationRouter;