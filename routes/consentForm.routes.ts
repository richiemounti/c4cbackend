// routes/consentForm.routes.ts - ADD PUBLIC ROUTE
import { Router } from "express";
import {
  createConsentForm,
  getConsentForms,
  getConsentForm,
  updateConsentForm,
  archiveConsentForm,
  getAvailableConsentFormsForProject,
  cloneConsentForm,
  getPublicConsentForm // ADD THIS
} from "../controllers/consentForm.controller";

import authorize from "../middlewares/auth.middleware";

const consentFormRouter = Router();

// PUBLIC ROUTE - must be before auth middleware
consentFormRouter.get('/public/:consentFormId', getPublicConsentForm);

// Protected routes
consentFormRouter.post('/', authorize, createConsentForm);
consentFormRouter.get('/', authorize, getConsentForms);
consentFormRouter.get('/:id', authorize, getConsentForm);
consentFormRouter.put('/:id', authorize, updateConsentForm);
consentFormRouter.delete('/:id', authorize, archiveConsentForm);

// Helper routes
consentFormRouter.get('/available/:projectId', authorize, getAvailableConsentFormsForProject);
consentFormRouter.post('/:id/clone', authorize, cloneConsentForm);

export default consentFormRouter;