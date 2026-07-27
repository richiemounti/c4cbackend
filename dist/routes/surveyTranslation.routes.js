"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/surveyTranslation.routes.ts
const express_1 = require("express");
const surveyTranslation_controller_1 = require("../controllers/surveyTranslation.controller");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const surveyTranslationRouter = (0, express_1.Router)({ mergeParams: true });
// Mounted at /surveys/:surveyId/translations
surveyTranslationRouter.post('/', auth_middleware_1.default, surveyTranslation_controller_1.createSurveyTranslation);
surveyTranslationRouter.get('/', auth_middleware_1.default, surveyTranslation_controller_1.getSurveyTranslations);
surveyTranslationRouter.get('/published', surveyTranslation_controller_1.getPublishedTranslations); // public - respondents
surveyTranslationRouter.get('/statistics', auth_middleware_1.default, surveyTranslation_controller_1.getTranslationStatistics);
exports.default = surveyTranslationRouter;
//# sourceMappingURL=surveyTranslation.routes.js.map