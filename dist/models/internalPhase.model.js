"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// models/internalPhase.model.ts
const mongoose_1 = __importDefault(require("mongoose"));
const internalPhaseSchema = new mongoose_1.default.Schema({
    theoryOfChange: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'TheoryOfChange',
        required: true,
        index: true,
    },
    title: {
        type: String,
        required: [true, 'Phase title is required'],
        trim: true,
        minLength: 2,
        maxLength: 100,
    },
    description: {
        type: String,
        trim: true,
        maxLength: 500,
    },
    inputs: [{
            type: String,
            trim: true,
            required: true
        }],
    activities: [{
            type: String,
            trim: true,
            required: true
        }],
    outputs: [{
            type: String,
            trim: true,
            required: true
        }],
    order: {
        type: Number,
        required: true,
        default: 0
    },
    metrics: [{
            name: String,
            target: mongoose_1.default.Schema.Types.Mixed,
            current: mongoose_1.default.Schema.Types.Mixed,
            unit: String
        }],
    archived: {
        type: Boolean,
        default: false
    },
    archivedAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });
const InternalPhase = mongoose_1.default.model('InternalPhase', internalPhaseSchema);
exports.default = InternalPhase;
//# sourceMappingURL=internalPhase.model.js.map