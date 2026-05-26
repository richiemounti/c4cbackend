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
    trim: true,
    maxLength: 1000,
  },
  // Location information
  address: {
    type: String,
    trim: true,
  },
  region: {
    type: String,
    trim: true,
  },
  city: {
    type: String,
    trim: true,
  },
  country: {
    type: String,
    trim: true,
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
  // Site-specific information
  size: {
    type: Number, // in hectares or square kilometers
    default: null
  },
  sizeUnit: {
    type: String,
    enum: ['hectares', 'sqkm', 'acres', 'sqmi'],
    default: 'hectares'
  },
  siteType: {
    type: String,
    enum: ['forest', 'wetland', 'grassland', 'coastal', 'agricultural', 'urban', 'other'],
    default: 'other'
  },
  // Site status
  status: {
    type: String,
    enum: ['active', 'inactive', 'planned'],
    default: 'active'
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
  // Additional site-specific details
  notes: {
    type: String,
    trim: true,
    maxLength: 2000,
  },
  // Site visit history or any important dates
  startDate: {
    type: Date,
    default: null
  },
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
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