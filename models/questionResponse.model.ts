// models/questionResponse.model.ts
import mongoose from "mongoose";

const questionResponseSchema = new mongoose.Schema({
    surveyResponse: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SurveyResponse',
        required: true,
        index: true,
    },
    surveyQuestion: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SurveyQuestion',
        required: true,
        index: true,
    },
    answer: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    // Stores per-option descriptor text, keyed by option value
    // e.g. { "other": "I prefer walking", "disagree": "The process is too slow" }
    descriptorAnswers: {
        type: Map,
        of: String,
        default: undefined
    },
    metadata: {
        timeSpent: Number,
        attempts: Number,
        skipped: Boolean,
        skipReason: String
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

// Create a compound index for efficient querying
questionResponseSchema.index({ surveyResponse: 1, surveyQuestion: 1 }, { unique: true });

const QuestionResponse = mongoose.model('QuestionResponse', questionResponseSchema);

export default QuestionResponse;