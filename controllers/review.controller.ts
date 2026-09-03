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
import {
  notifyReviewCreated,
  notifyIssueAdded,
  notifyIssueResolved,
  notifyReviewEscalated,
  notifyReviewClosed,
  notifyStatusChanged,
  notifySeekInput,
} from "../utils/reviewNotifications";
import Conversation from "../models/conversation.model";
import Message from "../models/message.model";

// Type guard to check if user is authenticated
function isUserAuthenticated(req: Request): req is Request & { user: IUserDocument & { _id: mongoose.Types.ObjectId } } {
  return req.user !== undefined;
}

// Safely extract an ID string from a field that may be a populated object or a plain ObjectId
function idStr(field: any): string {
  if (!field) return '';
  return (field._id ?? field).toString();
}

/**
 * Builds a Mongo condition for a date-friendly urgency bucket, derived from
 * dueDate — mirrors the byDueBucket aggregation in reviewHelpers.ts so the
 * stats card and this list filter always agree.
 */
function buildDueBucketCondition(bucket: string): any {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
  const endOfWeek = new Date(startOfToday);
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  const notClosed = { $nin: ['approved', 'resolved'] };

  switch (bucket) {
    case 'overdue':
      return { dueDate: { $lt: now }, status: notClosed };
    case 'due_today':
      return { dueDate: { $gte: now, $lt: startOfTomorrow }, status: notClosed };
    case 'due_this_week':
      return { dueDate: { $gte: startOfTomorrow, $lt: endOfWeek }, status: notClosed };
    case 'due_later':
      return { dueDate: { $gte: endOfWeek }, status: notClosed };
    case 'no_deadline':
      return { dueDate: null, status: notClosed };
    default:
      return {};
  }
}

/**
 * Adds a user to the review's inbox conversation (if not already a participant)
 * and posts a system message so all participants see the event in their inbox.
 */
async function addParticipantToReviewConversation(
  conversationId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  organization: mongoose.Types.ObjectId,
  systemMessageContent: string,
  triggeredBy: mongoose.Types.ObjectId
): Promise<void> {
  await Conversation.findByIdAndUpdate(conversationId, {
    $addToSet: { participants: userId },
    $set: { lastActivityAt: new Date() },
  });

  await Message.create({
    conversation: conversationId,
    organization,
    sender: triggeredBy,
    content: systemMessageContent,
  });
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
    (review.escalatedTo && idStr(review.escalatedTo) === userId);

  // review_management permission + org access grants full access — this applies
  // to staff too (every ConnectGo staff role has review_management, and
  // hasOrganizationAccess/hasPermission both short-circuit to true for staff),
  // so an admin/owner/account manager/analyst can see any review, not just ones
  // they're explicitly on.
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

    // Notify all assigned reviewers
    notifyReviewCreated(review, req.user._id).catch(console.error);

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

    const { status, priority, module, projectId, projectSiteId, organizationId, dueBucket, isOverdue } = req.query;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    // Build query as a set of independent conditions, combined with $and, so
    // e.g. an explicit status filter and a dueBucket-derived status constraint
    // (below) don't clobber each other.
    const conditions: any[] = [
      {
        $or: [
          { submittedBy: req.user._id },
          { reviewers: req.user._id },
          { currentReviewer: req.user._id },
          { escalatedTo: req.user._id },
        ],
      },
    ];

    if (status) conditions.push({ status });
    if (priority) conditions.push({ priority });
    if (module) conditions.push({ module });
    if (projectId) conditions.push({ projectId });
    if (projectSiteId) conditions.push({ projectSiteId });
    if (organizationId) conditions.push({ organizationId });

    const effectiveDueBucket = (dueBucket as string) || (isOverdue === 'true' ? 'overdue' : undefined);
    if (effectiveDueBucket) {
      conditions.push(buildDueBucketCondition(effectiveDueBucket));
    }

    const query: any = conditions.length > 1 ? { $and: conditions } : conditions[0];

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
      .populate('activityLog.performedBy', 'name email');

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

    // Staff visibility: staff with review_management (every ConnectGo role has
    // it) see everything, matching hasReviewAccess(); only a staff role without
    // that permission would be scoped down to explicit participation.
    if (req.user.isConnectGoStaff && !req.user.hasPermission('review_management')) {
      const userId = req.user._id;
      query.$or = [
        { submittedBy: userId },
        { reviewers: userId },
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

    // Notify participants based on the new status
    if (status === 'approved' || status === 'resolved') {
      notifyReviewClosed(review, req.user._id).catch(console.error);
    } else if (status === 'in_review') {
      notifyStatusChanged(review, req.user._id).catch(console.error);
    }

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

    // Notify the account manager they've been escalated to
    notifyReviewEscalated(review, req.user._id).catch(console.error);

    // Add AM to the review's inbox conversation and post a system message
    if (review.conversationId) {
      await addParticipantToReviewConversation(
        review.conversationId,
        accountManagerId,
        review.organizationId,
        `Review escalated to ${staffUser.name} (Account Manager): ${reason}`,
        req.user._id
      );
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

    // Check if already in the conversation
    if (review.conversationId) {
      const conv = await Conversation.findById(review.conversationId).select('participants');
      const alreadyParticipant = conv?.participants.some(
        (p) => p.toString() === collaboratorId
      );
      if (alreadyParticipant) {
        const error = new Error('This staff member is already a collaborator') as CustomError;
        error.statusCode = 409;
        throw error;
      }
    }

    // Log the activity and add to the review conversation
    review.addActivity(
      'staff_collaborator_invited',
      req.user._id,
      message || `${collaborator.name} invited to collaborate on this review`,
      undefined,
      collaboratorId
    );
    await review.save();

    if (review.conversationId) {
      await addParticipantToReviewConversation(
        review.conversationId,
        collaborator._id as mongoose.Types.ObjectId,
        review.organizationId,
        `${collaborator.name} has been invited to collaborate${message ? `: "${message}"` : ''}`,
        req.user._id
      );
    }

    const populatedReview = await Review.findById(reviewId)
      .populate('reviewers', 'name email primaryRole photo')
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

    // Add reviewer to the review's inbox conversation
    if (review.conversationId) {
      await addParticipantToReviewConversation(
        review.conversationId,
        new mongoose.Types.ObjectId(reviewerId),
        review.organizationId,
        `${reviewerUser.name} was added as a reviewer`,
        req.user._id
      );
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

    // Notify submitter (and AM if escalated) about the new issue
    notifyIssueAdded(review, description, req.user._id).catch(console.error);

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

    // Capture the issue raiser before mutating
    const issueBeforeResolve = review.issues.find(
      (i) => i._id?.toString() === issueId
    );
    const issueRaisedBy = issueBeforeResolve?.raisedBy;

    // Resolve issue using the method
    review.resolveIssue(new mongoose.Types.ObjectId(issueId), req.user._id, resolutionNotes);
    await review.save();

    // Notify the person who raised the issue
    if (issueRaisedBy) {
      notifyIssueResolved(review, issueRaisedBy, req.user._id).catch(console.error);
    }

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

/**
 * Get non-staff organisation users eligible to be added as reviewers.
 * Staff-only: used when a staff member views a review in "client mode" and
 * wants to add an org client as a reviewer.
 * @route GET /api/v1/reviews/:reviewId/eligible-org-clients
 * @access Private (ConnectGo staff only)
 */
export const getEligibleOrgClients = async (
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
      const error = new Error('Staff access required') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const { reviewId } = req.params;

    const review = await Review.findById(reviewId)
      .select('organizationId projectId submittedBy reviewers');

    if (!review) {
      const error = new Error('Review not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    const currentReviewerIds = review.reviewers.map((r: any) => r.toString());

    const orgClients = await User.find({
      isConnectGoStaff: false,
      archived: false,
      _id: {
        $ne: review.submittedBy,
        $nin: currentReviewerIds,
      },
    }).select('name email primaryRole photo roles');

    const eligible = orgClients.filter((u: any) =>
      u.hasProjectAccess(review.projectId) ||
      u.hasOrganizationAccess(review.organizationId)
    );

    res.status(200).json({
      success: true,
      count: eligible.length,
      data: eligible.map((u: any) => ({
        _id: u._id,
        name: u.name,
        email: u.email,
        role: u.primaryRole,
        photo: u.photo,
        isStaff: false,
      })),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update editable metadata fields on an existing review: title, description, priority, dueDate.
 * @route PATCH /api/v1/reviews/:reviewId/metadata
 * @access Any user with review access (reviewer, submitter, escalated AM, or review_management perm)
 */
export const updateReviewMetadata = async (
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
    const { title, description, priority, dueDate } = req.body;

    const review = await Review.findById(reviewId);
    if (!review) {
      const error = new Error('Review not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    if (!hasReviewAccess(req.user, review)) {
      const error = new Error('Not authorized to update this review') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    const validPriorities = ['low', 'medium', 'high', 'critical'];
    if (priority && !validPriorities.includes(priority)) {
      const error = new Error(`Invalid priority. Must be one of: ${validPriorities.join(', ')}`) as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const updates: any = {};
    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = description?.trim() ?? null;
    if (priority !== undefined) updates.priority = priority;
    if (dueDate !== undefined) updates.dueDate = dueDate ? new Date(dueDate) : null;

    if (Object.keys(updates).length === 0) {
      const error = new Error('No valid fields provided for update') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    review.addActivity(
      'metadata_updated',
      req.user._id,
      `Updated: ${Object.keys(updates).join(', ')}`
    );

    Object.assign(review, updates);
    await review.save();

    const populated = await Review.findById(reviewId)
      .populate('submittedBy', 'name email')
      .populate('reviewers', 'name email')
      .populate('escalatedTo', 'name email');

    res.status(200).json({
      success: true,
      message: 'Review updated successfully',
      data: populated,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/reviews/:reviewId/seek-input
 * Send input_request notifications to a list of colleagues for a review.
 */
export const seekInput = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!isUserAuthenticated(req)) {
      const err = new Error("Authentication required") as CustomError;
      err.statusCode = 401;
      throw err;
    }

    const { reviewId } = req.params;
    const { recipientIds, message, deadline } = req.body;

    if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
      return res.status(400).json({ success: false, error: "recipientIds must be a non-empty array" });
    }
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ success: false, error: "message is required" });
    }
    if (!deadline || isNaN(new Date(deadline as string).getTime())) {
      return res.status(400).json({ success: false, error: "A valid deadline is required" });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ success: false, error: "Review not found" });
    }

    const recipientObjectIds = (recipientIds as string[]).map(
      (id) => new mongoose.Types.ObjectId(id)
    );
    const deadlineDate = new Date(deadline as string);

    const sent = await notifySeekInput(
      review,
      recipientObjectIds,
      req.user._id,
      message.trim(),
      deadlineDate
    );

    // The response deadline becomes the review's due date, driving the
    // date-based urgency shown/filtered on the reviews page.
    review.dueDate = deadlineDate;
    review.addActivity(
      'seek_input_deadline_set',
      req.user._id,
      `Response deadline set to ${deadlineDate.toISOString()}`
    );
    await review.save();

    return res.status(200).json({ success: true, data: { sent } });
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
  updateReviewMetadata,
  escalateReview,
  seekInput,
  inviteStaffCollaborator,
  addReviewer,
  addIssue,
  resolveIssue,
  getEscalatedReviews,
  getReviewStats,
  getReviewsByModule,
  getEligibleReviewers,
  getEligibleOrgClients,
};  