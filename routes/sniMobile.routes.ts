// routes/sniMobile.routes.ts — mounted at /api/v1/sni/mobile
import { Router } from 'express';
import { getMobileSniProjectSurveys } from '../controllers/sniMobile.controller';
import authorize from '../middlewares/auth.middleware';

const sniMobileRouter = Router();

// Every mobile route requires a valid JWT — no exceptions (mirrors mobile.routes.ts)
sniMobileRouter.use(authorize);

// The existing /api/v1/mobile/me (getMobileProfile) is reused as-is for SNI
// too — it's already generic (user + orgs + accessible projects, not tied to
// a survey type), so there's no need to duplicate it here.
sniMobileRouter.get('/projects/:projectId/surveys', getMobileSniProjectSurveys);

export default sniMobileRouter;
