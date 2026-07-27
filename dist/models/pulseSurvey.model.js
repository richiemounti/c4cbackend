"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// models/pulseSurvey.model.ts
const mongoose_1 = __importDefault(require("mongoose"));
// Define the question schema for pulse surveys
const pulseQuestionSchema = new mongoose_1.default.Schema({
    questionText: {
        type: String,
        required: true,
        trim: true
    },
    questionType: {
        type: String,
        enum: ['rating', 'text', 'multiple_choice', 'yes_no'],
        required: true
    },
    // For rating questions
    ratingScale: {
        min: {
            type: Number,
            default: 1
        },
        max: {
            type: Number,
            default: 5
        },
        labels: {
            low: String, // e.g., "Very Dissatisfied"
            high: String // e.g., "Very Satisfied"
        }
    },
    // For multiple choice questions
    options: [{
            value: String,
            label: String
        }],
    isRequired: {
        type: Boolean,
        default: true
    },
    order: {
        type: Number,
        required: true
    }
}, { _id: true });
const pulseSurveySchema = new mongoose_1.default.Schema({
    // Which module this pulse survey is for
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
        unique: true,
        index: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    questions: [pulseQuestionSchema],
    // Settings
    isActive: {
        type: Boolean,
        default: true
    },
    showToAllUsers: {
        type: Boolean,
        default: true // Show to all users or only specific roles
    },
    // Metadata
    creator: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    lastUpdatedBy: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User'
    },
    archived: {
        type: Boolean,
        default: false
    },
    archivedAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });
// Virtual for total questions count
pulseSurveySchema.virtual('totalQuestions').get(function () {
    return this.questions ? this.questions.length : 0;
});
const PulseSurvey = mongoose_1.default.model('PulseSurvey', pulseSurveySchema);
exports.default = PulseSurvey;
//# sourceMappingURL=pulseSurvey.model.js.map