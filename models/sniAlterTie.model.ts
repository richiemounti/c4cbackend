// models/sniAlterTie.model.ts
// The edge itself: "this alter is tied to this ego, via this sub-theme, as of
// this wave" — kept separate from the RWB-dimension answers (SniAlterQuestionResponse)
// because "alter named, tie-quality not yet answered" and "no one named" are
// both real states the export needs to represent (brief §11 tie table needs a
// generator_question_id column independent of any individual answer).
import mongoose from "mongoose";

interface ISniAlterTie extends mongoose.Document {
    alter: mongoose.Types.ObjectId;
    section: mongoose.Types.ObjectId;
    surveyResponse: mongoose.Types.ObjectId;
    wave: number; // denormalized from surveyResponse for query convenience
    generatorQuestion: mongoose.Types.ObjectId; // which name generator produced this tie
    createdAt: Date;
    updatedAt: Date;
}

const sniAlterTieSchema = new mongoose.Schema({
    alter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SniAlter',
        required: true,
        index: true,
    },
    section: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SniSection',
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
    generatorQuestion: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SniQuestion',
        required: true,
    },
}, { timestamps: true });

sniAlterTieSchema.index({ alter: 1, section: 1, wave: 1 }, { unique: true });

const SniAlterTie = mongoose.model<ISniAlterTie>('SniAlterTie', sniAlterTieSchema);

export default SniAlterTie;
