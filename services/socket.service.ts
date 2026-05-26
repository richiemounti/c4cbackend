// services/socket.service.ts
import { Server as SocketServer, Socket } from 'socket.io';
import http from 'http';
import jwt, { JwtPayload } from 'jsonwebtoken';
import User from '../models/user.model';

// ✅ Correct — uses the centralised env config, consistent with the rest of the codebase
import { env } from '../config/env';


interface CustomJwtPayload extends JwtPayload {
  userId: string;
}

let io: SocketServer;

/**
 * Initialize Socket.io on the HTTP server.
 * Call this once from www.ts/server.ts after creating the HTTP server.
 */
export const initSocket = (server: http.Server): SocketServer => {
  io = new SocketServer(server, {
    cors: {
      origin: process.env.FRONTEND_URL
        ? [process.env.FRONTEND_URL, 'http://localhost:3000', 'http://localhost:3001']
        : ['http://localhost:3000', 'http://localhost:3001'],
      credentials: true,
    },
    // Prefer WebSocket, fall back to polling
    transports: ['websocket', 'polling'],
  });

  // ── Authentication middleware ─────────────────────────────────────────────
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth.token ||
        socket.handshake.headers.authorization?.split(' ')[1];

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const decoded = jwt.verify(token, env.JWT_SECRET as string) as CustomJwtPayload;
      const user = await User.findById(decoded.userId).select(
        '-password -resetPasswordToken -invitationToken'
      );

      if (!user || user.archived) {
        return next(new Error('User not found or inactive'));
      }

      socket.data.user = user;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  // ── Connection handler ────────────────────────────────────────────────────
  io.on('connection', (socket: Socket) => {
    const user = socket.data.user;
    console.log(`[Socket] Connected: ${user.name} (${user._id})`);

    // Every authenticated user joins their personal inbox room
    // This is where notifications and new_message events land
    socket.join(`inbox:${user._id}`);

    // ── Room management ───────────────────────────────────────────────────

    // Client joins when they open a conversation panel
    socket.on('join_conversation', (conversationId: string) => {
      if (!conversationId) return;
      socket.join(`conversation:${conversationId}`);
      console.log(`[Socket] ${user.name} joined conversation:${conversationId}`);
    });

    // Client leaves when they close the conversation panel
    socket.on('leave_conversation', (conversationId: string) => {
      if (!conversationId) return;
      socket.leave(`conversation:${conversationId}`);
    });

    // ── Typing indicators ─────────────────────────────────────────────────

    socket.on('typing_start', ({ conversationId }: { conversationId: string }) => {
      if (!conversationId) return;
      socket.to(`conversation:${conversationId}`).emit('typing_start', {
        userId: user._id.toString(),
        userName: user.name,
        conversationId,
      });
    });

    socket.on('typing_stop', ({ conversationId }: { conversationId: string }) => {
      if (!conversationId) return;
      socket.to(`conversation:${conversationId}`).emit('typing_stop', {
        userId: user._id.toString(),
        conversationId,
      });
    });

    // ── Disconnect ────────────────────────────────────────────────────────

    socket.on('disconnect', (reason) => {
      console.log(`[Socket] Disconnected: ${user.name} — ${reason}`);
    });
  });

  console.log('[Socket] Socket.io initialized');
  return io;
};

/**
 * Get the initialized Socket.io instance.
 * Throws if called before initSocket().
 */
export const getIO = (): SocketServer => {
  if (!io) {
    throw new Error('Socket.io has not been initialized. Call initSocket() first.');
  }
  return io;
};

/**
 * Emit an event to a specific user's personal inbox room.
 * Used for notifications and new_message alerts.
 */
export const emitToUser = (userId: string, event: string, data: unknown): void => {
  getIO().to(`inbox:${userId}`).emit(event, data);
};

/**
 * Emit an event to all participants of a conversation room.
 * Used for new messages, read receipts, etc.
 */
export const emitToConversation = (
  conversationId: string,
  event: string,
  data: unknown
): void => {
  getIO().to(`conversation:${conversationId}`).emit(event, data);
};