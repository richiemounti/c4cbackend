"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// models/esgCategory.model.ts
const mongoose_1 = __importDefault(require("mongoose"));
const esgCategorySchema = new mongoose_1.default.Schema({
    code: {
        type: String,
        required: [true, 'ESG code is required'],
        unique: true,
        trim: true
    },
    name: {
        type: String,
        required: [true, 'ESG name is required'],
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    type: {
        type: String,
        enum: ['Environmental', 'Social', 'Governance'],
        required: true
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
const ESGCategory = mongoose_1.default.model('ESGCategory', esgCategorySchema);
exports.default = ESGCategory;
//# sourceMappingURL=esgCategory.model.js.map