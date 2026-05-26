// // controllers/reviewManagement.controller.ts - Enhanced with Two-Stage Review System
// import { Request, Response, NextFunction } from "express";
// import mongoose from "mongoose";
// import Review from "../models/review.model";
// import User from "../models/user.model";
// import Project from "../models/project.model";
// import ProjectSite from "../models/projectSite.model";
// import Organization from "../models/organization.model";
// import ProjectSetup from "../models/projectSetupTask.model";
// import ProjectSiteSetup from "../models/projectSiteSetupTask.model";
// import StakeholderGroup from "../models/stakeholderGroup.model";
// import SocialImpact from "../models/socialImpact.model";
// import StakeholderAction from "../models/stakeholderAction.model";
// import TheoryOfChangeStage from "../models/theoryOfChangeStage.model";
// import TOCConsultationPlan from "../models/tocConsultationPlan.model";
// import Survey from "../models/survey.model";
// import { CustomError } from "../middlewares/error.middleware";

// // ==================== TYPE GUARDS ====================

// function isUserAuthenticated(req: Request): req is Request & { 
//   user: { 
//     _id: mongoose.Types.ObjectId; 
//     isConnectGoStaff?: boolean;
//     primaryRole?: string;
//     roles?: Array<any>;
//   } 
// } {
//   return req.user !== undefined;
// }

// // Helper to check if user is ConnectGo staff
// function isConnectGoStaff(req: Request): boolean {
//   return isUserAuthenticated(req) && Boolean(req.user.isConnectGoStaff);
// }

// // Helper to check if user is manager
// function isManager(req: Request): boolean {
//   return isUserAuthenticated(req) && req.user.primaryRole === 'manager';
// }

// // Helper to check if user is project creator
// function isProjectCreator(req: Request): boolean {
//   return isUserAuthenticated(req) && req.user.primaryRole === 'projectCreator';
// }

// // Helper to get user's projects (for project creators)
// function getUserProjects(user: any): string[] {
//   if (!user || !user.roles) return [];
  
//   return user.roles
//     .filter((r: any) => r.role === 'projectCreator' && r.projects)
//     .flatMap((r: any) => r.projects)
//     .map((p: any) => p.toString());
// }

// // Helper to check if user can perform manager-level reviews
// function canReviewAsManager(req: Request, review: any): boolean {
//   if (!isUserAuthenticated(req)) return false;
  
//   // ConnectGo staff can review anything
//   if (isConnectGoStaff(req)) return true;
  
//   // Managers can review items in their organization
//   if (isManager(req)) {
//     const userOrgs = req.user.roles
//       ?.filter((r: any) => r.organization)
//       .map((r: any) => r.organization.toString()) || [];
    
//     return userOrgs.includes(review.organization.toString());
//   }
  
//   // Project creators can review items in their projects
//   if (isProjectCreator(req)) {
//     const userProjects = getUserProjects(req.user);
//     return userProjects.includes(review.project.toString());
//   }
  
//   return false;
// }

// // Helper to check if user has access to view a review
// function canViewReview(req: Request, review: any): boolean {
//   if (!isUserAuthenticated(req)) return false;
  
//   // ConnectGo staff can view anything
//   if (isConnectGoStaff(req)) return true;
  
//   // Managers can view reviews in their organization
//   if (isManager(req)) {
//     const userOrgs = req.user.roles
//       ?.filter((r: any) => r.organization)
//       .map((r: any) => r.organization.toString()) || [];
    
//     return userOrgs.includes(review.organization.toString());
//   }
  
//   // Project creators can view reviews for their projects
//   if (isProjectCreator(req)) {
//     const userProjects = getUserProjects(req.user);
//     return userProjects.includes(review.project.toString());
//   }
  
//   return false;
// }

// // Helper to determine phase from entity type
// function getPhaseFromEntityType(entityType: string): 'build' | 'measure' | 'learn' | 'tell' {
//   const phaseMap: Record<string, 'build' | 'measure' | 'learn' | 'tell'> = {
//     'project_setup': 'build',
//     'site_setup': 'build',
//     'stakeholder_mapping': 'build',
//     'consultation_plan': 'build',
//     'theory_of_change_stage': 'build',
//     'survey': 'measure',
//     'report': 'tell'
//   };
//   return phaseMap[entityType] || 'build';
// }

// // ==================== CREATE REVIEW ====================

// /**
//  * Create a new review manually
//  * @route POST /api/v1/reviews
//  * @access Private (Manager, ConnectGo Staff)
//  */
// export const createReview = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     if (!isUserAuthenticated(req)) {
//       const error = new Error('Authentication required') as CustomError;
//       error.statusCode = 401;
//       throw error;
//     }

//     const {
//       entityType,
//       entityId,
//       projectId,
//       projectSiteId,
//       organizationId,
//       title,
//       description,
//       priority = 'medium',
//       assignedTo,
//       managerReviewer,
//       staffReviewer,
//       dueDate,
//       managerDueDate,
//       staffDueDate,
//       approvalConfig
//     } = req.body;

//     // Validate required fields
//     if (!entityType || !entityId || !projectId || !organizationId || !title) {
//       const error = new Error('Missing required fields: entityType, entityId, projectId, organizationId, title') as CustomError;
//       error.statusCode = 400;
//       throw error;
//     }

//     // Validate entityType
//     const validEntityTypes = ['project_setup', 'site_setup', 'stakeholder_mapping', 'consultation_plan', 'theory_of_change_stage', 'survey', 'report'];
//     if (!validEntityTypes.includes(entityType)) {
//       const error = new Error(`Invalid entityType. Must be one of: ${validEntityTypes.join(', ')}`) as CustomError;
//       error.statusCode = 400;
//       throw error;
//     }

//     // Validate priority
//     const validPriorities = ['low', 'medium', 'high', 'critical'];
//     if (priority && !validPriorities.includes(priority)) {
//       const error = new Error(`Invalid priority. Must be one of: ${validPriorities.join(', ')}`) as CustomError;
//       error.statusCode = 400;
//       throw error;
//     }

//     // Check if entity exists
//     const entityExists = await verifyEntityExists(entityType, entityId);
//     if (!entityExists) {
//       const error = new Error(`Entity of type ${entityType} with ID ${entityId} not found`) as CustomError;
//       error.statusCode = 404;
//       throw error;
//     }

//     // Check if a similar review already exists and is active
//     const existingReview = await Review.findOne({
//       entityType,
//       entityId: new mongoose.Types.ObjectId(entityId),
//       project: new mongoose.Types.ObjectId(projectId),
//       status: { $nin: ['staff_approved', 'staff_rejected', 'cancelled'] }
//     });

//     if (existingReview) {
//       const error = new Error('An active review already exists for this entity') as CustomError;
//       error.statusCode = 409;
//       throw error;
//     }

//     // Validate assigned users if provided
//     if (assignedTo) {
//       const assignedUser = await User.findById(assignedTo);
//       if (!assignedUser) {
//         const error = new Error('Assigned user not found') as CustomError;
//         error.statusCode = 404;
//         throw error;
//       }
//     }

//     if (managerReviewer) {
//       const managerUser = await User.findById(managerReviewer);
//       if (!managerUser || managerUser.primaryRole !== 'manager') {
//         const error = new Error('Manager reviewer must be a user with manager role') as CustomError;
//         error.statusCode = 400;
//         throw error;
//       }
//     }

//     if (staffReviewer) {
//       const staffUser = await User.findById(staffReviewer);
//       if (!staffUser || !staffUser.isConnectGoStaff) {
//         const error = new Error('Staff reviewer must be a ConnectGo staff member') as CustomError;
//         error.statusCode = 400;
//         throw error;
//       }
//     }

//     // Determine phase
//     const phase = getPhaseFromEntityType(entityType);

//     // Calculate default due dates
//     const defaultDueDate = dueDate ? new Date(dueDate) : new Date(Date.now() + (14 * 24 * 60 * 60 * 1000)); // 14 days default
//     const calculatedManagerDueDate = managerDueDate ? new Date(managerDueDate) : new Date(Date.now() + (8 * 24 * 60 * 60 * 1000)); // 8 days for manager
//     const calculatedStaffDueDate = staffDueDate ? new Date(staffDueDate) : new Date(Date.now() + (14 * 24 * 60 * 60 * 1000)); // 14 days for staff

//     // Create the review
//     const reviewData = {
//       entityType,
//       entityId: new mongoose.Types.ObjectId(entityId),
//       project: new mongoose.Types.ObjectId(projectId),
//       projectSite: projectSiteId ? new mongoose.Types.ObjectId(projectSiteId) : undefined,
//       organization: new mongoose.Types.ObjectId(organizationId),
//       title,
//       description: description || '',
//       phase,
//       priority,
//       assignedTo: assignedTo ? new mongoose.Types.ObjectId(assignedTo) : undefined,
//       managerReviewer: managerReviewer ? new mongoose.Types.ObjectId(managerReviewer) : undefined,
//       staffReviewer: staffReviewer ? new mongoose.Types.ObjectId(staffReviewer) : undefined,
//       dueDate: defaultDueDate,
//       managerDueDate: calculatedManagerDueDate,
//       staffDueDate: calculatedStaffDueDate,
//       creator: req.user._id,
//       status: 'pending',
//       progress: 0,
//       completedTasks: 0,
//       totalTasks: 1,
//       approvalConfig: approvalConfig || {
//         requiresManagerApproval: true,
//         requiresStaffApproval: true,
//         autoProgressToStaff: true,
//         allowManagerOverride: false
//       }
//     };

//     const review = new Review(reviewData);
//     await review.save();

//     // Populate the created review
//     const populatedReview = await Review.findById(review._id)
//       .populate('project', 'name status')
//       .populate('projectSite', 'name status')
//       .populate('organization', 'name country city')
//       .populate('assignedTo', 'name email primaryRole')
//       .populate('managerReviewer', 'name email')
//       .populate('staffReviewer', 'name email')
//       .populate('creator', 'name email');

//     res.status(201).json({
//       success: true,
//       message: 'Review created successfully',
//       data: populatedReview
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// // ==================== GET REVIEWS ====================

// /**
//  * Get all reviews with filtering
//  * @route GET /api/v1/reviews
//  * @access Private (Manager: their org, Staff: all)
//  */
// export const getReviews = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     if (!isUserAuthenticated(req)) {
//       const error = new Error('Authentication required') as CustomError;
//       error.statusCode = 401;
//       throw error;
//     }

//     // Build query based on user role
//     let query: any = { archived: { $ne: true } };

//     // If not ConnectGo staff, filter by access level
//     if (!isConnectGoStaff(req)) {
//       // Managers: filter by organization
//       if (isManager(req)) {
//         const userOrgs = req.user.roles
//           ?.filter((r: any) => r.organization)
//           .map((r: any) => r.organization) || [];
        
//         if (userOrgs.length === 0) {
//           return res.status(200).json({
//             success: true,
//             count: 0,
//             data: []
//           });
//         }

//         query.organization = { $in: userOrgs };
//       }
//       // Project Creators: filter by projects
//       else if (isProjectCreator(req)) {
//         const userProjects = getUserProjects(req.user);
        
//         if (userProjects.length === 0) {
//           return res.status(200).json({
//             success: true,
//             count: 0,
//             data: []
//           });
//         }

//         query.project = { $in: userProjects };
//       }
//       // Other roles: no access to reviews
//       else {
//         return res.status(200).json({
//           success: true,
//           count: 0,
//           data: []
//         });
//       }
//     }

//     // Apply filters from query params
//     const { status, phase, priority, entityType, projectId, organizationId, assignedTo, stage } = req.query;

//     if (status) query.status = status;
//     if (phase) query.phase = phase;
//     if (priority) query.priority = priority;
//     if (entityType) query.entityType = entityType;
//     if (projectId) query.project = projectId;
//     if (organizationId) query.organization = organizationId;
//     if (assignedTo) query.assignedTo = assignedTo;

//     // Filter by review stage
//     if (stage === 'manager') {
//       query.status = { $in: ['pending', 'manager_review', 'manager_approved', 'manager_rejected'] };
//     } else if (stage === 'staff') {
//       query.status = { $in: ['staff_review', 'staff_approved', 'staff_rejected', 'manager_approved'] };
//     }

//     // Pagination
//     const page = parseInt(req.query.page as string) || 1;
//     const limit = parseInt(req.query.limit as string) || 20;
//     const skip = (page - 1) * limit;

//     // Sorting
//     const sortBy = (req.query.sortBy as string) || '-createdAt';

//     // Execute query
//     const [reviews, totalCount] = await Promise.all([
//       Review.find(query)
//         .populate('project', 'name status')
//         .populate('projectSite', 'name status')
//         .populate('organization', 'name country city')
//         .populate('assignedTo', 'name email primaryRole')
//         .populate('managerReviewer', 'name email')
//         .populate('staffReviewer', 'name email')
//         .populate('creator', 'name email')
//         .sort(sortBy)
//         .skip(skip)
//         .limit(limit),
//       Review.countDocuments(query)
//     ]);

//     res.status(200).json({
//       success: true,
//       count: reviews.length,
//       total: totalCount,
//       page,
//       pages: Math.ceil(totalCount / limit),
//       data: reviews
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// /**
//  * Get review by ID with full details
//  * @route GET /api/v1/reviews/:reviewId
//  * @access Private
//  */
// export const getReviewById = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     if (!isUserAuthenticated(req)) {
//       const error = new Error('Authentication required') as CustomError;
//       error.statusCode = 401;
//       throw error;
//     }

//     const { reviewId } = req.params;

//     const review = await Review.findById(reviewId)
//       .populate('project', 'name status')
//       .populate('projectSite', 'name status')
//       .populate('organization', 'name country city')
//       .populate('assignedTo', 'name email primaryRole')
//       .populate('managerReviewer', 'name email')
//       .populate('staffReviewer', 'name email')
//       .populate('creator', 'name email')
//       .populate('lastUpdatedBy', 'name email')
//       .populate('comments.author', 'name email')
//       .populate('attachments.uploadedBy', 'name email');

//     if (!review) {
//       const error = new Error('Review not found') as CustomError;
//       error.statusCode = 404;
//       throw error;
//     }

//     // Check access permissions
//     if (!canViewReview(req, review)) {
//       const error = new Error('Not authorized to view this review') as CustomError;
//       error.statusCode = 403;
//       throw error;
//     }

//     // Get entity-specific details
//     const entityDetails = await getEntityDetails(review.entityType, review.entityId);

//     res.status(200).json({
//       success: true,
//       data: {
//         review,
//         entityDetails
//       }
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// // ==================== MANAGER REVIEW ACTIONS ====================

// /**
//  * Start manager review
//  * @route POST /api/v1/reviews/:reviewId/manager/start
//  * @access Private (Manager or Staff)
//  */
// export const startManagerReview = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     if (!isUserAuthenticated(req)) {
//       const error = new Error('Authentication required') as CustomError;
//       error.statusCode = 401;
//       throw error;
//     }

//     const { reviewId } = req.params;

//     const review = await Review.findById(reviewId);

//     if (!review) {
//       const error = new Error('Review not found') as CustomError;
//       error.statusCode = 404;
//       throw error;
//     }

//     // Check permissions - manager, project creator, or ConnectGo staff can start
//     if (!canReviewAsManager(req, review)) {
//       const error = new Error('Not authorized to start manager review') as CustomError;
//       error.statusCode = 403;
//       throw error;
//     }

//     // Check if review is in correct state
//     if (review.status !== 'pending') {
//       const error = new Error(`Cannot start manager review. Current status: ${review.status}`) as CustomError;
//       error.statusCode = 400;
//       throw error;
//     }

//     // Start the manager review
//     review.startManagerReview(req.user._id);
    
//     // Add comment
//     review.comments.push({
//       author: req.user._id,
//       content: 'Manager review started',
//       type: 'comment',
//       stage: 'manager',
//       isInternal: false,
//       createdAt: new Date(),
//       updatedAt: new Date()
//     } as any);

//     await review.save();

//     const populatedReview = await Review.findById(review._id)
//       .populate('managerReviewer', 'name email')
//       .populate('comments.author', 'name email');

//     res.status(200).json({
//       success: true,
//       message: 'Manager review started successfully',
//       data: populatedReview
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// /**
//  * Complete manager review
//  * @route POST /api/v1/reviews/:reviewId/manager/complete
//  * @access Private (Manager or Staff)
//  */
// export const completeManagerReview = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     if (!isUserAuthenticated(req)) {
//       const error = new Error('Authentication required') as CustomError;
//       error.statusCode = 401;
//       throw error;
//     }

//     const { reviewId } = req.params;
//     const { approved, comments, decision, overallScore, recommendations } = req.body;

//     if (approved === undefined) {
//       const error = new Error('approved field is required (true/false)') as CustomError;
//       error.statusCode = 400;
//       throw error;
//     }

//     if (!comments) {
//       const error = new Error('Comments are required') as CustomError;
//       error.statusCode = 400;
//       throw error;
//     }

//     const review = await Review.findById(reviewId);

//     if (!review) {
//       const error = new Error('Review not found') as CustomError;
//       error.statusCode = 404;
//       throw error;
//     }

//     // Check permissions - manager, project creator, or ConnectGo staff can complete
//     if (!canReviewAsManager(req, review)) {
//       const error = new Error('Not authorized to complete manager review') as CustomError;
//       error.statusCode = 403;
//       throw error;
//     }

//     // Check if review is in correct state
//     if (review.status !== 'manager_review') {
//       const error = new Error(`Cannot complete manager review. Current status: ${review.status}`) as CustomError;
//       error.statusCode = 400;
//       throw error;
//     }

//     // Complete the manager review
//     await review.completeManagerReview(req.user._id, approved, comments, decision);

//     // Store manager review summary in metadata
//     review.metadata.managerReviewSummary = {
//       overallComment: comments,
//       score: overallScore || undefined,
//       recommendations: recommendations || [],
//       approvedTasks: [],
//       rejectedTasks: [],
//       tasksRequiringChanges: [],
//       reviewedBy: req.user._id,
//       reviewedAt: new Date()
//     };

//     await review.save();

//     const populatedReview = await Review.findById(review._id)
//       .populate('managerReviewer', 'name email')
//       .populate('comments.author', 'name email');

//     res.status(200).json({
//       success: true,
//       message: approved ? 'Manager review approved successfully' : 'Manager review rejected',
//       data: populatedReview
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// // ==================== STAFF REVIEW ACTIONS ====================

// /**
//  * Start staff review
//  * @route POST /api/v1/reviews/:reviewId/staff/start
//  * @access Private (ConnectGo Staff only)
//  */
// export const startStaffReview = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     if (!isUserAuthenticated(req)) {
//       const error = new Error('Authentication required') as CustomError;
//       error.statusCode = 401;
//       throw error;
//     }

//     if (!isConnectGoStaff(req)) {
//       const error = new Error('Only ConnectGo staff can start staff reviews') as CustomError;
//       error.statusCode = 403;
//       throw error;
//     }

//     const { reviewId } = req.params;

//     const review = await Review.findById(reviewId);

//     if (!review) {
//       const error = new Error('Review not found') as CustomError;
//       error.statusCode = 404;
//       throw error;
//     }

//     // Check if review is in correct state
//     if (!['manager_approved', 'staff_review'].includes(review.status)) {
//       const error = new Error(`Cannot start staff review. Current status: ${review.status}`) as CustomError;
//       error.statusCode = 400;
//       throw error;
//     }

//     // Start the staff review
//     review.startStaffReview(req.user._id);
    
//     // Add comment
//     review.comments.push({
//       author: req.user._id,
//       content: 'ConnectGo staff review started',
//       type: 'comment',
//       stage: 'staff',
//       isInternal: false,
//       createdAt: new Date(),
//       updatedAt: new Date()
//     } as any);

//     await review.save();

//     const populatedReview = await Review.findById(review._id)
//       .populate('staffReviewer', 'name email')
//       .populate('comments.author', 'name email');

//     res.status(200).json({
//       success: true,
//       message: 'Staff review started successfully',
//       data: populatedReview
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// /**
//  * Complete staff review (Final approval/rejection)
//  * @route POST /api/v1/reviews/:reviewId/staff/complete
//  * @access Private (ConnectGo Staff only)
//  */
// export const completeStaffReview = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     if (!isUserAuthenticated(req)) {
//       const error = new Error('Authentication required') as CustomError;
//       error.statusCode = 401;
//       throw error;
//     }

//     if (!isConnectGoStaff(req)) {
//       const error = new Error('Only ConnectGo staff can complete staff reviews') as CustomError;
//       error.statusCode = 403;
//       throw error;
//     }

//     const { reviewId } = req.params;
//     const { approved, comments, decision, overallScore, complianceChecks, recommendations } = req.body;

//     if (approved === undefined) {
//       const error = new Error('approved field is required (true/false)') as CustomError;
//       error.statusCode = 400;
//       throw error;
//     }

//     if (!comments) {
//       const error = new Error('Comments are required') as CustomError;
//       error.statusCode = 400;
//       throw error;
//     }

//     const review = await Review.findById(reviewId);

//     if (!review) {
//       const error = new Error('Review not found') as CustomError;
//       error.statusCode = 404;
//       throw error;
//     }

//     // Check if review is in correct state
//     if (review.status !== 'staff_review') {
//       const error = new Error(`Cannot complete staff review. Current status: ${review.status}`) as CustomError;
//       error.statusCode = 400;
//       throw error;
//     }

//     // Complete the staff review
//     await review.completeStaffReview(req.user._id, approved, comments, decision);

//     // Store staff review summary in metadata
//     review.metadata.staffReviewSummary = {
//       finalComment: comments,
//       overallScore: overallScore || 0,
//       complianceChecks: complianceChecks || {},
//       recommendations: recommendations || [],
//       finalizedBy: req.user._id,
//       finalizedAt: new Date()
//     };

//     await review.save();

//     const populatedReview = await Review.findById(review._id)
//       .populate('staffReviewer', 'name email')
//       .populate('comments.author', 'name email');

//     res.status(200).json({
//       success: true,
//       message: approved ? 'Review approved successfully by ConnectGo staff' : 'Review rejected by ConnectGo staff',
//       data: populatedReview
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// // ==================== TASK-LEVEL REVIEWS ====================

// /**
//  * Update task review status within a review
//  * @route PUT /api/v1/reviews/:reviewId/tasks/:taskId
//  * @access Private (Reviewer)
//  */
// export const updateTaskReview = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     if (!isUserAuthenticated(req)) {
//       const error = new Error('Authentication required') as CustomError;
//       error.statusCode = 401;
//       throw error;
//     }

//     const { reviewId, taskId } = req.params;
//     const { isApproved, comment, requiresChanges } = req.body;

//     const review = await Review.findById(reviewId);

//     if (!review) {
//       const error = new Error('Review not found') as CustomError;
//       error.statusCode = 404;
//       throw error;
//     }

//     // Determine review stage
//     const reviewStage = review.currentStage as 'manager' | 'staff';
    
//     // Check permissions based on stage
//     if (reviewStage === 'manager') {
//       if (!canReviewAsManager(req, review)) {
//         const error = new Error('Not authorized to review tasks at this stage') as CustomError;
//         error.statusCode = 403;
//         throw error;
//       }
//     } else if (reviewStage === 'staff') {
//       if (!isConnectGoStaff(req)) {
//         const error = new Error('Only ConnectGo staff can review tasks at this stage') as CustomError;
//         error.statusCode = 403;
//         throw error;
//       }
//     }

//     // Initialize task reviews metadata if not exists
//     if (!review.metadata.taskReviews) {
//       review.metadata.taskReviews = {};
//     }

//     // Update task review status
//     review.metadata.taskReviews[taskId] = {
//       isApproved: Boolean(isApproved),
//       comment: comment || '',
//       requiresChanges: Boolean(requiresChanges),
//       reviewedBy: req.user._id,
//       reviewedAt: new Date(),
//       reviewStage
//     };

//     // Update progress
//     review.updateProgress();
//     review.lastUpdatedBy = req.user._id;

//     await review.save();

//     res.status(200).json({
//       success: true,
//       message: 'Task review updated successfully',
//       data: {
//         taskReview: review.metadata.taskReviews[taskId],
//         overallProgress: review.progress,
//         completedTasks: review.completedTasks,
//         totalTasks: review.totalTasks
//       }
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// // ==================== COMMENTS & ATTACHMENTS ====================

// /**
//  * Add comment to review
//  * @route POST /api/v1/reviews/:reviewId/comments
//  * @access Private
//  */
// export const addComment = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     if (!isUserAuthenticated(req)) {
//       const error = new Error('Authentication required') as CustomError;
//       error.statusCode = 401;
//       throw error;
//     }

//     const { reviewId } = req.params;
//     const { content, type = 'comment', stage = 'general', isInternal = false } = req.body;

//     if (!content) {
//       const error = new Error('Comment content is required') as CustomError;
//       error.statusCode = 400;
//       throw error;
//     }

//     const review = await Review.findById(reviewId);

//     if (!review) {
//       const error = new Error('Review not found') as CustomError;
//       error.statusCode = 404;
//       throw error;
//     }

//     // Add comment
//     review.comments.push({
//       author: req.user._id,
//       content,
//       type: type as any,
//       stage: stage as 'manager' | 'staff' | 'general',
//       isInternal: Boolean(isInternal),
//       createdAt: new Date(),
//       updatedAt: new Date()
//     } as any);

//     review.lastUpdatedBy = req.user._id;
//     await review.save();

//     // Populate the new comment
//     await review.populate('comments.author', 'name email');

//     res.status(201).json({
//       success: true,
//       message: 'Comment added successfully',
//       data: {
//         comment: review.comments[review.comments.length - 1],
//         totalComments: review.comments.length
//       }
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// /**
//  * Add attachment to review
//  * @route POST /api/v1/reviews/:reviewId/attachments
//  * @access Private
//  */
// export const addAttachment = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     if (!isUserAuthenticated(req)) {
//       const error = new Error('Authentication required') as CustomError;
//       error.statusCode = 401;
//       throw error;
//     }

//     const { reviewId } = req.params;
//     const { filename, url, stage = 'general' } = req.body;

//     if (!filename || !url) {
//       const error = new Error('Filename and URL are required') as CustomError;
//       error.statusCode = 400;
//       throw error;
//     }

//     const review = await Review.findById(reviewId);

//     if (!review) {
//       const error = new Error('Review not found') as CustomError;
//       error.statusCode = 404;
//       throw error;
//     }

//     // Add attachment
//     review.attachments.push({
//       filename,
//       url,
//       uploadedBy: req.user._id,
//       uploadedAt: new Date(),
//       stage: stage as 'manager' | 'staff' | 'general'
//     } as any);

//     review.lastUpdatedBy = req.user._id;
//     await review.save();

//     res.status(201).json({
//       success: true,
//       message: 'Attachment added successfully',
//       data: {
//         attachment: review.attachments[review.attachments.length - 1],
//         totalAttachments: review.attachments.length
//       }
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// // ==================== UPDATE & ASSIGN ====================

// /**
//  * Update review details
//  * @route PUT /api/v1/reviews/:reviewId
//  * @access Private (Manager, Staff)
//  */
// export const updateReview = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     if (!isUserAuthenticated(req)) {
//       const error = new Error('Authentication required') as CustomError;
//       error.statusCode = 401;
//       throw error;
//     }

//     const { reviewId } = req.params;
//     const { 
//       title, 
//       description, 
//       priority, 
//       dueDate,
//       managerDueDate,
//       staffDueDate,
//       metadata 
//     } = req.body;

//     const review = await Review.findById(reviewId);

//     if (!review) {
//       const error = new Error('Review not found') as CustomError;
//       error.statusCode = 404;
//       throw error;
//     }

//     // Only allow updates if review is not completed
//     if (['staff_approved', 'staff_rejected', 'cancelled'].includes(review.status)) {
//       const error = new Error('Cannot update a completed review') as CustomError;
//       error.statusCode = 400;
//       throw error;
//     }

//     // Check permissions - manager, project creator, or ConnectGo staff can update
//     if (!canReviewAsManager(req, review)) {
//       const error = new Error('Not authorized to update this review') as CustomError;
//       error.statusCode = 403;
//       throw error;
//     }

//     // Update fields if provided
//     if (title) review.title = title;
//     if (description !== undefined) review.description = description;
//     if (priority) {
//       const validPriorities = ['low', 'medium', 'high', 'critical'];
//       if (!validPriorities.includes(priority)) {
//         const error = new Error(`Invalid priority. Must be one of: ${validPriorities.join(', ')}`) as CustomError;
//         error.statusCode = 400;
//         throw error;
//       }
//       review.priority = priority;
//     }
//     if (dueDate) review.dueDate = new Date(dueDate);
//     if (managerDueDate) review.managerDueDate = new Date(managerDueDate);
//     if (staffDueDate) review.staffDueDate = new Date(staffDueDate);
//     if (metadata) review.metadata = { ...review.metadata, ...metadata };

//     review.lastUpdatedBy = req.user._id;
//     await review.save();

//     const populatedReview = await Review.findById(review._id)
//       .populate('project', 'name status')
//       .populate('projectSite', 'name status')
//       .populate('organization', 'name country city')
//       .populate('assignedTo', 'name email')
//       .populate('managerReviewer', 'name email')
//       .populate('staffReviewer', 'name email');

//     res.status(200).json({
//       success: true,
//       message: 'Review updated successfully',
//       data: populatedReview
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// /**
//  * Assign/reassign reviewers
//  * @route PUT /api/v1/reviews/:reviewId/assign
//  * @access Private (Manager for manager reviewer, Staff for both)
//  */
// export const assignReviewers = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     if (!isUserAuthenticated(req)) {
//       const error = new Error('Authentication required') as CustomError;
//       error.statusCode = 401;
//       throw error;
//     }

//     const { reviewId } = req.params;
//     const { managerReviewer, staffReviewer, assignedTo } = req.body;

//     const review = await Review.findById(reviewId);

//     if (!review) {
//       const error = new Error('Review not found') as CustomError;
//       error.statusCode = 404;
//       throw error;
//     }

//     // Validate and assign manager reviewer
//     if (managerReviewer) {
//       const managerUser = await User.findById(managerReviewer);
//       if (!managerUser || managerUser.primaryRole !== 'manager') {
//         const error = new Error('Manager reviewer must be a user with manager role') as CustomError;
//         error.statusCode = 400;
//         throw error;
//       }
//       review.managerReviewer = new mongoose.Types.ObjectId(managerReviewer);
      
//       review.comments.push({
//         author: req.user._id,
//         content: `Manager reviewer assigned to ${managerUser.name}`,
//         type: 'comment',
//         stage: 'general',
//         isInternal: false,
//         createdAt: new Date(),
//         updatedAt: new Date()
//       } as any);
//     }

//     // Validate and assign staff reviewer (only ConnectGo staff can do this)
//     if (staffReviewer) {
//       if (!isConnectGoStaff(req)) {
//         const error = new Error('Only ConnectGo staff can assign staff reviewers') as CustomError;
//         error.statusCode = 403;
//         throw error;
//       }

//       const staffUser = await User.findById(staffReviewer);
//       if (!staffUser || !staffUser.isConnectGoStaff) {
//         const error = new Error('Staff reviewer must be a ConnectGo staff member') as CustomError;
//         error.statusCode = 400;
//         throw error;
//       }
//       review.staffReviewer = new mongoose.Types.ObjectId(staffReviewer);
      
//       review.comments.push({
//         author: req.user._id,
//         content: `Staff reviewer assigned to ${staffUser.name}`,
//         type: 'comment',
//         stage: 'general',
//         isInternal: false,
//         createdAt: new Date(),
//         updatedAt: new Date()
//       } as any);
//     }

//     // Assign general assignee
//     if (assignedTo) {
//       const assignedUser = await User.findById(assignedTo);
//       if (!assignedUser) {
//         const error = new Error('Assigned user not found') as CustomError;
//         error.statusCode = 404;
//         throw error;
//       }
//       review.assignedTo = new mongoose.Types.ObjectId(assignedTo);
//     }

//     review.lastUpdatedBy = req.user._id;
//     await review.save();

//     const populatedReview = await Review.findById(review._id)
//       .populate('assignedTo', 'name email')
//       .populate('managerReviewer', 'name email')
//       .populate('staffReviewer', 'name email')
//       .populate('comments.author', 'name email');

//     res.status(200).json({
//       success: true,
//       message: 'Reviewers assigned successfully',
//       data: populatedReview
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// // ==================== STATUS MANAGEMENT ====================

// /**
//  * Change review status (with validation)
//  * @route PUT /api/v1/reviews/:reviewId/status
//  * @access Private
//  */
// export const updateReviewStatus = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     if (!isUserAuthenticated(req)) {
//       const error = new Error('Authentication required') as CustomError;
//       error.statusCode = 401;
//       throw error;
//     }

//     const { reviewId } = req.params;
//     const { status, comment } = req.body;

//     if (!status) {
//       const error = new Error('Status is required') as CustomError;
//       error.statusCode = 400;
//       throw error;
//     }

//     const review = await Review.findById(reviewId);

//     if (!review) {
//       const error = new Error('Review not found') as CustomError;
//       error.statusCode = 404;
//       throw error;
//     }

//     // Check if transition is valid
//     const isStaff = isConnectGoStaff(req);
//     if (!review.canTransitionTo(status, req.user._id, isStaff)) {
//       const error = new Error(`Invalid status transition from ${review.status} to ${status}`) as CustomError;
//       error.statusCode = 400;
//       throw error;
//     }

//     // Transition to new status
//     review.transitionToStatus(status, req.user._id, isStaff, comment);
//     await review.save();

//     const populatedReview = await Review.findById(review._id)
//       .populate('comments.author', 'name email');

//     res.status(200).json({
//       success: true,
//       message: `Review status updated to ${status}`,
//       data: populatedReview
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// /**
//  * Cancel review
//  * @route PUT /api/v1/reviews/:reviewId/cancel
//  * @access Private (Manager, Staff)
//  */
// export const cancelReview = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     if (!isUserAuthenticated(req)) {
//       const error = new Error('Authentication required') as CustomError;
//       error.statusCode = 401;
//       throw error;
//     }

//     const { reviewId } = req.params;
//     const { reason } = req.body;

//     const review = await Review.findById(reviewId);

//     if (!review) {
//       const error = new Error('Review not found') as CustomError;
//       error.statusCode = 404;
//       throw error;
//     }

//     // Check permissions - manager, project creator, or ConnectGo staff can cancel
//     if (!canReviewAsManager(req, review)) {
//       const error = new Error('Not authorized to cancel this review') as CustomError;
//       error.statusCode = 403;
//       throw error;
//     }

//     // Transition to cancelled
//     review.transitionToStatus('cancelled', req.user._id, isConnectGoStaff(req), reason);
//     review.completedAt = new Date();
//     await review.save();

//     res.status(200).json({
//       success: true,
//       message: 'Review cancelled successfully',
//       data: review
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// // ==================== STATISTICS & ANALYTICS ====================

// /**
//  * Get review statistics
//  * @route GET /api/v1/reviews/statistics
//  * @access Private
//  */
// export const getReviewStatistics = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     if (!isUserAuthenticated(req)) {
//       const error = new Error('Authentication required') as CustomError;
//       error.statusCode = 401;
//       throw error;
//     }

//     const { organizationId, projectId } = req.query;

//     // Build query
//     let query: any = { archived: { $ne: true } };

//     if (organizationId) {
//       query.organization = organizationId;
//     } else if (!isConnectGoStaff(req)) {
//       // Filter based on user role
//       if (isManager(req)) {
//         // Filter by user's organizations
//         const userOrgs = req.user.roles
//           ?.filter((r: any) => r.organization)
//           .map((r: any) => r.organization) || [];
//         query.organization = { $in: userOrgs };
//       } else if (isProjectCreator(req)) {
//         // Filter by user's projects
//         const userProjects = getUserProjects(req.user);
//         query.project = { $in: userProjects };
//       }
//     }

//     if (projectId) {
//       query.project = projectId;
//     }

//     // Get statistics
//     const stats = await Review.aggregate([
//       { $match: query },
//       {
//         $group: {
//           _id: null,
//           total: { $sum: 1 },
//           pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
//           managerReview: { $sum: { $cond: [{ $eq: ['$status', 'manager_review'] }, 1, 0] } },
//           managerApproved: { $sum: { $cond: [{ $eq: ['$status', 'manager_approved'] }, 1, 0] } },
//           managerRejected: { $sum: { $cond: [{ $eq: ['$status', 'manager_rejected'] }, 1, 0] } },
//           staffReview: { $sum: { $cond: [{ $eq: ['$status', 'staff_review'] }, 1, 0] } },
//           staffApproved: { $sum: { $cond: [{ $eq: ['$status', 'staff_approved'] }, 1, 0] } },
//           staffRejected: { $sum: { $cond: [{ $eq: ['$status', 'staff_rejected'] }, 1, 0] } },
//           cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
//           onHold: { $sum: { $cond: [{ $eq: ['$status', 'on_hold'] }, 1, 0] } },
//           avgProgress: { $avg: '$progress' }
//         }
//       }
//     ]);

//     // Get overdue reviews
//     const overdueReviews = await Review.find({
//       ...query,
//       $or: [
//         {
//           managerDueDate: { $lt: new Date() },
//           'managerReview.status': { $in: ['pending', 'in_progress'] }
//         },
//         {
//           staffDueDate: { $lt: new Date() },
//           'staffReview.status': { $in: ['pending', 'in_progress'] }
//         }
//       ],
//       status: { $nin: ['staff_approved', 'staff_rejected', 'cancelled'] }
//     });

//     // Get reviews by phase
//     const byPhase = await Review.aggregate([
//       { $match: query },
//       {
//         $group: {
//           _id: '$phase',
//           count: { $sum: 1 }
//         }
//       }
//     ]);

//     // Get reviews by priority
//     const byPriority = await Review.aggregate([
//       { $match: query },
//       {
//         $group: {
//           _id: '$priority',
//           count: { $sum: 1 }
//         }
//       }
//     ]);

//     res.status(200).json({
//       success: true,
//       data: {
//         overview: stats[0] || {
//           total: 0,
//           pending: 0,
//           managerReview: 0,
//           managerApproved: 0,
//           managerRejected: 0,
//           staffReview: 0,
//           staffApproved: 0,
//           staffRejected: 0,
//           cancelled: 0,
//           onHold: 0,
//           avgProgress: 0
//         },
//         overdueCount: overdueReviews.length,
//         byPhase,
//         byPriority
//       }
//     });
//   } catch (error) {
//     next(error);
//   }
// };

// // ==================== HELPER FUNCTIONS ====================

// /**
//  * Verify if entity exists
//  */
// async function verifyEntityExists(entityType: string, entityId: string | mongoose.Types.ObjectId): Promise<boolean> {
//   let exists = false;
//   const id = new mongoose.Types.ObjectId(entityId);

//   switch (entityType) {
//     case 'project_setup':
//       exists = !!(await ProjectSetup.exists({ _id: id }));
//       break;
//     case 'site_setup':
//       exists = !!(await ProjectSiteSetup.exists({ _id: id }));
//       break;
//     case 'stakeholder_mapping':
//       exists = !!(await StakeholderGroup.exists({ _id: id }));
//       break;
//     case 'consultation_plan':
//       exists = !!(await TOCConsultationPlan.exists({ _id: id }));
//       break;
//     case 'theory_of_change_stage':
//       exists = !!(await TheoryOfChangeStage.exists({ _id: id }));
//       break;
//     case 'survey':
//       exists = !!(await Survey.exists({ _id: id }));
//       break;
//     case 'report':
//       // Add report model check when implemented
//       exists = true;
//       break;
//     default:
//       exists = false;
//   }

//   return exists;
// }

// /**
//  * Get entity-specific details
//  */
// async function getEntityDetails(entityType: string, entityId: mongoose.Types.ObjectId): Promise<any> {
//   let details = null;

//   switch (entityType) {
//     case 'project_setup':
//       details = await ProjectSetup.findById(entityId)
//         .populate('project', 'name')
//         .populate('lastUpdatedBy', 'name email');
//       break;
//     case 'site_setup':
//       details = await ProjectSiteSetup.findById(entityId)
//         .populate('project', 'name')
//         .populate('projectSite', 'name')
//         .populate('lastUpdatedBy', 'name email');
//       break;
//     case 'stakeholder_mapping':
//       details = await StakeholderGroup.findById(entityId)
//         .populate('category', 'name')
//         .populate('creator', 'name email');
//       break;
//     case 'consultation_plan':
//       details = await TOCConsultationPlan.findById(entityId)
//         .populate('project', 'name')
//         .populate('projectSite', 'name');
//       break;
//     case 'theory_of_change_stage':
//       details = await TheoryOfChangeStage.findById(entityId)
//         .populate('project', 'name')
//         .populate('projectSite', 'name');
      
//       // Get actions and impacts for the stage
//       if (details) {
//         const [actions, impacts] = await Promise.all([
//           StakeholderAction.find({ stage: entityId, archived: { $ne: true } }),
//           SocialImpact.find({ stage: entityId, archived: { $ne: true } })
//         ]);
//         details = {
//           ...details.toObject(),
//           actions,
//           impacts
//         };
//       }
//       break;
//     case 'survey':
//       details = await Survey.findById(entityId)
//         .populate('project', 'name')
//         .populate('projectSite', 'name')
//         .populate('stakeholderGroup', 'name')
//         .populate('creator', 'name email');
//       break;
//     default:
//       details = null;
//   }

//   return details;
// }

// // Export all functions
// export {
//   // Helpers are not exported as they're internal
// };