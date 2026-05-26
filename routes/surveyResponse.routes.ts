// routes/surveyResponse.routes.ts - UPDATED FOR MOUNTING
import { Router } from "express";
import {
  startSurveyResponse,
  getSurveyResponses,
  getSurveyStatistics,
  exportSurveyResponses,
  getSurveyResponse,
  submitAnswer,
  updateProgress,
  completeSurveyResponse,
  recordConsentDeclined  
} from "../controllers/surveyResponse.controller";
import { upload } from '../middlewares/upload.middleware';

import authorize from "../middlewares/auth.middleware";

const surveyResponseRouter = Router({ mergeParams: true });

// Routes mounted at /surveys/:surveyId/responses
// The :surveyId parameter is passed from parent router

// Survey response management routes
surveyResponseRouter.post('/start', startSurveyResponse);           // POST /surveys/:surveyId/responses/start
surveyResponseRouter.post('/consent-declined', recordConsentDeclined); // ADD THIS LINE - POST /surveys/:surveyId/responses/consent-declined
surveyResponseRouter.get('/', authorize, getSurveyResponses);       // GET /surveys/:surveyId/responses
surveyResponseRouter.get('/statistics', authorize, getSurveyStatistics); // GET /surveys/:surveyId/responses/statistics
surveyResponseRouter.get('/export', authorize, exportSurveyResponses);   // GET /surveys/:surveyId/responses/export

// Individual response operations (these expect :responseId)
surveyResponseRouter.get('/:responseId', getSurveyResponse);              // GET /surveys/:surveyId/responses/:responseId
surveyResponseRouter.post('/:responseId/answers', upload.single('file'), submitAnswer);          // POST /surveys/:surveyId/responses/:responseId/answers
surveyResponseRouter.put('/:responseId/progress', updateProgress);        // PUT /surveys/:surveyId/responses/:responseId/progress
surveyResponseRouter.put('/:responseId/complete', completeSurveyResponse);// PUT /surveys/:surveyId/responses/:responseId/complete

export default surveyResponseRouter;