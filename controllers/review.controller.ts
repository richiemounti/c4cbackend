// controllers/review.controller.ts - FULLY UPDATED
import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Review, { ReviewModule, ReviewStatus, ReviewPriority } from "../models/review.model";
import User, { IUserDocument } from "../models/user.model";
import Project from "../models/project.model";
import Organization from "../models/organization.model";
import { CustomError } from "../middlewares/error.middleware";
import {
  createReview,
  findAccountManagerForOrganization,
  reviewExistsForModuleItem,
  getPendingReviewsCount,
  getCriticalReviews,
  getOverdueReviews,
  getReviewStatistics,
} from "../utils/reviewHelpers";
import { addChannelMember, sendSystemMessage, upsertStreamChatUser } from "../services/streamChat.service";

// Type guard to check if user is authenticated
function isUserAuthenticated(req: Request): req is Request & { user: IUserDocument & { _id: mongoose.Types.ObjectId } } {
  return req.user !== undefined;
}

// Safely extract an ID string from a field that may be a populated object or a plain ObjectId
function idStr(field: any): string {
  if (!field) return '';
  return (field._id ?? field).toString();
}

// Helper function to check if user has review access
function hasReviewAccess(
  user: IUserDocument & { _id: mongoose.Types.ObjectId },
  review: any
): boolean {
  const userId = user._id.toString();

  const isParticipant =
    idStr(review.submittedBy) === userId ||
    review.reviewers?.some((r: any) => idStr(r) === userId) ||
    review.chatParticipants?.some((p: any) => idStr(p) === userId) ||
    (review.escalatedTo && idStr(review.escalatedTo) === userId);

  // Staff: only see reviews they created or were explicitly invited to
  if (user.isConnectGoStaff) {
    return isParticipant;
  }

  // Client: org membership + review_management permission grants full access
  if (user.hasPermission('review_management') && user.hasOrganizationAccess(review.organizationId)) {
    return true;
  }

  // Fallback: direct participant
  return isParticipant;
}

/**
 * Create a new review
 * @route POST /api/v1/reviews
 * @access Private
 */
export const createReviewManually = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const {
      module,
      moduleItemId,
      organizationId,
      projectId,
      projectSiteId,
      title,
      description,
      priority,
      reviewers,
      nestedPath,
      nestedItemId,
      dueDate,
    } = req.body;

    // Validate required fields
    if (!module || !moduleItemId || !organizationId || !projectId || !title) {
      const error = new Error('Required fields missing: module, moduleItemId, organizationId, projectId, title') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // ✅ UPDATED: Check review_management permission OR org access
    const hasPermission = req.user.hasPermission('review_management');
    const hasOrgAccess = req.user.hasOrganizationAccess(organizationId);
    const isConnectGoStaff = req.user.isConnectGoStaff;

    if (!hasPermission && !hasOrgAccess && !isConnectGoStaff) {
      const error = new Error('Not authorized to create reviews for this organization') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Check if review already exists for this module item
    const exists = await reviewExistsForModuleItem(module, moduleItemId, nestedItemId);
    if (exists) {
      const error = new Error('A review already exists for this item') as CustomError;
      error.statusCode = 409;
      throw error;
    }

    // Create the review
    const review = await createReview({
      module,
      moduleItemId,
      organizationId,
      projectId,
      projectSiteId,
      submittedBy: req.user._id,
      title,
      description,
      priority: priority || 'medium',
      nestedPath,
      nestedItemId,
      autoAssignReviewers: !reviewers || reviewers.length === 0,
    });

    // If specific reviewers provided, assign them
    if (reviewers && reviewers.length > 0) {
      for (const reviewerId of reviewers) {
        review.addReviewer(reviewerId, req.user._id);
      }
      await review.save();
    }

    // Set due date if provided
    if (dueDate) {
      review.dueDate = new Date(dueDate);
      await review.save();
    }

    // STREAM CHAT INTEGRATION: Sync users to Stream Chat
    try {
      await upsertStreamChatUser(
        req.user._id.toString(),
        {
          name: req.user.name,
          email: req.user.email,
          image: req.user.photo,
          role: req.user.primaryRole,
        }
      );

      if (reviewers && reviewers.length > 0) {
        for (const reviewerId of reviewers) {
          const reviewer = await User.findById(reviewerId);
          if (reviewer) {
            await upsertStreamChatUser(
              reviewerId,
              {
                name: reviewer.name,
                email: reviewer.email,
                image: reviewer.photo,
                role: reviewer.primaryRole,
              }
            );
          }
        }
      }

      console.log(`✅ Users synced to Stream Chat for review: ${review._id}`);
    } catch (streamChatError) {
      console.error('Failed to sync users to Stream Chat:', streamChatError);
    }

    // Populate the review
    const populatedReview = await Review.findById(review._id)
      .populate('submittedBy', 'name email')
      .populate('reviewers', 'name email')
      .populate('organizationId', 'name')
      .populate('projectId', 'name');

    res.status(201).json({
      success: true,
      message: 'Review created successfully',
      data: populatedReview,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all reviews for a user (as submitter, reviewer, or escalated to)
 * @route GET /api/v1/reviews/my-reviews
 * @access Private
 */
export const getMyReviews = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { status, priority, module } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Build query
    const query: any = {
      $or: [
        { submittedBy: req.user._id },
        { reviewers: req.user._id },
        { currentReviewer: req.user._id },
        { escalatedTo: req.user._id },
      ],
    };

    if (status) {
      query.status = status;
    }

    if (priority) {
      query.priority = priority;
    }

    if (module) {
      query.module = module;
    }

    // Get reviews with pagination
    const reviews = await Review.find(query)
      .populate('submittedBy', 'name email')
      .populate('reviewers', 'name email')
      .populate('currentReviewer', 'name email')
      .populate('escalatedTo', 'name email')
      .populate('organizationId', 'name')
      .populate('projectId', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Review.countDocuments(query);

    res.status(200).json({
      success: true,
      count: reviews.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: reviews,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single review by ID
 * @route GET /api/v1/reviews/:reviewId
 * @access Private
 */
export const getReviewById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { reviewId } = req.params;

    const review = await Review.findById(reviewId)
      .populate('submittedBy', 'name email')
      .populate('reviewers', 'name email')
      .populate('currentReviewer', 'name email')
      .populate('escalatedTo', 'name email')
      .populate('resolvedBy', 'name email')
      .populate('organizationId', 'name')
      .populate('projectId', 'name')
      .populate('projectSiteId', 'name')
      .populate('issues.raisedBy', 'name email')
      .populate('issues.resolvedBy', 'name email')
      .populate('activityLog.performedBy', 'name email')
      .populate('chatParticipants', 'name email');

    if (!review) {
      const error = new Error('Review not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // ✅ UPDATED: Use helper function with review_management check
    if (!hasReviewAccess(req.user, review)) {
      const error = new Error('Not authorized to access this review') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    res.status(200).json({
      success: true,
      data: review,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'CastError') {
      const customError = new Error('Invalid review ID format') as CustomError;
      customError.statusCode = 400;
      return next(customError);
    }
    next(error);
  }
};

/**
 * Get reviews for a specific module item
 * @route GET /api/v1/reviews/module/:module/item/:moduleItemId
 * @access Private
 */
export const getReviewsByModuleItem = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { module, moduleItemId } = req.params;
    const { nestedItemId } = req.query;

    // ✅ FIXED: Validate module type to prevent errors
    const validModules = [
      'stakeholder_group',
      'project_setup',
      'project_site_setup',
      'stakeholder_action',
      'social_impact',
      'toc_consultation_plan',
      'survey',
      'survey_question',
      'survey_translation',
    ];

    if (!validModules.includes(module)) {
      const error = new Error(`Invalid module type: ${module}. Valid types are: ${validModules.join(', ')}`) as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const query: any = {
      module,
      moduleItemId,
    };

    if (nestedItemId) {
      query.nestedItemId = nestedItemId;
    }

    // Staff visibility: staff only see reviews they are explicitly involved in
    if (req.user.isConnectGoStaff) {
      const userId = req.user._id;
      query.$or = [
        { submittedBy: userId },
        { reviewers: userId },
        { chatParticipants: userId },
        { escalatedTo: userId },
      ];
    }

    const reviews = await Review.find(query)
      .populate('submittedBy', 'name email')
      .populate('reviewers', 'name email')
      .populate('escalatedTo', 'name email')
      .populate('organizationId', 'name')
      .populate('projectId', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: reviews.length,
      data: reviews,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update review status
 * @route PATCH /api/v1/reviews/:reviewId/status
 * @access Private
 */
export const updateReviewStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { reviewId } = req.params;
    const { status, reason } = req.body;

    if (!status) {
      const error = new Error('Status is required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      const error = new Error('Review not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // ✅ UPDATED: Use helper function with review_management check
    if (!hasReviewAccess(req.user, review)) {
      const error = new Error('Not authorized to change review status') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Change status using the method
    review.changeStatus(status as ReviewStatus, req.user._id, reason);

    // If changing to in_review, set current reviewer
    if (status === 'in_review' && !review.currentReviewer) {
      review.currentReviewer = req.user._id;
    }

    await review.save();

    const populatedReview = await Review.findById(reviewId)
      .populate('submittedBy', 'name email')
      .populate('reviewers', 'name email')
      .populate('currentReviewer', 'name email')
      .populate('escalatedTo', 'name email');

    res.status(200).json({
      success: true,
      message: 'Review status updated successfully',
      data: populatedReview,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Escalate review to staff
 * @route POST /api/v1/reviews/:reviewId/escalate
 * @access Private
 */
export const escalateReview = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { reviewId } = req.params;
    const { staffAccountManagerId, reason } = req.body;

    if (!reason) {
      const error = new Error('Escalation reason is required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      const error = new Error('Review not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // ✅ UPDATED: Use helper function with review_management check
    if (!hasReviewAccess(req.user, review)) {
      const error = new Error('Not authorized to escalate this review') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Find account manager if not provided
    let accountManagerId = staffAccountManagerId;
    if (!accountManagerId) {
      const accountManager = await findAccountManagerForOrganization(review.organizationId);
      if (!accountManager) {
        const error = new Error('No account manager found for this organization') as CustomError;
        error.statusCode = 404;
        throw error;
      }
      accountManagerId = accountManager._id;
    }

    // Verify the account manager is staff
    const staffUser = await User.findById(accountManagerId);
    if (!staffUser || !staffUser.isConnectGoStaff) {
      const error = new Error('Invalid staff account manager') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Escalate using the method
    review.escalate(accountManagerId, reason, req.user._id);
    await review.save();

    // STREAM CHAT INTEGRATION: Add staff to chat channel
    try {
      if (review.streamChannelCreated && review.streamChannelId) {
        await upsertStreamChatUser(
          accountManagerId.toString(),
          {
            name: staffUser.name,
            email: staffUser.email,
            image: staffUser.photo,
            role: 'staff',
          }
        );

        await addChannelMember(review.streamChannelId, accountManagerId.toString());

        await sendSystemMessage(
          review.streamChannelId,
          `🔔 Review escalated to ${staffUser.name} (Account Manager)`,
          req.user._id.toString()
        );

        console.log(`✅ Staff added to Stream Chat channel: ${review.streamChannelId}`);
      }
    } catch (streamChatError) {
      console.error('Failed to add staff to Stream Chat channel:', streamChatError);
    }

    const populatedReview = await Review.findById(reviewId)
      .populate('submittedBy', 'name email')
      .populate('reviewers', 'name email')
      .populate('escalatedTo', 'name email')
      .populate('escalatedBy', 'name email');

    res.status(200).json({
      success: true,
      message: 'Review escalated to staff successfully',
      data: populatedReview,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Invite a staff collaborator to an escalated review.
 * Account managers can bring in other staff (analysts, admins, etc.)
 * to chime in and offer solutions on a review already escalated to them.
 * @route POST /api/v1/reviews/:reviewId/staff-collaborators
 * @access Private - Account Manager or ConnectGo Staff only
 */
export const inviteStaffCollaborator = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    // Only ConnectGo staff (account managers, admins, etc.) can invite collaborators
    if (!req.user.isConnectGoStaff) {
      const error = new Error('ConnectGo staff access required') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const { reviewId } = req.params;
    const { collaboratorId, message } = req.body;

    if (!collaboratorId) {
      const error = new Error('Collaborator ID is required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      const error = new Error('Review not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Review must be escalated before staff can collaborate
    if (review.status !== 'escalated') {
      const error = new Error(
        'Only escalated reviews can have staff collaborators added'
      ) as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Verify the collaborator exists and is ConnectGo staff
    const collaborator = await User.findById(collaboratorId);
    if (!collaborator) {
      const error = new Error('Collaborator not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (!collaborator.isConnectGoStaff) {
      const error = new Error('Collaborator must be a ConnectGo staff member') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Check if already a participant
    const alreadyParticipant = review.chatParticipants.some(
      (p) => p.toString() === collaboratorId
    );
    if (alreadyParticipant) {
      const error = new Error('This staff member is already a collaborator') as CustomError;
      error.statusCode = 409;
      throw error;
    }

    // Add to chat participants and log the activity
    review.chatParticipants.push(collaborator._id as mongoose.Types.ObjectId);
    review.addActivity(
      'staff_collaborator_invited',
      req.user._id,
      message || `${collaborator.name} invited to collaborate on this review`,
      undefined,
      collaboratorId
    );

    await review.save();

    // Stream Chat: sync collaborator and add to channel
    try {
      await upsertStreamChatUser(collaboratorId, {
        name: collaborator.name,
        email: collaborator.email,
        image: collaborator.photo,
        role: collaborator.primaryRole,
      });

      if (review.streamChannelCreated && review.streamChannelId) {
        await addChannelMember(review.streamChannelId, collaboratorId);
        await sendSystemMessage(
          review.streamChannelId,
          `🤝 ${collaborator.name} has been invited to collaborate on this review${message ? `: "${message}"` : ''}`,
          req.user._id.toString()
        );
      }
    } catch (streamChatError) {
      console.error('Failed to add collaborator to Stream Chat channel:', streamChatError);
    }

    const populatedReview = await Review.findById(reviewId)
      .populate('chatParticipants', 'name email primaryRole photo')
      .populate('escalatedTo', 'name email')
      .populate('escalatedBy', 'name email');

    res.status(200).json({
      success: true,
      message: `${collaborator.name} has been invited to collaborate`,
      data: populatedReview,
    });
  } catch (error) {
    next(error);
  }
};


/**
 * Add reviewer to review
 * @route POST /api/v1/reviews/:reviewId/reviewers
 * @access Private
 */
export const addReviewer = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { reviewId } = req.params;
    const { reviewerId } = req.body;

    if (!reviewerId) {
      const error = new Error('Reviewer ID is required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      const error = new Error('Review not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if user has permission to add reviewers
    const hasPermission = req.user.hasPermission('review_management');
    const hasOrgAccess = req.user.hasOrganizationAccess(review.organizationId);
    const isConnectGoStaff = req.user.isConnectGoStaff;

    if (!hasPermission && !hasOrgAccess && !isConnectGoStaff) {
      const error = new Error('Not authorized to add reviewers') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Verify the reviewer exists
    const reviewerUser = await User.findById(reviewerId);
    if (!reviewerUser) {
      const error = new Error('Reviewer not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Validate who can be added as reviewer based on the requester's context
    if (reviewerUser.isConnectGoStaff) {
      // Staff can only be added if:
      // - The requester is also staff (staff inviting staff), OR
      // - The reviewer is an accountManager (clients can pull in an AM for help)
      const requesterIsStaff = req.user.isConnectGoStaff;
      const reviewerIsAccountManager = reviewerUser.primaryRole === 'accountManager';

      if (!requesterIsStaff && !reviewerIsAccountManager) {
        const error = new Error('Only account managers can be added to client reviews') as CustomError;
        error.statusCode = 400;
        throw error;
      }
    } else {
      // Client users: must have project or organization access
      const hasProjectAccess = reviewerUser.hasProjectAccess(review.projectId);
      const hasOrgAccessReviewer = reviewerUser.hasOrganizationAccess(review.organizationId);

      if (!hasProjectAccess && !hasOrgAccessReviewer) {
        const error = new Error('Reviewer does not have access to this project or organization') as CustomError;
        error.statusCode = 400;
        throw error;
      }
    }

    // Add reviewer using the method
    review.addReviewer(reviewerId, req.user._id);
    await review.save();

    // STREAM CHAT INTEGRATION: Add reviewer to chat channel
    try {
      if (review.streamChannelCreated && review.streamChannelId) {
        await upsertStreamChatUser(
          reviewerId,
          {
            name: reviewerUser.name,
            email: reviewerUser.email,
            image: reviewerUser.photo,
            role: reviewerUser.primaryRole,
          }
        );

        await addChannelMember(review.streamChannelId, reviewerId);

        await sendSystemMessage(
          review.streamChannelId,
          `${reviewerUser.name} was added as a reviewer`,
          req.user._id.toString()
        );

        console.log(`✅ Reviewer added to Stream Chat channel: ${review.streamChannelId}`);
      }
    } catch (streamChatError) {
      console.error('Failed to add reviewer to Stream Chat channel:', streamChatError);
    }

    const populatedReview = await Review.findById(reviewId)
      .populate('reviewers', 'name email');

    res.status(200).json({
      success: true,
      message: 'Reviewer added successfully',
      data: populatedReview,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add issue to review
 * @route POST /api/v1/reviews/:reviewId/issues
 * @access Private
 */
export const addIssue = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { reviewId } = req.params;
    const { field, issueType, severity, description, suggestedFix } = req.body;

    if (!issueType || !severity || !description) {
      const error = new Error('Required fields missing: issueType, severity, description') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      const error = new Error('Review not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // ✅ UPDATED: Use helper function with review_management check
    if (!hasReviewAccess(req.user, review)) {
      const error = new Error('Not authorized to add issues to this review') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Add issue using the method
    review.addIssue({
      field,
      issueType,
      severity,
      description,
      suggestedFix,
      raisedBy: req.user._id,
    });

    await review.save();

    const populatedReview = await Review.findById(reviewId)
      .populate('issues.raisedBy', 'name email');

    res.status(200).json({
      success: true,
      message: 'Issue added successfully',
      data: populatedReview,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resolve issue
 * @route PATCH /api/v1/reviews/:reviewId/issues/:issueId/resolve
 * @access Private
 */
export const resolveIssue = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { reviewId, issueId } = req.params;
    const { resolutionNotes } = req.body;

    const review = await Review.findById(reviewId);
    if (!review) {
      const error = new Error('Review not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // ✅ UPDATED: Use helper function with review_management check
    if (!hasReviewAccess(req.user, review)) {
      const error = new Error('Not authorized to resolve issues in this review') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Resolve issue using the method
    review.resolveIssue(new mongoose.Types.ObjectId(issueId), req.user._id, resolutionNotes);
    await review.save();

    const populatedReview = await Review.findById(reviewId)
      .populate('issues.resolvedBy', 'name email');

    res.status(200).json({
      success: true,
      message: 'Issue resolved successfully',
      data: populatedReview,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get escalated reviews for staff
 * @route GET /api/v1/reviews/escalated
 * @access Private - Staff only
 */
export const getEscalatedReviews = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    if (!req.user.isConnectGoStaff) {
      const error = new Error('ConnectGo staff access required') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const query: any = {
      status: 'escalated',
    };

    // Account managers only see their assigned reviews
    if (req.user.primaryRole === 'accountManager') {
      query.escalatedTo = req.user._id;
    }

    const reviews = await Review.find(query)
      .populate('submittedBy', 'name email')
      .populate('reviewers', 'name email')
      .populate('escalatedBy', 'name email')
      .populate('organizationId', 'name')
      .populate('projectId', 'name')
      .sort({ escalatedAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Review.countDocuments(query);

    res.status(200).json({
      success: true,
      count: reviews.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: reviews,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get review statistics for dashboard
 * @route GET /api/v1/reviews/statistics/:organizationId
 * @access Private
 */
export const getReviewStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { organizationId } = req.params;

    // ✅ UPDATED: Check review_management permission OR org access
    const hasPermission = req.user.hasPermission('review_management');
    const hasOrgAccess = req.user.hasOrganizationAccess(organizationId);
    const isConnectGoStaff = req.user.isConnectGoStaff;

    if (!hasPermission && !hasOrgAccess && !isConnectGoStaff) {
      const error = new Error('Not authorized to access organization statistics') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const stats = await getReviewStatistics(new mongoose.Types.ObjectId(organizationId));
    const criticalReviews = await getCriticalReviews(new mongoose.Types.ObjectId(organizationId));
    const overdueReviews = await getOverdueReviews(new mongoose.Types.ObjectId(organizationId));
    const pendingCount = await getPendingReviewsCount(req.user._id);

    res.status(200).json({
      success: true,
      data: {
        statistics: stats,
        criticalReviews,
        overdueReviews,
        myPendingCount: pendingCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get reviews by module and module item ID
 * @route GET /api/v1/reviews/module/:projectId/:module/:moduleItemId
 * @access Private
 */
export const getReviewsByModule = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { projectId, module, moduleItemId } = req.params;

    // ✅ FIXED: Validate module type
    const validModules = [
      'stakeholder_group',
      'project_setup',
      'project_site_setup',
      'stakeholder_action',
      'social_impact',
      'toc_consultation_plan',
      'survey',
      'survey_question',
      'survey_translation',
    ];

    if (!validModules.includes(module)) {
      const error = new Error(`Invalid module type: ${module}. Valid types are: ${validModules.join(', ')}`) as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Check if user has access to this project
    const project = await Project.findById(projectId);
    if (!project) {
      const error = new Error('Project not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // ✅ UPDATED: Check review_management permission OR project access
    const hasPermission = req.user.hasPermission('review_management');
    const hasProjectAccess = req.user.hasProjectAccess(project._id);
    const isConnectGoStaff = req.user.isConnectGoStaff;

    if (!hasPermission && !hasProjectAccess && !isConnectGoStaff) {
      const error = new Error('Not authorized to access this project') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Find all reviews for this module item
    const reviews = await Review.find({
      projectId: new mongoose.Types.ObjectId(projectId),
      module: module as any,
      moduleItemId: new mongoose.Types.ObjectId(moduleItemId),
    })
      .populate('submittedBy', 'name email')
      .populate('reviewers', 'name email')
      .populate('currentReviewer', 'name email')
      .populate('escalatedTo', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: reviews.length,
      data: reviews,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get eligible reviewers for a review
 * Users must have project access AND review_management permission
 * Excludes ConnectGo staff users
 * @route GET /api/v1/reviews/:reviewId/eligible-reviewers
 * @access Private
 */
export const getEligibleReviewers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const error = new Error('Authentication required') as CustomError;
      error.statusCode = 401;
      throw error;
    }

    const { reviewId } = req.params;

    // Get the review to know which project and organization
    const review = await Review.findById(reviewId)
      .select('organizationId projectId submittedBy reviewers');

    if (!review) {
      const error = new Error('Review not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check if user has access to this review
    if (!hasReviewAccess(req.user, review)) {
      const error = new Error('Not authorized to access this review') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Get current reviewer IDs to exclude them
    const currentReviewerIds = review.reviewers.map(r => r.toString());

    const baseExclude = {
      _id: {
        $ne: review.submittedBy,
        $nin: currentReviewerIds,
      },
      archived: false,
    };

    let eligibleUsers: any[] = [];

    if (req.user.isConnectGoStaff) {
      // Staff adding to a review: they can invite other ConnectGo staff members
      const staffUsers = await User.find({
        ...baseExclude,
        isConnectGoStaff: true,
        _id: { ...baseExclude._id, $ne: req.user._id, $nin: currentReviewerIds },
      }).select('name email primaryRole photo');

      eligibleUsers = staffUsers.map(u => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        role: u.primaryRole,
        photo: u.photo,
        isStaff: true,
      }));
    } else {
      // Client adding to a review:
      // 1. Client users who have org/project access
      const clientUsers = await User.find({
        ...baseExclude,
        isConnectGoStaff: false,
      }).select('name email primaryRole roles photo');

      const clientEligible = clientUsers.filter(user => {
        return (
          user.hasProjectAccess(review.projectId) ||
          user.hasOrganizationAccess(review.organizationId)
        );
      });

      // 2. AccountManager staff (clients can bring in AM for help)
      const accountManagers = await User.find({
        ...baseExclude,
        isConnectGoStaff: true,
        primaryRole: 'accountManager',
        _id: { $ne: review.submittedBy, $nin: currentReviewerIds },
      }).select('name email primaryRole photo');

      eligibleUsers = [
        ...clientEligible.map(u => ({
          _id: u._id,
          name: u.name,
          email: u.email,
          role: u.primaryRole,
          photo: u.photo,
          isStaff: false,
        })),
        ...accountManagers.map(u => ({
          _id: u._id,
          name: u.name,
          email: u.email,
          role: u.primaryRole,
          photo: u.photo,
          isStaff: true,
        })),
      ];
    }

    const formattedUsers = eligibleUsers;

    res.status(200).json({
      success: true,
      count: formattedUsers.length,
      data: formattedUsers,
    });
  } catch (error) {
    next(error);
  }
};

// Update the default export at the bottom to include the new function
export default {
  createReviewManually,
  getMyReviews,
  getReviewById,
  getReviewsByModuleItem,
  updateReviewStatus,
  escalateReview,
  inviteStaffCollaborator, // ✅ ADD
  addReviewer,
  addIssue,
  resolveIssue,
  getEscalatedReviews,
  getReviewStats,
  getReviewsByModule,
  getEligibleReviewers, // ✅ ADD THIS
};  