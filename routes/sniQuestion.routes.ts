// routes/sniQuestion.routes.ts — mounted at /api/v1/sni/surveys/:surveyId/questions
import { Router } from "express";
import { createSniQuestion, getSniQuestions, updateSniQuestion, archiveSniQuestion } from "../controllers/sniQuestion.controller";
import authorize from "../middlewares/auth.middleware";
import { isConnectGoStaff } from "../middlewares/role.middleware";

const sniQuestionRouter = Router({ mergeParams: true });

sniQuestionRouter.post('/', authorize, isConnectGoStaff(), createSniQuestion);
sniQuestionRouter.get('/', authorize, isConnectGoStaff(), getSniQuestions);
sniQuestionRouter.put('/:id', authorize, isConnectGoStaff(), updateSniQuestion);
sniQuestionRouter.delete('/:id', authorize, isConnectGoStaff(), archiveSniQuestion);

export default sniQuestionRouter;
