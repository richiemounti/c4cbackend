// models/bugReport.model.ts - Enhanced for Comprehensive Feedback
import mongoose, { Document } from "mongoose";

interface SystemInfo {
  url: string;
  pathname: string;
  userAgent: string;
  platform: string;
  screenSize: string;
  timestamp: string;
  userId?: string;
  userName?: string;
  userEmail?: string;
  // NEW: Additional system info
  connectionSpeed?: string;
  browserVersion?: string;
  osVersion?: string;
  deviceType?: 'desktop' | 'mobile' | 'tablet';
}

// NEW: User Experience Rating Schema
interface UserExperienceRating {
  overallSatisfaction: number; // 1-5 scale
  easeOfUse: number; // 1-5 scale
  speed: number; // 1-5 scale
  visualAppeal: number; // 1-5 scale
  functionalityClarity: number; // 1-5 scale
}

// NEW: Feature Suggestion Schema
interface FeatureSuggestion {
  description: string;
  businessValue: 'low' | 'medium' | 'high';
  userImpact: 'low' | 'medium' | 'high';
  suggestedPriority: 'low' | 'medium' | 'high';
  discussedInternally?: boolean; // NEW: Optional flag
}

interface SourceOfFeedback {
  source: string; // Free text field for specific source details
  contactPerson?: string; // e.g., "Mark - Carbon Tanzania"
}

// Define the main BugReport interface
interface IBugReport extends Document {
  createdAt: any;
  feedbackType: 'bug_report' | 'user_experience' | 'thematic_feedback' | 'feature_suggestion' | 'general_feedback';
  title: string;
  description: string;
  steps?: string;
  expectedBehavior?: string;
  actualBehavior?: string;
  category: string;
  subCategory?: string;
  userExperienceRating?: UserExperienceRating;
  performanceIssues?: {
    pageLoadTime?: number;
    timeToInteractive?: number;
    specificSlowAreas?: string[];
    browserFreeze?: boolean;
    memoryIssues?: boolean;
  };
  thematicFeedback?: {
    lookAndFeelRating?: number;
    colorSchemeAppropriate?: boolean;
    fontReadability?: number;
    layoutIntuitive?: number;
    brandConsistency?: number;
    specificThematicComments?: string;
  };
  featureSuggestion?: FeatureSuggestion;
  urgencyLevel: 'fix_24_hours' | 'fix_1_3_days' | 'fix_this_week' | 'fix_2_weeks' | 'fix_next_month' | 'later';
  bugType?: 'fix' | 'food_for_thought' | 'pipeline';
  businessImpact?: {
    affectedUsers?: 'few' | 'some' | 'many' | 'most' | 'all';
    functionalityBlocked?: boolean;
    workaroundAvailable?: boolean;
    revenueImpact?: boolean;
    complianceImpact?: boolean;
  };
  deviceContext?: {
    isRecurring?: boolean;
    firstOccurrence?: Date;
    frequency?: 'once' | 'occasionally' | 'frequently' | 'always';
    contextOfUse?: 'work_hours' | 'after_hours' | 'peak_usage' | 'low_usage' | 'specific_workflow';
  };
  screenshot?: string;
  attachments?: Array<{
    filename: string;
    url: string;
    type: 'screenshot' | 'video' | 'document' | 'log_file' | 'other';
    uploadedAt: Date;
  }>;
  systemInfo: SystemInfo;
  status: 'new' | 'triaged' | 'resolved' | 'cannot-reproduce' | 'duplicate' | 'deferred';
  assignedToTeamMember?: 'kate' | 'sam' | 'belinda';
  sourceOfFeedback?: SourceOfFeedback;
  assignedTo?: mongoose.Types.ObjectId;
  reporter?: mongoose.Types.ObjectId;
  priority: 'p0' | 'p1' | 'p2' | 'p3' | 'p4';
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: mongoose.Types.ObjectId;
  resolution?: string;
  // NEW: Verification fields (separate from resolution)
  verified: boolean;
  verifiedAt?: Date;
  verifiedBy?: mongoose.Types.ObjectId;
  verificationDetails?: string; // NEW: Just like resolution details

  requiresFollowUp: boolean;
  followUpDate?: Date;
  verifiedByReporter: boolean;
  tags: string[];
  relatedIssues: mongoose.Types.ObjectId[];
  metrics: {
    viewCount: number;
    commentCount: number;
    timeToFirstResponse?: number;
    timeToResolution?: number;
    timeToVerification?: number; // NEW: Track verification time
    reopenCount: number;
  };
  
  // Virtual properties
  overallScore: number;
  
  // Methods
  updateMetrics(): void;
}

const sourceOfFeedbackSchema = new mongoose.Schema({
  source: {
    type: String,
    required: true,
    trim: true,
    maxLength: 100 // Free text with reasonable limit
  },
  contactPerson: {
    type: String,
    trim: true,
    maxLength: 100
  }
});

const systemInfoSchema = new mongoose.Schema({
  url: { type: String, required: true },
  pathname: { type: String, required: true },
  userAgent: { type: String, required: true },
  platform: { type: String, required: true },
  screenSize: { type: String, required: true },
  timestamp: { type: String, required: true },
  userId: { type: String },
  userName: { type: String },
  userEmail: { type: String },
  // NEW: Enhanced system info
  connectionSpeed: { type: String },
  browserVersion: { type: String },
  osVersion: { type: String },
  deviceType: { 
    type: String, 
    enum: ['desktop', 'mobile', 'tablet']
  }
});

const userExperienceRatingSchema = new mongoose.Schema({
  overallSatisfaction: { 
    type: Number, 
    min: 1, 
    max: 5,
    required: function(this: any) {
      return this.parent().feedbackType === 'user_experience' || this.parent().feedbackType === 'general_feedback';
    }
  },
  easeOfUse: { type: Number, min: 1, max: 5 },
  speed: { type: Number, min: 1, max: 5 },
  visualAppeal: { type: Number, min: 1, max: 5 },
  functionalityClarity: { type: Number, min: 1, max: 5 }
});

const featureSuggestionSchema = new mongoose.Schema({
  description: { 
    type: String, 
    required: true,
    trim: true,
    maxLength: 1000
  },
  businessValue: { 
    type: String, 
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  userImpact: { 
    type: String, 
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  suggestedPriority: { 
    type: String, 
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  // NEW: Optional internal discussion flag
  discussedInternally: {
    type: Boolean,
    default: false // Optional field, defaults to false
  }
});

const bugReportSchema = new mongoose.Schema({
  // ENHANCED: Report Type Classification
  feedbackType: {
    type: String,
    enum: ['bug_report', 'user_experience', 'thematic_feedback', 'feature_suggestion', 'general_feedback'],
    required: true,
    default: 'bug_report',
    index: true
  },
  
  // Basic Information (Enhanced)
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    minLength: 2,
    maxLength: 200,
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    minLength: 2,
    maxLength: 2000, // Increased for detailed feedback
  },
  
  // Bug-specific fields (existing, but now conditional)
  steps: {
    type: String,
    trim: true,
    required: function(this: any) {
      return this.feedbackType === 'bug_report';
    }
  },
  expectedBehavior: {
    type: String,
    trim: true,
    required: function(this: any) {
      return this.feedbackType === 'bug_report';
    }
  },
  actualBehavior: {
    type: String,
    trim: true,
    required: function(this: any) {
      return this.feedbackType === 'bug_report';
    }
  },
  
  // NEW: Enhanced Categorization
  category: {
    type: String,
    enum: [
      // Bug categories
      'functionality', 'ui_ux', 'performance', 'security', 'data_integrity', 'integration',
      // UX categories  
      'navigation', 'layout', 'accessibility', 'responsiveness', 'loading_speed',
      // Thematic categories
      'visual_design', 'branding', 'color_scheme', 'typography', 'iconography',
      // Feature categories
      'new_feature', 'enhancement', 'workflow_improvement', 'automation',
      // General categories
      'copy', // NEW: For wording/text issues
      'other'
    ],
    required: true,
    index: true
  },
  
  // NEW: Sub-category for more granular classification
  subCategory: {
    type: String,
    trim: true,
    maxLength: 100
  },
  
  // NEW: User Experience Assessment
  userExperienceRating: userExperienceRatingSchema,
  
  // NEW: Speed and Performance Issues
  performanceIssues: {
    pageLoadTime: { type: Number }, // in seconds
    timeToInteractive: { type: Number }, // in seconds
    specificSlowAreas: [String], // Array of slow components/pages
    browserFreeze: { type: Boolean, default: false },
    memoryIssues: { type: Boolean, default: false }
  },
  
  // NEW: Thematic/Visual Feedback
  thematicFeedback: {
    lookAndFeelRating: { type: Number, min: 1, max: 5 },
    colorSchemeAppropriate: { type: Boolean },
    fontReadability: { type: Number, min: 1, max: 5 },
    layoutIntuitive: { type: Number, min: 1, max: 5 },
    brandConsistency: { type: Number, min: 1, max: 5 },
    specificThematicComments: { type: String, trim: true, maxLength: 500 }
  },
  
  // NEW: Feature Suggestions
  featureSuggestion: featureSuggestionSchema,
  
  // UPDATED: Urgency with specific timeframes
  urgencyLevel: {
    type: String,
    enum: ['fix_24_hours', 'fix_1_3_days', 'fix_this_week', 'fix_2_weeks', 'fix_next_month', 'later'],
    default: 'fix_this_week',
    index: true
  },
  
  // UPDATED: Estimated effort becomes "Type"
  bugType: {
    type: String,
    enum: ['fix', 'food_for_thought', 'pipeline'],
    index: true
  },
  
  // NEW: Business Impact Assessment
  businessImpact: {
    affectedUsers: {
      type: String,
      enum: ['few', 'some', 'many', 'most', 'all'],
      index: true
    },
    functionalityBlocked: { type: Boolean, default: false },
    workaroundAvailable: { type: Boolean, default: false },
    revenueImpact: { type: Boolean, default: false },
    complianceImpact: { type: Boolean, default: false }
  },
  
  // NEW: Device and Context Information
  deviceContext: {
    isRecurring: { type: Boolean, default: false },
    firstOccurrence: { type: Date },
    frequency: {
      type: String,
      enum: ['once', 'occasionally', 'frequently', 'always']
    },
    contextOfUse: {
      type: String,
      enum: ['work_hours', 'after_hours', 'peak_usage', 'low_usage', 'specific_workflow']
    }
  },
  
  // Existing fields (kept for backward compatibility)
  screenshot: {
    type: String, // URL to stored screenshot
  },
  
  // NEW: Multiple attachments
  attachments: [{
    filename: String,
    url: String,
    type: {
      type: String,
      enum: ['screenshot', 'video', 'document', 'log_file', 'other']
    },
    uploadedAt: { type: Date, default: Date.now }
  }],
  
  systemInfo: systemInfoSchema,
  
  /// UPDATED: Removed 'verified' from status enum
  status: {
    type: String,
    enum: ['new', 'triaged', 'resolved', 'cannot-reproduce', 'duplicate', 'deferred'],
    default: 'new',
    index: true
  },

  // NEW: Team member assignment
  assignedToTeamMember: {
    type: String,
    // Remove enum completely
    required: false,
    validate: {
      validator: function(value: any) {
        if (!value || value === '' || value === 'unassigned') {
          return true;
        }
        return ['kate', 'sam', 'belinda'].includes(value);
      },
      message: 'Invalid team member assignment'
    }
  },

  // NEW: Source of feedback
  sourceOfFeedback: sourceOfFeedbackSchema,
  
  // Assignment and Ownership
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  reporter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  
  // Enhanced Priority (now separate from urgency)
  priority: {
    type: String,
    enum: ['p0', 'p1', 'p2', 'p3', 'p4'], // P0 = Critical, P4 = Low
    default: 'p3',
    index: true
  },
  
  // Resolution Information
  resolved: {
    type: Boolean,
    default: false
  },
  resolvedAt: {
    type: Date
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  resolution: {
    type: String,
    trim: true,
  },

  // NEW: Verification Information (separate from resolution)
  verified: {
    type: Boolean,
    default: false
  },
  verifiedAt: {
    type: Date
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  verificationDetails: {
    type: String,
    trim: true,
  },
  
  // NEW: Follow-up and Validation
  requiresFollowUp: {
    type: Boolean,
    default: false
  },
  followUpDate: {
    type: Date
  },
  verifiedByReporter: {
    type: Boolean,
    default: false
  },
  
  // NEW: Tags for better organization
  tags: [String],
  
  // NEW: Related Issues
  relatedIssues: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BugReport'
  }],
  
  // NEW: Metrics and Analytics
  metrics: {
    viewCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    timeToFirstResponse: { type: Number }, // in hours
    timeToResolution: { type: Number }, // in hours
    timeToVerification: { type: Number }, // NEW: Track verification time
    reopenCount: { type: Number, default: 0 }
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Enhanced text indices for better search
bugReportSchema.index({ 
  title: 'text', 
  description: 'text',
  steps: 'text',
  expectedBehavior: 'text',
  actualBehavior: 'text',
  'featureSuggestion.description': 'text',
  'thematicFeedback.specificThematicComments': 'text',
  tags: 'text'
});

// Compound indices for efficient querying
bugReportSchema.index({ feedbackType: 1, status: 1, priority: 1 });
bugReportSchema.index({ category: 1, urgencyLevel: 1 });
bugReportSchema.index({ 'businessImpact.affectedUsers': 1, priority: 1 });
bugReportSchema.index({ estimatedEffort: 1, urgencyLevel: 1 });
bugReportSchema.index({ assignedTo: 1, status: 1 });
bugReportSchema.index({ reporter: 1, feedbackType: 1 });
// NEW: Index for verification tracking
bugReportSchema.index({ resolved: 1, verified: 1 });

// Virtual for calculating overall score based on multiple factors
bugReportSchema.virtual('overallScore').get(function() {
  let score = 0;
  
  // Priority scoring (P0=100, P1=80, P2=60, P3=40, P4=20)
  const priorityScores = { 'p0': 100, 'p1': 80, 'p2': 60, 'p3': 40, 'p4': 20 };
  score += priorityScores[this.priority as keyof typeof priorityScores] || 40;
  
  // Business impact scoring
  if (this.businessImpact?.functionalityBlocked) score += 30;
  if (this.businessImpact?.revenueImpact) score += 25;
  if (this.businessImpact?.complianceImpact) score += 35;
  
  // Affected users multiplier
  const userImpactScores = { 'all': 50, 'most': 40, 'many': 30, 'some': 20, 'few': 10 };
  score += userImpactScores[this.businessImpact?.affectedUsers as keyof typeof userImpactScores] || 10;
  
  return Math.min(score, 255); // Cap at 255 for database efficiency
});

// Method to update metrics
bugReportSchema.methods.updateMetrics = function(this: IBugReport) {
  if (this.resolvedAt && this.createdAt) {
    this.metrics.timeToResolution = Math.floor((this.resolvedAt.getTime() - this.createdAt.getTime()) / (1000 * 60 * 60)); // hours
  }

  // NEW: Calculate verification time
  if (this.verifiedAt && this.resolvedAt) {
    this.metrics.timeToVerification = Math.floor((this.verifiedAt.getTime() - this.resolvedAt.getTime()) / (1000 * 60 * 60));
  }
};

// Update the priority auto-assignment logic in pre-save middleware
bugReportSchema.pre('save', function(this: IBugReport, next) {
  // Auto-assign priority based on urgency and business impact if not set
  if (!this.isModified('priority') && this.urgencyLevel && this.businessImpact) {
    if (this.urgencyLevel === 'fix_24_hours' || this.businessImpact.functionalityBlocked) {
      this.priority = 'p0';
    } else if (this.urgencyLevel === 'fix_1_3_days' || this.businessImpact.revenueImpact) {
      this.priority = 'p1';
    } else if (this.urgencyLevel === 'fix_this_week') {
      this.priority = 'p2';
    } else if (this.urgencyLevel === 'fix_2_weeks') {
      this.priority = 'p3';
    } else {
      this.priority = 'p4';
    }
  }
  
  // Update metrics
  this.updateMetrics();
  
  next();
});

// Create the model with proper typing
const BugReport = mongoose.models.BugReport || mongoose.model<IBugReport>('BugReport', bugReportSchema);

export default BugReport;
export type { IBugReport, SystemInfo, UserExperienceRating, FeatureSuggestion, SourceOfFeedback };

