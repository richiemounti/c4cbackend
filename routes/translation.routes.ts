// routes/translation.routes.ts
import { Router } from "express";
import translationController from "../controllers/surveyTranslation.controller";
import { autoTranslateSurvey } from "../controllers/surveyTranslation.controller"; // we'll add this
import authorize from "../middlewares/auth.middleware";

const translationRouter = Router();

// GET  /translations/:id         - full translation with populated content
// GET  /translations/:id/full    - public version for respondents taking survey
translationRouter.get('/:id', authorize, translationController.getTranslation);
translationRouter.get('/:id/full', translationController.getFullTranslation); // public

// PUT  /translations/:id         - update metadata (title, notes, etc.)
translationRouter.put('/:id', authorize, translationController.updateTranslation);

// DELETE /translations/:id       - archive
translationRouter.delete('/:id', authorize, translationController.archiveTranslation);

// Section translation
translationRouter.put('/:id/sections/:sectionId', authorize, translationController.updateTranslatedSection);

// Question translations - individual and bulk
translationRouter.put('/:id/questions/bulk', authorize, translationController.bulkUpdateTranslatedQuestions);
translationRouter.put('/:id/questions/:questionId', authorize, translationController.updateTranslatedQuestion);

// Workflow state transitions
translationRouter.put('/:id/submit', authorize, translationController.submitForReview);
translationRouter.put('/:id/approve', authorize, translationController.approveTranslation);
translationRouter.put('/:id/publish', authorize, translationController.publishTranslation);

// Auto-translate via Google Translate (we'll add this)
translationRouter.post('/:id/auto-translate', authorize, autoTranslateSurvey);

export default translationRouter;