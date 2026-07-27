"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// models/indicator.model.ts
const mongoose_1 = __importDefault(require("mongoose"));
const evidenceSchema = new mongoose_1.default.Schema({
    source: {
        type: String,
        trim: true,
        maxLength: 1000, // Updated from 200
    },
    url: [{
            type: String,
            trim: true,
            maxLength: 2500, // Updated from 500
            validate: {
                validator: function (v) {
                    // Optional URL validation - only validates if url is provided
                    if (!v)
                        return true;
                    return /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/.test(v);
                },
                message: 'Please provide a valid URL'
            }
        }],
    details: {
        type: String,
        trim: true,
        maxLength: 1500, // Updated from 1000
    }
}, { _id: false });
const indicatorSchema = new mongoose_1.default.Schema({
    name: {
        type: String,
        required: [true, 'Indicator name is required'],
        trim: true,
        minLength: 2,
        maxLength: 2000,
    },
    description: {
        type: String,
        trim: true,
        maxLength: 2500,
    },
    evidence: {
        type: evidenceSchema,
        default: null
    },
    creator: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
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
const Indicator = mongoose_1.default.model('Indicator', indicatorSchema);
exports.default = Indicator;
//# sourceMappingURL=indicator.model.js.map