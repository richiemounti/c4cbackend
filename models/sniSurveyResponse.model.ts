// models/sniSurveyResponse.model.ts
// One document per respondent PER WAVE (brief §4.6 item 3 — wave-aware from
// wave 1, even though wave 1 is the only wave in the September build).
//
// `participantCode` is the cross-wave respondent identity — a short
// pseudonymous code minted at wave-1 completion (platform-generated; see
// SNI_BUILD_PLAN.md §7 for why, since the brief itself doesn't specify a
// mechanism). It is what SniAlter and SniSurveyResponse both key off to
// resolve "same respondent, different wave" without requiring a platform
// login — mirrors how anonymous respondents already work via
// SurveyResponse.respondentInfo today.
import mongoose from "mongoose";

interface ISniSurveyResponse extends mongoose.Document {
    survey: mongoose.Types.ObjectId;
    participantCode: string;
    wave: number;
    status: 'started' | 'inProgress' | 'completed' | 'abandoned';
    respondentInfo?: {
        name?: string;
        email?: string;
        phone?: string;
        location?: string;
        ipAddress?: string;
        userAgent?: string;
        customFields?: any;
    };
    consentGiven?: boolean | null;
    consentFormId?: mongoose.Types.ObjectId;
    consentFormVersion?: string;
    consentTimestamp?: Date;
    consentFormSnapshot?: {
        _id: mongoose.Types.ObjectId;
        name: string;
        description: string;
        version: string;
    };
    gpsCoordinates?: {
        latitude?: number | null;
        longitude?: number | null;
        accuracy?: number | null;
        altitude?: number | null;
        capturedAt?: Date | null;
        method: 'automatic' | 'manual' | 'unavailable';
    };
    mobileMetadata?: {
        collectedOffline: boolean;
        deviceId?: string | null;
        appVersion?: string | null;
        syncedAt?: Date | null;
        clientGeneratedId?: string | null;
    };
    startedAt: Date;
    completedAt?: Date;
    lastActivityAt: Date;
    // True immediately for wave 1 (nothing to preload). For wave 2/3, stays
    // false until the respondent has gone through the "still someone you turn
    // to?" reconfirmation for every alter carried over from the prior wave —
    // the sequence engine won't advance to section 1 until this flips true.
    // Needed because a "no" answer during preload never bumps SniAlter.lastSeenWave
    // (by design — see sniRosterEngine.service.ts), so completion can't be
    // derived from alter state alone; it needs its own explicit marker.
    preloadCompleted: boolean;
    isTestResponse: boolean;
    archived: boolean;
    archivedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const sniSurveyResponseSchema = new mongoose.Schema({
    survey: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SniSurvey',
        required: true,
        index: true,
    },
    participantCode: {
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    wave: {
        type: Number,
        required: true,
        default: 1,
        min: 1,
    },
    status: {
        type: String,
        enum: ['started', 'inProgress', 'completed', 'abandoned'],
        default: 'started',
    },
    respondentInfo: {
        name: String,
        email: String,
        phone: String,
        location: String,
        ipAddress: String,
        userAgent: String,
        customFields: mongoose.Schema.Types.Mixed,
    },
    // ─── Consent (mirrors SurveyResponse) ─────────────────────────────────
    consentGiven: {
        type: Boolean,
        default: null,
    },
    consentFormId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ConsentForm',
    },
    consentFormVersion: String,
    consentTimestamp: Date,
    consentFormSnapshot: {
        _id: mongoose.Schema.Types.ObjectId,
        name: String,
        description: String,
        version: String,
    },
    // ─── GPS (mirrors SurveyResponse) ─────────────────────────────────────
    gpsCoordinates: {
        latitude: { type: Number, default: null },
        longitude: { type: Number, default: null },
        accuracy: { type: Number, default: null },
        altitude: { type: Number, default: null },
        capturedAt: { type: Date, default: null },
        method: { type: String, enum: ['automatic', 'manual', 'unavailable'], default: 'automatic' },
    },
    // ─── Mobile collection metadata (mirrors SurveyResponse) ──────────────
    mobileMetadata: {
        collectedOffline: { type: Boolean, default: false },
        deviceId: { type: String, default: null },
        appVersion: { type: String, default: null },
        syncedAt: { type: Date, default: null },
        clientGeneratedId: { type: String, default: null, index: true, sparse: true },
    },
    startedAt: {
        type: Date,
        default: Date.now,
    },
    completedAt: Date,
    lastActivityAt: {
        type: Date,
        default: Date.now,
    },
    preloadCompleted: {
        type: Boolean,
        default: function (this: ISniSurveyResponse) { return this.wave === 1; },
    },
    // Set to true when collected while the survey was in pretest status — same
    // pattern as Survey/SurveyResponse's pretest workflow.
    isTestResponse: {
        type: Boolean,
        default: false,
        index: true,
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

// One response per respondent per wave per survey
sniSurveyResponseSchema.index({ survey: 1, participantCode: 1, wave: 1 }, { unique: true });
// (clientGeneratedId's index is declared inline on the field above — a
// second schema.index() call here would just duplicate it.)

sniSurveyResponseSchema.methods.isComplete = function () {
    return this.status === 'completed' && this.completedAt != null;
};

sniSurveyResponseSchema.methods.markAsComplete = function () {
    this.status = 'completed';
    this.completedAt = new Date();
    this.lastActivityAt = new Date();
    return this.save();
};

const SniSurveyResponse = mongoose.model<ISniSurveyResponse>('SniSurveyResponse', sniSurveyResponseSchema);

export default SniSurveyResponse;
