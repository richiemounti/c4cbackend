// models/internalPhase.model.ts
import mongoose from "mongoose";

const internalPhaseSchema = new mongoose.Schema({
    theoryOfChange: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TheoryOfChange',
        required: true,
        index: true,
    },
    title: {
        type: String,
        required: [true, 'Phase title is required'],
        trim: true,
        minLength: 2,
        maxLength: 100,
    },
    description: {
        type: String,
        trim: true,
        maxLength: 500,
    },
    inputs: [{
        type: String,
        trim: true,
        required: true
    }],
    activities: [{
        type: String,
        trim: true,
        required: true
    }],
    outputs: [{
        type: String,
        trim: true,
        required: true
    }],
    order: {
        type: Number,
        required: true,
        default: 0
    },
    metrics: [{
        name: String,
        target: mongoose.Schema.Types.Mixed,
        current: mongoose.Schema.Types.Mixed,
        unit: String
    }],
    archived: {
        type: Boolean,
        default: false
    },
    archivedAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

const InternalPhase = mongoose.model('InternalPhase', internalPhaseSchema);

export default InternalPhase;