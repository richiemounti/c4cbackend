// models/document.model.ts
import mongoose from "mongoose";

// Define the document types as an enum
const DOCUMENT_TYPES = [
  'certification', 
  'mou',          // Memorandum of Understanding
  'fpic',         // Free Prior and Informed Consent
  'shapefile',    
  'report',
  'contract',
  'agreement',
  'map',
  'survey',
  'financial',
  'legal',
  'image',
  'video',
  'presentation',
  'other'
] as const;

// Create the schema
const documentSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true,
  },
  site: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProjectSite',
    default: null,
    index: true,
  },
  documentType: {
    type: String,
    enum: DOCUMENT_TYPES,
    required: [true, 'Document type is required']
  },
  fileName: {
    type: String,
    required: [true, 'File name is required'],
    trim: true
  },
  filePath: {
    type: String,
    required: [true, 'File path is required']
  },
  fileSize: {
    type: Number,
    required: [true, 'File size is required']
  },
  mimeType: {
    type: String,
    required: [true, 'MIME type is required']
  },
  description: {
    type: String,
    trim: true,
    maxLength: 1000
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  // Custom properties if needed for different document types
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Document versioning support
  version: {
    type: Number,
    default: 1
  },
  previousVersions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document'
  }],
  archived: {
    type: Boolean,
    default: false
  },
  archivedAt: {
    type: Date,
    default: null
  }
}, {timestamps: true});

// Create compound indexes for efficient queries
documentSchema.index({ project: 1, documentType: 1 });
documentSchema.index({ site: 1, documentType: 1 });

// Ensure upload_date is handled via the timestamps feature (createdAt)
// The UUID requirements are handled by MongoDB's ObjectId

const Document = mongoose.model('Document', documentSchema);

export default Document;