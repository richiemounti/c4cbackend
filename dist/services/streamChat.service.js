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
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertStreamChatUser = upsertStreamChatUser;
exports.createReviewChannel = createReviewChannel;
exports.addChannelMember = addChannelMember;
exports.removeChannelMember = removeChannelMember;
exports.deleteChannel = deleteChannel;
exports.updateChannelData = updateChannelData;
exports.generateUserToken = generateUserToken;
exports.isStreamChatConfigured = isStreamChatConfigured;
exports.getUserChannels = getUserChannels;
exports.sendSystemMessage = sendSystemMessage;
// services/streamChat.service.ts
const stream_chat_1 = require("stream-chat");
const apiKey = process.env.STREAM_API_KEY;
const apiSecret = process.env.STREAM_API_SECRET;
if (!apiKey || !apiSecret) {
    console.warn('⚠️  Stream Chat API credentials not configured. Chat features will be disabled.');
    console.warn('   Add STREAM_API_KEY and STREAM_API_SECRET to your .env file to enable chat.');
}
let serverClient = null;
// ✅ FIXED: Initialize Stream Chat client with increased timeout
if (apiKey && apiSecret) {
    serverClient = stream_chat_1.StreamChat.getInstance(apiKey, apiSecret, {
        timeout: 10000, // ✅ Increase timeout to 10 seconds
    });
    console.log('✅ Stream Chat client initialized successfully');
}
/**
 * Upsert (create or update) a user in Stream Chat
 * This should be called when a user registers or their profile is updated
 */
function upsertStreamChatUser(userId, userData) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!serverClient) {
            console.warn('Stream Chat not configured - skipping user upsert');
            return;
        }
        try {
            // ✅ UPDATED: Map user roles to Stream Chat roles
            // Stream Chat has specific roles: admin, user, guest, anonymous
            // We'll use 'user' for all regular users and 'admin' for staff
            let streamChatRole = 'user';
            if (userData.role) {
                // Staff roles get 'admin' privileges in Stream Chat
                if (['owner', 'admin', 'accountManager'].includes(userData.role)) {
                    streamChatRole = 'admin';
                }
            }
            yield serverClient.upsertUser({
                id: userId,
                name: userData.name,
                email: userData.email,
                image: userData.image,
                role: streamChatRole, // ✅ Use mapped role
                // Store original role as custom field for reference
                custom_role: userData.role,
            });
            console.log(`✅ Stream Chat user upserted: ${userId} with role: ${streamChatRole}`);
        }
        catch (error) {
            console.error('Error upserting Stream Chat user:', error.message);
            // Don't throw - let the request continue even if Stream Chat fails
        }
    });
}
/**
 * Create a chat channel for a review
 * Channel ID format: review-{reviewId}
 *
 * @param reviewId - The MongoDB ObjectId of the review
 * @param participantIds - Array of user IDs (MongoDB ObjectIds as strings)
 * @param reviewTitle - Title of the review for the channel name
 * @returns Channel information or null if Stream Chat is not configured
 */
function createReviewChannel(reviewId, participantIds, reviewTitle) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (!serverClient) {
            console.warn('Stream Chat not configured - skipping channel creation');
            return null;
        }
        try {
            const channelId = `review-${reviewId}`;
            // ✅ UPDATED: Ensure all participants exist in Stream Chat first
            // Run in parallel with increased timeout tolerance
            const userPromises = participantIds.map((userId) => __awaiter(this, void 0, void 0, function* () {
                try {
                    yield serverClient.queryUsers({ id: userId });
                }
                catch (error) {
                    console.warn(`User ${userId} not found in Stream Chat, will be created on first message`);
                }
            }));
            // ✅ Wait for all user checks with timeout
            yield Promise.race([
                Promise.all(userPromises),
                new Promise((_, reject) => setTimeout(() => reject(new Error('User check timeout')), 8000))
            ]).catch(err => {
                console.warn('User check timed out, proceeding with channel creation');
            });
            // Create the channel with proper configuration
            const channel = serverClient.channel('messaging', channelId, {
                name: `Review: ${reviewTitle}`,
                created_by_id: participantIds[0],
                members: participantIds,
                review_id: reviewId
            });
            // Create the channel in Stream's database
            yield channel.create();
            console.log(`✅ Stream Chat channel created: ${channelId} with ${participantIds.length} members`);
            return {
                channelId: channel.id || channelId,
                channelType: 'messaging',
            };
        }
        catch (error) {
            console.error('Error creating Stream Chat channel:', error.message);
            if ((_a = error.message) === null || _a === void 0 ? void 0 : _a.includes('was not found')) {
                console.error('❌ One or more users do not exist in Stream Chat. Call upsertStreamChatUser() first.');
            }
            // ✅ FIXED: Return null instead of throwing
            // This allows the app to continue even if Stream Chat fails
            return null;
        }
    });
}
/**
 * Add a member to an existing channel
 * Important: The user must be registered in Stream Chat first via upsertStreamChatUser()
 */
function addChannelMember(channelId, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        if (!serverClient) {
            console.warn('Stream Chat not configured - skipping add member');
            return;
        }
        try {
            const channel = serverClient.channel('messaging', channelId);
            // ✅ UPDATED: First query to check if channel exists and if user is already a member
            const channelState = yield channel.query();
            // Check if user is already a member
            const isMember = (_a = channelState.members) === null || _a === void 0 ? void 0 : _a.some((member) => { var _a; return member.user_id === userId || ((_a = member.user) === null || _a === void 0 ? void 0 : _a.id) === userId; });
            if (isMember) {
                console.log(`✅ User ${userId} is already a member of channel ${channelId}`);
                return;
            }
            // Add the member
            yield channel.addMembers([userId]);
            console.log(`✅ Added member ${userId} to channel ${channelId}`);
        }
        catch (error) {
            console.error('Error adding member to Stream Chat channel:', error.message);
            if ((_b = error.message) === null || _b === void 0 ? void 0 : _b.includes('was not found')) {
                console.error('❌ User does not exist in Stream Chat. Call upsertStreamChatUser() first.');
            }
            // Don't throw - just log the error
        }
    });
}
/**
 * Remove a member from a channel
 */
function removeChannelMember(channelId, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!serverClient) {
            console.warn('Stream Chat not configured - skipping remove member');
            return;
        }
        try {
            const channel = serverClient.channel('messaging', channelId);
            yield channel.removeMembers([userId]);
            console.log(`✅ Removed member ${userId} from channel ${channelId}`);
        }
        catch (error) {
            console.error('Error removing member from Stream Chat channel:', error.message);
            // ✅ FIXED: Don't throw
        }
    });
}
/**
 * Delete a channel (e.g., when a review is archived)
 */
function deleteChannel(channelId) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!serverClient) {
            console.warn('Stream Chat not configured - skipping channel deletion');
            return;
        }
        try {
            const channel = serverClient.channel('messaging', channelId);
            yield channel.delete();
            console.log(`✅ Deleted channel ${channelId}`);
        }
        catch (error) {
            console.error('Error deleting Stream Chat channel:', error.message);
            // ✅ FIXED: Don't throw
        }
    });
}
/**
 * Update channel data (e.g., when review title changes)
 */
function updateChannelData(channelId, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!serverClient) {
            console.warn('Stream Chat not configured - skipping channel update');
            return;
        }
        try {
            const channel = serverClient.channel('messaging', channelId);
            yield channel.updatePartial({ set: data });
            console.log(`✅ Updated channel ${channelId}`);
        }
        catch (error) {
            console.error('Error updating Stream Chat channel:', error.message);
            // ✅ FIXED: Don't throw
        }
    });
}
/**
 * Generate a client-side token for a user to connect to Stream Chat
 * This token should be provided to the frontend to authenticate the user
 *
 * @param userId - The user's ID (MongoDB ObjectId as string)
 * @returns JWT token for client-side authentication
 */
function generateUserToken(userId) {
    if (!serverClient) {
        throw new Error('Stream Chat not configured');
    }
    try {
        const token = serverClient.createToken(userId);
        console.log(`✅ Generated Stream Chat token for user: ${userId}`);
        return token;
    }
    catch (error) {
        console.error('Error generating Stream Chat token:', error);
        throw error;
    }
}
/**
 * Check if Stream Chat is properly configured
 */
function isStreamChatConfigured() {
    return serverClient !== null;
}
/**
 * Query channels for a user
 * Useful for getting all review channels a user is part of
 */
function getUserChannels(userId_1) {
    return __awaiter(this, arguments, void 0, function* (userId, limit = 20) {
        if (!serverClient) {
            console.warn('Stream Chat not configured');
            return [];
        }
        try {
            const filter = {
                type: 'messaging',
                members: { $in: [userId] },
            };
            const sort = [{ last_message_at: -1 }];
            const channels = yield serverClient.queryChannels(filter, sort, {
                limit,
                watch: false,
            });
            return channels;
        }
        catch (error) {
            console.error('Error querying user channels:', error.message);
            return [];
        }
    });
}
/**
 * Send a system message to a channel
 * Useful for notifications like "Review escalated to staff"
 */
function sendSystemMessage(channelId, text, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!serverClient) {
            console.warn('Stream Chat not configured - skipping system message');
            return;
        }
        try {
            const channel = serverClient.channel('messaging', channelId);
            yield channel.sendMessage({
                text,
                user_id: userId,
                type: 'system',
            });
            console.log(`✅ Sent system message to channel ${channelId}`);
        }
        catch (error) {
            console.error('Error sending system message:', error.message);
            // ✅ FIXED: Don't throw
        }
    });
}
exports.default = {
    upsertStreamChatUser,
    createReviewChannel,
    addChannelMember,
    removeChannelMember,
    deleteChannel,
    updateChannelData,
    generateUserToken,
    isStreamChatConfigured,
    getUserChannels,
    sendSystemMessage,
};
//# sourceMappingURL=streamChat.service.js.map