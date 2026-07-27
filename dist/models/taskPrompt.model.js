"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// models/taskPrompt.model.ts
const mongoose_1 = __importDefault(require("mongoose"));
// This model stores the prompts/questions for each task type
const taskPromptSchema = new mongoose_1.default.Schema({
    // The task type this prompt is for
    taskType: {
        type: String,
        required: true,
        enum: ['connections', 'power', 'wellbeing', 'roles', 'risks', 'benefits'],
        index: true
    },
    // The prompt text (e.g., "How is this group connected to the project?")
    promptText: {
        type: String,
        required: true
    },
    // Optional tooltip or description text
    tooltipText: {
        type: String
    },
    // The prompt for the rating question
    ratingPrompt: {
        type: String,
        required: true
    },
    // Min value for rating
    ratingMin: {
        type: Number,
        default: 1
    },
    // Max value for rating
    ratingMax: {
        type: Number,
        default: 5
    },
    // Label for minimum rating
    ratingMinLabel: {
        type: String
    },
    // Label for maximum rating
    ratingMaxLabel: {
        type: String
    },
    // Optional additional guidance text
    guidance: {
        type: String
    },
    // User tracking
    creator: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    // Standard fields
    archived: {
        type: Boolean,
        default: false
    },
    archivedAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });
// Create index to ensure uniqueness of task type
taskPromptSchema.index({ taskType: 1 }, { unique: true });
const TaskPrompt = mongoose_1.default.model('TaskPrompt', taskPromptSchema);
exports.default = TaskPrompt;
//# sourceMappingURL=taskPrompt.model.js.map