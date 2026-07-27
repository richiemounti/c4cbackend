"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// models/standard.model.ts
const mongoose_1 = __importDefault(require("mongoose"));
const standardSchema = new mongoose_1.default.Schema({
    code: {
        type: String,
        required: [true, 'Standard code is required'],
        unique: true,
        trim: true
    },
    name: {
        type: String,
        required: [true, 'Standard name is required'],
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    issuingBody: {
        type: String,
        required: [true, 'Standard issuing body is required'],
        trim: true
    },
    website: {
        type: String,
        trim: true
    },
    version: {
        type: String,
        trim: true
    },
    publishedYear: {
        type: Number
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
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
const Standard = mongoose_1.default.model('Standard', standardSchema);
exports.default = Standard;
//# sourceMappingURL=standard.model.js.map