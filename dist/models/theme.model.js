"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// models/theme.model.ts
const mongoose_1 = __importDefault(require("mongoose"));
const themeSchema = new mongoose_1.default.Schema({
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
const Theme = mongoose_1.default.model('Theme', themeSchema);
exports.default = Theme;
//# sourceMappingURL=theme.model.js.map