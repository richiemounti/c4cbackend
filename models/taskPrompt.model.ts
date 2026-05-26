// models/taskPrompt.model.ts
import mongoose from "mongoose";

// This model stores the prompts/questions for each task type
const taskPromptSchema = new mongoose.Schema({
  // The task type this prompt is for
  taskType: {
    type: String,
    required: true,
    enum: ['connections', 'power', 'wellbeing', 'roles', 'risks', 'benefits'],
    index: true
  },
  // The prompt text (e.g., "How is this group connected to the project?")
  promptText: {
    type: String,
    required: true
  },
  // Optional tooltip or description text
  tooltipText: {
    type: String
  },
  // The prompt for the rating question
  ratingPrompt: {
    type: String,
    required: true
  },
  // Min value for rating
  ratingMin: {
    type: Number,
    default: 1
  },
  // Max value for rating
  ratingMax: {
    type: Number,
    default: 5
  },
  // Label for minimum rating
  ratingMinLabel: {
    type: String
  },
  // Label for maximum rating
  ratingMaxLabel: {
    type: String
  },
  // Optional additional guidance text
  guidance: {
    type: String
  },
  // User tracking
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Standard fields
  archived: {
    type: Boolean,
    default: false
  },
  archivedAt: {
    type: Date,
    default: null
  }
}, {timestamps: true});

// Create index to ensure uniqueness of task type
taskPromptSchema.index({ taskType: 1 }, { unique: true });

const TaskPrompt = mongoose.model('TaskPrompt', taskPromptSchema);

export default TaskPrompt;