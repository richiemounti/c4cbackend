// models/stakeholderTaskOption.model.ts
import mongoose from "mongoose";

// This model stores the predefined options for each task type and category
const stakeholderTaskOptionSchema = new mongoose.Schema({
  // The category this option belongs to (e.g., "Government")
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true,
    index: true
  },
  // The task type this option belongs to (e.g., "connections")
  taskType: {
    type: String,
    required: true,
    enum: ['connections', 'power', 'wellbeing', 'roles', 'risks', 'benefits'],
    index: true
  },
  // Unique identifier for this option
  optionId: {
    type: String,
    required: true
  },
  // Display text for this option
  label: {
    type: String,
    required: true
  },
  // Whether this option requires a description
  requiresDescription: {
    type: Boolean,
    default: false
  },
  // Order of this option in the list
  order: {
    type: Number,
    default: 0
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

// Create a compound index to ensure uniqueness of options
stakeholderTaskOptionSchema.index(
  { category: 1, taskType: 1, optionId: 1 }, 
  { unique: true }
);

const StakeholderTaskOption = mongoose.model('StakeholderTaskOption', stakeholderTaskOptionSchema);

export default StakeholderTaskOption;