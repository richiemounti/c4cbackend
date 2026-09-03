// Project Site Model
import mongoose from "mongoose";

const projectSiteSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: [true, 'Site name is required'],
    trim: true,
    minLength: 2,
    maxLength: 100,
  },
  description: {
    type: String,
    required: [true, 'Site description is required'],
    trim: true,
    maxLength: 1000,
  },
  location: {
    type: String,
    required: [true, 'Site location is required'],
    trim: true
  },
  coordinates: {
    lat: {
      type: Number,
      default: null
    },
    lng: {
      type: Number,
      default: null
    }
  },
  // Site status
  status: {
    type: String,
    enum: ['planning', 'active', 'completed', 'on-hold'],
    default: 'planning'
  },
  // Site contacts - similar to project contacts but specific to the site
  contacts: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    role: {
      type: String,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true
    },
    notes: {
      type: String,
      trim: true
    }
  }],
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    default: null
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  archived: {
    type: Boolean,
    default: false
  },
  archivedAt: {
    type: Date,
    default: null
  }
}, {timestamps: true});

// Create a compound index for project and site name to avoid duplicate sites
projectSiteSchema.index({ project: 1, name: 1 }, { unique: true });

const ProjectSite = mongoose.model('ProjectSite', projectSiteSchema);

export default ProjectSite;