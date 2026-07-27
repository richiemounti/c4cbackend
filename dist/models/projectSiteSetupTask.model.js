"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// models/projectSiteSetupTask.model.ts
const mongoose_1 = __importDefault(require("mongoose"));
// Define the schema for project site setup task
const projectSiteSetupTaskSchema = new mongoose_1.default.Schema({
    fieldName: {
        type: String,
        required: true,
        trim: true
    },
    dataType: {
        type: String,
        required: true,
        trim: true,
        enum: ['string', 'number', 'date', 'boolean', 'array', 'object', 'file']
    },
    description: {
        type: String,
        trim: true
    },
    userFacingCopy: {
        type: String,
        trim: true
    },
    options: {
        type: [String],
        default: undefined
    },
    fieldLabel: {
        type: String,
        trim: true
    },
    helperText: {
        type: String,
        trim: true
    },
    hoverText: {
        type: String,
        trim: true
    },
    isRequired: {
        type: Boolean,
        default: false
    },
    sortOrder: {
        type: Number,
        required: true
    },
    step: {
        type: Number,
        required: true,
        default: 2
    },
    stepNumber: {
        type: Number,
        default: null
    },
    stepLabel: {
        type: String,
        default: null
    },
    conditionalOn: {
        fieldName: { type: String },
        value: { type: mongoose_1.default.Schema.Types.Mixed }
    },
    isCompleted: {
        type: Boolean,
        default: false
    },
    completedAt: {
        type: Date,
        default: null
    },
    completedBy: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    // New field to store the user's response data
    responseData: {
        type: mongoose_1.default.Schema.Types.Mixed,
        default: null
    }
}, { timestamps: true });
// Define the schema for project site setup progress
const projectSiteSetupSchema = new mongoose_1.default.Schema({
    projectSite: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'ProjectSite',
        required: true,
        unique: true
    },
    project: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
        index: true
    },
    tasks: [projectSiteSetupTaskSchema],
    progress: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    isComplete: {
        type: Boolean,
        default: false
    },
    completedAt: {
        type: Date,
        default: null
    },
    lastUpdatedBy: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }
}, { timestamps: true });
// Add methods to calculate progress for project site setup
projectSiteSetupSchema.methods.calculateProgress = function () {
    if (!this.tasks || this.tasks.length === 0)
        return 0;
    const requiredTasks = this.tasks.filter((task) => task.isRequired);
    const completedRequiredTasks = requiredTasks.filter((task) => task.isCompleted);
    // If there are no required tasks, calculate based on all tasks
    if (requiredTasks.length === 0) {
        const completedTasks = this.tasks.filter((task) => task.isCompleted);
        this.progress = Math.round((completedTasks.length / this.tasks.length) * 100);
    }
    else {
        this.progress = Math.round((completedRequiredTasks.length / requiredTasks.length) * 100);
    }
    this.isComplete = this.progress === 100;
    if (this.isComplete && !this.completedAt) {
        this.completedAt = new Date();
    }
    return this.progress;
};
projectSiteSetupSchema.pre('save', function (next) {
    // First cast to unknown, then to our interface to satisfy TypeScript
    const doc = this;
    doc.calculateProgress();
    next();
});
const ProjectSiteSetup = mongoose_1.default.model('ProjectSiteSetup', projectSiteSetupSchema);
exports.default = ProjectSiteSetup;
//# sourceMappingURL=projectSiteSetupTask.model.js.map