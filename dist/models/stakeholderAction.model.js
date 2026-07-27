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
// models/stakeholderAction.model.ts - UPDATED
const mongoose_1 = __importDefault(require("mongoose"));
const stakeholderActionSchema = new mongoose_1.default.Schema({
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
    action: {
        type: String,
        required: true,
        trim: true
    },
    responsibility: {
        name: String,
        role: String,
        email: String,
        phone: String
    },
    timeframe: {
        type: {
            startDate: {
                type: Date,
                required: true
            },
            endDate: {
                type: Date,
                required: true
            },
            estimatedDuration: {
                type: Number,
                min: 1
            },
            isFlexible: {
                type: Boolean,
                default: false
            }
        },
        required: true
    },
    // How often this action should be revisited after completion
    repeatCycle: {
        type: String,
        enum: ['monthly', 'quarterly', 'yearly', 'no_repeat'],
        default: 'no_repeat',
        required: true
    },
    notes: {
        type: String,
        trim: true
    },
    status: {
        type: String,
        enum: ['not_started', 'in_progress', 'completed', 'on_hold', 'cancelled'],
        default: 'not_started',
        required: true
    },
    progress: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    dependencies: [{
            type: mongoose_1.default.Schema.Types.ObjectId,
            ref: 'StakeholderAction'
        }],
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
    },
    milestones: [{
            date: { type: Date, required: true },
            description: { type: String, required: true },
            completed: {
                type: Boolean,
                default: false
            }
        }],
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
// Compound uniqueness: same action text cannot appear twice for the
// same project / site / stakeholder combination
stakeholderActionSchema.index({
    project: 1,
    projectSite: 1,
    stakeholderGroup: 1,
    action: 1
}, { unique: true, sparse: true });
// 1. Ensure endDate is strictly after startDate
stakeholderActionSchema.pre('save', function (next) {
    var _a, _b;
    if (((_a = this.timeframe) === null || _a === void 0 ? void 0 : _a.startDate) && ((_b = this.timeframe) === null || _b === void 0 ? void 0 : _b.endDate)) {
        if (this.timeframe.endDate <= this.timeframe.startDate) {
            return next(new Error('End date must be after start date'));
        }
    }
    next();
});
// 2. Ensure every selected subTheme belongs to one of the selected themes
stakeholderActionSchema.pre('save', function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (this.isModified('themes') || this.isModified('subThemes')) {
            const SubTheme = mongoose_1.default.model('SubTheme');
            const subThemes = yield SubTheme.find({
                _id: { $in: this.subThemes }
            }).populate('theme');
            const selectedThemeIds = this.themes.map(id => id.toString());
            const invalidSubThemes = subThemes.filter(subTheme => {
                if (!subTheme.theme || !subTheme.theme._id)
                    return true;
                return !selectedThemeIds.includes(subTheme.theme._id.toString());
            });
            if (invalidSubThemes.length > 0) {
                return next(new Error(`SubThemes [${invalidSubThemes.map(st => st.name).join(', ')}] do not belong to selected themes`));
            }
        }
        next();
    });
});
// 3. Auto-sync progress → status so they stay consistent
stakeholderActionSchema.pre('save', function (next) {
    if (this.isModified('progress')) {
        if (this.progress === 100 && this.status !== 'completed') {
            this.status = 'completed';
        }
        else if (this.progress > 0 && this.progress < 100 && this.status === 'not_started') {
            this.status = 'in_progress';
        }
    }
    next();
});
const StakeholderAction = mongoose_1.default.model('StakeholderAction', stakeholderActionSchema);
exports.default = StakeholderAction;
//# sourceMappingURL=stakeholderAction.model.js.map