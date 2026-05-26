// models/surveyResponse.model.ts
import mongoose from "mongoose";

const surveyResponseSchema = new mongoose.Schema({
    survey: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Survey',
        required: true,
        index: true,
    },
    // Track which translation was used (if any)
    translation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SurveyTranslation',
        index: true
    },
    language: {
        type: String,
        trim: true,
        lowercase: true,
    },
    respondent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true,
    },
    respondentInfo: {
        name: String,
        email: String,
        phone: String,
        location: String,
        ipAddress: String,
        userAgent: String,
        customFields: mongoose.Schema.Types.Mixed
    },
    status: {
        type: String,
        enum: ['started', 'inProgress', 'completed', 'abandoned'],
        default: 'started'
    },
    progress: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    // ─── Consent fields ──────────────────────────────────────────────────────────
    consentGiven: {
        type: Boolean,
        default: null  // null = not yet answered, true = accepted, false = declined
    },
    consentFormId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ConsentForm'
    },
    consentFormVersion: {
        type: String
    },
    consentTimestamp: {
        type: Date
    },
    consentFormSnapshot: {
        _id: mongoose.Schema.Types.ObjectId,
        name: String,
        description: String,
        version: String
    },
    // ─── GPS coordinates ─────────────────────────────────────────────────────────
    // Captured at the time the response is submitted (completion point).
    // accuracy is in metres — used downstream for data-quality filtering.
    // method distinguishes automatic GPS from a manually entered location
    // or a device that could not provide coordinates at all.
    gpsCoordinates: {
        latitude: {
            type: Number,
            default: null
        },
        longitude: {
            type: Number,
            default: null
        },
        accuracy: {
            type: Number,   // metres — lower is better
            default: null
        },
        altitude: {
            type: Number,
            default: null
        },
        capturedAt: {
            type: Date,
            default: null
        },
        method: {
            type: String,
            enum: ['automatic', 'manual', 'unavailable'],
            default: 'automatic'
        }
    },
    // ─── Mobile collection metadata ──────────────────────────────────────────────
    // collectedOffline  — true when the response was created while the device
    //                     had no network and was later batch-uploaded.
    // deviceId          — anonymised device identifier for audit trails.
    // appVersion        — mobile app semver, helps diagnose version-specific bugs.
    // syncedAt          — timestamp of the batch-upload request from the device.
    // clientGeneratedId — UUID generated on-device BEFORE the response reaches
    //                     the server. The batch endpoint checks this for
    //                     idempotency, preventing duplicate inserts on retry.
    mobileMetadata: {
        collectedOffline: {
            type: Boolean,
            default: false
        },
        deviceId: {
            type: String,
            default: null
        },
        appVersion: {
            type: String,
            default: null
        },
        syncedAt: {
            type: Date,
            default: null
        },
        clientGeneratedId: {
            type: String,
            default: null,
            index: true,
            sparse: true   // only indexed when present — web responses won't have it
        }
    },
    // ─── Timestamps ──────────────────────────────────────────────────────────────
    startedAt: {
        type: Date,
        default: Date.now
    },
    completedAt: {
        type: Date
    },
    lastActivityAt: {
        type: Date,
        default: Date.now
    },
    metadata: {
        totalTimeSpent: Number,  // seconds
        device: String,
        browser: String,
        os: String,
        language: String
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

// ─── Indexes ─────────────────────────────────────────────────────────────────

// Fast dedup check in the batch-upload endpoint
surveyResponseSchema.index({ 'mobileMetadata.clientGeneratedId': 1 }, { sparse: true });

// Common query: all mobile responses for a project awaiting review
surveyResponseSchema.index({ survey: 1, 'mobileMetadata.collectedOffline': 1 });

// ─── Methods ─────────────────────────────────────────────────────────────────

surveyResponseSchema.methods.isComplete = function () {
    return this.status === 'completed' && this.completedAt != null;
};

surveyResponseSchema.methods.updateProgress = function (progress: number) {
    this.progress = progress;
    this.lastActivityAt = new Date();
    return this.save();
};

surveyResponseSchema.methods.markAsComplete = function () {
    this.status = 'completed';
    this.progress = 100;
    this.completedAt = new Date();
    this.lastActivityAt = new Date();
    return this.save();
};

const SurveyResponse = mongoose.model('SurveyResponse', surveyResponseSchema);

export default SurveyResponse;