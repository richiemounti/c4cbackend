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
// models/survey.model.ts - Enhanced Version
const mongoose_1 = __importDefault(require("mongoose"));
const surveySchema = new mongoose_1.default.Schema({
    title: {
        type: String,
        required: [true, 'Survey title is required'],
        trim: true,
        maxLength: 200
    },
    description: {
        type: String,
        trim: true,
        maxLength: 1000
    },
    project: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
        index: true
    },
    // ENHANCED: Optional project site association
    projectSite: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'ProjectSite',
        index: true
    },
    // NEW: Theory of Change stage association
    theoryOfChangeStage: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'TheoryOfChangeStage',
        required: true,
        index: true
    },
    // NEW: Stakeholder group association
    stakeholderGroup: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'StakeholderGroup',
        required: true,
        index: true
    },
    // Consent form association
    consentForm: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'ConsentForm',
        index: true
    },
    // Survey-level override to make consent optional/required
    consentRequired: {
        type: Boolean,
        default: true
    },
    // NEW: Survey categorization for multiple surveys per stakeholder
    category: {
        type: String,
        enum: ['baseline', 'monitoring', 'evaluation', 'impact_assessment', 'feedback', 'custom'],
        default: 'custom',
        index: true
    },
    // NEW: Custom category name when category is 'custom'
    customCategoryName: {
        type: String,
        trim: true,
        maxLength: 100,
        required: function () {
            return this.category === 'custom';
        }
    },
    // NEW: Survey sequence number for same stakeholder group (auto-generated)
    sequenceNumber: {
        type: Number,
        default: 1,
        index: true
    },
    // NEW: Translation fields
    defaultLanguage: {
        type: String,
        default: 'en',
        trim: true,
        lowercase: true,
        minLength: 2,
        maxLength: 10
    },
    translations: [{
            type: mongoose_1.default.Schema.Types.ObjectId,
            ref: 'SurveyTranslation'
        }],
    availableLanguages: [{
            type: String,
            trim: true,
            lowercase: true
        }],
    status: {
        type: String,
        enum: ['draft', 'published', 'closed', 'archived'],
        default: 'draft',
        index: true
    },
    settings: {
        // Access settings
        isPublic: {
            type: Boolean,
            default: false
        },
        requiresAuth: {
            type: Boolean,
            default: true
        },
        allowAnonymous: {
            type: Boolean,
            default: false
        },
        // Date restrictions
        startDate: Date,
        endDate: Date,
        // Response settings
        allowMultipleResponses: {
            type: Boolean,
            default: false
        },
        maxResponses: Number,
        // Display settings
        showProgressBar: {
            type: Boolean,
            default: true
        },
        allowSaveAndContinue: {
            type: Boolean,
            default: true
        },
        randomizeQuestions: {
            type: Boolean,
            default: false
        },
        // Notification settings
        sendConfirmationEmail: {
            type: Boolean,
            default: false
        },
        notifyOnResponse: {
            type: Boolean,
            default: false
        },
        // Sampling calculation settings
        samplingCalculator: {
            populationSize: Number,
            confidenceLevel: {
                type: Number,
                default: 95
            },
            marginOfError: {
                type: Number,
                default: 5
            },
            recommendedSampleSize: Number,
            calculatedAt: Date,
            isEnabled: {
                type: Boolean,
                default: false
            }
        }
    },
    // Template settings
    isTemplate: {
        type: Boolean,
        default: false
    },
    templateCategory: {
        type: String,
        enum: ['organizational', 'community', 'environmental', 'social', 'economic'],
        required: function () {
            return this.isTemplate;
        }
    },
    // Metadata
    estimatedDuration: {
        type: Number, // in minutes
        default: 10
    },
    totalQuestions: {
        type: Number,
        default: 0
    },
    // User tracking
    creator: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    lastUpdatedBy: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User'
    },
    // Historical sample size calculations (up to 5, newest first)
    samplingCalculations: [{
            populationSize: { type: Number, required: true },
            confidenceLevel: { type: Number, required: true },
            marginOfError: { type: Number, required: true },
            recommendedSampleSize: { type: Number, required: true },
            calculatedAt: { type: Date, required: true }
        }],
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
// Add index for language queries
surveySchema.index({ availableLanguages: 1 });
// ENHANCED: Compound index for uniqueness per stakeholder group
surveySchema.index({
    project: 1,
    projectSite: 1,
    stakeholderGroup: 1,
    title: 1
}, {
    unique: true,
    sparse: true
});
// Index for filtering surveys by stage and stakeholder
surveySchema.index({
    theoryOfChangeStage: 1,
    stakeholderGroup: 1,
    status: 1
});
// Index for survey categorization
surveySchema.index({
    stakeholderGroup: 1,
    category: 1,
    sequenceNumber: 1
});
// Pre-save middleware to auto-increment sequence number
surveySchema.pre('save', function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (this.isNew) {
            // Find the highest sequence number for this stakeholder group
            const lastSurvey = yield mongoose_1.default.model('Survey')
                .findOne({
                stakeholderGroup: this.stakeholderGroup,
                project: this.project,
                projectSite: this.projectSite || null
            })
                .sort({ sequenceNumber: -1 });
            this.sequenceNumber = lastSurvey ? lastSurvey.sequenceNumber + 1 : 1;
        }
        next();
    });
});
const Survey = mongoose_1.default.model('Survey', surveySchema);
exports.default = Survey;
//# sourceMappingURL=survey.model.js.map