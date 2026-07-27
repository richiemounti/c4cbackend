"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// models/resilienceDimension.model.ts (revised)
const mongoose_1 = __importDefault(require("mongoose"));
// Define the top-level resilience capacities
const resilienceCapacityTypes = [
    'absorptive_capacity',
    'adaptive_capacity',
    'transformative_capacity'
];
const resilienceDimensionSchema = new mongoose_1.default.Schema({
    code: {
        type: String,
        required: [true, 'Resilience dimension code is required'],
        unique: true,
        trim: true
    },
    name: {
        type: String,
        required: [true, 'Resilience dimension name is required'],
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    // Multiple top-level capacities can apply to one dimension
    capacityTypes: [{
            type: String,
            enum: resilienceCapacityTypes,
            required: true
        }],
    // Changed from enum to string for flexible user-defined categories
    category: {
        type: String,
        required: true,
        trim: true
    },
    // New optional fields
    linkToPvModel: {
        type: String,
        trim: true
    },
    resilienceIndexCriteria: {
        type: String,
        trim: true
    },
    indicatorExamples: {
        type: String,
        trim: true
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
const ResilienceDimension = mongoose_1.default.model('ResilienceDimension', resilienceDimensionSchema);
exports.default = ResilienceDimension;
//# sourceMappingURL=resilienceDimension.model.js.map