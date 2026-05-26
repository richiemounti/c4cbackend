// routes/question.routes.ts
import { Router } from "express";
import {
  createQuestion,
  getQuestions,
  getQuestion,
  updateQuestion,
  archiveQuestion,
  restoreQuestion,
  deleteQuestion,
  cloneQuestion,
  getQuestionTagStatistics,
  getQuestionAvailableTags,        // ← NEW
  getSubthemeAvailableTags,      // ← NEW
  bulkToggleDemographic,
  getDemographicComplianceReport,
  getDemographicsByCategory,
  getRecommendedDemographics,
  getStandardDemographics,
  toggleStandardDemographic
  ,
  // NEW: Import bespoke question functions
  createBespokeQuestion,
  getBespokeQuestionsByProject,
  getBespokeQuestionsByOrganization,
  getAvailableBespokeQuestions,
  approveBespokeQuestion,
  rejectBespokeQuestion,
  elevateBespokeQuestion,
  updateBespokeQuestion,
  getBespokeQuestionStatistics,
  validateQuestionConditionalLogic,
  getQuestionConditionalDependencies,
  getQuestionsWithDependencies,
  getQuestionDependents,
  updateQuestionConditionalLogic
} from "../controllers/question.controller";

import authorize from "../middlewares/auth.middleware";
import { isConnectGoStaff } from "../middlewares/role.middleware";

const questionRouter = Router();

// ── Static collection-level routes (must be before /:id to avoid shadowing) ──
questionRouter.get('/', getQuestions);
questionRouter.get('/tag-statistics', authorize, isConnectGoStaff(), getQuestionTagStatistics);

// Demographics — read
questionRouter.get('/demographics', authorize, getStandardDemographics);
questionRouter.get('/demographics/category/:category', authorize, getDemographicsByCategory);
questionRouter.get('/demographics/recommended/:audience', authorize, getRecommendedDemographics);
questionRouter.get('/demographics/compliance-report', authorize, isConnectGoStaff(), getDemographicComplianceReport);

// Demographics — write
questionRouter.put('/bulk-toggle-demographic', authorize, isConnectGoStaff(), bulkToggleDemographic);

// Subtheme tag helper
questionRouter.get('/subthemes/:id/available-tags-for-questions', authorize, getSubthemeAvailableTags);

// Bespoke questions
questionRouter.post('/bespoke', authorize, createBespokeQuestion);
questionRouter.get('/bespoke/project/:projectId', authorize, getBespokeQuestionsByProject);
questionRouter.get('/bespoke/project/:projectId/available', authorize, getAvailableBespokeQuestions);
questionRouter.get('/bespoke/project/:projectId/statistics', authorize, getBespokeQuestionStatistics);
questionRouter.get('/bespoke/organization/:organizationId', authorize, getBespokeQuestionsByOrganization);
questionRouter.put('/bespoke/:id', authorize, updateBespokeQuestion);

// Bulk conditional logic fetch
questionRouter.post('/with-dependencies', authorize, getQuestionsWithDependencies);

// ConnectGo staff — create
questionRouter.post('/', authorize, isConnectGoStaff(), createQuestion);

// ── Param routes (/:id must come after all static paths) ──
questionRouter.get('/:id', getQuestion);
questionRouter.put('/:id', authorize, isConnectGoStaff(), updateQuestion);
questionRouter.delete('/:id', authorize, isConnectGoStaff(), archiveQuestion);
questionRouter.post('/:id/restore', authorize, isConnectGoStaff(), restoreQuestion);
questionRouter.delete('/:id/permanent', authorize, isConnectGoStaff(), deleteQuestion);
questionRouter.post('/:id/clone', authorize, isConnectGoStaff(), cloneQuestion);
questionRouter.get('/:id/available-tags', authorize, getQuestionAvailableTags);
questionRouter.put('/:id/toggle-demographic', authorize, isConnectGoStaff(), toggleStandardDemographic);
questionRouter.put('/:id/conditional-logic', authorize, isConnectGoStaff(), updateQuestionConditionalLogic);
questionRouter.post('/:id/validate-conditional-logic', authorize, validateQuestionConditionalLogic);
questionRouter.get('/:id/conditional-dependencies', authorize, getQuestionConditionalDependencies);
questionRouter.get('/:id/dependents', authorize, getQuestionDependents);
questionRouter.put('/:id/approve', authorize, approveBespokeQuestion);
questionRouter.put('/:id/reject', authorize, rejectBespokeQuestion);
questionRouter.post('/:id/elevate', authorize, isConnectGoStaff(), elevateBespokeQuestion);

export default questionRouter;