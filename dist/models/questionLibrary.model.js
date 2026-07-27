"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// models/questionLibrary.model.ts
const mongoose_1 = __importDefault(require("mongoose"));
const questionLibrarySchema = new mongoose_1.default.Schema({
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
            type: mongoose_1.default.Schema.Types.ObjectId,
            ref: 'Question'
        }],
    creator: {
        type: mongoose_1.default.Schema.Types.ObjectId,
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
const QuestionLibrary = mongoose_1.default.model('QuestionLibrary', questionLibrarySchema);
exports.default = QuestionLibrary;
//# sourceMappingURL=questionLibrary.model.js.map