// models/sniSurvey.model.ts
// The Social Networks Instrument survey — a separate, paywalled instrument-built
// survey. Also serves as the "theme" container (per the SNI design brief's own
// naming: "Networks of Care" names both the survey and the top of its theme
// hierarchy — there is no separate SniTheme model).
import mongoose from "mongoose";

interface ISniSurveySettings {
    isPublic: boolean;
    requiresAuth: boolean;
    allowAnonymous: boolean;
    showProgressBar: boolean;
    allowSaveAndContinue: boolean;
}

interface ISniSurvey extends mongoose.Document {
    title: string;
    description?: string;
    isTemplate: boolean;
    templateSource?: mongoose.Types.ObjectId;
    project?: mongoose.Types.ObjectId; // required unless isTemplate
    status: 'draft' | 'pretest' | 'published' | 'closed' | 'archived';
    rosterCap: number;
    consentForm?: mongoose.Types.ObjectId;
    consentRequired: boolean;
    settings: ISniSurveySettings;
    creator: mongoose.Types.ObjectId;
    lastUpdatedBy?: mongoose.Types.ObjectId;
    archived: boolean;
    archivedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const sniSurveySchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Survey title is required'],
        trim: true,
        minLength: 2,
        maxLength: 200,
    },
    description: {
        type: String,
        trim: true,
        maxLength: 1000,
    },
    // Pre-built shapes (Networks of Care, Networks of Change Agents, ...) that
    // clients activate rather than compose. Activation clones the template's
    // SniSurvey + SniSection + SniQuestion tree into a project-scoped copy —
    // mirrors the existing Survey.cloneSurvey pattern.
    isTemplate: {
        type: Boolean,
        default: false,
        index: true,
    },
    templateSource: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SniSurvey',
        default: null,
    },
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: function (this: ISniSurvey) { return !this.isTemplate; },
        index: true,
    },
    status: {
        type: String,
        enum: ['draft', 'pretest', 'published', 'closed', 'archived'],
        default: 'draft',
    },
    // Configurable per survey, never hardcoded (brief §4.3 — the right number
    // is not finalized, and it must be tunable after pilot without a rebuild).
    rosterCap: {
        type: Number,
        required: true,
        min: 1,
        default: 5,
    },
    consentForm: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ConsentForm',
        default: null,
    },
    consentRequired: {
        type: Boolean,
        default: true,
    },
    settings: {
        isPublic: { type: Boolean, default: false },
        requiresAuth: { type: Boolean, default: false },
        allowAnonymous: { type: Boolean, default: true },
        showProgressBar: { type: Boolean, default: true },
        allowSaveAndContinue: { type: Boolean, default: true },
    },
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    lastUpdatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    archived: {
        type: Boolean,
        default: false,
    },
    archivedAt: {
        type: Date,
        default: null,
    },
}, { timestamps: true });

sniSurveySchema.index({ project: 1, isTemplate: 1 });

const SniSurvey = mongoose.model<ISniSurvey>('SniSurvey', sniSurveySchema);

export default SniSurvey;
