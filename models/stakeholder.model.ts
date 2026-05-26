import mongoose from "mongoose";

// Schema for a stakeholder connection or other attribute
const stakeholderAttributeSchema = new mongoose.Schema({
  attributeType: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ""
  }
});

// Schema for a task rating
const taskRatingSchema = new mongoose.Schema({
  taskType: {
    type: String,
    required: true,
    enum: ['connections', 'power', 'wellbeing', 'roles', 'risks', 'benefits']
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 10
  }
});

// Schema for a stakeholder assessment task
const stakeholderTaskSchema = new mongoose.Schema({
  taskType: {
    type: String,
    required: true,
    enum: ['connections', 'power', 'wellbeing', 'roles', 'risks', 'benefits']
  },
  attributes: [stakeholderAttributeSchema],
  rating: {
    type: Number,
    min: 1,
    max: 10
  }
});

// Interface for Stakeholder Document
interface IStakeholder extends mongoose.Document {
  project: mongoose.Types.ObjectId;
  category: string;
  name: string;
  connections: Array<{ attributeType: string; description: string }>;
  connectionStrength: number;
  tasks: Array<{
    taskType: string;
    attributes: Array<{ attributeType: string; description: string }>;
    rating?: number;
  }>;
  creator: mongoose.Types.ObjectId;
  lastUpdatedBy?: mongoose.Types.ObjectId;
  completionStatus: 'not_started' | 'in_progress' | 'completed';
  createdAt: Date;
  updatedAt: Date;
  checkCompletion(): boolean;
}

const stakeholderSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true
  },
  category: {
    type: String,
    enum: ['Government', 'Communities affected by the project', 'Marginalized groups', 'Partner Agencies', 'Our Organisation'],
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  // The connection task (original)
  connections: [stakeholderAttributeSchema],
  connectionStrength: {
    type: Number,
    min: 1,
    max: 10
  },
  // Additional tasks
  tasks: [stakeholderTaskSchema],
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  completionStatus: {
    type: String,
    enum: ['not_started', 'in_progress', 'completed'],
    default: 'not_started'
  }
}, {timestamps: true});

// Create a compound index for project + category + name to ensure uniqueness
stakeholderSchema.index({ project: 1, category: 1, name: 1 }, { unique: true });

// Method to check if all required tasks are completed
stakeholderSchema.methods.checkCompletion = function(): boolean {
  // Define required task types
  const requiredTaskTypes = ['connections', 'power', 'wellbeing', 'roles', 'risks', 'benefits'];
  
  // Check the connection task (original format)
  const hasConnections = this.connections && this.connections.length > 0 && this.connectionStrength;
  
  // Check other tasks
  const completedTaskTypes = this.tasks.map((task: any) => task.taskType);
  
  // Remove 'connections' from required if it's handled separately
  const remainingRequired = requiredTaskTypes.filter(type => type !== 'connections');
  
  // Check if all remaining required tasks are completed
  const allTasksComplete = remainingRequired.every(type => 
    completedTaskTypes.includes(type) && 
    this.tasks.find((t: any) => t.taskType === type)?.attributes?.length > 0
  );
  
  return hasConnections && allTasksComplete;
};

// Update completion status before saving
stakeholderSchema.pre('save', function(this: IStakeholder, next) {
  if (this.checkCompletion()) {
    this.completionStatus = 'completed';
  } else if (this.connections && this.connections.length > 0) {
    this.completionStatus = 'in_progress';
  }
  next();
});

const Stakeholder = mongoose.model<IStakeholder>('Stakeholder', stakeholderSchema);

export default Stakeholder;