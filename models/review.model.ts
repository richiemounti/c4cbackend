// models/review.model.ts
import mongoose, { Document, Schema, Types } from 'mongoose';

// Define all possible modules that can be reviewed
export type ReviewModule =
  | 'stakeholder_group'           // StakeholderGroup tasks
  | 'project_setup'               // ProjectSetup tasks
  | 'project_site_setup'          // ProjectSiteSetup tasks
  | 'stakeholder_action'          // TheoryOfChange Stage 1
  | 'social_impact'               // TheoryOfChange Stage 2
  | 'toc_consultation_plan'       // TOC Consultation Plan
  | 'survey'                      // Survey configuration
  | 'survey_question'             // Individual survey questions
  | 'survey_translation';         // Survey translations

// Review workflow states
export type ReviewStatus = 
  | 'pending'           // Initial state - review created but not started
  | 'in_review'         // Client roles are discussing
  | 'approved'          // No issues found, approved by client
  | 'escalated'         // Escalated to staff account manager
  | 'resolved';         // Issue resolved by staff or final approval

// Priority levels
export type ReviewPriority = 'low' | 'medium' | 'high' | 'critical';

// Issue severity levels
export type IssueSeverity = 'minor' | 'major' | 'critical';

// Issue types
export type IssueType = 
  | 'validation'        // Data validation errors
  | 'compliance'        // GDPR or certification compliance issues
  | 'quality'           // Data quality concerns
  | 'completeness'      // Missing or incomplete information
  | 'accuracy'          // Accuracy concerns
  | 'other';            // Other issues

// Interface for individual issues/findings
interface IReviewIssue {
  _id?: Types.ObjectId; 
  field?: string;                    // Specific field with issue (e.g., "tasks.0.responses")
  issueType: IssueType;
  severity: IssueSeverity;
  description: string;
  suggestedFix?: string;
  raisedBy: Types.ObjectId;          // User who raised the issue
  raisedAt: Date;
  resolvedAt?: Date;
  resolvedBy?: Types.ObjectId;
  resolutionNotes?: string;
}

// Interface for file attachments
interface IAttachment {
  fileUrl: string;
  fileName: string;
  fileType: string;
  size: number;
  uploadedBy: Types.ObjectId;
  uploadedAt: Date;
}

// Interface for activity log entries
interface IActivityLog {
  action: string;                    // e.g., "status_changed", "issue_added", "escalated"
  performedBy: Types.ObjectId;
  performedAt: Date;
  details?: string;
  fromValue?: string;                // For tracking state changes
  toValue?: string;
}

// Main Review Document Interface
export interface IReview extends Document {
  _id: Types.ObjectId;
  
  // ===== CORE IDENTIFICATION =====
  organizationId: Types.ObjectId;
  projectId: Types.ObjectId;
  projectSiteId?: Types.ObjectId;     // Optional, some modules are project-level only
  
  // Module identification
  module: ReviewModule;
  moduleItemId: Types.ObjectId;       // ID of the specific item being reviewed
  
  // For nested items (like tasks in arrays)
  nestedPath?: string;                // e.g., "tasks.0" for first task in StakeholderGroup
  nestedItemId?: string;              // e.g., task._id for specific task
  
  // ===== REVIEW METADATA =====
  title: string;                      // Auto-generated or custom title
  description?: string;               // Optional description
  status: ReviewStatus;
  priority: ReviewPriority;
  
  // ===== WORKFLOW TRACKING =====
  // Submission
  submittedBy: Types.ObjectId;        // User who submitted/initiated review
  submittedAt: Date;
  
  // Client-side review
  reviewers: Types.ObjectId[];        // Client users assigned to review
  currentReviewer?: Types.ObjectId;   // Current active reviewer
  reviewStartedAt?: Date;
  reviewCompletedAt?: Date;
  
  // Escalation to staff
  escalatedTo?: Types.ObjectId;       // Staff account manager
  escalatedAt?: Date;
  escalatedReason?: string;
  escalatedBy?: Types.ObjectId;       // Who initiated escalation
  
  // Resolution
  resolvedBy?: Types.ObjectId;        // Who resolved/approved
  resolvedAt?: Date;
  resolutionNotes?: string;
  
  // ===== STREAM CHAT INTEGRATION =====
  // Stream Chat channel information
  streamChannelId?: string;           // Stream Chat channel ID
  streamChannelType?: string;         // Channel type (e.g., 'messaging', 'team')
  streamChannelCreated?: boolean;     // Whether channel has been created
  streamChannelCreatedAt?: Date;
  
  // Participant tracking for chat
  chatParticipants: Types.ObjectId[]; // Users currently in the chat
  
  // ===== REVIEW FINDINGS =====
  issues: IReviewIssue[];             // Array of issues found
  
  // Approval/rejection details
  approvalNotes?: string;
  rejectionReason?: string;
  
  // ===== ADDITIONAL DATA =====
  tags: string[];                     // For categorization and filtering
  attachments: IAttachment[];         // Supporting documents
  activityLog: IActivityLog[];        // Complete activity history
  
  // ===== METADATA =====
  dueDate?: Date;                     // Optional deadline for review
  reminderSent?: boolean;             // Whether reminder has been sent
  
  archived: boolean;
  archivedAt?: Date;
  archivedBy?: Types.ObjectId;
  
  createdAt: Date;
  updatedAt: Date;
  
  // ===== INSTANCE METHODS =====
  addActivity(
    action: string,
    performedBy: Types.ObjectId,
    details?: string,
    fromValue?: string,
    toValue?: string
  ): void;
  
  addIssue(issueData: Omit<IReviewIssue, 'raisedAt'>): void;
  
  resolveIssue(
    issueId: Types.ObjectId,
    resolvedBy: Types.ObjectId,
    resolutionNotes?: string
  ): void;
  
  changeStatus(
    newStatus: ReviewStatus,
    changedBy: Types.ObjectId,
    reason?: string
  ): void;
  
  escalate(
    staffAccountManager: Types.ObjectId,
    reason: string,
    escalatedBy: Types.ObjectId
  ): void;
  
  addReviewer(
    reviewerId: Types.ObjectId,
    addedBy: Types.ObjectId
  ): void;
}

// Review Issue Schema
const reviewIssueSchema = new Schema<IReviewIssue>({
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
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  raisedAt: {
    type: Date,
    default: Date.now,
  },
  resolvedAt: Date,
  resolvedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
  },
  resolutionNotes: String,
}, { _id: true });

// Attachment Schema
const attachmentSchema = new Schema<IAttachment>({
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
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: true });

// Activity Log Schema
const activityLogSchema = new Schema<IActivityLog>({
  action: {
    type: String,
    required: true,
  },
  performedBy: {
    type: Schema.Types.ObjectId,
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
const ReviewSchema = new Schema<IReview>(
  {
    // ===== CORE IDENTIFICATION =====
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    projectSiteId: {
      type: Schema.Types.ObjectId,
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
      type: Schema.Types.ObjectId,
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
      type: Schema.Types.ObjectId,
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
      type: Schema.Types.ObjectId,
      ref: 'User',
    }],
    currentReviewer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewStartedAt: Date,
    reviewCompletedAt: Date,
    
    // Escalation
    escalatedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    escalatedAt: Date,
    escalatedReason: {
      type: String,
      trim: true,
    },
    escalatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    
    // Resolution
    resolvedBy: {
      type: Schema.Types.ObjectId,
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
      type: Schema.Types.ObjectId,
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
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

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
ReviewSchema.virtual('unresolvedIssuesCount').get(function(this: IReview) {
  return this.issues.filter(issue => !issue.resolvedAt).length;
});

// Virtual for resolved issues count
ReviewSchema.virtual('resolvedIssuesCount').get(function(this: IReview) {
  return this.issues.filter(issue => issue.resolvedAt).length;
});

// Virtual for total issues count
ReviewSchema.virtual('totalIssuesCount').get(function(this: IReview) {
  return this.issues.length;
});

// Virtual for critical issues count
ReviewSchema.virtual('criticalIssuesCount').get(function(this: IReview) {
  return this.issues.filter(issue => issue.severity === 'critical' && !issue.resolvedAt).length;
});

// Virtual for review duration (in days)
ReviewSchema.virtual('reviewDuration').get(function(this: IReview) {
  if (!this.reviewStartedAt) return 0;
  const endDate = this.reviewCompletedAt || new Date();
  return Math.floor((endDate.getTime() - this.reviewStartedAt.getTime()) / (1000 * 60 * 60 * 24));
});

// Virtual for is overdue
ReviewSchema.virtual('isOverdue').get(function(this: IReview) {
  if (!this.dueDate || this.status === 'approved' || this.status === 'resolved') return false;
  return new Date() > this.dueDate;
});

// ===== PRE-SAVE MIDDLEWARE =====

// Auto-populate submittedBy in chatParticipants
ReviewSchema.pre('save', function(this: IReview, next) {
  if (this.isNew && !this.chatParticipants.includes(this.submittedBy)) {
    this.chatParticipants.push(this.submittedBy);
  }
  next();
});

// Log initial creation
ReviewSchema.pre('save', function(this: IReview, next) {
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
ReviewSchema.methods.addActivity = function(
  this: IReview,
  action: string,
  performedBy: Types.ObjectId,
  details?: string,
  fromValue?: string,
  toValue?: string
): void {
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
ReviewSchema.methods.addIssue = function(
  this: IReview,
  issueData: Omit<IReviewIssue, 'raisedAt'>
): void {
  const newIssue: IReviewIssue = {
    ...issueData,
    raisedAt: new Date(),
  };
  
  this.issues.push(newIssue);
  
  // Log the activity
  this.addActivity(
    'issue_added',
    issueData.raisedBy,
    `New ${issueData.severity} ${issueData.issueType} issue added`,
    undefined,
    issueData.description.substring(0, 100)
  );
};

/**
 * Resolve an issue
 */
ReviewSchema.methods.resolveIssue = function(
  this: IReview,
  issueId: Types.ObjectId,
  resolvedBy: Types.ObjectId,
  resolutionNotes?: string
): void {
  // Use find instead of id for TypeScript compatibility
  const issue = this.issues.find(i => i._id?.toString() === issueId.toString());
  
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
  this.addActivity(
    'issue_resolved',
    resolvedBy,
    `Issue resolved: ${issue.description.substring(0, 100)}`,
    'unresolved',
    'resolved'
  );
  
  // Auto-approve if all issues are resolved
  const unresolvedCount = this.issues.filter(i => !i.resolvedAt).length;
  if (unresolvedCount === 0 && this.status === 'in_review') {
    this.changeStatus('approved', resolvedBy, 'All issues resolved');
  }
};


/**
 * Change review status
 */
ReviewSchema.methods.changeStatus = function(
  this: IReview,
  newStatus: ReviewStatus,
  changedBy: Types.ObjectId,
  reason?: string
): void {
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
  this.addActivity(
    'status_changed',
    changedBy,
    reason || `Status changed from ${oldStatus} to ${newStatus}`,
    oldStatus,
    newStatus
  );
};

/**
 * Escalate review to staff
 */
ReviewSchema.methods.escalate = function(
  this: IReview,
  staffAccountManager: Types.ObjectId,
  reason: string,
  escalatedBy: Types.ObjectId
): void {
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
  this.addActivity(
    'review_escalated',
    escalatedBy,
    `Escalated to staff: ${reason}`,
    this.status,
    'escalated'
  );
};

/**
 * Add a reviewer to the review
 */
ReviewSchema.methods.addReviewer = function(
  this: IReview,
  reviewerId: Types.ObjectId,
  addedBy: Types.ObjectId
): void {
  // Check if reviewer already exists
  const reviewerExists = this.reviewers.some(
    r => r.toString() === reviewerId.toString()
  );
  
  if (reviewerExists) {
    throw new Error('Reviewer already assigned to this review');
  }
  
  this.reviewers.push(reviewerId);
  
  // Add to chat participants if not already there
  if (!this.chatParticipants.some(p => p.toString() === reviewerId.toString())) {
    this.chatParticipants.push(reviewerId);
  }
  
  // Log the activity
  this.addActivity(
    'reviewer_added',
    addedBy,
    'New reviewer assigned',
    undefined,
    reviewerId.toString()
  );
};


// ===== STATIC METHODS =====

// Find reviews for a specific module item
ReviewSchema.statics.findByModuleItem = function(
  module: ReviewModule,
  moduleItemId: Types.ObjectId | string
) {
  return this.find({ module, moduleItemId }).sort({ createdAt: -1 });
};

// Find reviews for a user (as submitter or reviewer)
ReviewSchema.statics.findForUser = function(userId: Types.ObjectId | string) {
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
ReviewSchema.statics.findEscalatedForStaff = function(staffId: Types.ObjectId | string) {
  return this.find({
    status: 'escalated',
    escalatedTo: staffId,
  }).sort({ escalatedAt: -1 });
};

// Find pending reviews for organization
ReviewSchema.statics.findPendingForOrganization = function(orgId: Types.ObjectId | string) {
  return this.find({
    organizationId: orgId,
    status: { $in: ['pending', 'in_review'] },
  }).sort({ priority: -1, createdAt: -1 });
};

// Create Review Model
const Review = mongoose.model<IReview>('Review', ReviewSchema);

export default Review;