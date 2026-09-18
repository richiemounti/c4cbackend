// models/sniAlterQuestionResponse.model.ts
// Unified answer table for BOTH alter_attribute and tie_quality questions —
// one row per {alter, question, wave}. Deliberately not split into two tables:
// the only difference between the two roles is whether the question is
// section-scoped (tie_quality) or survey-scoped (alter_attribute), which is
// already recorded on SniQuestion itself. Splitting them would hardcode
// "exactly N dimensions per sub-theme" into the schema — the brief repeatedly
// warns against assuming anything Networks-of-Care-specific ("nothing about
// this theme's sub-themes... should be hardcoded" — §12).
//
// Export logic (brief §11) groups these rows by question.questionRole /
// question.section at read time to build the alter table and the pivoted tie
// table (tie_others / tie_self / tie_environment columns) — no fixed-shape
// assumption baked into storage.
import mongoose from "mongoose";

interface ISniAlterQuestionResponse extends mongoose.Document {
    alter: mongoose.Types.ObjectId;
    question: mongoose.Types.ObjectId;
    surveyResponse: mongoose.Types.ObjectId;
    wave: number;
    answer: any;
    createdAt: Date;
    updatedAt: Date;
}

const sniAlterQuestionResponseSchema = new mongoose.Schema({
    alter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SniAlter',
        required: true,
        index: true,
    },
    question: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SniQuestion',
        required: true,
        index: true,
    },
    surveyResponse: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SniSurveyResponse',
        required: true,
        index: true,
    },
    wave: {
        type: Number,
        required: true,
        min: 1,
    },
    answer: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
    },
}, { timestamps: true });

sniAlterQuestionResponseSchema.index({ alter: 1, question: 1, wave: 1 }, { unique: true });

const SniAlterQuestionResponse = mongoose.model<ISniAlterQuestionResponse>('SniAlterQuestionResponse', sniAlterQuestionResponseSchema);

export default SniAlterQuestionResponse;
