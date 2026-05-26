// models/pulseSurveyResponse.model.ts
import mongoose from "mongoose";

// Schema for individual question responses
const questionResponseSchema = new mongoose.Schema({
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  questionText: {
    type: String,
    required: true
  },
  questionType: {
    type: String,
    enum: ['rating', 'text', 'multiple_choice', 'yes_no'],
    required: true
  },
  // Store the actual response based on question type
  ratingValue: Number,  // For rating questions
  textValue: String,    // For text questions
  selectedOption: String, // For multiple_choice and yes_no
  
  // Optional metadata
  skipped: {
    type: Boolean,
    default: false
  }
}, { _id: false });

const pulseSurveyResponseSchema = new mongoose.Schema({
  // Reference to the pulse survey template
  pulseSurvey: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PulseSurvey',
    required: true,
    index: true
  },
  
  // Module information
  moduleType: {
    type: String,
    required: true,
    enum: [
      'setup_project',
      'setup_site',
      'theory_of_change_stage_1',
      'theory_of_change_stage_2',
      'survey_creation',
      'survey_analysis'
    ],
    index: true
  },
  
  // Reference to the specific module instance completed
  moduleReference: {
    // Will be ProjectSetup._id, ProjectSiteSetup._id, TheoryOfChangeStage._id, etc.
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'moduleReferenceModel',
    required: true,
    index: true
  },
  moduleReferenceModel: {
    type: String,
    required: true,
    enum: ['ProjectSetup', 'ProjectSiteSetup', 'TheoryOfChangeStage', 'Survey']
  },
  
  // Context metadata
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true
  },
  projectSite: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProjectSite',
    index: true
  },
  
  // User who provided feedback
  respondent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // All responses for this pulse survey
  responses: [questionResponseSchema],
  
  // Overall metrics (calculated from responses)
  averageRating: {
    type: Number,
    min: 0,
    max: 5
  },
  
  // Additional feedback
  additionalComments: {
    type: String,
    trim: true,
    maxLength: 2000
  },
  
  // Response metadata
  completedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  timeToComplete: {
    type: Number  // in seconds
  },
  
  // Status tracking
  status: {
    type: String,
    enum: ['draft', 'submitted'],
    default: 'submitted',
    index: true
  },
  
  // IP and device info (for analytics, optional)
  metadata: {
    ipAddress: String,
    userAgent: String,
    deviceType: String
  }
}, { timestamps: true });

// Compound index to prevent duplicate responses for same module completion
pulseSurveyResponseSchema.index(
  { 
    moduleReference: 1, 
    respondent: 1 
  },
  { unique: true }
);

// Index for analytics queries
pulseSurveyResponseSchema.index({
  organization: 1,
  moduleType: 1,
  completedAt: -1
});

// Pre-save hook to calculate average rating
pulseSurveyResponseSchema.pre('save', function(next) {
  // Calculate average rating from all rating-type responses
  const ratingResponses = this.responses.filter(r => 
    r.questionType === 'rating' && r.ratingValue !== undefined
  );
  
  if (ratingResponses.length > 0) {
    const sum = ratingResponses.reduce((acc, r) => acc + (r.ratingValue || 0), 0);
    this.averageRating = sum / ratingResponses.length;
  }
  
  next();
});

const PulseSurveyResponse = mongoose.model('PulseSurveyResponse', pulseSurveyResponseSchema);

export default PulseSurveyResponse;