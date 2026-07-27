"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const organizationSchema = new mongoose_1.default.Schema({
    name: {
        type: String,
        required: [true, 'Organization name is required'],
        trim: true,
        minLength: 2,
        maxLength: 100,
    },
    country: {
        type: String,
        required: [true, 'Organization country is required']
    },
    city: {
        type: String,
        required: [true, 'Organization city is required']
    },
    creator: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
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
const Organization = mongoose_1.default.model('Organization', organizationSchema);
exports.default = Organization;
//# sourceMappingURL=organization.model.js.map