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
// models/tocConsultationPlan.model.ts
const mongoose_1 = __importStar(require("mongoose"));
// Schema for stakeholder group selection
const StakeholderGroupSelectionSchema = new mongoose_1.Schema({
    stakeholderGroup: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'StakeholderGroup',
        required: true
    },
    isSelected: {
        type: Boolean,
        default: false
    },
    notes: {
        type: String,
        trim: true
    }
}, { _id: false });
// Schema for consultation planning questions
const ConsultationQuestionsSchema = new mongoose_1.Schema({
    howManyPeople: {
        type: String,
        trim: true,
        default: ''
    },
    whoInvitedHow: {
        type: String,
        trim: true,
        default: ''
    },
    whereHow: {
        type: String,
        trim: true,
        default: ''
    },
    underRepresentedGroups: {
        type: String,
        trim: true,
        default: ''
    },
    costsPlanning: {
        type: String,
        trim: true,
        default: ''
    },
    permissions: {
        type: String,
        trim: true,
        default: ''
    }
}, { _id: false });
// Schema for planned consultation dates
const PlannedDatesSchema = new mongoose_1.Schema({
    startDate: {
        type: Date
    },
    endDate: {
        type: Date
    },
    dateDescription: {
        type: String,
        trim: true
    }
}, { _id: false });
// Main TOC Consultation Plan Schema
const TOCConsultationPlanSchema = new mongoose_1.Schema({
    project: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Project',
        required: true
    },
    projectSite: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'ProjectSite',
        required: true
    },
    stakeholderGroups: {
        type: [StakeholderGroupSelectionSchema],
        default: []
    },
    consultationQuestions: {
        type: ConsultationQuestionsSchema,
        default: () => ({
            howManyPeople: '',
            whoInvitedHow: '',
            whereHow: '',
            underRepresentedGroups: '',
            costsPlanning: '',
            permissions: ''
        })
    },
    plannedConsultationDates: {
        type: PlannedDatesSchema,
        default: () => ({})
    },
    status: {
        type: String,
        enum: ['draft', 'completed'],
        default: 'draft'
    },
    isCompleted: {
        type: Boolean,
        default: false
    },
    completedAt: {
        type: Date
    },
    creator: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    lastUpdatedBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});
// Indexes for efficient querying
TOCConsultationPlanSchema.index({ project: 1, projectSite: 1 }, { unique: true });
TOCConsultationPlanSchema.index({ projectSite: 1 });
TOCConsultationPlanSchema.index({ status: 1 });
TOCConsultationPlanSchema.index({ isCompleted: 1 });
// Helper function to check if consultation questions are answered
function hasAnsweredQuestions(questions) {
    if (!questions)
        return false;
    return Object.values(questions).some(q => q !== null &&
        q !== undefined &&
        typeof q === 'string' &&
        q.trim() !== '');
}
// Virtual for selected stakeholder groups count
TOCConsultationPlanSchema.virtual('selectedStakeholderCount').get(function () {
    return this.stakeholderGroups.filter(sg => sg.isSelected).length;
});
// Virtual for completion percentage
TOCConsultationPlanSchema.virtual('completionPercentage').get(function () {
    const sections = {
        stakeholderGroups: this.stakeholderGroups.some(sg => sg.isSelected),
        consultationQuestions: hasAnsweredQuestions(this.consultationQuestions),
        plannedDates: this.plannedConsultationDates.startDate ||
            this.plannedConsultationDates.endDate ||
            (this.plannedConsultationDates.dateDescription &&
                typeof this.plannedConsultationDates.dateDescription === 'string' &&
                this.plannedConsultationDates.dateDescription.trim() !== '')
    };
    const completedSections = Object.values(sections).filter(Boolean).length;
    return Math.round((completedSections / 3) * 100);
});
// Pre-save middleware to update completion status
TOCConsultationPlanSchema.pre('save', function (next) {
    // Update lastUpdatedBy timestamp
    this.updatedAt = new Date();
    // Check if plan should be marked as completed
    const hasSelectedStakeholders = this.stakeholderGroups.some(sg => sg.isSelected);
    const hasAnsweredQuestionsCheck = hasAnsweredQuestions(this.consultationQuestions);
    const hasPlannedDates = this.plannedConsultationDates.startDate ||
        this.plannedConsultationDates.endDate ||
        (this.plannedConsultationDates.dateDescription &&
            typeof this.plannedConsultationDates.dateDescription === 'string' &&
            this.plannedConsultationDates.dateDescription.trim() !== '');
    // Auto-update completion status based on content
    if (hasSelectedStakeholders && hasAnsweredQuestionsCheck && hasPlannedDates) {
        if (this.status === 'draft') {
            this.status = 'completed';
            this.isCompleted = true;
            this.completedAt = new Date();
        }
    }
    else {
        this.status = 'draft';
        this.isCompleted = false;
        this.completedAt = undefined;
    }
    next();
});
// Static method to find consultation plan by site
TOCConsultationPlanSchema.statics.findBySite = function (projectSiteId) {
    return this.findOne({ projectSite: projectSiteId })
        .populate('project', 'name')
        .populate('projectSite', 'name location')
        .populate('stakeholderGroups.stakeholderGroup', 'name description')
        .populate('creator', 'name email')
        .populate('lastUpdatedBy', 'name email');
};
// Static method to check if consultation plan is completed for a site
TOCConsultationPlanSchema.statics.isCompletedForSite = function (projectSiteId) {
    return this.findOne({
        projectSite: projectSiteId,
        isCompleted: true
    });
};
// Instance method to validate completion requirements
TOCConsultationPlanSchema.methods.canBeCompleted = function () {
    const hasSelectedStakeholders = this.stakeholderGroups.some((sg) => sg.isSelected);
    const hasAnsweredQuestionsCheck = hasAnsweredQuestions(this.consultationQuestions);
    const hasPlannedDates = this.plannedConsultationDates.startDate ||
        this.plannedConsultationDates.endDate ||
        (this.plannedConsultationDates.dateDescription &&
            typeof this.plannedConsultationDates.dateDescription === 'string' &&
            this.plannedConsultationDates.dateDescription.trim() !== '');
    return {
        canComplete: hasSelectedStakeholders && hasAnsweredQuestionsCheck && hasPlannedDates,
        missing: {
            stakeholderGroups: !hasSelectedStakeholders,
            consultationQuestions: !hasAnsweredQuestionsCheck,
            plannedDates: !hasPlannedDates
        }
    };
};
exports.default = mongoose_1.default.model('TOCConsultationPlan', TOCConsultationPlanSchema);
//# sourceMappingURL=tocConsultationPlan.model.js.map