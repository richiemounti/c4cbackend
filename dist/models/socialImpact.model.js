"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// models/socialImpact.model.ts
const mongoose_1 = __importDefault(require("mongoose"));
const socialImpactSchema = new mongoose_1.default.Schema({
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
    stage: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'TheoryOfChangeStage',
        required: true,
        index: true
    },
    stakeholderGroup: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'StakeholderGroup',
        required: true,
        index: true
    },
    // CHANGED: Multiple themes selection
    themes: [{
            type: mongoose_1.default.Schema.Types.ObjectId,
            ref: 'Theme',
            required: true
        }],
    // CHANGED: Multiple subthemes selection
    subThemes: [{
            type: mongoose_1.default.Schema.Types.ObjectId,
            ref: 'SubTheme',
            required: true
        }],
    outcome: {
        type: String,
        required: true,
        trim: true
    },
    risks: [{
            type: mongoose_1.default.Schema.Types.ObjectId,
            ref: 'RiskRegister'
        }],
    notes: {
        type: String,
        trim: true
    },
    // CHANGED: Auto-linked from multiple SubThemes - now arrays can contain duplicates from multiple subthemes
    sdgTags: [{
            type: String,
            trim: true
        }],
    resilienceTags: [{
            type: String,
            trim: true
        }],
    // NEW: Add timeline support for impacts
    timeframe: {
        targetDate: Date, // when impact should be achieved
        reviewDate: Date, // when to review progress
        estimatedDuration: Number // days to achieve impact
    },
    status: {
        type: String,
        enum: ['planned', 'in_progress', 'achieved', 'at_risk', 'not_achieved'],
        default: 'planned'
    },
    progress: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    // NEW: Impact measurement
    measurementPlan: {
        indicators: [String],
        measurementMethod: String,
        frequency: {
            type: String,
            enum: ['weekly', 'monthly', 'quarterly', 'annually'],
            default: 'quarterly'
        }
    },
    creator: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    lastUpdatedBy: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User'
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
// CHANGED: Updated compound index for uniqueness - now uses outcome text as part of uniqueness
socialImpactSchema.index({
    project: 1,
    projectSite: 1,
    stakeholderGroup: 1,
    outcome: 1 // Using outcome text for uniqueness instead of theme/subtheme
}, { unique: true, sparse: true });
// Add validation to ensure subThemes belong to selected themes
socialImpactSchema.pre('save', function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (this.isModified('themes') || this.isModified('subThemes')) {
            // Get all subthemes and populate their theme references
            const SubTheme = mongoose_1.default.model('SubTheme');
            const subThemes = yield SubTheme.find({
                _id: { $in: this.subThemes }
            }).populate('theme');
            // Extract theme IDs from selected themes
            const selectedThemeIds = this.themes.map(id => id.toString());
            // Check if all subthemes belong to selected themes
            const invalidSubThemes = subThemes.filter(subTheme => !selectedThemeIds.includes(subTheme.theme._id.toString()));
            if (invalidSubThemes.length > 0) {
                const error = new Error(`SubThemes [${invalidSubThemes.map(st => st.name).join(', ')}] do not belong to selected themes`);
                return next(error);
            }
        }
        next();
    });
});
// Pre-save hook to automatically populate SDG and resilience tags from selected subthemes
socialImpactSchema.pre('save', function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (this.isModified('subThemes')) {
            try {
                const SubTheme = mongoose_1.default.model('SubTheme');
                const subThemes = yield SubTheme.find({
                    _id: { $in: this.subThemes }
                });
                // Aggregate all SDG and resilience tags from selected subthemes
                const allSdgTags = new Set();
                const allResilienceTags = new Set();
                subThemes.forEach(subTheme => {
                    if (subTheme.sdgTags) {
                        subTheme.sdgTags.forEach((tag) => allSdgTags.add(tag));
                    }
                    if (subTheme.resilienceTags) {
                        subTheme.resilienceTags.forEach((tag) => allResilienceTags.add(tag));
                    }
                });
                this.sdgTags = Array.from(allSdgTags);
                this.resilienceTags = Array.from(allResilienceTags);
            }
            catch (error) {
                return next(error);
            }
        }
        next();
    });
});
const SocialImpact = mongoose_1.default.model('SocialImpact', socialImpactSchema);
exports.default = SocialImpact;
//# sourceMappingURL=socialImpact.model.js.map