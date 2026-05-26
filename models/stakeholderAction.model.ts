// models/stakeholderAction.model.ts - UPDATED
import mongoose from "mongoose";

interface IStakeholderAction extends mongoose.Document {
  project: mongoose.Types.ObjectId;
  projectSite?: mongoose.Types.ObjectId;
  stage: mongoose.Types.ObjectId;
  stakeholderGroup: mongoose.Types.ObjectId;
  themes: mongoose.Types.ObjectId[];
  subThemes: mongoose.Types.ObjectId[];
  action: string;
  responsibility?: {
    name?: string;
    role?: string;
    email?: string;
    phone?: string;
  };
  timeframe: {
    startDate: Date;
    endDate: Date;
    estimatedDuration?: number;
    isFlexible?: boolean;
  };
  repeatCycle: 'monthly' | 'quarterly' | 'yearly' | 'no_repeat';
  notes?: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';
  progress: number;
  dependencies?: mongoose.Types.ObjectId[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  milestones?: Array<{
    date: Date;
    description: string;
    completed: boolean;
  }>;
  creator: mongoose.Types.ObjectId;
  lastUpdatedBy?: mongoose.Types.ObjectId;
  archived: boolean;
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const stakeholderActionSchema = new mongoose.Schema({
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
  stage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TheoryOfChangeStage',
    required: true,
    index: true
  },
  stakeholderGroup: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StakeholderGroup',
    required: true,
    index: true
  },
  // CHANGED: Multiple themes selection
  themes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Theme',
    required: true
  }],
  // CHANGED: Multiple subthemes selection
  subThemes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubTheme',
    required: true
  }],
  action: {
    type: String,
    required: true,
    trim: true
  },
  responsibility: {
    name: String,
    role: String,
    email: String,
    phone: String
  },
  timeframe: {
    type: {
      startDate: {
        type: Date,
        required: true
      },
      endDate: {
        type: Date,
        required: true
      },
      estimatedDuration: {
        type: Number,
        min: 1
      },
      isFlexible: {
        type: Boolean,
        default: false
      }
    },
    required: true
  },
  // How often this action should be revisited after completion
  repeatCycle: {
    type: String,
    enum: ['monthly', 'quarterly', 'yearly', 'no_repeat'],
    default: 'no_repeat',
    required: true
  },
  notes: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['not_started', 'in_progress', 'completed', 'on_hold', 'cancelled'],
    default: 'not_started',
    required: true
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  dependencies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StakeholderAction'
  }],
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  milestones: [{
    date: { type: Date, required: true },
    description: { type: String, required: true },
    completed: {
      type: Boolean,
      default: false
    }
  }],
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  archived: {
    type: Boolean,
    default: false
  },
  archivedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

// Compound uniqueness: same action text cannot appear twice for the
// same project / site / stakeholder combination
stakeholderActionSchema.index(
  {
    project: 1,
    projectSite: 1,
    stakeholderGroup: 1,
    action: 1
  },
  { unique: true, sparse: true }
);

// 1. Ensure endDate is strictly after startDate
stakeholderActionSchema.pre<IStakeholderAction>('save', function (next) {
  if (this.timeframe?.startDate && this.timeframe?.endDate) {
    if (this.timeframe.endDate <= this.timeframe.startDate) {
      return next(new Error('End date must be after start date'));
    }
  }
  next();
});

// 2. Ensure every selected subTheme belongs to one of the selected themes
stakeholderActionSchema.pre<IStakeholderAction>('save', async function (next) {
  if (this.isModified('themes') || this.isModified('subThemes')) {
    const SubTheme = mongoose.model('SubTheme');
    const subThemes = await SubTheme.find({
      _id: { $in: this.subThemes }
    }).populate('theme');

    const selectedThemeIds = this.themes.map(id => id.toString());

    const invalidSubThemes = subThemes.filter(subTheme => {
      if (!subTheme.theme || !(subTheme.theme as any)._id) return true;
      return !selectedThemeIds.includes((subTheme.theme as any)._id.toString());
    });

    if (invalidSubThemes.length > 0) {
      return next(
        new Error(
          `SubThemes [${invalidSubThemes.map(st => st.name).join(', ')}] do not belong to selected themes`
        )
      );
    }
  }
  next();
});

// 3. Auto-sync progress → status so they stay consistent
stakeholderActionSchema.pre<IStakeholderAction>('save', function (next) {
  if (this.isModified('progress')) {
    if (this.progress === 100 && this.status !== 'completed') {
      this.status = 'completed';
    } else if (this.progress > 0 && this.progress < 100 && this.status === 'not_started') {
      this.status = 'in_progress';
    }
  }
  next();
});

const StakeholderAction = mongoose.model<IStakeholderAction>('StakeholderAction', stakeholderActionSchema);

export default StakeholderAction;
export { IStakeholderAction };