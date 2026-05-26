// routes/surveySection.routes.ts - UPDATED FOR MOUNTING
import { Router } from "express";
import {
  createSurveySection,
  reorderSurveySections,
  getSurveySection,
  updateSurveySection,
  deleteSurveySection,
  getSectionQuestions
} from "../controllers/surveySection.controller";

import authorize from "../middlewares/auth.middleware";

const sectionRouter = Router({ mergeParams: true });

// Routes mounted at /surveys/:surveyId/sections
// The :surveyId parameter is passed from parent router

// Create new section for survey
sectionRouter.post('/', authorize, createSurveySection);

// Reorder sections in survey
sectionRouter.put('/reorder', authorize, reorderSurveySections);

// Individual section operations (these expect :id to be the sectionId)
sectionRouter.get('/:id', authorize, getSurveySection);
sectionRouter.put('/:id', authorize, updateSurveySection);
sectionRouter.delete('/:id', authorize, deleteSurveySection);
sectionRouter.get('/:id/questions', authorize, getSectionQuestions);

export default sectionRouter;