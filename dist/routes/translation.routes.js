"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/translation.routes.ts
const express_1 = require("express");
const surveyTranslation_controller_1 = __importDefault(require("../controllers/surveyTranslation.controller"));
const surveyTranslation_controller_2 = require("../controllers/surveyTranslation.controller"); // we'll add this
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const translationRouter = (0, express_1.Router)();
// GET  /translations/:id         - full translation with populated content
// GET  /translations/:id/full    - public version for respondents taking survey
translationRouter.get('/:id', auth_middleware_1.default, surveyTranslation_controller_1.default.getTranslation);
translationRouter.get('/:id/full', surveyTranslation_controller_1.default.getFullTranslation); // public
// PUT  /translations/:id         - update metadata (title, notes, etc.)
translationRouter.put('/:id', auth_middleware_1.default, surveyTranslation_controller_1.default.updateTranslation);
// DELETE /translations/:id       - archive
translationRouter.delete('/:id', auth_middleware_1.default, surveyTranslation_controller_1.default.archiveTranslation);
// Section translation
translationRouter.put('/:id/sections/:sectionId', auth_middleware_1.default, surveyTranslation_controller_1.default.updateTranslatedSection);
// Question translations - individual and bulk
translationRouter.put('/:id/questions/bulk', auth_middleware_1.default, surveyTranslation_controller_1.default.bulkUpdateTranslatedQuestions);
translationRouter.put('/:id/questions/:questionId', auth_middleware_1.default, surveyTranslation_controller_1.default.updateTranslatedQuestion);
// Workflow state transitions
translationRouter.put('/:id/submit', auth_middleware_1.default, surveyTranslation_controller_1.default.submitForReview);
translationRouter.put('/:id/approve', auth_middleware_1.default, surveyTranslation_controller_1.default.approveTranslation);
translationRouter.put('/:id/publish', auth_middleware_1.default, surveyTranslation_controller_1.default.publishTranslation);
// Auto-translate via Google Translate (we'll add this)
translationRouter.post('/:id/auto-translate', auth_middleware_1.default, surveyTranslation_controller_2.autoTranslateSurvey);
exports.default = translationRouter;
//# sourceMappingURL=translation.routes.js.map