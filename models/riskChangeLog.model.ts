// models/riskChangeLog.model.ts
import mongoose, { Schema, Document, Model } from 'mongoose';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface IChangeDetail {
  field: string;
  fieldLabel: string;
  oldValue: any;
  newValue: any;
  oldValueLabel?: string;
  newValueLabel?: string;
}

export interface IRiskChangeLog {
  riskId: mongoose.Types.ObjectId;
  project: mongoose.Types.ObjectId;
  organization: mongoose.Types.ObjectId;
  changeType: 'status' | 'assessment' | 'mitigation' | 'review' | 'ownership' | 'source' | 'general';
  changedBy: mongoose.Types.ObjectId;
  changedAt: Date;
  changes: IChangeDetail[];
  description?: string;
  impact: 'low' | 'medium' | 'high';
  ipAddress?: string;
  userAgent?: string;
}

export interface IRiskChangeLogDocument extends IRiskChangeLog, Document {
  createdAt: Date;
  updatedAt: Date;
  toDisplayFormat(): any;
  generateDescription(): string;
}

export interface IRiskChangeLogModel extends Model<IRiskChangeLogDocument> {
  logChange(
    riskId: mongoose.Types.ObjectId,
    project: mongoose.Types.ObjectId,
    organization: mongoose.Types.ObjectId,
    changeType: string,
    changedBy: mongoose.Types.ObjectId,
    changes: IChangeDetail[],
    description?: string,
    impact?: 'low' | 'medium' | 'high'
  ): Promise<IRiskChangeLogDocument>;
  
  findByRisk(riskId: mongoose.Types.ObjectId, limit?: number): Promise<IRiskChangeLogDocument[]>;
  
  findByProject(
    projectId: mongoose.Types.ObjectId,
    startDate?: Date,
    endDate?: Date
  ): Promise<IRiskChangeLogDocument[]>;
  
  getChangeStats(
    projectId: mongoose.Types.ObjectId,
    startDate?: Date,
    endDate?: Date
  ): Promise<any[]>;
}

// ============================================================================
// SCHEMA DEFINITION
// ============================================================================

const changeDetailSchema = new Schema({
  field: {
    type: String,
    required: true
  },
  fieldLabel: {
    type: String,
    required: true
  },
  oldValue: Schema.Types.Mixed,
  newValue: Schema.Types.Mixed,
  oldValueLabel: String,
  newValueLabel: String
}, { _id: false });

const riskChangeLogSchema = new Schema<IRiskChangeLogDocument, IRiskChangeLogModel>(
  {
    riskId: {
      type: Schema.Types.ObjectId,
      ref: 'RiskRegister',
      required: true,
      index: true
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true
    },
    organization: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true
    },
    changeType: {
      type: String,
      enum: ['status', 'assessment', 'mitigation', 'review', 'ownership', 'source', 'general'],
      required: true,
      index: true
    },
    changedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    changedAt: {
      type: Date,
      default: Date.now,
      required: true,
      index: true
    },
    changes: [changeDetailSchema],
    description: {
      type: String,
      maxlength: 500
    },
    impact: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'low'
    },
    ipAddress: String,
    userAgent: String
  },
  {
    timestamps: true,
    collection: 'riskchangelogs'
  }
);

// ============================================================================
// INDEXES
// ============================================================================

riskChangeLogSchema.index({ riskId: 1, changedAt: -1 });
riskChangeLogSchema.index({ project: 1, changeType: 1, changedAt: -1 });
riskChangeLogSchema.index({ organization: 1, changedAt: -1 });
riskChangeLogSchema.index({ changedBy: 1, changedAt: -1 });

// ============================================================================
// STATIC METHODS
// ============================================================================

riskChangeLogSchema.statics.logChange = async function(
  riskId: mongoose.Types.ObjectId,
  project: mongoose.Types.ObjectId,
  organization: mongoose.Types.ObjectId,
  changeType: string,
  changedBy: mongoose.Types.ObjectId,
  changes: IChangeDetail[],
  description?: string,
  impact: 'low' | 'medium' | 'high' = 'low'
): Promise<IRiskChangeLogDocument> {
  return await this.create({
    riskId,
    project,
    organization,
    changeType,
    changedBy,
    changes,
    description,
    impact,
    changedAt: new Date()
  });
};

riskChangeLogSchema.statics.findByRisk = function(
  riskId: mongoose.Types.ObjectId,
  limit: number = 50
): Promise<IRiskChangeLogDocument[]> {
  return this.find({ riskId })
    .populate('changedBy', 'name email')
    .sort({ changedAt: -1 })
    .limit(limit)
    .exec();
};

riskChangeLogSchema.statics.findByProject = function(
  projectId: mongoose.Types.ObjectId,
  startDate?: Date,
  endDate?: Date
): Promise<IRiskChangeLogDocument[]> {
  const query: any = { project: projectId };
  
  if (startDate || endDate) {
    query.changedAt = {};
    if (startDate) query.changedAt.$gte = startDate;
    if (endDate) query.changedAt.$lte = endDate;
  }
  
  return this.find(query)
    .populate('changedBy', 'name email')
    .populate('riskId', 'name riskScore')
    .sort({ changedAt: -1 })
    .exec();
};

riskChangeLogSchema.statics.getChangeStats = async function(
  projectId: mongoose.Types.ObjectId,
  startDate?: Date,
  endDate?: Date
): Promise<any[]> {
  const matchStage: any = { project: projectId };
  
  if (startDate || endDate) {
    matchStage.changedAt = {};
    if (startDate) matchStage.changedAt.$gte = startDate;
    if (endDate) matchStage.changedAt.$lte = endDate;
  }
  
  return await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$changeType',
        count: { $sum: 1 },
        highImpact: {
          $sum: { $cond: [{ $eq: ['$impact', 'high'] }, 1, 0] }
        }
      }
    },
    { $sort: { count: -1 } }
  ]);
};

// ============================================================================
// INSTANCE METHODS
// ============================================================================

riskChangeLogSchema.methods.toDisplayFormat = function() {
  return {
    id: this._id.toString(),
    riskId: this.riskId.toString(),
    changeType: this.changeType,
    changedBy: this.changedBy,
    changedAt: this.changedAt,
    description: this.description || this.generateDescription(),
    impact: this.impact,
    changes: this.changes
  };
};

riskChangeLogSchema.methods.generateDescription = function(): string {
  if (!this.changes || this.changes.length === 0) return 'No changes recorded';
  
  if (this.changes.length === 1) {
    const change = this.changes[0];
    const oldLabel = change.oldValueLabel || String(change.oldValue || 'None');
    const newLabel = change.newValueLabel || String(change.newValue || 'None');
    return `${change.fieldLabel} changed from "${oldLabel}" to "${newLabel}"`;
  }
  
  if (this.changes.length === 2) {
    return `${this.changes[0].fieldLabel} and ${this.changes[1].fieldLabel} updated`;
  }
  
  return `${this.changes.length} fields updated: ${this.changes.map((c: { fieldLabel: any; }) => c.fieldLabel).join(', ')}`;
};

// ============================================================================
// MODEL EXPORT
// ============================================================================

const RiskChangeLog = mongoose.model<IRiskChangeLogDocument, IRiskChangeLogModel>(
  'RiskChangeLog',
  riskChangeLogSchema
);

export default RiskChangeLog;