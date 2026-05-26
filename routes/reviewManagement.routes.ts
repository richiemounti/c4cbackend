// // routes/reviewManagement.routes.ts
// import { Router } from "express";
// import {
//   createReview,
//   getReviews,
//   getReviewById,
//   updateReview,
//   assignReviewers,
//   updateReviewStatus,
//   cancelReview,
//   startManagerReview,
//   completeManagerReview,
//   startStaffReview,
//   completeStaffReview,
//   updateTaskReview,
//   addComment,
//   addAttachment,
//   getReviewStatistics
// } from "../controllers/reviewManagement.controller";

// import authorize from "../middlewares/auth.middleware";
// import { 
//   hasPermission, 
//   hasProjectAccess, 
//   hasOrganizationAccess,
//   isConnectGoStaff 
// } from "../middlewares/role.middleware";

// const reviewRouter = Router();

// // ==================== GENERAL REVIEW ROUTES ====================

// /**
//  * Get all reviews (filtered by user's access)
//  * Managers: See their organization's reviews
//  * ConnectGo Staff: See all reviews
//  */
// reviewRouter.get('/', 
//   authorize, 
//   getReviews
// );

// /**
//  * Get review statistics
//  * Query params: organizationId, projectId
//  */
// reviewRouter.get('/statistics', 
//   authorize, 
//   getReviewStatistics
// );

// /**
//  * Create a new review
//  * Managers: Can create reviews for their organization
//  * Project Creators: Can create reviews for their projects
//  * ConnectGo Staff: Can create reviews for any organization
//  */
// reviewRouter.post('/', 
//   authorize,
//   hasPermission(['create_projects', 'manage_org_projects', 'configure_projects']),
//   createReview
// );

// /**
//  * Get single review by ID with full details
//  * Includes entity-specific information
//  */
// reviewRouter.get('/:reviewId', 
//   authorize, 
//   getReviewById
// );

// /**
//  * Update review details (title, description, priority, dates, metadata)
//  * Managers: Can update reviews in their organization
//  * ConnectGo Staff: Can update any review
//  */
// reviewRouter.put('/:reviewId', 
//   authorize,
//   updateReview
// );

// /**
//  * Assign or reassign reviewers
//  * Managers: Can assign manager reviewers
//  * ConnectGo Staff: Can assign both manager and staff reviewers
//  */
// reviewRouter.put('/:reviewId/assign', 
//   authorize,
//   assignReviewers
// );

// /**
//  * Update review status with validation
//  * Validates status transitions based on workflow rules
//  */
// reviewRouter.put('/:reviewId/status', 
//   authorize,
//   updateReviewStatus
// );

// /**
//  * Cancel a review
//  * Managers: Can cancel reviews in their organization
//  * ConnectGo Staff: Can cancel any review
//  */
// reviewRouter.put('/:reviewId/cancel', 
//   authorize,
//   cancelReview
// );

// // ==================== MANAGER REVIEW ROUTES ====================

// /**
//  * Start manager review stage
//  * Managers: Can start reviews for their organization
//  * Project Creators: Can start reviews for their projects
//  * ConnectGo Staff: Can start any review
//  */
// reviewRouter.post('/:reviewId/manager/start', 
//   authorize,
//   hasPermission(['create_projects', 'manage_org_projects', 'configure_projects']),
//   startManagerReview
// );

// /**
//  * Complete manager review (approve/reject)
//  * Managers: Can complete manager reviews for their organization
//  * Project Creators: Can complete manager reviews for their projects
//  * ConnectGo Staff: Can complete any manager review
//  */
// reviewRouter.post('/:reviewId/manager/complete', 
//   authorize,
//   hasPermission(['create_projects', 'manage_org_projects', 'configure_projects']),
//   completeManagerReview
// );

// // ==================== STAFF REVIEW ROUTES ====================

// /**
//  * Start ConnectGo staff review stage
//  * ConnectGo Staff Only
//  */
// reviewRouter.post('/:reviewId/staff/start', 
//   authorize,
//   isConnectGoStaff(),
//   startStaffReview
// );

// /**
//  * Complete ConnectGo staff review (final approval/rejection)
//  * ConnectGo Staff Only
//  */
// reviewRouter.post('/:reviewId/staff/complete', 
//   authorize,
//   isConnectGoStaff(),
//   completeStaffReview
// );

// // ==================== TASK-LEVEL REVIEW ROUTES ====================

// /**
//  * Update task review status
//  * Managers: Can review tasks during manager stage
//  * ConnectGo Staff: Can review tasks during any stage
//  */
// reviewRouter.put('/:reviewId/tasks/:taskId', 
//   authorize,
//   updateTaskReview
// );

// // ==================== COMMENTS & ATTACHMENTS ====================

// /**
//  * Add comment to review
//  * All authenticated users can add comments
//  */
// reviewRouter.post('/:reviewId/comments', 
//   authorize,
//   addComment
// );

// /**
//  * Add attachment to review
//  * All authenticated users can add attachments
//  */
// reviewRouter.post('/:reviewId/attachments', 
//   authorize,
//   addAttachment
// );

// export default reviewRouter;