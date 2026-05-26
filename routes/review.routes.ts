// routes/review.routes.ts - FIXED ROUTE ORDERING
import express, { Router } from 'express';
import {
  createReviewManually,
  getMyReviews,
  getReviewById,
  getReviewsByModuleItem,
  updateReviewStatus,
  escalateReview,
  addReviewer,
  addIssue,
  resolveIssue,
  getEscalatedReviews,
  getReviewStats,
  getReviewsByModule,
  getEligibleReviewers,
  inviteStaffCollaborator
} from '../controllers/review.controller';
import authorize from '../middlewares/auth.middleware';
import { isConnectGoStaff } from '../middlewares/role.middleware';
import {
  validateCreateReview,
  validateUpdateStatus,
  validateEscalate,
  validateAddReviewer,
  validateAddIssue,
  validateResolveIssue,
} from '../middlewares/review.validation';

const reviewRoutes = Router();

// ===== All Routes Require Authentication =====
reviewRoutes.use(authorize);

// ===== IMPORTANT: Order matters! More specific routes MUST come first =====

// ✅ FIXED: Put the more specific route with literal "item" segment FIRST
// This route has a literal segment "item", making it more specific
reviewRoutes.get('/module/:module/item/:moduleItemId', getReviewsByModuleItem);

// This route comes second because it has all dynamic segments
reviewRoutes.get('/module/:projectId/:module/:moduleItemId', getReviewsByModule);

// Get my reviews (as submitter, reviewer, or escalated to)
reviewRoutes.get('/my-reviews', getMyReviews);

// Get review statistics for organization
reviewRoutes.get('/statistics/:organizationId', getReviewStats);

// ✅ NEW: Get eligible reviewers for a review (MUST come before /:reviewId)
reviewRoutes.get('/:reviewId/eligible-reviewers', getEligibleReviewers);

// Get review by ID (put this after more specific routes)
reviewRoutes.get('/:reviewId', getReviewById);

// Create a new review manually
reviewRoutes.post('/', validateCreateReview, createReviewManually);

// Update review status
reviewRoutes.patch('/:reviewId/status', validateUpdateStatus, updateReviewStatus);

// Escalate review to staff
reviewRoutes.post('/:reviewId/escalate', validateEscalate, escalateReview);

// In your review routes file
reviewRoutes.post('/:reviewId/staff-collaborators', authorize, inviteStaffCollaborator);

// Add reviewer to review
reviewRoutes.post('/:reviewId/reviewers', validateAddReviewer, addReviewer);

// Add issue to review
reviewRoutes.post('/:reviewId/issues', validateAddIssue, addIssue);

// Resolve issue
reviewRoutes.patch('/:reviewId/issues/:issueId/resolve', validateResolveIssue, resolveIssue);

// ===== Staff-Only Routes =====
// Get escalated reviews (staff only)
reviewRoutes.get(
  '/escalated/all',
  isConnectGoStaff(),
  getEscalatedReviews
);

export default reviewRoutes;