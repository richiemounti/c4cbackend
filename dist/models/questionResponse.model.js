"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// models/questionResponse.model.ts
const mongoose_1 = __importDefault(require("mongoose"));
const questionResponseSchema = new mongoose_1.default.Schema({
    surveyResponse: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'SurveyResponse',
        required: true,
        index: true,
    },
    surveyQuestion: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'SurveyQuestion',
        required: true,
        index: true,
    },
    answer: {
        type: mongoose_1.default.Schema.Types.Mixed,
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
const QuestionResponse = mongoose_1.default.model('QuestionResponse', questionResponseSchema);
exports.default = QuestionResponse;
//# sourceMappingURL=questionResponse.model.js.map