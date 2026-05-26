import express from 'express';
import { pulseSurveyController } from '../controllers/pulseSurvey.controller';
import authorize from '../middlewares/auth.middleware';

const pulseRouter = express.Router();

pulseRouter.use(authorize);

// ============ TEMPLATES ============
pulseRouter.post('/', pulseSurveyController.createOrUpdatePulseSurvey);
pulseRouter.get('/', pulseSurveyController.getAllPulseSurveys);

// ============ RESPONSES ============
// These must come before /:moduleType
pulseRouter.post('/responses', pulseSurveyController.submitPulseSurveyResponse);
pulseRouter.get('/responses', pulseSurveyController.getPulseSurveyResponses);

// ============ ANALYTICS ============
pulseRouter.get('/analytics', pulseSurveyController.getPulseSurveyAnalytics);

// ============ CHECK REQUIRED ============
pulseRouter.get('/check-required/:moduleType/:moduleReference', pulseSurveyController.checkPulseSurveyRequired);

// ============ DYNAMIC — must be last ============
pulseRouter.get('/:moduleType', pulseSurveyController.getPulseSurveyByModule);
pulseRouter.delete('/:id', pulseSurveyController.archivePulseSurvey);

export default pulseRouter;