"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/question.routes.ts
const express_1 = require("express");
const question_controller_1 = require("../controllers/question.controller");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const role_middleware_1 = require("../middlewares/role.middleware");
const questionRouter = (0, express_1.Router)();
// ── Static collection-level routes (must be before /:id to avoid shadowing) ──
questionRouter.get('/', question_controller_1.getQuestions);
questionRouter.get('/tag-statistics', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), question_controller_1.getQuestionTagStatistics);
// Demographics — read
questionRouter.get('/demographics', auth_middleware_1.default, question_controller_1.getStandardDemographics);
questionRouter.get('/demographics/category/:category', auth_middleware_1.default, question_controller_1.getDemographicsByCategory);
questionRouter.get('/demographics/recommended/:audience', auth_middleware_1.default, question_controller_1.getRecommendedDemographics);
questionRouter.get('/demographics/compliance-report', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), question_controller_1.getDemographicComplianceReport);
// Demographics — write
questionRouter.put('/bulk-toggle-demographic', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), question_controller_1.bulkToggleDemographic);
// Subtheme tag helper
questionRouter.get('/subthemes/:id/available-tags-for-questions', auth_middleware_1.default, question_controller_1.getSubthemeAvailableTags);
// Bespoke questions
questionRouter.post('/bespoke', auth_middleware_1.default, question_controller_1.createBespokeQuestion);
questionRouter.get('/bespoke/project/:projectId', auth_middleware_1.default, question_controller_1.getBespokeQuestionsByProject);
questionRouter.get('/bespoke/project/:projectId/available', auth_middleware_1.default, question_controller_1.getAvailableBespokeQuestions);
questionRouter.get('/bespoke/project/:projectId/statistics', auth_middleware_1.default, question_controller_1.getBespokeQuestionStatistics);
questionRouter.get('/bespoke/organization/:organizationId', auth_middleware_1.default, question_controller_1.getBespokeQuestionsByOrganization);
questionRouter.put('/bespoke/:id', auth_middleware_1.default, question_controller_1.updateBespokeQuestion);
// Bulk conditional logic fetch
questionRouter.post('/with-dependencies', auth_middleware_1.default, question_controller_1.getQuestionsWithDependencies);
// ConnectGo staff — create
questionRouter.post('/', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), question_controller_1.createQuestion);
// ── Param routes (/:id must come after all static paths) ──
questionRouter.get('/:id', question_controller_1.getQuestion);
questionRouter.put('/:id', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), question_controller_1.updateQuestion);
questionRouter.delete('/:id', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), question_controller_1.archiveQuestion);
questionRouter.post('/:id/restore', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), question_controller_1.restoreQuestion);
questionRouter.delete('/:id/permanent', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), question_controller_1.deleteQuestion);
questionRouter.post('/:id/clone', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), question_controller_1.cloneQuestion);
questionRouter.get('/:id/available-tags', auth_middleware_1.default, question_controller_1.getQuestionAvailableTags);
questionRouter.put('/:id/toggle-demographic', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), question_controller_1.toggleStandardDemographic);
questionRouter.put('/:id/conditional-logic', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), question_controller_1.updateQuestionConditionalLogic);
questionRouter.post('/:id/validate-conditional-logic', auth_middleware_1.default, question_controller_1.validateQuestionConditionalLogic);
questionRouter.get('/:id/conditional-dependencies', auth_middleware_1.default, question_controller_1.getQuestionConditionalDependencies);
questionRouter.get('/:id/dependents', auth_middleware_1.default, question_controller_1.getQuestionDependents);
questionRouter.put('/:id/approve', auth_middleware_1.default, question_controller_1.approveBespokeQuestion);
questionRouter.put('/:id/reject', auth_middleware_1.default, question_controller_1.rejectBespokeQuestion);
questionRouter.post('/:id/elevate', auth_middleware_1.default, (0, role_middleware_1.isConnectGoStaff)(), question_controller_1.elevateBespokeQuestion);
exports.default = questionRouter;
//# sourceMappingURL=question.routes.js.map