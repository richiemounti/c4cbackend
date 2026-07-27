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
// models/review.model.ts
const mongoose_1 = __importStar(require("mongoose"));
// Review Issue Schema
const reviewIssueSchema = new mongoose_1.Schema({
    field: {
        type: String,
        trim: true,
    },
    issueType: {
        type: String,
        enum: ['validation', 'compliance', 'quality', 'completeness', 'accuracy', 'other'],
        required: true,
    },
    severity: {
        type: String,
        enum: ['minor', 'major', 'critical'],
        required: true,
    },
    description: {
        type: String,
        required: true,
        trim: true,
    },
    suggestedFix: {
        type: String,
        trim: true,
    },
    raisedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    raisedAt: {
        type: Date,
        default: Date.now,
    },
    resolvedAt: Date,
    resolvedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
    },
    resolutionNotes: String,
}, { _id: true });
// Attachment Schema
const attachmentSchema = new mongoose_1.Schema({
    fileUrl: {
        type: String,
        required: true,
    },
    fileName: {
        type: String,
        required: true,
    },
    fileType: String,
    size: Number,
    uploadedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    uploadedAt: {
        type: Date,
        default: Date.now,
    },
}, { _id: true });
// Activity Log Schema
const activityLogSchema = new mongoose_1.Schema({
    action: {
        type: String,
        required: true,
    },
    performedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    performedAt: {
        type: Date,
        default: Date.now,
    },
    details: String,
    fromValue: String,
    toValue: String,
}, { _id: true });
// Main Review Schema
const ReviewSchema = new mongoose_1.Schema({
    // ===== CORE IDENTIFICATION =====
    organizationId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true,
    },
    projectId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
        index: true,
    },
    projectSiteId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'ProjectSite',
        index: true,
    },
    // Module identification
    module: {
        type: String,
        enum: [
            'stakeholder_group',
            'project_setup',
            'project_site_setup',
            'stakeholder_action',
            'social_impact',
            'toc_consultation_plan',
            'survey',
            'survey_question',
        ],
        required: true,
        index: true,
    },
    moduleItemId: {
        type: mongoose_1.Schema.Types.ObjectId,
        required: true,
        index: true,
    },
    // For nested items
    nestedPath: {
        type: String,
        trim: true,
    },
    nestedItemId: {
        type: String,
        trim: true,
    },
    // ===== REVIEW METADATA =====
    title: {
        type: String,
        required: true,
        trim: true,
        maxLength: 200,
    },
    description: {
        type: String,
        trim: true,
        maxLength: 1000,
    },
    status: {
        type: String,
        enum: ['pending', 'in_review', 'approved', 'escalated', 'resolved'],
        default: 'pending',
        index: true,
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium',
        index: true,
    },
    // ===== WORKFLOW TRACKING =====
    submittedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    submittedAt: {
        type: Date,
        default: Date.now,
    },
    // Client-side review
    reviewers: [{
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'User',
        }],
    currentReviewer: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
    },
    reviewStartedAt: Date,
    reviewCompletedAt: Date,
    // Escalation
    escalatedTo: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        index: true,
    },
    escalatedAt: Date,
    escalatedReason: {
        type: String,
        trim: true,
    },
    escalatedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
    },
    // Resolution
    resolvedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
    },
    resolvedAt: Date,
    resolutionNotes: {
        type: String,
        trim: true,
    },
    // ===== STREAM CHAT INTEGRATION =====
    streamChannelId: {
        type: String,
        trim: true,
        index: true,
    },
    streamChannelType: {
        type: String,
        default: 'messaging',
    },
    streamChannelCreated: {
        type: Boolean,
        default: false,
    },
    streamChannelCreatedAt: Date,
    chatParticipants: [{
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'User',
        }],
    // ===== REVIEW FINDINGS =====
    issues: [reviewIssueSchema],
    approvalNotes: {
        type: String,
        trim: true,
    },
    rejectionReason: {
        type: String,
        trim: true,
    },
    // ===== ADDITIONAL DATA =====
    tags: [{
            type: String,
            trim: true,
        }],
    attachments: [attachmentSchema],
    activityLog: [activityLogSchema],
    // ===== METADATA =====
    dueDate: Date,
    reminderSent: {
        type: Boolean,
        default: false,
    },
    archived: {
        type: Boolean,
        default: false,
    },
    archivedAt: Date,
    archivedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
    },
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
});
// ===== INDEXES FOR PERFORMANCE =====
// Compound indexes for common queries
ReviewSchema.index({ organizationId: 1, projectId: 1, status: 1 });
ReviewSchema.index({ module: 1, moduleItemId: 1 });
ReviewSchema.index({ status: 1, priority: 1 });
ReviewSchema.index({ escalatedTo: 1, status: 1 });
ReviewSchema.index({ reviewers: 1, status: 1 });
ReviewSchema.index({ submittedBy: 1, createdAt: -1 });
// Index for finding reviews by nested items
ReviewSchema.index({ module: 1, moduleItemId: 1, nestedItemId: 1 });
// ===== VIRTUALS =====
// Virtual for unresolved issues count
ReviewSchema.virtual('unresolvedIssuesCount').get(function () {
    return this.issues.filter(issue => !issue.resolvedAt).length;
});
// Virtual for resolved issues count
ReviewSchema.virtual('resolvedIssuesCount').get(function () {
    return this.issues.filter(issue => issue.resolvedAt).length;
});
// Virtual for total issues count
ReviewSchema.virtual('totalIssuesCount').get(function () {
    return this.issues.length;
});
// Virtual for critical issues count
ReviewSchema.virtual('criticalIssuesCount').get(function () {
    return this.issues.filter(issue => issue.severity === 'critical' && !issue.resolvedAt).length;
});
// Virtual for review duration (in days)
ReviewSchema.virtual('reviewDuration').get(function () {
    if (!this.reviewStartedAt)
        return 0;
    const endDate = this.reviewCompletedAt || new Date();
    return Math.floor((endDate.getTime() - this.reviewStartedAt.getTime()) / (1000 * 60 * 60 * 24));
});
// Virtual for is overdue
ReviewSchema.virtual('isOverdue').get(function () {
    if (!this.dueDate || this.status === 'approved' || this.status === 'resolved')
        return false;
    return new Date() > this.dueDate;
});
// ===== PRE-SAVE MIDDLEWARE =====
// Auto-populate submittedBy in chatParticipants
ReviewSchema.pre('save', function (next) {
    if (this.isNew && !this.chatParticipants.includes(this.submittedBy)) {
        this.chatParticipants.push(this.submittedBy);
    }
    next();
});
// Log initial creation
ReviewSchema.pre('save', function (next) {
    if (this.isNew) {
        this.activityLog.push({
            action: 'review_created',
            performedBy: this.submittedBy,
            performedAt: new Date(),
            details: 'Review initiated',
        });
    }
    next();
});
// ===== STATIC METHODS =====
// Find reviews for a specific module item
ReviewSchema.statics.findByModuleItem = function (module, moduleItemId) {
    return this.find({ module, moduleItemId }).sort({ createdAt: -1 });
};
// Find reviews for a user (as submitter or reviewer)
ReviewSchema.statics.findForUser = function (userId) {
    return this.find({
        $or: [
            { submittedBy: userId },
            { reviewers: userId },
            { currentReviewer: userId },
            { escalatedTo: userId },
        ],
    }).sort({ createdAt: -1 });
};
// Find escalated reviews for staff
ReviewSchema.statics.findEscalatedForStaff = function (staffId) {
    return this.find({
        status: 'escalated',
        escalatedTo: staffId,
    }).sort({ escalatedAt: -1 });
};
// Find pending reviews for organization
ReviewSchema.statics.findPendingForOrganization = function (orgId) {
    return this.find({
        organizationId: orgId,
        status: { $in: ['pending', 'in_review'] },
    }).sort({ priority: -1, createdAt: -1 });
};
// Create Review Model
const Review = mongoose_1.default.model('Review', ReviewSchema);
exports.default = Review;
//# sourceMappingURL=review_model.js.map