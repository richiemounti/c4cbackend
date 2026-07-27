"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Modified Project Model with contact information
const mongoose_1 = __importDefault(require("mongoose"));
// Define a schema for project contacts
const contactSchema = new mongoose_1.default.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    role: {
        type: String,
        trim: true
    },
    phone: {
        type: String,
        trim: true
    },
    email: {
        type: String,
        trim: true
    },
    notes: {
        type: String,
        trim: true
    }
}, { _id: true });
const projectSchema = new mongoose_1.default.Schema({
    name: {
        type: String,
        required: [true, 'Project name is required'],
        trim: true,
        minLength: 2,
        maxLength: 100,
    },
    description: {
        type: String,
        required: [true, 'Project description is required'],
        trim: true,
        maxLength: 1000,
    },
    logo: {
        type: String,
        default: null
    },
    location: {
        type: String,
        required: [true, 'Project location is required'],
        trim: true
    },
    // Additional location details could be useful
    coordinates: {
        lat: {
            type: Number,
            default: null
        },
        lng: {
            type: Number,
            default: null
        }
    },
    // Added contacts field for project contacts
    contacts: [contactSchema],
    startDate: {
        type: Date,
        default: Date.now
    },
    endDate: {
        type: Date,
        default: null
    },
    status: {
        type: String,
        enum: ['planning', 'active', 'completed', 'on-hold'],
        default: 'planning'
    },
    creator: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    organization: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'Organization',
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
const Project = mongoose_1.default.model('Project', projectSchema);
exports.default = Project;
//# sourceMappingURL=project.model.js.map