"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// models/externalPhase.model.ts
const mongoose_1 = __importDefault(require("mongoose"));
const externalPhaseSchema = new mongoose_1.default.Schema({
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
    outcomes: {
        shortTerm: [{
                type: String,
                trim: true
            }],
        mediumTerm: [{
                type: String,
                trim: true
            }],
        longTerm: [{
                type: String,
                trim: true
            }]
    },
    impacts: [{
            type: String,
            trim: true
        }],
    stakeholderGroups: [{
            type: mongoose_1.default.Schema.Types.ObjectId,
            ref: 'Stakeholder'
        }],
    metrics: [{
            name: String,
            target: mongoose_1.default.Schema.Types.Mixed,
            current: mongoose_1.default.Schema.Types.Mixed,
            unit: String,
            dataSource: String
        }],
    assumptions: [{
            type: String,
            trim: true
        }],
    risks: [{
            description: String,
            likelihood: {
                type: String,
                enum: ['low', 'medium', 'high']
            },
            impact: {
                type: String,
                enum: ['low', 'medium', 'high']
            },
            mitigation: String
        }],
    order: {
        type: Number,
        required: true,
        default: 0
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
const ExternalPhase = mongoose_1.default.model('ExternalPhase', externalPhaseSchema);
exports.default = ExternalPhase;
//# sourceMappingURL=externalPhase.model.js.map