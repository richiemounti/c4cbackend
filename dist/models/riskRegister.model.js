"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// models/riskRegister.model.ts
const mongoose_1 = __importDefault(require("mongoose"));
const riskRegisterSchema = new mongoose_1.default.Schema({
    // Context references
    project: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
        index: true
    },
    projectSite: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'ProjectSite',
        index: true
    },
    organization: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    // Risk identification
    name: {
        type: String,
        required: true,
        trim: true
    },
    riskType: {
        type: String,
        required: true,
        enum: [
            'operational',
            'financial',
            'strategic',
            'compliance',
            'environmental',
            'social',
            'technical',
            'reputational',
            'political',
            'market',
            'legal'
        ],
        index: true
    },
    riskDescription: {
        type: String,
        required: true,
        trim: true
    },
    // Risk source tracking
    riskSource: {
        type: String,
        required: true,
        enum: [
            'manual', // Created directly in risk register
            'project_setup', // From project setup tasks
            'site_setup', // From site setup tasks
            'stakeholder_mapping', // From stakeholder mapping
            'toc_stage1', // From Theory of Change stage 1
            'toc_stage2' // From Theory of Change stage 2
        ],
        default: 'manual',
        index: true
    },
    sourceReference: {
        type: String,
        trim: true,
        // Optional field to store additional context like task name, stakeholder group, etc.
    },
    // Risk assessment
    probability: {
        type: String,
        required: true,
        enum: ['very_low', 'low', 'medium', 'high', 'very_high'],
        index: true
    },
    consequences: {
        type: String,
        required: true,
        enum: ['negligible', 'minor', 'moderate', 'major', 'catastrophic'],
        index: true
    },
    riskScore: {
        type: String,
        required: true,
        enum: ['low', 'medium', 'high'],
        index: true
    },
    // Risk ownership and management
    owner: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    mitigationStrategy: {
        type: String,
        required: true,
        trim: true
    },
    // Additional risk details
    category: {
        type: String,
        enum: ['inherent', 'residual', 'current'],
        default: 'current'
    },
    impactArea: [{
            type: String,
            enum: ['timeline', 'budget', 'scope', 'quality', 'stakeholders', 'compliance', 'reputation']
        }],
    // Timeline and tracking
    identifiedDate: {
        type: Date,
        default: Date.now
    },
    reviewDate: {
        type: Date,
        required: [true, 'Review date is required for risk monitoring'],
        index: true
    },
    status: {
        type: String,
        enum: ['open', 'monitoring', 'closed', 'transferred'],
        default: 'open',
        index: true
    },
    reviewFrequency: {
        type: String,
        enum: ['quarterly', 'half_yearly', 'yearly'],
        required: true,
        default: 'quarterly',
        index: true
    },
    // Mitigation actions
    mitigationActions: [{
            action: {
                type: String,
                required: true,
                trim: true
            },
            responsible: {
                type: mongoose_1.default.Schema.Types.ObjectId,
                ref: 'User'
            },
            dueDate: Date,
            status: {
                type: String,
                enum: ['not_started', 'in_progress', 'completed', 'cancelled'],
                default: 'not_started'
            },
            completedAt: Date,
            notes: String
        }],
    // Risk monitoring
    riskHistory: [{
            date: {
                type: Date,
                default: Date.now
            },
            probability: String,
            consequences: String,
            riskScore: String,
            notes: String,
            updatedBy: {
                type: mongoose_1.default.Schema.Types.ObjectId,
                ref: 'User'
            }
        }],
    // Documentation
    attachments: [{
            filename: String,
            url: String,
            uploadedBy: {
                type: mongoose_1.default.Schema.Types.ObjectId,
                ref: 'User'
            },
            uploadedAt: {
                type: Date,
                default: Date.now
            }
        }],
    // ✅ NEW: Comments system (replaces simple notes field)
    comments: [{
            text: {
                type: String,
                required: true,
                trim: true
            },
            author: {
                type: mongoose_1.default.Schema.Types.ObjectId,
                ref: 'User',
                required: true
            },
            isKeyInsight: {
                type: Boolean,
                default: false
            },
            starredBy: {
                type: mongoose_1.default.Schema.Types.ObjectId,
                ref: 'User'
            },
            starredAt: {
                type: Date
            },
            createdAt: {
                type: Date,
                default: Date.now
            }
        }],
    // User tracking
    creator: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    lastUpdatedBy: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User'
    },
    // Standard fields
    archived: {
        type: Boolean,
        default: false
    },
    archivedAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });
// Indexes for efficient querying
riskRegisterSchema.index({ project: 1, riskScore: 1 });
riskRegisterSchema.index({ owner: 1, status: 1 });
riskRegisterSchema.index({ riskType: 1, riskScore: 1 });
riskRegisterSchema.index({ organization: 1, riskScore: 1 });
riskRegisterSchema.index({ reviewDate: 1, status: 1 });
riskRegisterSchema.index({ riskSource: 1, riskScore: 1 });
// Virtual for calculating days until review
riskRegisterSchema.virtual('daysUntilReview').get(function () {
    const today = new Date();
    const reviewDate = new Date(this.reviewDate);
    const diffTime = reviewDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});
// Virtual for checking if review is overdue
riskRegisterSchema.virtual('isReviewOverdue').get(function () {
    return new Date(this.reviewDate) < new Date() && this.status === 'open';
});
// Method to calculate risk score based on probability and consequences
riskRegisterSchema.methods.calculateRiskScore = function () {
    const probabilityValues = {
        'very_low': 1,
        'low': 2,
        'medium': 3,
        'high': 4,
        'very_high': 5
    };
    const consequenceValues = {
        'negligible': 1,
        'minor': 2,
        'moderate': 3,
        'major': 4,
        'catastrophic': 5
    };
    const probValue = probabilityValues[this.probability] || 3;
    const consValue = consequenceValues[this.consequences] || 3;
    const score = probValue * consValue;
    if (score <= 6) {
        this.riskScore = 'low';
    }
    else if (score <= 15) {
        this.riskScore = 'medium';
    }
    else {
        this.riskScore = 'high';
    }
};
// Pre-save hook to calculate risk score and add to history
riskRegisterSchema.pre('save', function (next) {
    // Recalculate risk score if probability or consequences changed
    if (this.isModified('probability') || this.isModified('consequences')) {
        this.calculateRiskScore();
        // Add to risk history
        this.riskHistory.push({
            date: new Date(),
            probability: this.probability,
            consequences: this.consequences,
            riskScore: this.riskScore,
            notes: 'Risk assessment updated',
            updatedBy: this.lastUpdatedBy
        });
    }
    next();
});
const RiskRegister = mongoose_1.default.model('RiskRegister', riskRegisterSchema);
exports.default = RiskRegister;
//# sourceMappingURL=riskRegister.model.js.map