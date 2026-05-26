// models/externalPhase.model.ts
import mongoose from "mongoose";

const externalPhaseSchema = new mongoose.Schema({
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
    outcomes: {
        shortTerm: [{
            type: String,
            trim: true
        }],
        mediumTerm: [{
            type: String,
            trim: true
        }],
        longTerm: [{
            type: String,
            trim: true
        }]
    },
    impacts: [{
        type: String,
        trim: true
    }],
    stakeholderGroups: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Stakeholder'
    }],
    metrics: [{
        name: String,
        target: mongoose.Schema.Types.Mixed,
        current: mongoose.Schema.Types.Mixed,
        unit: String,
        dataSource: String
    }],
    assumptions: [{
        type: String,
        trim: true
    }],
    risks: [{
        description: String,
        likelihood: {
            type: String,
            enum: ['low', 'medium', 'high']
        },
        impact: {
            type: String,
            enum: ['low', 'medium', 'high']
        },
        mitigation: String
    }],
    order: {
        type: Number,
        required: true,
        default: 0
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

const ExternalPhase = mongoose.model('ExternalPhase', externalPhaseSchema);

export default ExternalPhase;