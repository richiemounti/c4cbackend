"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// models/theoryOfChangeStage.model.ts
const mongoose_1 = __importDefault(require("mongoose"));
const theoryOfChangeStageSchema = new mongoose_1.default.Schema({
    project: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
        index: true
    },
    projectSite: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'ProjectSite',
        default: null,
        index: true
    },
    stageNumber: {
        type: Number,
        required: true,
        enum: [1, 2], // Stage 1 or Stage 2
        index: true
    },
    status: {
        type: String,
        enum: ['not_started', 'in_progress', 'completed'],
        default: 'not_started'
    },
    progress: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    creator: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    lastUpdatedBy: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User'
    },
    completedAt: {
        type: Date,
        default: null
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
// Create compound index for project/site + stage
theoryOfChangeStageSchema.index({ project: 1, projectSite: 1, stageNumber: 1 }, { unique: true, sparse: true });
const TheoryOfChangeStage = mongoose_1.default.model('TheoryOfChangeStage', theoryOfChangeStageSchema);
exports.default = TheoryOfChangeStage;
//# sourceMappingURL=theoryOfChangeStage.model.js.map