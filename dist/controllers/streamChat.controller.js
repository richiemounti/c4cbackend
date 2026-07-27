"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStreamChatStatus = exports.addMemberToReviewChannel = exports.createReviewChannelOnDemand = exports.getMyStreamChannels = exports.getStreamChatToken = void 0;
const streamChat_service_1 = require("../services/streamChat.service");
const review_model_1 = __importDefault(require("../models/review.model"));
const user_model_1 = __importDefault(require("../models/user.model"));
const mongoose_1 = __importDefault(require("mongoose"));
// Type guard for authenticated user
function isUserAuthenticated(req) {
    return req.user !== undefined;
}
/**
 * Get Stream Chat token for authenticated user
 * @route GET /api/v1/stream-chat/token
 * @access Private
 */
const getStreamChatToken = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        if (!(0, streamChat_service_1.isStreamChatConfigured)()) {
            const error = new Error('Stream Chat is not configured on the server');
            error.statusCode = 503;
            throw error;
        }
        // Ensure user exists in Stream Chat
        yield (0, streamChat_service_1.upsertStreamChatUser)(req.user._id.toString(), {
            name: req.user.name,
            email: req.user.email,
            image: req.user.photo, // ✅ FIXED: Use 'photo' instead of 'profilePicture'
            role: req.user.primaryRole,
        });
        // Generate token for this user
        const token = (0, streamChat_service_1.generateUserToken)(req.user._id.toString());
        res.status(200).json({
            success: true,
            data: {
                token,
                apiKey: process.env.STREAM_API_KEY,
                userId: req.user._id.toString(),
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getStreamChatToken = getStreamChatToken;
/**
 * Get user's Stream Chat channels
 * @route GET /api/v1/stream-chat/channels
 * @access Private
 */
const getMyStreamChannels = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        if (!(0, streamChat_service_1.isStreamChatConfigured)()) {
            return res.status(200).json({
                success: true,
                data: {
                    channels: [],
                    message: 'Stream Chat not configured',
                },
            });
        }
        const limit = parseInt(req.query.limit) || 20;
        const channels = yield (0, streamChat_service_1.getUserChannels)(req.user._id.toString(), limit);
        res.status(200).json({
            success: true,
            count: channels.length,
            data: {
                channels,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getMyStreamChannels = getMyStreamChannels;
// controllers/streamChat.controller.ts - UPDATE createReviewChannelOnDemand
/**
 * Create a Stream Chat channel for a review (on-demand)
 * This is called when the first message is about to be sent
 * @route POST /api/v1/stream-chat/reviews/:reviewId/channel
 * @access Private
 */
const createReviewChannelOnDemand = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        if (!(0, streamChat_service_1.isStreamChatConfigured)()) {
            const error = new Error('Stream Chat is not configured');
            error.statusCode = 503;
            throw error;
        }
        const { reviewId } = req.params;
        // Get the review
        const review = yield review_model_1.default.findById(reviewId)
            .populate('submittedBy', '_id name email photo')
            .populate('reviewers', '_id name email photo')
            .populate('escalatedTo', '_id name email photo')
            .populate('chatParticipants', '_id name email photo');
        if (!review) {
            const error = new Error('Review not found');
            error.statusCode = 404;
            throw error;
        }
        // ✅ UPDATED: Check if user has access to this review using hasReviewAccess helper
        // This is more comprehensive than the original check
        const hasPermission = req.user.hasPermission('review_management');
        const isParticipant = review.submittedBy._id.toString() === req.user._id.toString() ||
            review.reviewers.some((r) => r._id.toString() === req.user._id.toString()) ||
            review.chatParticipants.some((p) => p._id.toString() === req.user._id.toString()) ||
            (review.escalatedTo && review.escalatedTo._id.toString() === req.user._id.toString());
        const hasOrgAccess = req.user.hasOrganizationAccess(review.organizationId);
        const hasProjectAccess = req.user.hasProjectAccess(review.projectId);
        const isConnectGoStaff = req.user.isConnectGoStaff;
        const hasAccess = hasPermission || isParticipant || hasOrgAccess || hasProjectAccess || isConnectGoStaff;
        if (!hasAccess) {
            const error = new Error('Not authorized to access this review');
            error.statusCode = 403;
            throw error;
        }
        // ✅ NEW: Add current user to chatParticipants if they have access but aren't in the list yet
        const currentUserInParticipants = review.chatParticipants.some((p) => p._id.toString() === req.user._id.toString());
        if (!currentUserInParticipants) {
            console.log(`Adding current user ${req.user._id} to chatParticipants`);
            review.chatParticipants.push(req.user._id);
            yield review.save();
            // Re-populate after adding
            yield review.populate('chatParticipants', '_id name email photo');
        }
        // Check if channel already exists
        if (review.streamChannelCreated && review.streamChannelId) {
            // ✅ NEW: If channel exists but current user is not a member, add them
            try {
                yield (0, streamChat_service_1.upsertStreamChatUser)(req.user._id.toString(), {
                    name: req.user.name,
                    email: req.user.email,
                    image: req.user.photo,
                    role: req.user.primaryRole,
                });
                // Add current user to the existing channel
                yield (0, streamChat_service_1.addChannelMember)(review.streamChannelId, req.user._id.toString());
                console.log(`✅ Added current user to existing channel: ${review.streamChannelId}`);
            }
            catch (err) {
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
        const participants = review.chatParticipants;
        const participantIds = participants.map((p) => p._id.toString());
        console.log(`Creating channel with ${participantIds.length} participants:`, participantIds);
        for (const participant of participants) {
            yield (0, streamChat_service_1.upsertStreamChatUser)(participant._id.toString(), {
                name: participant.name,
                email: participant.email,
                image: participant.photo,
                role: participant.primaryRole || 'user', // ✅ Use their actual role
            });
        }
        // Create the channel
        const channelInfo = yield (0, streamChat_service_1.createReviewChannel)(reviewId, participantIds, review.title);
        if (!channelInfo) {
            const error = new Error('Failed to create Stream Chat channel');
            error.statusCode = 500;
            throw error;
        }
        // Update review with channel info
        review.streamChannelId = channelInfo.channelId;
        review.streamChannelType = channelInfo.channelType;
        review.streamChannelCreated = true;
        review.streamChannelCreatedAt = new Date();
        yield review.save();
        res.status(201).json({
            success: true,
            message: 'Stream Chat channel created successfully',
            data: {
                channelId: channelInfo.channelId,
                channelType: channelInfo.channelType,
                alreadyExisted: false,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.createReviewChannelOnDemand = createReviewChannelOnDemand;
/**
 * Add a user to a review's Stream Chat channel
 * @route POST /api/v1/stream-chat/reviews/:reviewId/members
 * @access Private
 */
const addMemberToReviewChannel = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        if (!(0, streamChat_service_1.isStreamChatConfigured)()) {
            const error = new Error('Stream Chat is not configured');
            error.statusCode = 503;
            throw error;
        }
        const { reviewId } = req.params;
        const { userId } = req.body;
        if (!userId) {
            const error = new Error('User ID is required');
            error.statusCode = 400;
            throw error;
        }
        // Get the review
        const review = yield review_model_1.default.findById(reviewId);
        if (!review) {
            const error = new Error('Review not found');
            error.statusCode = 404;
            throw error;
        }
        // Check authorization
        const hasOrgAccess = req.user.hasOrganizationAccess(review.organizationId);
        const isConnectGoStaff = req.user.isConnectGoStaff;
        if (!hasOrgAccess && !isConnectGoStaff) {
            const error = new Error('Not authorized to add members');
            error.statusCode = 403;
            throw error;
        }
        // Check if channel exists
        if (!review.streamChannelCreated || !review.streamChannelId) {
            const error = new Error('Stream Chat channel not created yet');
            error.statusCode = 400;
            throw error;
        }
        // Get user to add
        const userToAdd = yield user_model_1.default.findById(userId);
        if (!userToAdd) {
            const error = new Error('User not found');
            error.statusCode = 404;
            throw error;
        }
        // Ensure user exists in Stream Chat
        yield (0, streamChat_service_1.upsertStreamChatUser)(userId, {
            name: userToAdd.name,
            email: userToAdd.email,
            image: userToAdd.photo, // ✅ FIXED: Use 'photo' instead of 'profilePicture'
        });
        // Add member to Stream Chat channel
        yield (0, streamChat_service_1.addChannelMember)(review.streamChannelId, userId);
        // Add to chatParticipants if not already there
        if (!review.chatParticipants.includes(new mongoose_1.default.Types.ObjectId(userId))) {
            review.chatParticipants.push(new mongoose_1.default.Types.ObjectId(userId));
            yield review.save();
        }
        res.status(200).json({
            success: true,
            message: 'Member added to Stream Chat channel successfully',
        });
    }
    catch (error) {
        next(error);
    }
});
exports.addMemberToReviewChannel = addMemberToReviewChannel;
/**
 * Check Stream Chat configuration status
 * @route GET /api/v1/stream-chat/status
 * @access Private
 */
const getStreamChatStatus = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req)) {
            const error = new Error('Authentication required');
            error.statusCode = 401;
            throw error;
        }
        const configured = (0, streamChat_service_1.isStreamChatConfigured)();
        res.status(200).json({
            success: true,
            data: {
                configured,
                message: configured
                    ? 'Stream Chat is configured and ready'
                    : 'Stream Chat is not configured. Add STREAM_API_KEY and STREAM_API_SECRET to enable.',
            },
        });
    }
    catch (error) {
        next(error);
    }
});
exports.getStreamChatStatus = getStreamChatStatus;
exports.default = {
    getStreamChatToken: exports.getStreamChatToken,
    getMyStreamChannels: exports.getMyStreamChannels,
    createReviewChannelOnDemand: exports.createReviewChannelOnDemand,
    addMemberToReviewChannel: exports.addMemberToReviewChannel,
    getStreamChatStatus: exports.getStreamChatStatus,
};
//# sourceMappingURL=streamChat.controller.js.map