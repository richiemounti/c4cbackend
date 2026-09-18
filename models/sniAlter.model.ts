// models/sniAlter.model.ts
// A person named by a respondent (ego). First-class record, not a string on a
// response (brief §4.6 item 1 — "everything downstream depends on this:
// longitudinal linking, tie state, and any future alter-to-alter ties").
//
// Scoped to {project, participantCode} rather than to one SniSurveyResponse,
// so the same alter persists and is reusable across waves and across
// sub-themes within one survey (brief §4.2 "one roster, shared across
// sub-themes 1-3"; §4.5 "roster and alter records persist across waves").
//
// name/facebookUrl/phoneNumber are stored as ciphertext (brief §9 — the
// platform's only PII capture point). Encryption/decryption is handled by a
// dedicated crypto utility at the service layer, not in the model — no
// reversible field-level encryption utility existed anywhere in this codebase
// before SNI (confirmed by grep), so this is new infrastructure, built once.
import mongoose from "mongoose";

interface ISniAlter extends mongoose.Document {
    project: mongoose.Types.ObjectId;
    participantCode: string;
    // Pluggable alter source (brief §4.6 item 2). Only 'free_text' is built for
    // September; 'project_roster' (selection from a bounded project roster) is
    // left as an unimplemented branch — the door to whole-community designs
    // later, at near-zero cost to leave open now.
    source: 'free_text' | 'project_roster';
    encryptedName: string;
    encryptedFacebookUrl?: string;
    encryptedPhoneNumber?: string;
    firstWave: number;
    lastSeenWave: number;
    firstSurveyResponse: mongoose.Types.ObjectId;
    archived: boolean; // deletion/anonymisation capability (brief §9)
    archivedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const sniAlterSchema = new mongoose.Schema({
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
        index: true,
    },
    participantCode: {
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    source: {
        type: String,
        enum: ['free_text', 'project_roster'],
        default: 'free_text',
    },
    encryptedName: {
        type: String,
        required: [true, 'Alter name is required'],
    },
    encryptedFacebookUrl: {
        type: String,
        default: null,
    },
    encryptedPhoneNumber: {
        type: String,
        default: null,
    },
    firstWave: {
        type: Number,
        required: true,
        min: 1,
    },
    lastSeenWave: {
        type: Number,
        required: true,
        min: 1,
    },
    firstSurveyResponse: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SniSurveyResponse',
        required: true,
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

// Lookup index only — deliberately NOT unique. Dedup is an app-layer selection
// decision (the respondent picks from their own roster); two genuinely
// different alters can share a name. Brief §5: "Alter identity is established
// by selection, not by string matching. Do not attempt fuzzy matching on names."
sniAlterSchema.index({ project: 1, participantCode: 1 });

const SniAlter = mongoose.model<ISniAlter>('SniAlter', sniAlterSchema);

export default SniAlter;
