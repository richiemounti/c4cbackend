// models/tocConsultationPlan.model.ts
import mongoose, { Document, Schema } from 'mongoose';

// Interface for stakeholder group selection
interface IStakeholderGroupSelection {
  stakeholderGroup: mongoose.Types.ObjectId;
  isSelected: boolean;
  notes?: string;
}

// Interface for consultation planning questions
interface IConsultationQuestions {
  howManyPeople: string;
  whoInvitedHow: string;
  whereHow: string;
  underRepresentedGroups: string;
  costsPlanning: string;
  permissions: string;
}

// Interface for planned consultation dates
interface IPlannedDates {
  startDate?: Date;
  endDate?: Date;
  dateDescription?: string;
}

// Main interface for TOC Consultation Plan
export interface ITOCConsultationPlan extends Document {
  project: mongoose.Types.ObjectId;
  projectSite: mongoose.Types.ObjectId;
  stakeholderGroups: IStakeholderGroupSelection[];
  consultationQuestions: IConsultationQuestions;
  plannedConsultationDates: IPlannedDates;
  status: 'draft' | 'completed';
  isCompleted: boolean;
  completedAt?: Date;
  creator: mongoose.Types.ObjectId;
  lastUpdatedBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Schema for stakeholder group selection
const StakeholderGroupSelectionSchema = new Schema<IStakeholderGroupSelection>({
  stakeholderGroup: {
    type: Schema.Types.ObjectId,
    ref: 'StakeholderGroup',
    required: true
  },
  isSelected: {
    type: Boolean,
    default: false
  },
  notes: {
    type: String,
    trim: true
  }
}, { _id: false });

// Schema for consultation planning questions
const ConsultationQuestionsSchema = new Schema<IConsultationQuestions>({
  howManyPeople: {
    type: String,
    trim: true,
    default: ''
  },
  whoInvitedHow: {
    type: String,
    trim: true,
    default: ''
  },
  whereHow: {
    type: String,
    trim: true,
    default: ''
  },
  underRepresentedGroups: {
    type: String,
    trim: true,
    default: ''
  },
  costsPlanning: {
    type: String,
    trim: true,
    default: ''
  },
  permissions: {
    type: String,
    trim: true,
    default: ''
  }
}, { _id: false });

// Schema for planned consultation dates
const PlannedDatesSchema = new Schema<IPlannedDates>({
  startDate: {
    type: Date
  },
  endDate: {
    type: Date
  },
  dateDescription: {
    type: String,
    trim: true
  }
}, { _id: false });

// Main TOC Consultation Plan Schema
const TOCConsultationPlanSchema = new Schema<ITOCConsultationPlan>({
  project: {
    type: Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  projectSite: {
    type: Schema.Types.ObjectId,
    ref: 'ProjectSite',
    required: true
  },
  stakeholderGroups: {
    type: [StakeholderGroupSelectionSchema],
    default: []
  },
  consultationQuestions: {
    type: ConsultationQuestionsSchema,
    default: () => ({
      howManyPeople: '',
      whoInvitedHow: '',
      whereHow: '',
      underRepresentedGroups: '',
      costsPlanning: '',
      permissions: ''
    })
  },
  plannedConsultationDates: {
    type: PlannedDatesSchema,
    default: () => ({})
  },
  status: {
    type: String,
    enum: ['draft', 'completed'],
    default: 'draft'
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date
  },
  creator: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastUpdatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient querying
TOCConsultationPlanSchema.index({ project: 1, projectSite: 1 }, { unique: true });
TOCConsultationPlanSchema.index({ projectSite: 1 });
TOCConsultationPlanSchema.index({ status: 1 });
TOCConsultationPlanSchema.index({ isCompleted: 1 });

// Helper function to check if consultation questions are answered
function hasAnsweredQuestions(questions: IConsultationQuestions): boolean {
  if (!questions) return false;
  return Object.values(questions).some(q => 
    q !== null && 
    q !== undefined && 
    typeof q === 'string' && 
    q.trim() !== ''
  );
}

// Virtual for selected stakeholder groups count
TOCConsultationPlanSchema.virtual('selectedStakeholderCount').get(function() {
  return this.stakeholderGroups.filter(sg => sg.isSelected).length;
});

// Virtual for completion percentage
TOCConsultationPlanSchema.virtual('completionPercentage').get(function() {
  const sections = {
    stakeholderGroups: this.stakeholderGroups.some(sg => sg.isSelected),
    consultationQuestions: hasAnsweredQuestions(this.consultationQuestions),
    plannedDates: this.plannedConsultationDates.startDate || 
                  this.plannedConsultationDates.endDate || 
                  (this.plannedConsultationDates.dateDescription && 
                   typeof this.plannedConsultationDates.dateDescription === 'string' &&
                   this.plannedConsultationDates.dateDescription.trim() !== '')
  };
  
  const completedSections = Object.values(sections).filter(Boolean).length;
  return Math.round((completedSections / 3) * 100);
});

// Pre-save middleware to update completion status
TOCConsultationPlanSchema.pre('save', function(next) {
  // Update lastUpdatedBy timestamp
  this.updatedAt = new Date();
  
  // Check if plan should be marked as completed
  const hasSelectedStakeholders = this.stakeholderGroups.some(sg => sg.isSelected);
  const hasAnsweredQuestionsCheck = hasAnsweredQuestions(this.consultationQuestions);
  const hasPlannedDates = this.plannedConsultationDates.startDate || 
                         this.plannedConsultationDates.endDate || 
                         (this.plannedConsultationDates.dateDescription && 
                          typeof this.plannedConsultationDates.dateDescription === 'string' &&
                          this.plannedConsultationDates.dateDescription.trim() !== '');
  
  // Auto-update completion status based on content
  if (hasSelectedStakeholders && hasAnsweredQuestionsCheck && hasPlannedDates) {
    if (this.status === 'draft') {
      this.status = 'completed';
      this.isCompleted = true;
      this.completedAt = new Date();
    }
  } else {
    this.status = 'draft';
    this.isCompleted = false;
    this.completedAt = undefined;
  }
  
  next();
});

// Static method to find consultation plan by site
TOCConsultationPlanSchema.statics.findBySite = function(projectSiteId: mongoose.Types.ObjectId) {
  return this.findOne({ projectSite: projectSiteId })
    .populate('project', 'name')
    .populate('projectSite', 'name location')
    .populate('stakeholderGroups.stakeholderGroup', 'name description')
    .populate('creator', 'name email')
    .populate('lastUpdatedBy', 'name email');
};

// Static method to check if consultation plan is completed for a site
TOCConsultationPlanSchema.statics.isCompletedForSite = function(projectSiteId: mongoose.Types.ObjectId) {
  return this.findOne({ 
    projectSite: projectSiteId, 
    isCompleted: true 
  });
};

// Instance method to validate completion requirements
TOCConsultationPlanSchema.methods.canBeCompleted = function() {
  const hasSelectedStakeholders = this.stakeholderGroups.some((sg: IStakeholderGroupSelection) => sg.isSelected);
  const hasAnsweredQuestionsCheck = hasAnsweredQuestions(this.consultationQuestions);
  const hasPlannedDates = this.plannedConsultationDates.startDate || 
                         this.plannedConsultationDates.endDate || 
                         (this.plannedConsultationDates.dateDescription && 
                          typeof this.plannedConsultationDates.dateDescription === 'string' &&
                          this.plannedConsultationDates.dateDescription.trim() !== '');
  
  return {
    canComplete: hasSelectedStakeholders && hasAnsweredQuestionsCheck && hasPlannedDates,
    missing: {
      stakeholderGroups: !hasSelectedStakeholders,
      consultationQuestions: !hasAnsweredQuestionsCheck,
      plannedDates: !hasPlannedDates
    }
  };
};

export default mongoose.model<ITOCConsultationPlan>('TOCConsultationPlan', TOCConsultationPlanSchema);