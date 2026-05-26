// models/stakeholderReport.model.ts
import mongoose from "mongoose";

const stakeholderReportSchema = new mongoose.Schema({
  // Reference to the project
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true
  },
  // Optional reference to a specific project site
  projectSite: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProjectSite',
    index: true
  },
  // Report title
  title: {
    type: String,
    required: true,
    trim: true
  },
  // Report description
  description: {
    type: String,
    trim: true
  },
  // Snapshot of stakeholder data at report generation time
  stakeholderData: [{
    stakeholderGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StakeholderGroup'
    },
    name: String,
    category: String,
    tasks: [{
      taskType: String,
      responses: [{
        option: String,
        description: String
      }],
      rating: Number
    }]
  }],
  // Filter settings used for this report
  filters: {
    categories: [String],
    connectionStrength: {
      min: Number,
      max: Number
    },
    risks: [String],
    includeArchived: Boolean
  },
  // Report status
  status: {
    type: String,
    enum: ['draft', 'approved', 'archived'],
    default: 'draft'
  },
  // User tracking
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
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

const StakeholderReport = mongoose.model('StakeholderReport', stakeholderReportSchema);

export default StakeholderReport;