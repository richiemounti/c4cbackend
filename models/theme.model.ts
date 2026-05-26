// models/theme.model.ts
import mongoose from "mongoose";

const themeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Theme name is required'],
        trim: true,
        minLength: 2,
        maxLength: 200,
    },
    description: {
        type: String,
        trim: true,
        maxLength: 1000,
    },
    theoryOfChangeStage: {
        type: String,
        enum: ['Stage 1 - Output', 'Stage 2 - Outcome', 'Both'],
        required: false,
        default: null,
        index: true
    },
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

const Theme = mongoose.model('Theme', themeSchema);

export default Theme;