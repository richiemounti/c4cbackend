// models/surveyTranslation.model.ts
import mongoose from "mongoose";

// Interface for translated section
interface ITranslatedSection {
  section: mongoose.Types.ObjectId;
  title: string;
  description?: string;
}

// Interface for translated question
interface ITranslatedQuestion {
  surveyQuestion: mongoose.Types.ObjectId;
  translatedText: string;
  translatedDescription?: string;
  translatedOptions?: Array<{ value: string; label: string }>;
}

// Interface for the SurveyTranslation document
interface ISurveyTranslation extends mongoose.Document {
  survey: mongoose.Types.ObjectId;
  language: string;
  languageName: string;
  title: string;
  description?: string;
  translatedSections: ITranslatedSection[];
  translatedQuestions: ITranslatedQuestion[];
  translator?: mongoose.Types.ObjectId;
  translationMethod: 'human' | 'machine' | 'hybrid';
  status: 'draft' | 'pending_review' | 'approved' | 'published';
  completionPercentage: number;
  reviewer?: mongoose.Types.ObjectId;
  reviewedAt?: Date;
  publishedAt?: Date;
  notes?: string;
  archived: boolean;
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Interface for instance methods
interface ISurveyTranslationMethods {
  calculateCompletionPercentage(): Promise<number>;
  markAsComplete(): Promise<void>;
  approve(reviewerId: mongoose.Types.ObjectId): Promise<void>;
  publish(): Promise<void>;
}

// Combined interface for the document
interface ISurveyTranslationDocument extends ISurveyTranslation, ISurveyTranslationMethods {}

// Schema for translated section
const translatedSectionSchema = new mongoose.Schema({
  section: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SurveySection',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxLength: 200
  },
  description: {
    type: String,
    trim: true,
    maxLength: 1000
  }
}, { _id: false });

// Schema for translated question
const translatedQuestionSchema = new mongoose.Schema({
  surveyQuestion: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SurveyQuestion',
    required: true,
    index: true
  },
  translatedText: {
    type: String,
    required: true,
    trim: true
  },
  translatedDescription: {
    type: String,
    trim: true
  },
  translatedOptions: [{
    value: {
      type: String,
      required: true
    },
    label: {
      type: String,
      required: true
    }
  }]
}, { _id: false });

// Main translation schema
const surveyTranslationSchema = new mongoose.Schema({
  survey: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Survey',
    required: true,
    index: true
  },
  language: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    minLength: 2,
    maxLength: 10,
    index: true,
    // ISO 639-1 language codes (2 letter) or ISO 639-2 (3 letter)
    match: /^[a-z]{2,3}(-[A-Z]{2})?$/
  },
  languageName: {
    type: String,
    required: true,
    trim: true,
    maxLength: 100
    // e.g., "English", "Swahili", "French", "Kinyarwanda"
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxLength: 200
  },
  description: {
    type: String,
    trim: true,
    maxLength: 1000
  },
  translatedSections: [translatedSectionSchema],
  translatedQuestions: [translatedQuestionSchema],
  translator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  translationMethod: {
    type: String,
    enum: ['human', 'machine', 'hybrid'],
    default: 'human'
  },
  status: {
    type: String,
    enum: ['draft', 'pending_review', 'approved', 'published'],
    default: 'draft',
    index: true
  },
  completionPercentage: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  reviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: Date,
  publishedAt: Date,
  notes: {
    type: String,
    trim: true,
    maxLength: 2000
  },
  archived: {
    type: Boolean,
    default: false
  },
  archivedAt: Date
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Compound indexes
surveyTranslationSchema.index({ survey: 1, language: 1 }, { unique: true });
surveyTranslationSchema.index({ survey: 1, status: 1 });
surveyTranslationSchema.index({ translator: 1, status: 1 });

// Virtual for checking if translation is complete
surveyTranslationSchema.virtual('isComplete').get(function(this: ISurveyTranslationDocument) {
  return this.completionPercentage === 100;
});

// Pre-save middleware to calculate completion percentage
surveyTranslationSchema.pre('save', async function(this: ISurveyTranslationDocument, next) {
  if (this.isModified('translatedQuestions') || this.isModified('translatedSections')) {
    try {
      this.completionPercentage = await this.calculateCompletionPercentage();
    } catch (error) {
      return next(error as Error);
    }
  }
  next();
});

// Instance method to calculate completion percentage
surveyTranslationSchema.methods.calculateCompletionPercentage = async function(this: ISurveyTranslationDocument): Promise<number> {
  try {
    // Get total number of questions and sections in the survey
    const SurveyQuestion = mongoose.model('SurveyQuestion');
    const SurveySection = mongoose.model('SurveySection');
    
    const [totalQuestions, totalSections] = await Promise.all([
      SurveyQuestion.countDocuments({ 
        survey: this.survey,
        archived: { $ne: true }
      }),
      SurveySection.countDocuments({ 
        survey: this.survey,
        archived: { $ne: true }
      })
    ]);
    
    const translatedQuestionsCount = this.translatedQuestions.length;
    const translatedSectionsCount = this.translatedSections.length;
    
    // Calculate percentage
    const totalItems = totalQuestions + totalSections;
    const translatedItems = translatedQuestionsCount + translatedSectionsCount;
    
    if (totalItems === 0) return 0;
    
    return Math.round((translatedItems / totalItems) * 100);
  } catch (error) {
    console.error('Error calculating completion percentage:', error);
    return 0;
  }
};

// Instance method to mark translation as complete
surveyTranslationSchema.methods.markAsComplete = async function(this: ISurveyTranslationDocument): Promise<void> {
  this.completionPercentage = await this.calculateCompletionPercentage();
  
  if (this.completionPercentage === 100 && this.status === 'draft') {
    this.status = 'pending_review';
  }
  
  await this.save();
};

// Instance method to approve translation
surveyTranslationSchema.methods.approve = async function(
  this: ISurveyTranslationDocument, 
  reviewerId: mongoose.Types.ObjectId
): Promise<void> {
  if (this.status !== 'pending_review') {
    throw new Error('Only translations pending review can be approved');
  }
  
  if (this.completionPercentage < 100) {
    throw new Error('Translation must be 100% complete before approval');
  }
  
  this.status = 'approved';
  this.reviewer = reviewerId;
  this.reviewedAt = new Date();
  
  await this.save();
};

// Instance method to publish translation
surveyTranslationSchema.methods.publish = async function(this: ISurveyTranslationDocument): Promise<void> {
  if (this.status !== 'approved') {
    throw new Error('Only approved translations can be published');
  }
  
  this.status = 'published';
  this.publishedAt = new Date();
  
  await this.save();
  
  // Update the parent survey's available languages
  const Survey = mongoose.model('Survey');
  const survey = await Survey.findById(this.survey);
  
  if (survey) {
    if (!survey.availableLanguages) {
      survey.availableLanguages = [];
    }
    
    if (!survey.availableLanguages.includes(this.language)) {
      survey.availableLanguages.push(this.language);
      await survey.save();
    }
  }
};

// Static method to get translations by survey
surveyTranslationSchema.statics.getTranslationsBySurvey = async function(
  surveyId: string,
  filters: {
    status?: string;
    language?: string;
  } = {}
) {
  const query: any = {
    survey: surveyId,
    archived: { $ne: true }
  };
  
  if (filters.status) {
    query.status = filters.status;
  }
  
  if (filters.language) {
    query.language = filters.language;
  }
  
  return this.find(query)
    .populate('translator', 'name email')
    .populate('reviewer', 'name email')
    .sort('-updatedAt');
};

// Static method to get published translations for a survey
surveyTranslationSchema.statics.getPublishedTranslations = async function(surveyId: string) {
  return this.find({
    survey: surveyId,
    status: 'published',
    archived: { $ne: true }
  })
    .populate('translator', 'name email')
    .sort('language');
};

const SurveyTranslation = mongoose.model<ISurveyTranslationDocument>('SurveyTranslation', surveyTranslationSchema);

export default SurveyTranslation;
export type { ISurveyTranslation, ISurveyTranslationDocument, ITranslatedQuestion, ITranslatedSection };