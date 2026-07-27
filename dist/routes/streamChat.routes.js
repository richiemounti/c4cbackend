"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/streamChat.routes.ts
const express_1 = require("express");
const streamChat_controller_1 = require("../controllers/streamChat.controller");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const streamChatRoutes = (0, express_1.Router)();
// All routes require authentication
streamChatRoutes.use(auth_middleware_1.default);
// Get Stream Chat configuration status
streamChatRoutes.get('/status', streamChat_controller_1.getStreamChatStatus);
// Get authentication token for current user
streamChatRoutes.get('/token', streamChat_controller_1.getStreamChatToken);
// Get user's channels
streamChatRoutes.get('/channels', streamChat_controller_1.getMyStreamChannels);
// Create channel for a review (on-demand when first message is sent)
streamChatRoutes.post('/reviews/:reviewId/channel', streamChat_controller_1.createReviewChannelOnDemand);
// Add member to review channel
streamChatRoutes.post('/reviews/:reviewId/members', streamChat_controller_1.addMemberToReviewChannel);
exports.default = streamChatRoutes;
//# sourceMappingURL=streamChat.routes.js.map