// routes/surveyQuestion.routes.ts - UPDATED FOR MOUNTING
import { Router } from "express";
import {
  addQuestionToSurvey,
  reorderQuestions,
  getSurveyQuestion,
  updateSurveyQuestion,
  deleteSurveyQuestion,
  moveQuestion,
  // NEW imports
  bulkAddQuestionsWithDependencies,
  updateSurveyQuestionConditionalLogic
} from "../controllers/surveyQuestion.controller";

import authorize from "../middlewares/auth.middleware";

const surveyQuestionRouter = Router({ mergeParams: true });

// Routes mounted at /surveys/:surveyId/questions
// The :surveyId parameter is passed from parent router

// Add question to survey
surveyQuestionRouter.post('/', authorize, addQuestionToSurvey)

// Bulk add questions with dependency resolution
surveyQuestionRouter.post(
  '/bulk-add',
  authorize,
  bulkAddQuestionsWithDependencies
);

// Reorder questions in survey
surveyQuestionRouter.put('/reorder', authorize, reorderQuestions);

// Individual question operations (these expect :id to be the questionId)
surveyQuestionRouter.get('/:id', authorize, getSurveyQuestion);
surveyQuestionRouter.put('/:id', authorize, updateSurveyQuestion);
surveyQuestionRouter.delete('/:id', authorize, deleteSurveyQuestion);
surveyQuestionRouter.put('/:id/move', authorize, moveQuestion);

// Update only the conditional logic of a survey question
surveyQuestionRouter.put(
  '/:id/conditional-logic',
  authorize,
  updateSurveyQuestionConditionalLogic
);

surveyQuestionRouter.delete(
  '/:id',
  authorize,
  deleteSurveyQuestion
);

export default surveyQuestionRouter;