"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
// Schema for a stakeholder connection or other attribute
const stakeholderAttributeSchema = new mongoose_1.default.Schema({
    attributeType: {
        type: String,
        required: true
    },
    description: {
        type: String,
        default: ""
    }
});
// Schema for a task rating
const taskRatingSchema = new mongoose_1.default.Schema({
    taskType: {
        type: String,
        required: true,
        enum: ['connections', 'power', 'wellbeing', 'roles', 'risks', 'benefits']
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 10
    }
});
// Schema for a stakeholder assessment task
const stakeholderTaskSchema = new mongoose_1.default.Schema({
    taskType: {
        type: String,
        required: true,
        enum: ['connections', 'power', 'wellbeing', 'roles', 'risks', 'benefits']
    },
    attributes: [stakeholderAttributeSchema],
    rating: {
        type: Number,
        min: 1,
        max: 10
    }
});
const stakeholderSchema = new mongoose_1.default.Schema({
    project: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
        index: true
    },
    category: {
        type: String,
        enum: ['Government', 'Communities affected by the project', 'Marginalized groups', 'Partner Agencies', 'Our Organisation'],
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    // The connection task (original)
    connections: [stakeholderAttributeSchema],
    connectionStrength: {
        type: Number,
        min: 1,
        max: 10
    },
    // Additional tasks
    tasks: [stakeholderTaskSchema],
    creator: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    lastUpdatedBy: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User'
    },
    completionStatus: {
        type: String,
        enum: ['not_started', 'in_progress', 'completed'],
        default: 'not_started'
    }
}, { timestamps: true });
// Create a compound index for project + category + name to ensure uniqueness
stakeholderSchema.index({ project: 1, category: 1, name: 1 }, { unique: true });
// Method to check if all required tasks are completed
stakeholderSchema.methods.checkCompletion = function () {
    // Define required task types
    const requiredTaskTypes = ['connections', 'power', 'wellbeing', 'roles', 'risks', 'benefits'];
    // Check the connection task (original format)
    const hasConnections = this.connections && this.connections.length > 0 && this.connectionStrength;
    // Check other tasks
    const completedTaskTypes = this.tasks.map((task) => task.taskType);
    // Remove 'connections' from required if it's handled separately
    const remainingRequired = requiredTaskTypes.filter(type => type !== 'connections');
    // Check if all remaining required tasks are completed
    const allTasksComplete = remainingRequired.every(type => {
        var _a, _b;
        return completedTaskTypes.includes(type) &&
            ((_b = (_a = this.tasks.find((t) => t.taskType === type)) === null || _a === void 0 ? void 0 : _a.attributes) === null || _b === void 0 ? void 0 : _b.length) > 0;
    });
    return hasConnections && allTasksComplete;
};
// Update completion status before saving
stakeholderSchema.pre('save', function (next) {
    if (this.checkCompletion()) {
        this.completionStatus = 'completed';
    }
    else if (this.connections && this.connections.length > 0) {
        this.completionStatus = 'in_progress';
    }
    next();
});
const Stakeholder = mongoose_1.default.model('Stakeholder', stakeholderSchema);
exports.default = Stakeholder;
//# sourceMappingURL=stakeholder.model.js.map