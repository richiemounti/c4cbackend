// models/theoryOfChange.model.ts
import mongoose from "mongoose";

const theoryOfChangeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Theory of Change name is required'],
        trim: true,
        minLength: 2,
        maxLength: 150,
    },
    description: {
        type: String,
        trim: true,
        maxLength: 1000,
    },
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
        index: true,
    },
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    status: {
        type: String,
        enum: ['draft', 'active', 'archived'],
        default: 'draft'
    },
    version: {
        type: Number,
        default: 1
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

const TheoryOfChange = mongoose.model('TheoryOfChange', theoryOfChangeSchema);

export default TheoryOfChange;