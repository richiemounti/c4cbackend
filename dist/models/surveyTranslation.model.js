"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// models/surveyTranslation.model.ts
const mongoose_1 = __importDefault(require("mongoose"));
// Schema for translated section
const translatedSectionSchema = new mongoose_1.default.Schema({
    section: {
        type: mongoose_1.default.Schema.Types.ObjectId,
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
const translatedQuestionSchema = new mongoose_1.default.Schema({
    surveyQuestion: {
        type: mongoose_1.default.Schema.Types.ObjectId,
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
const surveyTranslationSchema = new mongoose_1.default.Schema({
    survey: {
        type: mongoose_1.default.Schema.Types.ObjectId,
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
        type: mongoose_1.default.Schema.Types.ObjectId,
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
        type: mongoose_1.default.Schema.Types.ObjectId,
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
surveyTranslationSchema.virtual('isComplete').get(function () {
    return this.completionPercentage === 100;
});
// Pre-save middleware to calculate completion percentage
surveyTranslationSchema.pre('save', function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (this.isModified('translatedQuestions') || this.isModified('translatedSections')) {
            try {
                this.completionPercentage = yield this.calculateCompletionPercentage();
            }
            catch (error) {
                return next(error);
            }
        }
        next();
    });
});
// Instance method to calculate completion percentage
surveyTranslationSchema.methods.calculateCompletionPercentage = function () {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Get total number of questions and sections in the survey
            const SurveyQuestion = mongoose_1.default.model('SurveyQuestion');
            const SurveySection = mongoose_1.default.model('SurveySection');
            const [totalQuestions, totalSections] = yield Promise.all([
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
            if (totalItems === 0)
                return 0;
            return Math.round((translatedItems / totalItems) * 100);
        }
        catch (error) {
            console.error('Error calculating completion percentage:', error);
            return 0;
        }
    });
};
// Instance method to mark translation as complete
surveyTranslationSchema.methods.markAsComplete = function () {
    return __awaiter(this, void 0, void 0, function* () {
        this.completionPercentage = yield this.calculateCompletionPercentage();
        if (this.completionPercentage === 100 && this.status === 'draft') {
            this.status = 'pending_review';
        }
        yield this.save();
    });
};
// Instance method to approve translation
surveyTranslationSchema.methods.approve = function (reviewerId) {
    return __awaiter(this, void 0, void 0, function* () {
        if (this.status !== 'pending_review') {
            throw new Error('Only translations pending review can be approved');
        }
        if (this.completionPercentage < 100) {
            throw new Error('Translation must be 100% complete before approval');
        }
        this.status = 'approved';
        this.reviewer = reviewerId;
        this.reviewedAt = new Date();
        yield this.save();
    });
};
// Instance method to publish translation
surveyTranslationSchema.methods.publish = function () {
    return __awaiter(this, void 0, void 0, function* () {
        if (this.status !== 'approved') {
            throw new Error('Only approved translations can be published');
        }
        this.status = 'published';
        this.publishedAt = new Date();
        yield this.save();
        // Update the parent survey's available languages
        const Survey = mongoose_1.default.model('Survey');
        const survey = yield Survey.findById(this.survey);
        if (survey) {
            if (!survey.availableLanguages) {
                survey.availableLanguages = [];
            }
            if (!survey.availableLanguages.includes(this.language)) {
                survey.availableLanguages.push(this.language);
                yield survey.save();
            }
        }
    });
};
// Static method to get translations by survey
surveyTranslationSchema.statics.getTranslationsBySurvey = function (surveyId_1) {
    return __awaiter(this, arguments, void 0, function* (surveyId, filters = {}) {
        const query = {
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
    });
};
// Static method to get published translations for a survey
surveyTranslationSchema.statics.getPublishedTranslations = function (surveyId) {
    return __awaiter(this, void 0, void 0, function* () {
        return this.find({
            survey: surveyId,
            status: 'published',
            archived: { $ne: true }
        })
            .populate('translator', 'name email')
            .sort('language');
    });
};
const SurveyTranslation = mongoose_1.default.model('SurveyTranslation', surveyTranslationSchema);
exports.default = SurveyTranslation;
//# sourceMappingURL=surveyTranslation.model.js.map