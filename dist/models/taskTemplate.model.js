"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// models/taskTemplate.model.ts
const mongoose_1 = __importStar(require("mongoose"));
const taskTemplateSchema = new mongoose_1.Schema({
    type: {
        type: String,
        enum: ['project', 'projectSite'],
        required: true
    },
    tasks: [
        {
            fieldName: String,
            dataType: String,
            description: String,
            userFacingCopy: String,
            fieldLabel: String,
            helperText: String,
            hoverText: String,
            isRequired: Boolean,
            sortOrder: Number,
            step: Number,
            stepNumber: Number,
            stepLabel: String,
            conditionalOn: {
                fieldName: String,
                value: mongoose_1.default.Schema.Types.Mixed
            },
            options: [String]
        }
    ],
    version: {
        type: String,
        default: '1.0.0'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});
const TaskTemplate = mongoose_1.default.models.TaskTemplate ||
    mongoose_1.default.model('TaskTemplate', taskTemplateSchema);
exports.default = TaskTemplate;
//# sourceMappingURL=taskTemplate.model.js.map