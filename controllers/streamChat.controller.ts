// controllers/streamChat.controller.ts
import { Request, Response, NextFunction } from 'express';
import { CustomError } from '../middlewares/error.middleware';
import {
  generateUserToken,
  upsertStreamChatUser,
  getUserChannels,
  createReviewChannel,
  addChannelMember,
  isStreamChatConfigured,
} from '../services/streamChat.service';
import Review from '../models/review.model';
import User, { IUserDocument } from '../models/user.model';
import mongoose from 'mongoose';

// Type guard for authenticated user
function isUserAuthenticated(req: Request): req is Request & { user: IUserDocument & { _id: mongoose.Types.ObjectId } } {
  return req.user !== undefined;
}

/**
 * Get Stream Chat token for authenticated user
 * @route GET /api/v1/stream-chat/token
 * @access Private
 */
export const getStreamChatToken = async (
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

    if (!isStreamChatConfigured()) {
      const error = new Error('Stream Chat is not configured on the server') as CustomError;
      error.statusCode = 503;
      throw error;
    }

    // Ensure user exists in Stream Chat
    await upsertStreamChatUser(
      req.user._id.toString(),
      {
        name: req.user.name,
        email: req.user.email,
        image: req.user.photo, // ✅ FIXED: Use 'photo' instead of 'profilePicture'
        role: req.user.primaryRole,
      }
    );

    // Generate token for this user
    const token = generateUserToken(req.user._id.toString());

    res.status(200).json({
      success: true,
      data: {
        token,
        apiKey: process.env.STREAM_API_KEY,
        userId: req.user._id.toString(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get user's Stream Chat channels
 * @route GET /api/v1/stream-chat/channels
 * @access Private
 */
export const getMyStreamChannels = async (
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

    if (!isStreamChatConfigured()) {
      return res.status(200).json({
        success: true,
        data: {
          channels: [],
          message: 'Stream Chat not configured',
        },
      });
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const channels = await getUserChannels(req.user._id.toString(), limit);

    res.status(200).json({
      success: true,
      count: channels.length,
      data: {
        channels,
      },
    });
  } catch (error) {
    next(error);
  }
};

// controllers/streamChat.controller.ts - UPDATE createReviewChannelOnDemand

/**
 * Create a Stream Chat channel for a review (on-demand)
 * This is called when the first message is about to be sent
 * @route POST /api/v1/stream-chat/reviews/:reviewId/channel
 * @access Private
 */
export const createReviewChannelOnDemand = async (
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

    if (!isStreamChatConfigured()) {
      const error = new Error('Stream Chat is not configured') as CustomError;
      error.statusCode = 503;
      throw error;
    }

    const { reviewId } = req.params;

    // Get the review
    const review = await Review.findById(reviewId)
      .populate('submittedBy', '_id name email photo')
      .populate('reviewers', '_id name email photo')
      .populate('escalatedTo', '_id name email photo')
      .populate('chatParticipants', '_id name email photo');

    if (!review) {
      const error = new Error('Review not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // ✅ UPDATED: Check if user has access to this review using hasReviewAccess helper
    // This is more comprehensive than the original check
    const hasPermission = req.user.hasPermission('review_management');
    const isParticipant =
      review.submittedBy._id.toString() === req.user._id.toString() ||
      review.reviewers.some((r: any) => r._id.toString() === req.user._id.toString()) ||
      review.chatParticipants.some((p: any) => p._id.toString() === req.user._id.toString()) ||
      (review.escalatedTo && review.escalatedTo._id.toString() === req.user._id.toString());

    const hasOrgAccess = req.user.hasOrganizationAccess(review.organizationId);
    const hasProjectAccess = req.user.hasProjectAccess(review.projectId);
    const isConnectGoStaff = req.user.isConnectGoStaff;

    const hasAccess = hasPermission || isParticipant || hasOrgAccess || hasProjectAccess || isConnectGoStaff;

    if (!hasAccess) {
      const error = new Error('Not authorized to access this review') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // ✅ NEW: Add current user to chatParticipants if they have access but aren't in the list yet
    const currentUserInParticipants = review.chatParticipants.some(
      (p: any) => p._id.toString() === req.user._id.toString()
    );

    if (!currentUserInParticipants) {
      console.log(`Adding current user ${req.user._id} to chatParticipants`);
      review.chatParticipants.push(req.user._id);
      await review.save();
      
      // Re-populate after adding
      await review.populate('chatParticipants', '_id name email photo');
    }

    // Check if channel already exists
    if (review.streamChannelCreated && review.streamChannelId) {
      // ✅ NEW: If channel exists but current user is not a member, add them
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

        // Add current user to the existing channel
        await addChannelMember(review.streamChannelId, req.user._id.toString());
        
        console.log(`✅ Added current user to existing channel: ${review.streamChannelId}`);
      } catch (err) {
        console.error('Error adding user to existing channel:', err);
        // Continue anyway - they might already be a member
      }

      return res.status(200).json({
        success: true,
        message: 'Channel ready',
        data: {
          channelId: review.streamChannelId,
          channelType: review.streamChannelType || 'messaging',
          alreadyExisted: true,
        },
      });
    }

    // ✅ UPDATED: Ensure all participants are upserted in Stream Chat
    const participants = review.chatParticipants as any as IUserDocument[];
    const participantIds = participants.map((p) => (p._id as mongoose.Types.ObjectId).toString());
    
    console.log(`Creating channel with ${participantIds.length} participants:`, participantIds);

    for (const participant of participants) {
      await upsertStreamChatUser(
        (participant._id as mongoose.Types.ObjectId).toString(),
        {
          name: participant.name,
          email: participant.email,
          image: participant.photo,
          role: participant.primaryRole || 'user', // ✅ Use their actual role
        }
      );
    }

    // Create the channel
    const channelInfo = await createReviewChannel(
      reviewId,
      participantIds,
      review.title
    );

    if (!channelInfo) {
      const error = new Error('Failed to create Stream Chat channel') as CustomError;
      error.statusCode = 500;
      throw error;
    }

    // Update review with channel info
    review.streamChannelId = channelInfo.channelId;
    review.streamChannelType = channelInfo.channelType;
    review.streamChannelCreated = true;
    review.streamChannelCreatedAt = new Date();
    await review.save();

    res.status(201).json({
      success: true,
      message: 'Stream Chat channel created successfully',
      data: {
        channelId: channelInfo.channelId,
        channelType: channelInfo.channelType,
        alreadyExisted: false,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Add a user to a review's Stream Chat channel
 * @route POST /api/v1/stream-chat/reviews/:reviewId/members
 * @access Private
 */
export const addMemberToReviewChannel = async (
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

    if (!isStreamChatConfigured()) {
      const error = new Error('Stream Chat is not configured') as CustomError;
      error.statusCode = 503;
      throw error;
    }

    const { reviewId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      const error = new Error('User ID is required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Get the review
    const review = await Review.findById(reviewId);
    if (!review) {
      const error = new Error('Review not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Check authorization
    const hasOrgAccess = req.user.hasOrganizationAccess(review.organizationId);
    const isConnectGoStaff = req.user.isConnectGoStaff;

    if (!hasOrgAccess && !isConnectGoStaff) {
      const error = new Error('Not authorized to add members') as CustomError;
      error.statusCode = 403;
      throw error;
    }

    // Check if channel exists
    if (!review.streamChannelCreated || !review.streamChannelId) {
      const error = new Error('Stream Chat channel not created yet') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // Get user to add
    const userToAdd = await User.findById(userId);
    if (!userToAdd) {
      const error = new Error('User not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Ensure user exists in Stream Chat
    await upsertStreamChatUser(
      userId,
      {
        name: userToAdd.name,
        email: userToAdd.email,
        image: userToAdd.photo, // ✅ FIXED: Use 'photo' instead of 'profilePicture'
      }
    );

    // Add member to Stream Chat channel
    await addChannelMember(review.streamChannelId, userId);

    // Add to chatParticipants if not already there
    if (!review.chatParticipants.includes(new mongoose.Types.ObjectId(userId))) {
      review.chatParticipants.push(new mongoose.Types.ObjectId(userId));
      await review.save();
    }

    res.status(200).json({
      success: true,
      message: 'Member added to Stream Chat channel successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Check Stream Chat configuration status
 * @route GET /api/v1/stream-chat/status
 * @access Private
 */
export const getStreamChatStatus = async (
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

    const configured = isStreamChatConfigured();

    res.status(200).json({
      success: true,
      data: {
        configured,
        message: configured
          ? 'Stream Chat is configured and ready'
          : 'Stream Chat is not configured. Add STREAM_API_KEY and STREAM_API_SECRET to enable.',
      },
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getStreamChatToken,
  getMyStreamChannels,
  createReviewChannelOnDemand,
  addMemberToReviewChannel,
  getStreamChatStatus,
};