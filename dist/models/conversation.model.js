"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// models/conversation.model.ts
const mongoose_1 = __importStar(require("mongoose"));
const conversationSchema = new mongoose_1.Schema({
    organization: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true,
    },
    project: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Project',
        index: true,
        default: null,
    },
    type: {
        type: String,
        enum: ['direct', 'group'],
        required: true,
        index: true,
    },
    // Only populated for group conversations
    name: {
        type: String,
        trim: true,
        default: null,
    },
    participants: [
        {
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    ],
    createdBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    // Denormalized reference to the last message for inbox list rendering
    lastMessage: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Message',
        default: null,
    },
    lastActivityAt: {
        type: Date,
        default: Date.now,
        index: true,
    },
    // Track which users have "archived" (hidden) this conversation for themselves
    archivedBy: [
        {
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'User',
        },
    ],
    // Hard archive — conversation fully removed from system (admin only)
    archived: {
        type: Boolean,
        default: false,
    },
    archivedAt: {
        type: Date,
        default: null,
    },
}, { timestamps: true });
// Compound index: enforce uniqueness of direct conversations between two users in the same org
conversationSchema.index({ organization: 1, type: 1, participants: 1 }, { sparse: true });
// Fast lookup of all conversations a user participates in
conversationSchema.index({ participants: 1, lastActivityAt: -1 });
const Conversation = mongoose_1.default.model('Conversation', conversationSchema);
exports.default = Conversation;
//# sourceMappingURL=conversation.model.js.map