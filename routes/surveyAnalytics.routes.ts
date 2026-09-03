// routes/surveyAnalytics.routes.ts
import { Router } from 'express';
import authorize from '../middlewares/auth.middleware';
import { getReport } from '../controllers/surveyAnalytics.controller';

const surveyAnalyticsRouter = Router();

surveyAnalyticsRouter.get('/report', authorize, getReport);

export default surveyAnalyticsRouter;
