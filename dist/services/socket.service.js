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
exports.emitToConversation = exports.emitToUser = exports.getIO = exports.initSocket = void 0;
// services/socket.service.ts
const socket_io_1 = require("socket.io");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const user_model_1 = __importDefault(require("../models/user.model"));
// ✅ Correct — uses the centralised env config, consistent with the rest of the codebase
const env_1 = require("../config/env");
let io;
/**
 * Initialize Socket.io on the HTTP server.
 * Call this once from www.ts/server.ts after creating the HTTP server.
 */
const initSocket = (server) => {
    io = new socket_io_1.Server(server, {
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
    io.use((socket, next) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        try {
            const token = socket.handshake.auth.token ||
                ((_a = socket.handshake.headers.authorization) === null || _a === void 0 ? void 0 : _a.split(' ')[1]);
            if (!token) {
                return next(new Error('Authentication required'));
            }
            const decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_SECRET);
            const user = yield user_model_1.default.findById(decoded.userId).select('-password -resetPasswordToken -invitationToken');
            if (!user || user.archived) {
                return next(new Error('User not found or inactive'));
            }
            socket.data.user = user;
            next();
        }
        catch (_b) {
            next(new Error('Invalid or expired token'));
        }
    }));
    // ── Connection handler ────────────────────────────────────────────────────
    io.on('connection', (socket) => {
        const user = socket.data.user;
        console.log(`[Socket] Connected: ${user.name} (${user._id})`);
        // Every authenticated user joins their personal inbox room
        // This is where notifications and new_message events land
        socket.join(`inbox:${user._id}`);
        // ── Room management ───────────────────────────────────────────────────
        // Client joins when they open a conversation panel
        socket.on('join_conversation', (conversationId) => {
            if (!conversationId)
                return;
            socket.join(`conversation:${conversationId}`);
            console.log(`[Socket] ${user.name} joined conversation:${conversationId}`);
        });
        // Client leaves when they close the conversation panel
        socket.on('leave_conversation', (conversationId) => {
            if (!conversationId)
                return;
            socket.leave(`conversation:${conversationId}`);
        });
        // ── Typing indicators ─────────────────────────────────────────────────
        socket.on('typing_start', ({ conversationId }) => {
            if (!conversationId)
                return;
            socket.to(`conversation:${conversationId}`).emit('typing_start', {
                userId: user._id.toString(),
                userName: user.name,
                conversationId,
            });
        });
        socket.on('typing_stop', ({ conversationId }) => {
            if (!conversationId)
                return;
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
exports.initSocket = initSocket;
/**
 * Get the initialized Socket.io instance.
 * Throws if called before initSocket().
 */
const getIO = () => {
    if (!io) {
        throw new Error('Socket.io has not been initialized. Call initSocket() first.');
    }
    return io;
};
exports.getIO = getIO;
/**
 * Emit an event to a specific user's personal inbox room.
 * Used for notifications and new_message alerts.
 */
const emitToUser = (userId, event, data) => {
    (0, exports.getIO)().to(`inbox:${userId}`).emit(event, data);
};
exports.emitToUser = emitToUser;
/**
 * Emit an event to all participants of a conversation room.
 * Used for new messages, read receipts, etc.
 */
const emitToConversation = (conversationId, event, data) => {
    (0, exports.getIO)().to(`conversation:${conversationId}`).emit(event, data);
};
exports.emitToConversation = emitToConversation;
//# sourceMappingURL=socket.service.js.map