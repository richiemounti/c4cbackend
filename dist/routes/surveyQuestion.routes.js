"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/surveyQuestion.routes.ts - UPDATED FOR MOUNTING
const express_1 = require("express");
const surveyQuestion_controller_1 = require("../controllers/surveyQuestion.controller");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const surveyQuestionRouter = (0, express_1.Router)({ mergeParams: true });
// Routes mounted at /surveys/:surveyId/questions
// The :surveyId parameter is passed from parent router
// Add question to survey
surveyQuestionRouter.post('/', auth_middleware_1.default, surveyQuestion_controller_1.addQuestionToSurvey);
// Bulk add questions with dependency resolution
surveyQuestionRouter.post('/bulk-add', auth_middleware_1.default, surveyQuestion_controller_1.bulkAddQuestionsWithDependencies);
// Reorder questions in survey
surveyQuestionRouter.put('/reorder', auth_middleware_1.default, surveyQuestion_controller_1.reorderQuestions);
// Individual question operations (these expect :id to be the questionId)
surveyQuestionRouter.get('/:id', auth_middleware_1.default, surveyQuestion_controller_1.getSurveyQuestion);
surveyQuestionRouter.put('/:id', auth_middleware_1.default, surveyQuestion_controller_1.updateSurveyQuestion);
surveyQuestionRouter.delete('/:id', auth_middleware_1.default, surveyQuestion_controller_1.deleteSurveyQuestion);
surveyQuestionRouter.put('/:id/move', auth_middleware_1.default, surveyQuestion_controller_1.moveQuestion);
// Update only the conditional logic of a survey question
surveyQuestionRouter.put('/:id/conditional-logic', auth_middleware_1.default, surveyQuestion_controller_1.updateSurveyQuestionConditionalLogic);
surveyQuestionRouter.delete('/:id', auth_middleware_1.default, surveyQuestion_controller_1.deleteSurveyQuestion);
exports.default = surveyQuestionRouter;
//# sourceMappingURL=surveyQuestion.routes.js.map