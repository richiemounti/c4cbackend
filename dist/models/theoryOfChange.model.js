"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// models/theoryOfChange.model.ts
const mongoose_1 = __importDefault(require("mongoose"));
const theoryOfChangeSchema = new mongoose_1.default.Schema({
    name: {
        type: String,
        required: [true, 'Theory of Change name is required'],
        trim: true,
        minLength: 2,
        maxLength: 150,
    },
    description: {
        type: String,
        trim: true,
        maxLength: 1000,
    },
    project: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
        index: true,
    },
    creator: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    status: {
        type: String,
        enum: ['draft', 'active', 'archived'],
        default: 'draft'
    },
    version: {
        type: Number,
        default: 1
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
const TheoryOfChange = mongoose_1.default.model('TheoryOfChange', theoryOfChangeSchema);
exports.default = TheoryOfChange;
//# sourceMappingURL=theoryOfChange.model.js.map