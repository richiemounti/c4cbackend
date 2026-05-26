// models/consentForm.model.ts - ENHANCED VERSION
import mongoose from "mongoose";

const consentFormSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Consent form name is required'],
    trim: true,
    maxLength: 200
  },
  description: {
    type: String,
    required: [true, 'Consent form description/text is required'],
    trim: true,
    maxLength: 5000
  },
  // ADD THIS: The checkbox agreement text
  agreementLabel: {
    type: String,
    required: true,
    default: 'I have read and agree to the above terms',
    trim: true,
    maxLength: 200
  },
  // Version tracking for legal compliance
  version: {
    type: String,
    default: '1.0',
    trim: true
  },
  // ADD THIS: Version history for audit trail
  versionHistory: [{
    version: String,
    description: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    updatedAt: Date
  }],
  // Scope - can be org-wide, project-specific, or global template
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    index: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    index: true
  },
  // Status
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  // Template settings
  isTemplate: {
    type: Boolean,
    default: false,
    index: true
  },
  templateCategory: {
    type: String,
    enum: ['community_engagement', 'data_collection', 'environmental_study', 'carbon_project', 'gdpr_compliance', 'custom'],
    required: function(this: any) {
      return this.isTemplate;
    }
  },
  // Multi-language support
  defaultLanguage: {
    type: String,
    default: 'en',
    trim: true,
    lowercase: true,
    minLength: 2,
    maxLength: 10
  },
  translations: [{
    language: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    // ADD THIS: Translated agreement label
    agreementLabel: {
      type: String,
      required: true,
      trim: true
    }
  }],
  // ADD THIS: Usage tracking
  usageCount: {
    type: Number,
    default: 0
  },
  lastUsedAt: {
    type: Date
  },
  // Metadata
  creator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastUpdatedBy: {
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
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
consentFormSchema.index({ organization: 1, isActive: 1 });
consentFormSchema.index({ project: 1, isActive: 1 });
consentFormSchema.index({ isTemplate: 1, isActive: 1 });
consentFormSchema.index({ name: 'text', description: 'text' }); // For search

// Virtual for surveys using this consent form
consentFormSchema.virtual('surveys', {
  ref: 'Survey',
  localField: '_id',
  foreignField: 'consentForm'
});

// Virtual for display name with version
consentFormSchema.virtual('displayName').get(function() {
  return `${this.name} (v${this.version})`;
});

// Pre-save middleware to handle versioning
consentFormSchema.pre('save', function(next) {
  if (this.isModified('description') && !this.isNew) {
    // Store old version in history
    this.versionHistory.push({
      version: this.version,
      description: `Version ${this.version}`,
      updatedBy: this.lastUpdatedBy,
      updatedAt: new Date()
    });
    
    // Increment version when description changes
    const [major, minor] = this.version.split('.').map(Number);
    this.version = `${major}.${minor + 1}`;
  }
  next();
});

// Method to record usage
consentFormSchema.methods.recordUsage = async function() {
  this.usageCount += 1;
  this.lastUsedAt = new Date();
  await this.save();
};

// Static method to get active consent forms for a project
consentFormSchema.statics.getActiveForProject = async function(
  projectId: string,
  organizationId?: string
) {
  const query: any = {
    isActive: true,
    archived: { $ne: true },
    $or: [
      { project: projectId },
      { organization: organizationId, project: null },
      { isTemplate: true, organization: null, project: null }
    ]
  };
  
  return this.find(query)
    .populate('creator', 'name email')
    .populate('project', 'name')
    .populate('organization', 'name')
    .sort({ isTemplate: -1, name: 1 });
};

const ConsentForm = mongoose.model('ConsentForm', consentFormSchema);

export default ConsentForm;