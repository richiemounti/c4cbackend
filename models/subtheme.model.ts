// models/subtheme.model.ts
import mongoose from "mongoose";

const subThemeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'SubTheme name is required'],
        trim: true,
        minLength: 2,
        maxLength: 100,
    },
    description: {
        type: String,
        trim: true,
        maxLength: 1000,
    },
    theme: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Theme',
        required: true,
        index: true,
    },
    theoryOfChangeStage: {
        type: String,
        enum: ['Stage 1 - Output', 'Stage 2 - Outcome', 'Both'],
        required: [true, 'Theory of Change stage is required'],
        index: true
    },
    // Indicator tags - references to Indicator documents
    indicatorTags: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Indicator',
            index: true,
        }
    ],
    // SDG tags - references to SDG documents
    sdgTags: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'SDG',
            index: true,
        }
    ],
    // Resilience tags - references to ResilienceDimension documents
    resilienceTags: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ResilienceDimension',
            index: true,
        }
    ],
    // ESG tags - references to ESGCategory documents
    esgTags: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ESGCategory',
            index: true,
        }
    ],
    // Standard tags - references to Standard documents
    standardTags: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Standard',
            index: true,
        }
    ],
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    status: {
        type: String,
        enum: ['draft', 'published', 'archived'],
        default: 'draft'
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

const SubTheme = mongoose.model('SubTheme', subThemeSchema);

export default SubTheme;