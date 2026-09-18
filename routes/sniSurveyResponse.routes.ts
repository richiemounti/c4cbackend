// routes/sniSurveyResponse.routes.ts
// Mounted at /api/v1/sni/surveys/:surveyId/responses (mirrors
// routes/surveyResponse.routes.ts's mounting convention exactly).
import { Router } from "express";
import {
    startSniSurveyResponse,
    getNextSniScreen,
    confirmSniPreloadAlter,
    completeSniPreload,
    submitSniNameGeneratorAnswer,
    submitSniAlterBatteryAnswers,
    submitSniStandardAnswer,
    completeSniSurveyResponse,
} from "../controllers/sniSurveyResponse.controller";

const sniSurveyResponseRouter = Router({ mergeParams: true });

sniSurveyResponseRouter.post('/start', startSniSurveyResponse);
sniSurveyResponseRouter.get('/:responseId/next', getNextSniScreen);
sniSurveyResponseRouter.post('/:responseId/preload/confirm', confirmSniPreloadAlter);
sniSurveyResponseRouter.post('/:responseId/preload/complete', completeSniPreload);
sniSurveyResponseRouter.post('/:responseId/name-generator', submitSniNameGeneratorAnswer);
sniSurveyResponseRouter.post('/:responseId/alter-battery', submitSniAlterBatteryAnswers);
sniSurveyResponseRouter.post('/:responseId/standard-answer', submitSniStandardAnswer);
sniSurveyResponseRouter.post('/:responseId/complete', completeSniSurveyResponse);

export default sniSurveyResponseRouter;
