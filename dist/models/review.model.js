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
            'survey_translation',
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
// models/review.model.ts
// ... (keep all your existing code until after the Pre-save middleware section)
// ===== INSTANCE METHODS =====
/**
 * Add an activity log entry
 */
ReviewSchema.methods.addActivity = function (action, performedBy, details, fromValue, toValue) {
    this.activityLog.push({
        action,
        performedBy,
        performedAt: new Date(),
        details,
        fromValue,
        toValue,
    });
};
/**
 * Add an issue to the review
 */
ReviewSchema.methods.addIssue = function (issueData) {
    const newIssue = Object.assign(Object.assign({}, issueData), { raisedAt: new Date() });
    this.issues.push(newIssue);
    // Log the activity
    this.addActivity('issue_added', issueData.raisedBy, `New ${issueData.severity} ${issueData.issueType} issue added`, undefined, issueData.description.substring(0, 100));
};
/**
 * Resolve an issue
 */
ReviewSchema.methods.resolveIssue = function (issueId, resolvedBy, resolutionNotes) {
    // Use find instead of id for TypeScript compatibility
    const issue = this.issues.find(i => { var _a; return ((_a = i._id) === null || _a === void 0 ? void 0 : _a.toString()) === issueId.toString(); });
    if (!issue) {
        throw new Error('Issue not found');
    }
    if (issue.resolvedAt) {
        throw new Error('Issue is already resolved');
    }
    issue.resolvedAt = new Date();
    issue.resolvedBy = resolvedBy;
    issue.resolutionNotes = resolutionNotes;
    // Log the activity
    this.addActivity('issue_resolved', resolvedBy, `Issue resolved: ${issue.description.substring(0, 100)}`, 'unresolved', 'resolved');
    // Auto-approve if all issues are resolved
    const unresolvedCount = this.issues.filter(i => !i.resolvedAt).length;
    if (unresolvedCount === 0 && this.status === 'in_review') {
        this.changeStatus('approved', resolvedBy, 'All issues resolved');
    }
};
/**
 * Change review status
 */
ReviewSchema.methods.changeStatus = function (newStatus, changedBy, reason) {
    const oldStatus = this.status;
    if (oldStatus === newStatus) {
        return; // No change needed
    }
    this.status = newStatus;
    // Update timestamps based on status
    switch (newStatus) {
        case 'in_review':
            if (!this.reviewStartedAt) {
                this.reviewStartedAt = new Date();
            }
            break;
        case 'approved':
        case 'resolved':
            this.reviewCompletedAt = new Date();
            this.resolvedBy = changedBy;
            if (reason) {
                this.resolutionNotes = reason;
            }
            break;
    }
    // Log the activity
    this.addActivity('status_changed', changedBy, reason || `Status changed from ${oldStatus} to ${newStatus}`, oldStatus, newStatus);
};
/**
 * Escalate review to staff
 */
ReviewSchema.methods.escalate = function (staffAccountManager, reason, escalatedBy) {
    if (this.status === 'escalated') {
        throw new Error('Review is already escalated');
    }
    this.status = 'escalated';
    this.escalatedTo = staffAccountManager;
    this.escalatedAt = new Date();
    this.escalatedReason = reason;
    this.escalatedBy = escalatedBy;
    // Add staff to chat participants if not already there
    if (!this.chatParticipants.some(p => p.toString() === staffAccountManager.toString())) {
        this.chatParticipants.push(staffAccountManager);
    }
    // Log the activity
    this.addActivity('review_escalated', escalatedBy, `Escalated to staff: ${reason}`, this.status, 'escalated');
};
/**
 * Add a reviewer to the review
 */
ReviewSchema.methods.addReviewer = function (reviewerId, addedBy) {
    // Check if reviewer already exists
    const reviewerExists = this.reviewers.some(r => r.toString() === reviewerId.toString());
    if (reviewerExists) {
        throw new Error('Reviewer already assigned to this review');
    }
    this.reviewers.push(reviewerId);
    // Add to chat participants if not already there
    if (!this.chatParticipants.some(p => p.toString() === reviewerId.toString())) {
        this.chatParticipants.push(reviewerId);
    }
    // Log the activity
    this.addActivity('reviewer_added', addedBy, 'New reviewer assigned', undefined, reviewerId.toString());
};
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
//# sourceMappingURL=review.model.js.map