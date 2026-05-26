// models/report.model.ts
import mongoose from "mongoose";

// Interface for report filters
interface IReportFilters {
  // Date range filters
  dateRange?: {
    startDate?: Date;
    endDate?: Date;
  };
  
  // Status filters
  statusFilters?: string[];
  
  // Category filters (for stakeholder reports)
  categoryFilters?: string[];
  
  // Risk level filters (for risk register reports)
  riskLevelFilters?: string[];
  
  // Completion status filters
  completionFilters?: string[];
  
  // Custom filters for specific report types
  customFilters?: Record<string, any>;
}

// Interface for workflow history
interface IWorkflowHistoryEntry {
  fromStatus: string;
  toStatus: string;
  transitionedBy: mongoose.Types.ObjectId;
  transitionedAt: Date;
  notes?: string;
  metadata?: any;
}

// Interface for scheduled regeneration
interface IScheduledRegeneration {
  scheduledDate: Date;
  scheduledBy: mongoose.Types.ObjectId;
  recurring: boolean;
  frequency?: string;
  status: 'scheduled' | 'completed' | 'failed' | 'cancelled';
  lastAttempt?: Date;
  nextScheduled?: Date;
}

// Interface for report metadata
interface IReportMetadata {
  // Generation details
  generationTime?: number; // Time taken to generate in milliseconds
  dataVersion?: string; // Version of data schema used
  totalRecords?: number; // Total number of records processed

  // Generation tracking
  generationCompletedAt?: Date;
  generationCompletedBy?: string;
  
  // Publishing tracking
  publishedAt?: Date;
  publishedBy?: string;
  
  // Regeneration tracking
  regeneratedAt?: Date;
  regeneratedBy?: string;
  regenerationAttempts?: number;
  lastRegenerationAttempt?: Date;
  lastRegenerationError?: string;
  
  // Scheduled operations
  scheduledRegeneration?: IScheduledRegeneration;
  
  // Workflow history
  workflowHistory?: IWorkflowHistoryEntry[];
  
  // Report specific metadata
  projectInfo?: {
    name: string;
    status: string;
    organization: string;
  };
  
  siteInfo?: {
    name: string;
    region: string;
    country: string;
  };
  
  // Statistics for quick overview
  summary?: {
    totalItems?: number;
    completedItems?: number;
    pendingItems?: number;
    completionPercentage?: number;
  };
  
  // Export information
  exportHistory?: Array<{
    format: 'pdf' | 'excel' | 'csv';
    exportedAt: Date;
    exportedBy: mongoose.Types.ObjectId;
    fileSize?: number;
    downloadCount?: number;
  }>;

  // Performance metrics
  queryExecutionTime?: number;
  cacheHit?: boolean;
  
  // Compliance tracking
  dataRetentionDate?: Date;
  privacyFlags?: string[];
}

// Interface for the Report document
interface IReportDocument extends mongoose.Document {
  // Report identification
  reportType: 'project_setup' | 'project_site_setup' | 'stakeholder_mapping' | 'theory_of_change' | 'risk_register';
  title: string;
  description?: string;
  
  // Entity references
  entityId: mongoose.Types.ObjectId; // project or projectSite ID
  entityType: 'project' | 'project_site';
  organization: mongoose.Types.ObjectId;
  project: mongoose.Types.ObjectId;
  projectSite?: mongoose.Types.ObjectId; // Only for site-specific reports
  
  // Report data snapshot (flexible structure)
  reportData: any; // Main report content - structure varies by report type
  
  // Report configuration
  filters: IReportFilters;
  metadata: IReportMetadata;
  
  // Report workflow
  status: 'draft' | 'generated' | 'approved' | 'published' | 'archived';
  version: number; // For report versioning
  
  // Access control
  visibility: 'private' | 'organization' | 'public';
  sharedWith?: mongoose.Types.ObjectId[]; // Specific users with access
  
  // Approval workflow
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  approvalNotes?: string;
  
  // User tracking
  creator: mongoose.Types.ObjectId;
  lastUpdatedBy?: mongoose.Types.ObjectId;
  
  // Standard fields
  archived: boolean;
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // Virtual fields
  isExpired: boolean;
  canBeRegenerated: boolean;
  isNearingExpiration: boolean;
  workflowState: string;
  
  // Enhanced methods
  generateTitle(): string;
  markAsApproved(userId: mongoose.Types.ObjectId, notes?: string): void;
  addExportRecord(format: string, userId: mongoose.Types.ObjectId, fileSize?: number): void;
  addWorkflowHistory(fromStatus: string, toStatus: string, userId: mongoose.Types.ObjectId, notes?: string): void;
  canUserTransition(userId: mongoose.Types.ObjectId, toStatus: string): Promise<boolean>;
  scheduleRegeneration(scheduledDate: Date, userId: mongoose.Types.ObjectId, recurring?: boolean): void;
  calculateNextScheduledDate(): void;
}

// Enhanced schema for workflow history
const workflowHistorySchema = new mongoose.Schema({
  fromStatus: {
    type: String,
    required: true,
    enum: ['draft', 'generated', 'approved', 'published', 'archived', 'regenerating']
  },
  toStatus: {
    type: String,
    required: true,
    enum: ['draft', 'generated', 'approved', 'published', 'archived', 'regenerating']
  },
  transitionedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  transitionedAt: {
    type: Date,
    default: Date.now
  },
  notes: String,
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, { _id: false });

// Enhanced schema for scheduled regeneration
const scheduledRegenerationSchema = new mongoose.Schema({
  scheduledDate: {
    type: Date,
    required: true
  },
  scheduledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recurring: {
    type: Boolean,
    default: false
  },
  frequency: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'quarterly']
  },
  status: {
    type: String,
    enum: ['scheduled', 'completed', 'failed', 'cancelled'],
    default: 'scheduled'
  },
  lastAttempt: Date,
  nextScheduled: Date
}, { _id: false });


// Schema for report filters
const reportFiltersSchema = new mongoose.Schema({
  dateRange: {
    startDate: Date,
    endDate: Date
  },
  statusFilters: [String],
  categoryFilters: [String],
  riskLevelFilters: [String],
  completionFilters: [String],
  customFilters: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { _id: false });

// Enhanced schema for report metadata
const reportMetadataSchema = new mongoose.Schema({
  generationTime: Number,
  dataVersion: {
    type: String,
    default: '1.0'
  },
  totalRecords: Number,
  
  // Generation tracking
  generationCompletedAt: Date,
  generationCompletedBy: String,
  
  // Publishing tracking
  publishedAt: Date,
  publishedBy: String,
  
  // Regeneration tracking
  regeneratedAt: Date,
  regeneratedBy: String,
  regenerationAttempts: {
    type: Number,
    default: 0
  },
  lastRegenerationAttempt: Date,
  lastRegenerationError: String,
  
  // Scheduled operations
  scheduledRegeneration: scheduledRegenerationSchema,
  
  // Workflow history
  workflowHistory: [workflowHistorySchema],
  
  projectInfo: {
    name: String,
    status: String,
    organization: String
  },
  
  siteInfo: {
    name: String,
    region: String,
    country: String
  },
  
  summary: {
    totalItems: Number,
    completedItems: Number,
    pendingItems: Number,
    completionPercentage: Number
  },
  
  exportHistory: [{
    format: {
      type: String,
      enum: ['pdf', 'excel', 'csv']
    },
    exportedAt: {
      type: Date,
      default: Date.now
    },
    exportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    fileSize: Number,
    downloadCount: {
      type: Number,
      default: 0
    }
  }],
  
  // Performance metrics
  queryExecutionTime: Number,
  cacheHit: Boolean,
  
  // Compliance tracking
  dataRetentionDate: Date,
  privacyFlags: [String]
}, { _id: false });


// Main report schema
const reportSchema = new mongoose.Schema({
  // Report identification
  reportType: {
    type: String,
    required: true,
    enum: ['project_setup', 'project_site_setup', 'stakeholder_mapping', 'theory_of_change', 'risk_register'],
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxLength: 200
  },
  description: {
    type: String,
    trim: true,
    maxLength: 1000
  },
  
  // Entity references
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  entityType: {
    type: String,
    required: true,
    enum: ['project', 'project_site'],
    index: true
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true
  },
  projectSite: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProjectSite',
    index: true
  },
  
  // Report data snapshot
  reportData: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  
  // Report configuration
  filters: {
    type: reportFiltersSchema,
    default: {}
  },
  metadata: {
    type: reportMetadataSchema,
    default: {}
  },
  
  // Report workflow
  status: {
    type: String,
    enum: ['draft', 'generated', 'approved', 'published', 'archived', 'regenerating'],
    default: 'generated',
    index: true
  },
  version: {
    type: Number,
    default: 1,
    min: 1
  },
  
  // Access control
  visibility: {
    type: String,
    enum: ['private', 'organization', 'public'],
    default: 'organization',
    index: true
  },
  sharedWith: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Approval workflow
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  approvalNotes: {
    type: String,
    trim: true
  },
  
  // User tracking
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Standard fields
  archived: {
    type: Boolean,
    default: false,
    index: true
  },
  archivedAt: {
    type: Date,
    default: null
  }
}, { 
  timestamps: true,
  // Enable virtuals in JSON output
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient querying
reportSchema.index({ reportType: 1, organization: 1 });
reportSchema.index({ reportType: 1, project: 1 });
reportSchema.index({ reportType: 1, projectSite: 1 });
reportSchema.index({ creator: 1, reportType: 1 });
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ entityType: 1, entityId: 1 });
reportSchema.index({ 'metadata.scheduledRegeneration.scheduledDate': 1, 'metadata.scheduledRegeneration.status': 1 });
reportSchema.index({ 'metadata.regenerationAttempts': 1 });

// Compound index for report uniqueness (prevent duplicate reports)
reportSchema.index(
  { 
    reportType: 1, 
    entityType: 1, 
    entityId: 1, 
    version: 1 
  }, 
  { unique: true }
);

// Virtual for checking if report is expired (older than 30 days)
reportSchema.virtual('isExpired').get(function(this: IReportDocument) {
  const expirationDays = {
    'project_setup': 90,
    'project_site_setup': 90,
    'stakeholder_mapping': 180,
    'theory_of_change': 365,
    'risk_register': 60
  };
  
  const maxAge = expirationDays[this.reportType] || 90;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxAge);
  
  return this.createdAt < cutoffDate;
});

// Virtual for checking near expiration
reportSchema.virtual('isNearingExpiration').get(function(this: IReportDocument) {
  const warningDays = {
    'project_setup': 14,
    'project_site_setup': 14,
    'stakeholder_mapping': 30,
    'theory_of_change': 60,
    'risk_register': 7
  };
  
  const expirationDays = {
    'project_setup': 90,
    'project_site_setup': 90,
    'stakeholder_mapping': 180,
    'theory_of_change': 365,
    'risk_register': 60
  };
  
  const maxAge = expirationDays[this.reportType] || 90;
  const warningPeriod = warningDays[this.reportType] || 14;
  
  const warningDate = new Date();
  warningDate.setDate(warningDate.getDate() - (maxAge - warningPeriod));
  
  return this.createdAt < warningDate && !this.isExpired;
});

// Virtual for workflow state description
reportSchema.virtual('workflowState').get(function(this: IReportDocument) {
  const stateDescriptions = {
    'draft': 'Being created or edited',
    'generated': 'Ready for review',
    'approved': 'Approved for publication',
    'published': 'Available to stakeholders',
    'archived': 'No longer active',
    'regenerating': 'Being regenerated'
  };
  
  return stateDescriptions[this.status] || 'Unknown state';
});


// Virtual for checking if report can be regenerated
reportSchema.virtual('canBeRegenerated').get(function(this: IReportDocument) {
  return this.status === 'generated' || this.status === 'draft';
});

// Method to generate automatic title based on report type and entity
reportSchema.methods.generateTitle = function(this: IReportDocument): string {
  const reportTypeNames = {
    'project_setup': 'Project Setup Report',
    'project_site_setup': 'Project Site Setup Report',
    'stakeholder_mapping': 'Stakeholder Mapping Report',
    'theory_of_change': 'Theory of Change Report',
    'risk_register': 'Risk Register Report'
  };
  
  const baseTitle = reportTypeNames[this.reportType];
  const entityName = this.metadata.projectInfo?.name || this.metadata.siteInfo?.name || 'Unknown';
  const date = this.createdAt.toLocaleDateString();
  
  return `${baseTitle} - ${entityName} (${date})`;
};

// Method to mark report as approved
reportSchema.methods.markAsApproved = function(
  this: IReportDocument, 
  userId: mongoose.Types.ObjectId, 
  notes?: string
): void {
  this.status = 'approved';
  this.approvedBy = userId;
  this.approvedAt = new Date();
  this.approvalNotes = notes || '';
  this.lastUpdatedBy = userId;
};

reportSchema.methods.addExportRecord = function(
  this: IReportDocument,
  format: string,
  userId: mongoose.Types.ObjectId,
  fileSize?: number
): void {
  if (!this.metadata.exportHistory) {
    this.metadata.exportHistory = [];
  }
  
  // Check if this user has exported this format recently (within last hour)
  const oneHourAgo = new Date(Date.now() - (60 * 60 * 1000));
  const recentExport = this.metadata.exportHistory.find(exp => 
    exp.exportedBy.toString() === userId.toString() &&
    exp.format === format &&
    exp.exportedAt > oneHourAgo
  );
  
  if (recentExport) {
    // Increment download count instead of creating new record
    recentExport.downloadCount = (recentExport.downloadCount || 0) + 1;
  } else {
    // Create new export record
    this.metadata.exportHistory.push({
      format: format as 'pdf' | 'excel' | 'csv',
      exportedAt: new Date(),
      exportedBy: userId,
      fileSize,
      downloadCount: 1
    });
  }
  
  this.lastUpdatedBy = userId;
};

// Method to get export statistics
reportSchema.methods.getExportStats = function(this: IReportDocument) {
  if (!this.metadata.exportHistory?.length) {
    return { totalExports: 0, totalDownloads: 0, byFormat: {}, topExporters: [] };
  }
  
  const stats = {
    totalExports: this.metadata.exportHistory.length,
    totalDownloads: this.metadata.exportHistory.reduce((sum, exp) => sum + (exp.downloadCount || 1), 0),
    byFormat: {} as Record<string, number>,
    topExporters: [] as Array<{ userId: string; count: number }>
  };
  
  // Count by format
  this.metadata.exportHistory.forEach(exp => {
    stats.byFormat[exp.format] = (stats.byFormat[exp.format] || 0) + (exp.downloadCount || 1);
  });
  
  // Count by user (top exporters)
  const userCounts = new Map<string, number>();
  this.metadata.exportHistory.forEach(exp => {
    const userId = exp.exportedBy.toString();
    userCounts.set(userId, (userCounts.get(userId) || 0) + (exp.downloadCount || 1));
  });
  
  stats.topExporters = Array.from(userCounts.entries())
    .map(([userId, count]) => ({ userId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  return stats;
};

// Enhanced method to add workflow history
reportSchema.methods.addWorkflowHistory = function(
  this: IReportDocument,
  fromStatus: string,
  toStatus: string,
  userId: mongoose.Types.ObjectId,
  notes?: string
): void {
  if (!this.metadata.workflowHistory) {
    this.metadata.workflowHistory = [];
  }
  
  this.metadata.workflowHistory.push({
    fromStatus,
    toStatus,
    transitionedBy: userId,
    transitionedAt: new Date(),
    notes
  });
};

// Method to schedule regeneration
reportSchema.methods.scheduleRegeneration = function(
  this: IReportDocument,
  scheduledDate: Date,
  userId: mongoose.Types.ObjectId,
  recurring: boolean = false
): void {
  this.metadata.scheduledRegeneration = {
    scheduledDate,
    scheduledBy: userId,
    recurring,
    status: 'scheduled'
  };
};

// Method to calculate next scheduled date for recurring regeneration
reportSchema.methods.calculateNextScheduledDate = function(this: IReportDocument): void {
  const sched = this.metadata.scheduledRegeneration;
  if (!sched || !sched.recurring || !sched.frequency) return;
  
  const baseDate = sched.scheduledDate;
  let nextDate = new Date(baseDate);
  
  switch (sched.frequency) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + 1);
      break;
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7);
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + 1);
      break;
    case 'quarterly':
      nextDate.setMonth(nextDate.getMonth() + 3);
      break;
    default:
      return;
  }
  
  sched.nextScheduled = nextDate;
  sched.status = 'scheduled';
};

// Method to check if user can perform a specific transition
reportSchema.methods.canUserTransition = async function(
  this: IReportDocument,
  userId: mongoose.Types.ObjectId,
  toStatus: string
): Promise<boolean> {
  // Basic permission checks - implement according to your auth system
  const isCreator = this.creator.toString() === userId.toString();
  
  // Define transition permissions
  const transitionPermissions: Record<string, (isCreator: boolean, userRole?: string) => boolean> = {
    'draft': () => isCreator,
    'generated': () => isCreator,
    'approved': () => true, // Assuming any authenticated user can approve
    'published': () => true, // Assuming any authenticated user can publish
    'archived': () => isCreator,
    'regenerating': () => isCreator
  };
  
  const permissionCheck = transitionPermissions[toStatus];
  return permissionCheck ? permissionCheck(isCreator) : false;
};



// Pre-save hook to auto-generate title if not provided
reportSchema.pre('save', function(this: IReportDocument, next) {
  if (!this.title || this.title.trim() === '') {
    this.title = this.generateTitle();
  }
  next();
});

// Pre-save hook to ensure projectSite is null for project-level reports
reportSchema.pre('save', function(this: IReportDocument, next) {
  if (this.entityType === 'project') {
    this.projectSite = undefined;
  }
  next();
});

// Pre-save middleware to ensure workflow history is maintained
reportSchema.pre('save', function(this: IReportDocument, next) {
  // Auto-generate title if not provided
  if (!this.title || this.title.trim() === '') {
    this.title = this.generateTitle();
  }
  
  // Track status changes in workflow history
  if (this.isModified('status') && !this.isNew) {
    const oldStatus = this.get('status', null, { getters: false });
    if (oldStatus && oldStatus !== this.status) {
      this.addWorkflowHistory(
        oldStatus,
        this.status,
        this.lastUpdatedBy || this.creator,
        'Automatic status change tracking'
      );
    }
  }
  
  // Handle scheduled regeneration next date calculation
  if (this.metadata.scheduledRegeneration?.recurring && 
      this.metadata.scheduledRegeneration.status === 'completed') {
    this.calculateNextScheduledDate();
  }
  
  next();
});


// Static method to find reports by entity
reportSchema.statics.findByEntity = function(
  entityType: string, 
  entityId: mongoose.Types.ObjectId, 
  reportType?: string
) {
  const query: any = { entityType, entityId, archived: { $ne: true } };
  if (reportType) {
    query.reportType = reportType;
  }
  return this.find(query).sort({ createdAt: -1 });
};

// Static method to find recent reports for organization
reportSchema.statics.findRecentByOrganization = function(
  organizationId: mongoose.Types.ObjectId,
  limit: number = 10
) {
  return this.find({ 
    organization: organizationId, 
    archived: { $ne: true } 
  })
  .sort({ createdAt: -1 })
  .limit(limit)
  .populate('creator', 'name')
  .populate('project', 'name')
  .populate('projectSite', 'name');
};


// Static method to find reports needing regeneration
reportSchema.statics.findRegenerationCandidates = function(limit: number = 10) {
  return this.find({
    $or: [
      {
        // Reports with scheduled regeneration that's due
        'metadata.scheduledRegeneration.scheduledDate': { $lte: new Date() },
        'metadata.scheduledRegeneration.status': 'scheduled'
      },
      {
        // Reports that are expired and can be regenerated
        status: { $in: ['generated', 'approved'] },
        $expr: {
          $gt: [
            { $subtract: [new Date(), '$createdAt'] },
            { $multiply: [90, 24, 60, 60, 1000] } // 90 days in milliseconds
          ]
        }
      }
    ],
    archived: { $ne: true }
  })
  .limit(limit)
  .sort({ 'metadata.scheduledRegeneration.scheduledDate': 1, createdAt: 1 });
};

// Static method to find reports requiring attention
reportSchema.statics.findAttentionRequired = function(organizationId: mongoose.Types.ObjectId) {
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
  
  return this.aggregate([
    {
      $match: {
        organization: organizationId,
        archived: { $ne: true }
      }
    },
    {
      $addFields: {
        needsAttention: {
          $or: [
            // Expired reports
            { $lt: ['$createdAt', new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000))] },
            // Pending approval for more than 3 days
            {
              $and: [
                { $eq: ['$status', 'generated'] },
                { $lt: ['$createdAt', new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000))] }
              ]
            },
            // Scheduled regeneration is overdue
            {
              $and: [
                { $ne: ['$metadata.scheduledRegeneration.scheduledDate', null] },
                { $lt: ['$metadata.scheduledRegeneration.scheduledDate', now] },
                { $eq: ['$metadata.scheduledRegeneration.status', 'scheduled'] }
              ]
            },
            // Failed regeneration attempts
            { $gt: ['$metadata.regenerationAttempts', 2] }
          ]
        },
        urgencyScore: {
          $sum: [
            // Age urgency (0-10 based on how old the report is)
            {
              $min: [
                10,
                { $divide: [{ $subtract: [now, '$createdAt'] }, (9 * 24 * 60 * 60 * 1000)] }
              ]
            },
            // Status urgency
            {
              $switch: {
                branches: [
                  { case: { $eq: ['$status', 'generated'] }, then: 5 },
                  { case: { $eq: ['$status', 'draft'] }, then: 3 },
                  { case: { $eq: ['$status', 'approved'] }, then: 2 }
                ],
                default: 0
              }
            },
            // Regeneration failure penalty
            { $multiply: ['$metadata.regenerationAttempts', 2] }
          ]
        }
      }
    },
    {
      $match: { needsAttention: true }
    },
    {
      $sort: { urgencyScore: -1, createdAt: 1 }
    }
  ]);
};

const Report = mongoose.model<IReportDocument>('Report', reportSchema);

export default Report;
export { IReportDocument, IReportFilters, IReportMetadata };