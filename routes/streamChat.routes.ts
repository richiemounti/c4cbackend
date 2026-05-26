// routes/streamChat.routes.ts
import express, { Router } from 'express';
import {
  getStreamChatToken,
  getMyStreamChannels,
  createReviewChannelOnDemand,
  addMemberToReviewChannel,
  getStreamChatStatus,
} from '../controllers/streamChat.controller';
import authorize from '../middlewares/auth.middleware';

const streamChatRoutes = Router();

// All routes require authentication
streamChatRoutes.use(authorize);

// Get Stream Chat configuration status
streamChatRoutes.get('/status', getStreamChatStatus);

// Get authentication token for current user
streamChatRoutes.get('/token', getStreamChatToken);

// Get user's channels
streamChatRoutes.get('/channels', getMyStreamChannels);

// Create channel for a review (on-demand when first message is sent)
streamChatRoutes.post('/reviews/:reviewId/channel', createReviewChannelOnDemand);

// Add member to review channel
streamChatRoutes.post('/reviews/:reviewId/members', addMemberToReviewChannel);

export default streamChatRoutes;