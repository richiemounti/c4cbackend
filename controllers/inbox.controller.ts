// controllers/inbox.controller.ts
import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Conversation from '../models/conversation.model';
import Message from '../models/message.model';
import Notification from '../models/notification.model';
import User, { IUserDocument } from '../models/user.model';
import { CustomError } from '../middlewares/error.middleware';
import { emitToUser, emitToConversation } from '../services/socket.service';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

type AuthUser = IUserDocument & {
  _id: mongoose.Types.ObjectId;
  primaryRole?: string;
  isConnectGoStaff?: boolean;
  roles?: any[];
};

// Mirrors the pattern used in project.controller.ts
function isUserAuthenticated(req: Request): req is Request & { user: AuthUser } {
  return req.user !== undefined;
}

/**
 * Verify the current user is a participant in the given conversation.
 * Throws a 403 if not.
 */
async function assertParticipant(
  conversationId: string,
  userId: string
): Promise<InstanceType<typeof Conversation>> {
  const conversation = await Conversation.findOne({
    _id: conversationId,
    participants: userId,
    archived: false,
  });

  if (!conversation) {
    const error = new Error('Conversation not found or access denied') as CustomError;
    error.statusCode = 403;
    throw error;
  }

  return conversation as any;
}

/**
 * Create and emit a notification to the recipient's inbox room.
 */
async function createNotification(params: {
  recipient: mongoose.Types.ObjectId;
  organization: mongoose.Types.ObjectId;
  type: 'mention_in_message' | 'mention_on_page' | 'new_message' | 'system';
  triggeredBy: mongoose.Types.ObjectId;
  conversation?: mongoose.Types.ObjectId;
  message?: mongoose.Types.ObjectId;
  pageContext?: any;
  contextLink?: any;
  preview: string;
}): Promise<void> {
  const notification = await Notification.create(params);
  await notification.populate('triggeredBy', 'name photo userName');
  emitToUser(params.recipient.toString(), 'notification', notification);
}

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/inbox/conversations
 * List all conversations for the current user, sorted by most recent activity.
 */
export const getConversations = async (
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

    const userId = req.user._id.toString();

    const conversations = await Conversation.find({
      participants: userId,
      archived: false,
      archivedBy: { $ne: userId },
    })
      .sort({ lastActivityAt: -1 })
      .limit(50)
      .populate('participants', 'name email photo userName primaryRole')
      .populate('createdBy', 'name photo userName')
      .populate({
        path: 'lastMessage',
        select: 'content sender createdAt deleted',
        populate: { path: 'sender', select: 'name photo userName' },
      })
      .lean();

    // Compute unread count per conversation for this user
    const conversationIds = conversations.map((c) => c._id);

    const unreadCounts = await Message.aggregate([
      {
        $match: {
          conversation: { $in: conversationIds },
          deleted: false,
          'readBy.user': { $ne: new mongoose.Types.ObjectId(userId) },
          sender: { $ne: new mongoose.Types.ObjectId(userId) },
        },
      },
      { $group: { _id: '$conversation', count: { $sum: 1 } } },
    ]);

    const unreadMap = new Map(
      unreadCounts.map((u) => [u._id.toString(), u.count])
    );

    const enriched = conversations.map((c) => ({
      ...c,
      unreadCount: unreadMap.get((c._id as any).toString()) ?? 0,
    }));

    res.status(200).json({
      success: true,
      count: enriched.length,
      data: enriched,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/inbox/conversations
 * Create a new direct or group conversation.
 * For direct conversations, returns the existing one if it already exists.
 */
export const createConversation = async (
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

    const { type, participantIds, name, organizationId, projectId } = req.body;
    const userId = req.user._id.toString();
    const isStaff = req.user.isConnectGoStaff;

    if (!type || !participantIds || (!organizationId && !isStaff)) {
      const error = new Error(
        'type, participantIds, and organizationId are required'
      ) as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // For staff without an explicit org, derive it from the first non-staff participant
    let resolvedOrgId = organizationId;
    if (!resolvedOrgId && isStaff) {
      const firstParticipant = await User.findById(participantIds[0]).select('roles isConnectGoStaff');
      const orgFromParticipant = (firstParticipant?.roles as any[])?.find(
        (r: any) => r.organization
      )?.organization;

      if (!orgFromParticipant) {
        const error = new Error(
          'Cannot determine organisation from participants — please provide organizationId'
        ) as CustomError;
        error.statusCode = 400;
        throw error;
      }
      resolvedOrgId = orgFromParticipant.toString();
    }

    // Always include the creator in participants
    const allParticipantIds = [...new Set([userId, ...participantIds])] as string[];

    // Verify every non-staff participant belongs to the resolved organisation
    const orgUsers = await User.find({
      _id: { $in: allParticipantIds },
      archived: false,
    }).select('_id roles isConnectGoStaff');

    const invalidUsers = orgUsers.filter(
      (u) =>
        !u.isConnectGoStaff &&
        !(u.roles as any[]).some(
          (r: any) => r.organization && r.organization.toString() === resolvedOrgId
        )
    );

    if (invalidUsers.length > 0) {
      const error = new Error(
        'All participants must belong to the same organisation'
      ) as CustomError;
      error.statusCode = 400;
      throw error;
    }

    // ── Direct conversation ───────────────────────────────────────────────

    if (type === 'direct') {
      if (allParticipantIds.length !== 2) {
        const error = new Error(
          'Direct conversations must have exactly 2 participants'
        ) as CustomError;
        error.statusCode = 400;
        throw error;
      }

      // Return existing DM if one already exists between these two users
      const existing = await Conversation.findOne({
        type: 'direct',
        organization: resolvedOrgId,
        participants: {
          $all: allParticipantIds.map((id) => new mongoose.Types.ObjectId(id)),
          $size: 2,
        },
        archived: false,
      }).populate('participants', 'name email photo userName primaryRole');

      if (existing) {
        // Un-archive for the requesting user if they had previously hidden it
        if (
          (existing.archivedBy as any[]).some(
            (id: any) => id.toString() === userId
          )
        ) {
          await Conversation.findByIdAndUpdate(existing._id, {
            $pull: { archivedBy: userId },
          });
        }
        return res.status(200).json({ success: true, data: existing });
      }
    }

    // ── Group conversation ────────────────────────────────────────────────

    if (type === 'group' && !name) {
      const error = new Error('Group conversations require a name') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const conversation = await Conversation.create({
      organization: resolvedOrgId,
      project: projectId || null,
      type,
      name: type === 'group' ? name : undefined,
      participants: allParticipantIds,
      createdBy: userId,
      lastActivityAt: new Date(),
    });

    const populated = await conversation.populate(
      'participants',
      'name email photo userName primaryRole'
    );

    res.status(201).json({ success: true, data: populated });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/inbox/conversations/:id
 * Get a single conversation with its first page of messages.
 */
export const getConversation = async (
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

    const userId = req.user._id.toString();
    const { id } = req.params;

    const conversation = await Conversation.findOne({
      _id: id,
      participants: userId,
      archived: false,
    })
      .populate('participants', 'name email photo userName primaryRole')
      .populate('createdBy', 'name photo userName')
      .lean();

    if (!conversation) {
      const error = new Error('Conversation not found or access denied') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    // Fetch first page of messages (newest 30, returned in chronological order)
    const messages = await Message.find({
      conversation: id,
      deleted: false,
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .populate('sender', 'name photo userName')
      .populate('mentions', 'name photo userName')
      .lean();

    // Mark all unread messages in this conversation as read
    await Message.updateMany(
      {
        conversation: id,
        deleted: false,
        'readBy.user': { $ne: new mongoose.Types.ObjectId(userId) },
        sender: { $ne: new mongoose.Types.ObjectId(userId) },
      },
      {
        $push: {
          readBy: {
            user: new mongoose.Types.ObjectId(userId),
            readAt: new Date(),
          },
        },
      }
    );

    emitToConversation(id, 'messages_read', {
      conversationId: id,
      readBy: userId,
      readAt: new Date(),
    });

    res.status(200).json({
      success: true,
      data: {
        conversation,
        messages: messages.reverse(),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/inbox/conversations/:id
 * Soft-archive a conversation for the current user only.
 */
export const archiveConversation = async (
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

    const userId = req.user._id.toString();
    const { id } = req.params;

    await assertParticipant(id, userId);

    await Conversation.findByIdAndUpdate(id, {
      $addToSet: { archivedBy: userId },
    });

    res.status(200).json({ success: true, message: 'Conversation archived successfully' });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGES
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/inbox/conversations/:id/messages
 * Paginated message history. Uses cursor-based pagination via `before`
 * (a message createdAt ISO timestamp).
 */
export const getMessages = async (
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

    const userId = req.user._id.toString();
    const { id } = req.params;
    const { before, limit = '30' } = req.query;

    await assertParticipant(id, userId);

    const pageLimit = Math.min(parseInt(limit as string, 10) || 30, 100);

    const query: Record<string, any> = {
      conversation: id,
      deleted: false,
    };

    if (before) {
      query.createdAt = { $lt: new Date(before as string) };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(pageLimit)
      .populate('sender', 'name photo userName')
      .populate('mentions', 'name photo userName')
      .lean();

    res.status(200).json({
      success: true,
      hasMore: messages.length === pageLimit,
      count: messages.length,
      data: messages.reverse(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/inbox/conversations/:id/messages
 * Send a message in a conversation.
 */
export const sendMessage = async (
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

    const userId = req.user._id.toString();
    const { id: conversationId } = req.params;
    const { content, mentionIds, contextLink } = req.body;

    if (!content || !content.trim()) {
      const error = new Error('Message content is required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    const conversation = await assertParticipant(conversationId, userId);

    const message = await Message.create({
      conversation: conversationId,
      organization: conversation.organization,
      sender: userId,
      content: content.trim(),
      mentions: mentionIds || [],
      contextLink: contextLink || null,
      readBy: [{ user: userId, readAt: new Date() }],
    });

    // Update conversation metadata and un-hide for all participants
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
      lastActivityAt: new Date(),
      $set: { archivedBy: [] },
    });

    await message.populate('sender', 'name photo userName');
    await message.populate('mentions', 'name photo userName');

    emitToConversation(conversationId, 'new_message', message);

    // ── Notifications ─────────────────────────────────────────────────────

    const participants = (conversation.participants as mongoose.Types.ObjectId[])
      .map((p) => p.toString())
      .filter((p) => p !== userId);

    const preview =
      `${req.user!.name}: ` +
      (content.length > 100 ? content.substring(0, 100) + '...' : content);

    const mentionedIds: string[] = (mentionIds || []).filter(
      (id: string) => id !== userId
    );

    // Mention notifications for @mentioned users
    for (const mentionedId of mentionedIds) {
      await createNotification({
        recipient: new mongoose.Types.ObjectId(mentionedId),
        organization: conversation.organization,
        type: 'mention_in_message',
        triggeredBy: new mongoose.Types.ObjectId(userId),
        conversation: conversation._id as mongoose.Types.ObjectId,
        message: message._id as mongoose.Types.ObjectId,
        contextLink: contextLink || undefined,
        preview,
      });
    }

    // New message notification for non-mentioned participants
    const nonMentionedParticipants = participants.filter(
      (p) => !mentionedIds.includes(p)
    );

    for (const participantId of nonMentionedParticipants) {
      await createNotification({
        recipient: new mongoose.Types.ObjectId(participantId),
        organization: conversation.organization,
        type: 'new_message',
        triggeredBy: new mongoose.Types.ObjectId(userId),
        conversation: conversation._id as mongoose.Types.ObjectId,
        message: message._id as mongoose.Types.ObjectId,
        preview,
      });
    }

    res.status(201).json({ success: true, data: message });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/inbox/conversations/:id/messages/:msgId
 * Edit a message. Only the original sender can edit.
 */
export const editMessage = async (
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

    const userId = req.user._id.toString();
    const { id: conversationId, msgId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      const error = new Error('Message content is required') as CustomError;
      error.statusCode = 400;
      throw error;
    }

    await assertParticipant(conversationId, userId);

    const message = await Message.findOne({
      _id: msgId,
      conversation: conversationId,
      sender: userId,
      deleted: false,
    });

    if (!message) {
      const error = new Error(
        'Message not found or you are not the sender'
      ) as CustomError;
      error.statusCode = 404;
      throw error;
    }

    message.content = content.trim();
    message.editedAt = new Date();
    await message.save();

    await message.populate('sender', 'name photo userName');

    emitToConversation(conversationId, 'message_edited', message);

    res.status(200).json({ success: true, data: message });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/v1/inbox/conversations/:id/messages/:msgId
 * Soft-delete a message. Sender can delete their own; ConnectGo staff can delete any.
 */
export const deleteMessage = async (
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

    const userId = req.user._id.toString();
    const { id: conversationId, msgId } = req.params;

    await assertParticipant(conversationId, userId);

    const filter: Record<string, any> = {
      _id: msgId,
      conversation: conversationId,
      deleted: false,
    };

    // ConnectGo staff can delete any message; regular users only their own
    if (!req.user!.isConnectGoStaff) {
      filter.sender = userId;
    }

    const message = await Message.findOneAndUpdate(
      filter,
      { deleted: true, deletedAt: new Date(), content: '[Message deleted]' },
      { new: true }
    );

    if (!message) {
      const error = new Error(
        'Message not found or you are not authorized to delete it'
      ) as CustomError;
      error.statusCode = 404;
      throw error;
    }

    emitToConversation(conversationId, 'message_deleted', {
      messageId: msgId,
      conversationId,
    });

    res.status(200).json({ success: true, message: 'Message deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/inbox/conversations/:id/read
 * Mark all messages in a conversation as read for the current user.
 */
export const markConversationRead = async (
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

    const userId = req.user._id.toString();
    const { id: conversationId } = req.params;

    await assertParticipant(conversationId, userId);

    await Message.updateMany(
      {
        conversation: conversationId,
        deleted: false,
        'readBy.user': { $ne: new mongoose.Types.ObjectId(userId) },
        sender: { $ne: new mongoose.Types.ObjectId(userId) },
      },
      {
        $push: {
          readBy: {
            user: new mongoose.Types.ObjectId(userId),
            readAt: new Date(),
          },
        },
      }
    );

    emitToConversation(conversationId, 'messages_read', {
      conversationId,
      readBy: userId,
      readAt: new Date(),
    });

    res.status(200).json({ success: true, message: 'Conversation marked as read' });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/inbox/notifications
 * List notifications for the current user, newest first.
 */
export const getNotifications = async (
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

    const userId = req.user._id.toString();
    const { page = '1', limit = '20', unreadOnly } = req.query;

    const pageNum = parseInt(page as string, 10) || 1;
    const pageLimit = Math.min(parseInt(limit as string, 10) || 20, 50);
    const skip = (pageNum - 1) * pageLimit;

    const filter: Record<string, any> = { recipient: userId };
    if (unreadOnly === 'true') {
      filter.read = false;
    }

    const [notifications, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageLimit)
        .populate('triggeredBy', 'name photo userName')
        .lean(),
      Notification.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      count: notifications.length,
      total,
      page: pageNum,
      pages: Math.ceil(total / pageLimit),
      data: notifications,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/inbox/notifications/unread-count
 * Returns unread notification + message counts for the nav badge.
 */
export const getUnreadCount = async (
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

    const userId = req.user._id.toString();

    const [unreadNotifications, unreadMessages] = await Promise.all([
      Notification.countDocuments({ recipient: userId, read: false }),
      Message.aggregate([
        {
          $match: {
            deleted: false,
            'readBy.user': { $ne: new mongoose.Types.ObjectId(userId) },
            sender: { $ne: new mongoose.Types.ObjectId(userId) },
          },
        },
        {
          $lookup: {
            from: 'conversations',
            localField: 'conversation',
            foreignField: '_id',
            as: 'conv',
          },
        },
        { $unwind: '$conv' },
        {
          $match: {
            'conv.participants': new mongoose.Types.ObjectId(userId),
            'conv.archived': false,
            'conv.archivedBy': { $ne: new mongoose.Types.ObjectId(userId) },
          },
        },
        { $group: { _id: '$conversation' } },
        { $count: 'total' },
      ]),
    ]);

    const unreadMessageConversations =
      unreadMessages.length > 0 ? unreadMessages[0].total : 0;

    res.status(200).json({
      success: true,
      data: {
        notifications: unreadNotifications,
        messages: unreadMessageConversations,
        total: unreadNotifications + unreadMessageConversations,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/v1/inbox/notifications/:id/read
 * Mark a single notification as read.
 */
export const markNotificationRead = async (
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

    const userId = req.user._id.toString();
    const { id } = req.params;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipient: userId },
      { read: true, readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      const error = new Error('Notification not found') as CustomError;
      error.statusCode = 404;
      throw error;
    }

    res.status(200).json({ success: true, data: notification });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/inbox/notifications/read-all
 * Mark all notifications as read for the current user.
 */
export const markAllNotificationsRead = async (
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

    const userId = req.user._id.toString();

    await Notification.updateMany(
      { recipient: userId, read: false },
      { read: true, readAt: new Date() }
    );

    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// MENTIONS (page-level, not inside a chat)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/inbox/mention
 * Send a contextual mention from anywhere on the platform — risk register,
 * report, review, etc. Creates a notification directly without involving
 * the conversation system.
 */
export const sendPageMention = async (
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

    const userId = req.user._id.toString();
    const { recipientIds, organizationId, preview, pageContext, contextLink } = req.body;

    if (!recipientIds?.length || !organizationId || !preview || !pageContext) {
      const error = new Error(
        'recipientIds, organizationId, preview, and pageContext are required'
      ) as CustomError;
      error.statusCode = 400;
      throw error;
    }

    let sent = 0;

    for (const recipientId of recipientIds) {
      if (recipientId === userId) continue; // never notify yourself

      await createNotification({
        recipient: new mongoose.Types.ObjectId(recipientId),
        organization: new mongoose.Types.ObjectId(organizationId),
        type: 'mention_on_page',
        triggeredBy: new mongoose.Types.ObjectId(userId),
        pageContext,
        contextLink: contextLink || undefined,
        preview,
      });

      sent++;
    }

    res.status(201).json({
      success: true,
      message: `${sent} mention(s) sent successfully`,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v1/inbox/mentionable-users
 * Search for users in the same organisation to @mention.
 * Query params: search, organizationId, limit
 */
export const getMentionableUsers = async (
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

    const { search, organizationId, limit = '10' } = req.query;

    const isStaff = req.user.isConnectGoStaff;

    if (!organizationId && !isStaff) {
        const error = new Error('organizationId is required') as CustomError;
        error.statusCode = 400;
        throw error;
    }

    const pageLimit = Math.min(parseInt(limit as string, 10) || 10, 25);

    const filter: Record<string, any> = {
        archived: false,
        _id: { $ne: req.user._id },
        };

        if (!isStaff && organizationId) {
        filter.$or = [
            { isConnectGoStaff: true },
            { 'roles.organization': new mongoose.Types.ObjectId(organizationId as string) },
        ];
    };

    if (search) {
      const searchRegex = new RegExp(search as string, 'i');
      filter.$and = [
        {
          $or: [
            { name: searchRegex },
            { userName: searchRegex },
            { email: searchRegex },
          ],
        },
      ];
    }

    const users = await User.find(filter)
      .select('name userName email photo primaryRole')
      .limit(pageLimit)
      .lean();

    res.status(200).json({
      success: true,
      count: users.length,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};