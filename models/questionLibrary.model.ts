// models/questionLibrary.model.ts
import mongoose from "mongoose";

const questionLibrarySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Library name is required'],
        trim: true,
        minLength: 2,
        maxLength: 100,
    },
    description: {
        type: String,
        trim: true,
        maxLength: 500,
    },
    questions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question'
    }],
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

const QuestionLibrary = mongoose.model('QuestionLibrary', questionLibrarySchema);

export default QuestionLibrary;
