// models/projectSetupTask.model.ts
import mongoose from "mongoose";

// Define interfaces for our documents
interface ISetupTask {
  fieldName: string;
  dataType: string;
  description?: string;
  userFacingCopy?: string;
  options?: [string];
  fieldLabel: string;
  helperText: string;
  hoverText: string;
  isRequired: boolean;
  sortOrder: number;
  step: number;
  stepNumber?: number;
  stepLabel?: string;
  conditionalOn?: { fieldName: string; value: any };
  isCompleted: boolean;
  completedAt?: Date;
  completedBy?: mongoose.Types.ObjectId;
  responseData?: any;
  createdAt?: Date;
  updatedAt?: Date;
}

interface IProjectSetup {
  project: mongoose.Types.ObjectId;
  tasks: mongoose.Types.DocumentArray<ISetupTask>;
  progress: number;
  isComplete: boolean;
  completedAt?: Date;
  lastUpdatedBy?: mongoose.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
  calculateProgress(): number;
}

// Create a type for the mongoose document with our interface
interface IProjectSetupDocument extends mongoose.Document, IProjectSetup {}

// Define the schema for a single setup task
const projectSetupTaskSchema = new mongoose.Schema({
  fieldName: {
    type: String,
    required: true,
    trim: true
  },
  dataType: {
    type: String,
    required: true,
    trim: true,
    enum: ['string', 'number', 'date', 'boolean', 'array', 'object', 'file']
  },
  description: {
    type: String,
    trim: true
  },
  userFacingCopy: {
    type: String,
    trim: true
  },
  options: {
    type: [String],
    default: undefined
  },
  fieldLabel: {
    type: String,
    trim: true
  },
  helperText: {
    type: String,
    trim: true
  },
  hoverText: {
    type: String,
    trim: true
  },
  isRequired: {
    type: Boolean,
    default: false
  },
  sortOrder: {
    type: Number,
    required: true
  },
  step: {
    type: Number,
    required: true,
    default: 1
  },
  stepNumber: {
    type: Number,
    default: null
  },
  stepLabel: {
    type: String,
    default: null
  },
  conditionalOn: {
    fieldName: { type: String },
    value: { type: mongoose.Schema.Types.Mixed }
  },
  isCompleted: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date,
    default: null
  },
  completedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // New field to store the user's response data
  responseData: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
}, { timestamps: true });

// Define the schema for project setup progress
const projectSetupSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    unique: true
  },
  tasks: [projectSetupTaskSchema],
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  isComplete: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date,
    default: null
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, { timestamps: true });

// Add methods to calculate progress for project setup
projectSetupSchema.methods.calculateProgress = function(this: IProjectSetupDocument): number {
  if (!this.tasks || this.tasks.length === 0) return 0;
  
  const requiredTasks = this.tasks.filter((task: any) => task.isRequired);
  const completedRequiredTasks = requiredTasks.filter((task: any) => task.isCompleted);
  
  // If there are no required tasks, calculate based on all tasks
  if (requiredTasks.length === 0) {
    const completedTasks = this.tasks.filter((task: any) => task.isCompleted);
    this.progress = Math.round((completedTasks.length / this.tasks.length) * 100);
  } else {
    this.progress = Math.round((completedRequiredTasks.length / requiredTasks.length) * 100);
  }
  
  this.isComplete = this.progress === 100;
  if (this.isComplete && !this.completedAt) {
    this.completedAt = new Date();
  }
  
  return this.progress;
};

// Pre-save hooks to calculate progress before saving (with proper typing)
projectSetupSchema.pre('save', function(next) {
  // First cast to unknown, then to our interface to satisfy TypeScript
  const doc = this as unknown as IProjectSetupDocument;
  doc.calculateProgress();
  next();
});

const ProjectSetup = mongoose.model<IProjectSetupDocument>('ProjectSetup', projectSetupSchema);

export default ProjectSetup;