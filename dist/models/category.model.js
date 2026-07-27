"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// models/category.model.ts
const mongoose_1 = __importDefault(require("mongoose"));
const categorySchema = new mongoose_1.default.Schema({
    name: {
        type: String,
        required: [true, 'Category name is required'],
        trim: true,
        minLength: 2,
        maxLength: 100,
    },
    description: {
        type: String,
        trim: true,
        maxLength: 500,
    },
    creator: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    status: {
        type: String,
        enum: ['draft', 'published', 'archived'],
        default: 'draft'
    },
    inclusion: {
        type: [String],
        enum: [
            'people with disability',
            'women and girls',
            'LGBTQ',
            'young people',
            'indigenous persons'
        ],
        default: []
    },
    // NEW FIELD: Population estimate at site level
    estimatedPopulation: {
        type: Number,
        min: 0,
        default: null // Optional field
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
const Category = mongoose_1.default.model('Category', categorySchema);
exports.default = Category;
//# sourceMappingURL=category.model.js.map