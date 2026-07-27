"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/surveySection.routes.ts - UPDATED FOR MOUNTING
const express_1 = require("express");
const surveySection_controller_1 = require("../controllers/surveySection.controller");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const sectionRouter = (0, express_1.Router)({ mergeParams: true });
// Routes mounted at /surveys/:surveyId/sections
// The :surveyId parameter is passed from parent router
// Create new section for survey
sectionRouter.post('/', auth_middleware_1.default, surveySection_controller_1.createSurveySection);
// Reorder sections in survey
sectionRouter.put('/reorder', auth_middleware_1.default, surveySection_controller_1.reorderSurveySections);
// Individual section operations (these expect :id to be the sectionId)
sectionRouter.get('/:id', auth_middleware_1.default, surveySection_controller_1.getSurveySection);
sectionRouter.put('/:id', auth_middleware_1.default, surveySection_controller_1.updateSurveySection);
sectionRouter.delete('/:id', auth_middleware_1.default, surveySection_controller_1.deleteSurveySection);
sectionRouter.get('/:id/questions', auth_middleware_1.default, surveySection_controller_1.getSectionQuestions);
exports.default = sectionRouter;
//# sourceMappingURL=surveySection.routes.js.map