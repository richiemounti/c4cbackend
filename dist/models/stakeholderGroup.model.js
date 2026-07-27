"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// models/stakeholderGroup.model.ts
const mongoose_1 = __importDefault(require("mongoose"));
// Schema for a stakeholder assessment task
const taskSchema = new mongoose_1.default.Schema({
    taskType: {
        type: String,
        required: true,
        enum: ['connections', 'power', 'wellbeing', 'roles', 'risks', 'benefits'],
    },
    // Selected attributes/responses for this task
    responses: [{
            optionId: String,
            description: String,
            isKeyInsight: {
                type: Boolean,
                default: false
            }
        }],
    // Rating for this task (1-5)
    rating: {
        type: Number,
        min: 1,
        max: 5
    },
    // Tags field
    tags: [{
            type: String,
            trim: true,
            maxlength: 100
        }],
    // When this task was last updated
    updatedAt: {
        type: Date,
        default: Date.now
    }
});
const stakeholderGroupSchema = new mongoose_1.default.Schema({
    // Reference to the project
    project: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
        index: true
    },
    // Optional reference to a specific project site
    projectSite: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'ProjectSite',
        index: true
    },
    // Reference to the category
    category: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'Category',
        required: true,
        index: true
    },
    // Name of this stakeholder group (e.g., "National Government")
    name: {
        type: String,
        required: true,
        trim: true
    },
    // Description of this stakeholder group
    description: {
        type: String,
        trim: true
    },
    // NEW: Estimated population for this stakeholder group
    estimatedPopulation: {
        type: Number,
        min: 0,
        default: null
    },
    // ADDED: Themes that this stakeholder group can work with for Theory of Change
    // If empty array, stakeholder can work with any themes (no restrictions)
    themes: [{
            type: mongoose_1.default.Schema.Types.ObjectId,
            ref: 'Theme'
        }],
    // Completed tasks for this stakeholder group
    tasks: [taskSchema],
    // Completion status tracking
    completionStatus: {
        type: String,
        enum: ['not_started', 'in_progress', 'completed'],
        default: 'not_started'
    },
    // User tracking
    creator: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    lastUpdatedBy: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User'
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
// Create a compound index to ensure uniqueness at project/site + category + name level
stakeholderGroupSchema.index({
    project: 1,
    projectSite: 1,
    category: 1,
    name: 1
}, {
    unique: true,
    // Sparse index allows null values for projectSite
    sparse: true
});
// Method to check if all required tasks are completed
stakeholderGroupSchema.methods.checkCompletion = function () {
    const requiredTaskTypes = ['connections', 'power', 'wellbeing', 'roles', 'risks', 'benefits'];
    // Check if all required task types exist and have responses
    const allTasksComplete = requiredTaskTypes.every(type => {
        const task = this.tasks.find(t => t.taskType === type);
        return task && task.responses.length > 0 && task.rating !== undefined;
    });
    return allTasksComplete;
};
// Update completion status before saving
stakeholderGroupSchema.pre('save', function (next) {
    if (this.checkCompletion()) {
        this.completionStatus = 'completed';
    }
    else if (this.tasks.length > 0) {
        this.completionStatus = 'in_progress';
    }
    next();
});
const StakeholderGroup = mongoose_1.default.model('StakeholderGroup', stakeholderGroupSchema);
exports.default = StakeholderGroup;
//# sourceMappingURL=stakeholderGroup.model.js.map