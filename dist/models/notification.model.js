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
// models/notification.model.ts
const mongoose_1 = __importStar(require("mongoose"));
const pageContextSchema = new mongoose_1.Schema({
    resourceType: { type: String, required: true },
    resourceId: { type: mongoose_1.Schema.Types.ObjectId, required: true },
    label: { type: String, required: true, trim: true },
    href: { type: String, required: true, trim: true },
}, { _id: false });
const contextLinkSchema = new mongoose_1.Schema({
    label: { type: String, required: true, trim: true },
    resourceType: { type: String, required: true },
    resourceId: { type: mongoose_1.Schema.Types.ObjectId, required: true },
    projectId: { type: mongoose_1.Schema.Types.ObjectId, default: null },
    siteId: { type: mongoose_1.Schema.Types.ObjectId, default: null },
    href: { type: String, required: true, trim: true },
}, { _id: false });
const notificationSchema = new mongoose_1.Schema({
    recipient: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    organization: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true,
    },
    type: {
        type: String,
        enum: ['mention_in_message', 'mention_on_page', 'new_message', 'system'],
        required: true,
        index: true,
    },
    triggeredBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    conversation: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Conversation',
        default: null,
    },
    message: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Message',
        default: null,
    },
    pageContext: {
        type: pageContextSchema,
        default: null,
    },
    contextLink: {
        type: contextLinkSchema,
        default: null,
    },
    preview: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200,
    },
    read: {
        type: Boolean,
        default: false,
        index: true,
    },
    readAt: {
        type: Date,
        default: null,
    },
}, { timestamps: true });
// Fast unread notifications lookup per user
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
// Fast org-scoped notification queries
notificationSchema.index({ recipient: 1, organization: 1, createdAt: -1 });
const Notification = mongoose_1.default.model('Notification', notificationSchema);
exports.default = Notification;
//# sourceMappingURL=notification.model.js.map