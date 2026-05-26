// models/projectSiteSetupTask.model.ts
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
  isCompleted: boolean;
  completedAt?: Date;
  completedBy?: mongoose.Types.ObjectId;
  // New field to store the user's response data
  responseData?: any;
  createdAt?: Date;
  updatedAt?: Date;
}


interface IProjectSiteSetup {
  projectSite: mongoose.Types.ObjectId;
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


interface IProjectSiteSetupDocument extends mongoose.Document, IProjectSiteSetup {}

// Define the schema for project site setup task
const projectSiteSetupTaskSchema = new mongoose.Schema({
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
    default: 2 // Default to step 2 as these are site tasks
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


// Define the schema for project site setup progress
const projectSiteSetupSchema = new mongoose.Schema({
  projectSite: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProjectSite',
    required: true,
    unique: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true
  },
  tasks: [projectSiteSetupTaskSchema],
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


// Add methods to calculate progress for project site setup
projectSiteSetupSchema.methods.calculateProgress = function(this: IProjectSiteSetupDocument): number {
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


projectSiteSetupSchema.pre('save', function(next) {
  // First cast to unknown, then to our interface to satisfy TypeScript
  const doc = this as unknown as IProjectSiteSetupDocument;
  doc.calculateProgress();
  next();
});


const ProjectSiteSetup = mongoose.model('ProjectSiteSetup', projectSiteSetupSchema);


export default ProjectSiteSetup;