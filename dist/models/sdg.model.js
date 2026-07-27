"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// models/sdg.model.ts
const mongoose_1 = __importDefault(require("mongoose"));
const sdgSchema = new mongoose_1.default.Schema({
    code: {
        type: String,
        required: [true, 'SDG code is required'],
        unique: true,
        trim: true,
        enum: [
            'SDG1', 'SDG2', 'SDG3', 'SDG4', 'SDG5',
            'SDG6', 'SDG7', 'SDG8', 'SDG9', 'SDG10',
            'SDG11', 'SDG12', 'SDG13', 'SDG14', 'SDG15',
            'SDG16', 'SDG17'
        ]
    },
    name: {
        type: String,
        required: [true, 'SDG name is required'],
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    iconUrl: {
        type: String,
        trim: true
    },
    color: {
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
const SDG = mongoose_1.default.model('SDG', sdgSchema);
exports.default = SDG;
//# sourceMappingURL=sdg.model.js.map