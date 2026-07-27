"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/review.routes.ts - FIXED ROUTE ORDERING
const express_1 = require("express");
const review_controller_1 = require("../controllers/review.controller");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const role_middleware_1 = require("../middlewares/role.middleware");
const review_validation_1 = require("../middlewares/review.validation");
const reviewRoutes = (0, express_1.Router)();
// ===== All Routes Require Authentication =====
reviewRoutes.use(auth_middleware_1.default);
// ===== IMPORTANT: Order matters! More specific routes MUST come first =====
// ✅ FIXED: Put the more specific route with literal "item" segment FIRST
// This route has a literal segment "item", making it more specific
reviewRoutes.get('/module/:module/item/:moduleItemId', review_controller_1.getReviewsByModuleItem);
// This route comes second because it has all dynamic segments
reviewRoutes.get('/module/:projectId/:module/:moduleItemId', review_controller_1.getReviewsByModule);
// Get my reviews (as submitter, reviewer, or escalated to)
reviewRoutes.get('/my-reviews', review_controller_1.getMyReviews);
// Get review statistics for organization
reviewRoutes.get('/statistics/:organizationId', review_controller_1.getReviewStats);
// ✅ NEW: Get eligible reviewers for a review (MUST come before /:reviewId)
reviewRoutes.get('/:reviewId/eligible-reviewers', review_controller_1.getEligibleReviewers);
// Get review by ID (put this after more specific routes)
reviewRoutes.get('/:reviewId', review_controller_1.getReviewById);
// Create a new review manually
reviewRoutes.post('/', review_validation_1.validateCreateReview, review_controller_1.createReviewManually);
// Update review status
reviewRoutes.patch('/:reviewId/status', review_validation_1.validateUpdateStatus, review_controller_1.updateReviewStatus);
// Escalate review to staff
reviewRoutes.post('/:reviewId/escalate', review_validation_1.validateEscalate, review_controller_1.escalateReview);
// In your review routes file
reviewRoutes.post('/:reviewId/staff-collaborators', auth_middleware_1.default, review_controller_1.inviteStaffCollaborator);
// Add reviewer to review
reviewRoutes.post('/:reviewId/reviewers', review_validation_1.validateAddReviewer, review_controller_1.addReviewer);
// Add issue to review
reviewRoutes.post('/:reviewId/issues', review_validation_1.validateAddIssue, review_controller_1.addIssue);
// Resolve issue
reviewRoutes.patch('/:reviewId/issues/:issueId/resolve', review_validation_1.validateResolveIssue, review_controller_1.resolveIssue);
// ===== Staff-Only Routes =====
// Get escalated reviews (staff only)
reviewRoutes.get('/escalated/all', (0, role_middleware_1.isConnectGoStaff)(), review_controller_1.getEscalatedReviews);
exports.default = reviewRoutes;
//# sourceMappingURL=review.routes.js.map