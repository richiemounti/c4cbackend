// models/sniQuestionResponse.model.ts
// Ordinary (Kind B / questionRole 'standard') answers — same one-row-per-
// question shape as the existing platform's QuestionResponse. This is the
// table behind the SNI export's "ego table" (brief §11): demographic
// questions and sub-theme 4-6 responses all land here, one row per
// {surveyResponse, question}.
import mongoose from "mongoose";

interface ISniQuestionResponse extends mongoose.Document {
    surveyResponse: mongoose.Types.ObjectId;
    question: mongoose.Types.ObjectId;
    answer: any;
    descriptorAnswers?: Map<string, string>;
    metadata?: {
        timeSpent?: number;
        skipped?: boolean;
        skipReason?: string;
    };
    createdAt: Date;
    updatedAt: Date;
}

const sniQuestionResponseSchema = new mongoose.Schema({
    surveyResponse: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SniSurveyResponse',
        required: true,
        index: true,
    },
    question: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SniQuestion',
        required: true,
        index: true,
    },
    answer: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
    },
    descriptorAnswers: {
        type: Map,
        of: String,
        default: undefined,
    },
    metadata: {
        timeSpent: Number,
        skipped: { type: Boolean, default: false },
        skipReason: String,
    },
}, { timestamps: true });

sniQuestionResponseSchema.index({ surveyResponse: 1, question: 1 }, { unique: true });

const SniQuestionResponse = mongoose.model<ISniQuestionResponse>('SniQuestionResponse', sniQuestionResponseSchema);

export default SniQuestionResponse;
