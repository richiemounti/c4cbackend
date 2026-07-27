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
// models/question.model.ts (Enhanced with Conditional Logic)
const mongoose_1 = __importDefault(require("mongoose"));
// Schema for option
const questionOptionSchema = new mongoose_1.default.Schema({
    value: {
        type: String,
        required: true
    },
    label: {
        type: String,
        required: true
    },
    descriptor: {
        type: String,
        trim: true,
        maxLength: 500,
        default: null
    },
    placeholder: {
        type: String,
        trim: true,
        maxLength: 200,
        default: null
    }
});
// Schema for scale/rating question configuration
const scaleConfigSchema = new mongoose_1.default.Schema({
    min: { type: Number, required: true },
    max: { type: Number, required: true },
    step: { type: Number, default: 1 },
    minLabel: { type: String, trim: true, maxLength: 100 },
    maxLabel: { type: String, trim: true, maxLength: 100 },
    showNAOption: { type: Boolean, default: false }
}, { _id: false });
// Schema for matrix question configuration
const matrixConfigSchema = new mongoose_1.default.Schema({
    rows: [{
            label: { type: String, required: true, trim: true, maxLength: 500 }
        }],
    columns: [{
            value: { type: String, required: true },
            label: { type: String, required: true, trim: true, maxLength: 200 }
        }],
    allowMultiple: { type: Boolean, default: false }
}, { _id: false });
// NEW: Schema for conditional logic
const conditionalLogicSchema = new mongoose_1.default.Schema({
    enabled: {
        type: Boolean,
        default: false
    },
    conditions: [{
            questionId: {
                type: mongoose_1.default.Schema.Types.ObjectId,
                ref: 'Question',
                required: true
            },
            operator: {
                type: String,
                enum: ['equals', 'notEquals', 'contains', 'notContains', 'greaterThan', 'lessThan'],
                required: true
            },
            value: {
                type: mongoose_1.default.Schema.Types.Mixed,
                required: true
            }
        }],
    action: {
        type: String,
        enum: ['show', 'hide'],
        default: 'show'
    },
    logicOperator: {
        type: String,
        enum: ['AND', 'OR'],
        default: 'AND'
    }
}, { _id: false });
const questionSchema = new mongoose_1.default.Schema({
    text: {
        type: String,
        required: [true, 'Question text is required'],
        trim: true,
        minLength: 2,
    },
    description: {
        type: String,
        trim: true,
        maxLength: 1000,
    },
    type: {
        type: String,
        enum: ['text', 'textarea', 'number', 'date', 'time', 'datetime', 'radio', 'checkbox', 'dropdown', 'scale', 'matrix', 'file', 'location'],
        required: [true, 'Question type is required']
    },
    required: {
        type: Boolean,
        default: false
    },
    options: [questionOptionSchema],
    scaleConfig: scaleConfigSchema,
    matrixConfig: matrixConfigSchema,
    validation: {
        min: Number,
        max: Number,
        pattern: String,
        errorMessage: String
    },
    creator: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    categories: [{
            type: mongoose_1.default.Schema.Types.ObjectId,
            ref: 'Category',
            index: true,
        }],
    theme: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'Theme',
        required: true,
        index: true,
    },
    subThemes: [{
            type: mongoose_1.default.Schema.Types.ObjectId,
            ref: 'SubTheme',
            index: true,
        }],
    targetAudience: {
        type: String,
        enum: ['internal', 'external', 'both'],
        default: 'both'
    },
    status: {
        type: String,
        enum: ['draft', 'published', 'archived'],
        default: 'draft'
    },
    isTemplate: {
        type: Boolean,
        default: false
    },
    tags: [String],
    // NEW: Conditional Logic
    conditionalLogic: conditionalLogicSchema,
    // Bespoke Question Fields
    isBespoke: {
        type: Boolean,
        default: false,
        index: true
    },
    bespokeMetadata: {
        createdBy: {
            type: mongoose_1.default.Schema.Types.ObjectId,
            ref: 'User',
            required: function () {
                return this.isBespoke;
            }
        },
        project: {
            type: mongoose_1.default.Schema.Types.ObjectId,
            ref: 'Project',
            required: function () {
                return this.isBespoke;
            },
            index: true
        },
        organization: {
            type: mongoose_1.default.Schema.Types.ObjectId,
            ref: 'Organization',
            required: function () {
                return this.isBespoke;
            },
            index: true
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected', 'elevated'],
            default: 'pending',
            required: function () {
                return this.isBespoke;
            },
            index: true
        },
        approvedBy: {
            type: mongoose_1.default.Schema.Types.ObjectId,
            ref: 'User'
        },
        approvedAt: Date,
        elevatedBy: {
            type: mongoose_1.default.Schema.Types.ObjectId,
            ref: 'User'
        },
        elevatedAt: Date,
        originalQuestionId: {
            type: mongoose_1.default.Schema.Types.ObjectId,
            ref: 'Question'
        },
        rejectionReason: {
            type: String,
            trim: true,
            maxLength: 500
        }
    },
    // Standard Demographics Fields
    isStandardDemographic: {
        type: Boolean,
        default: false,
        index: true
    },
    demographicType: {
        type: String,
        enum: ['age', 'gender', 'education', 'income', 'location', 'employment', 'household_size', 'marital_status', 'ethnicity', 'language', 'disability', 'other'],
        required: function () {
            return this.isStandardDemographic;
        },
        index: true
    },
    demographicCategory: {
        type: String,
        enum: ['basic', 'socioeconomic', 'cultural', 'accessibility'],
        required: function () {
            return this.isStandardDemographic;
        },
        index: true
    },
    isGlobalStandard: {
        type: Boolean,
        default: false,
        index: true
    },
    demographicMetadata: {
        isRequired: {
            type: Boolean,
            default: false
        },
        recommendedForAudience: [{
                type: String,
                enum: ['internal', 'external', 'both']
            }],
        complianceRelevant: {
            type: Boolean,
            default: false
        },
        sensitivityLevel: {
            type: String,
            enum: ['low', 'medium', 'high'],
            default: 'medium'
        },
        dataRetentionPeriod: {
            type: Number,
            min: 1,
            max: 120
        },
        anonymizationRequired: {
            type: Boolean,
            default: false
        }
    },
    // Existing tag fields
    selectedIndicatorTags: [{
            type: mongoose_1.default.Schema.Types.ObjectId,
            ref: 'Indicator'
        }],
    selectedSdgTags: [{
            type: mongoose_1.default.Schema.Types.ObjectId,
            ref: 'SDG'
        }],
    selectedResilienceTags: [{
            type: mongoose_1.default.Schema.Types.ObjectId,
            ref: 'ResilienceDimension'
        }],
    selectedEsgTags: [{
            type: mongoose_1.default.Schema.Types.ObjectId,
            ref: 'ESGCategory'
        }],
    selectedStandardTags: [{
            type: mongoose_1.default.Schema.Types.ObjectId,
            ref: 'Standard'
        }],
    archived: {
        type: Boolean,
        default: false
    },
    archivedAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });
// Compound indexes
questionSchema.index({ isStandardDemographic: 1, demographicType: 1 });
questionSchema.index({ isStandardDemographic: 1, demographicCategory: 1 });
questionSchema.index({ isGlobalStandard: 1, targetAudience: 1 });
questionSchema.index({ 'demographicMetadata.complianceRelevant': 1 });
questionSchema.index({ isBespoke: 1, 'bespokeMetadata.status': 1 });
questionSchema.index({ isBespoke: 1, 'bespokeMetadata.project': 1 });
questionSchema.index({ isBespoke: 1, 'bespokeMetadata.organization': 1 });
questionSchema.index({ 'bespokeMetadata.createdBy': 1 });
// NEW: Index for conditional logic queries
questionSchema.index({ 'conditionalLogic.enabled': 1 });
questionSchema.index({ 'conditionalLogic.conditions.questionId': 1 });
// Pre-save middleware to validate demographic configuration
questionSchema.pre('save', function (next) {
    if (this.isStandardDemographic) {
        if (!this.demographicType || !this.demographicCategory) {
            return next(new Error('Demographic type and category are required for standard demographic questions'));
        }
        if (!this.demographicMetadata) {
            this.demographicMetadata = {
                isRequired: false,
                recommendedForAudience: ['both'],
                complianceRelevant: false,
                sensitivityLevel: 'medium',
                anonymizationRequired: false
            };
        }
    }
    else {
        if (!this.theme && !this.isBespoke) {
            return next(new Error('Theme is required for non-demographic questions'));
        }
    }
    next();
});
// Pre-save middleware for bespoke questions
questionSchema.pre('save', function (next) {
    var _a, _b, _c;
    if (this.isBespoke) {
        if (!((_a = this.bespokeMetadata) === null || _a === void 0 ? void 0 : _a.createdBy) || !((_b = this.bespokeMetadata) === null || _b === void 0 ? void 0 : _b.project) || !((_c = this.bespokeMetadata) === null || _c === void 0 ? void 0 : _c.organization)) {
            return next(new Error('Bespoke questions require createdBy, project, and organization in bespokeMetadata'));
        }
        if (!this.theme) {
            this.theme = null;
        }
        if (this.status !== 'published') {
            this.status = 'draft';
        }
    }
    next();
});
// NEW: Pre-save middleware to validate conditional logic
questionSchema.pre('save', function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (((_a = this.conditionalLogic) === null || _a === void 0 ? void 0 : _a.enabled) && this.conditionalLogic.conditions.length > 0) {
            try {
                const validation = yield this.validateConditionalLogic();
                // Log warnings but don't block save
                if (validation.warnings.length > 0) {
                    console.warn(`⚠️ Conditional logic warnings for question ${this._id}:`, validation.warnings);
                }
                // Only block save if there are critical errors
                if (!validation.isValid && validation.errors.length > 0) {
                    return next(new Error(`Conditional logic validation failed: ${validation.errors.join(', ')}`));
                }
            }
            catch (error) {
                console.error('Error validating conditional logic:', error);
                // Don't block save on validation errors, just log
            }
        }
        next();
    });
});
// NEW: Instance method to validate conditional logic
questionSchema.methods.validateConditionalLogic = function () {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const errors = [];
        const warnings = [];
        if (!((_a = this.conditionalLogic) === null || _a === void 0 ? void 0 : _a.enabled)) {
            return { isValid: true, errors, warnings };
        }
        const conditions = this.conditionalLogic.conditions || [];
        if (conditions.length === 0) {
            errors.push('Conditional logic is enabled but no conditions are defined');
            return { isValid: false, errors, warnings };
        }
        // Validate each condition
        for (let i = 0; i < conditions.length; i++) {
            const condition = conditions[i];
            // Check if referenced question exists
            try {
                const referencedQuestion = yield mongoose_1.default.model('Question').findById(condition.questionId);
                if (!referencedQuestion) {
                    warnings.push(`Condition ${i + 1}: Referenced question ${condition.questionId} not found`);
                    continue;
                }
                if (referencedQuestion.archived) {
                    warnings.push(`Condition ${i + 1}: Referenced question is archived`);
                }
                // Validate operator compatibility with question type
                const operatorCompatibility = validateOperatorCompatibility(referencedQuestion.type, condition.operator);
                if (!operatorCompatibility.isValid) {
                    errors.push(`Condition ${i + 1}: ${operatorCompatibility.error}`);
                }
                // Check for circular dependencies
                if ((_b = referencedQuestion.conditionalLogic) === null || _b === void 0 ? void 0 : _b.enabled) {
                    const hasCircularDep = yield checkCircularDependency(this._id, condition.questionId);
                    if (hasCircularDep) {
                        errors.push(`Condition ${i + 1}: Circular dependency detected`);
                    }
                }
            }
            catch (error) {
                warnings.push(`Condition ${i + 1}: Error validating referenced question - ${error}`);
            }
        }
        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    });
};
// NEW: Helper function to validate operator compatibility
function validateOperatorCompatibility(questionType, operator) {
    const compatibilityMap = {
        'text': ['equals', 'notEquals', 'contains', 'notContains'],
        'textarea': ['equals', 'notEquals', 'contains', 'notContains'],
        'number': ['equals', 'notEquals', 'greaterThan', 'lessThan'],
        'date': ['equals', 'notEquals', 'greaterThan', 'lessThan'],
        'time': ['equals', 'notEquals', 'greaterThan', 'lessThan'],
        'datetime': ['equals', 'notEquals', 'greaterThan', 'lessThan'],
        'radio': ['equals', 'notEquals'],
        'checkbox': ['contains', 'notContains'],
        'dropdown': ['equals', 'notEquals'],
        'scale': ['equals', 'notEquals', 'greaterThan', 'lessThan'],
        'matrix': ['equals', 'notEquals', 'contains', 'notContains'],
        'file': ['equals', 'notEquals'], // Check if file is uploaded
        'location': ['equals', 'notEquals']
    };
    const validOperators = compatibilityMap[questionType] || [];
    if (!validOperators.includes(operator)) {
        return {
            isValid: false,
            error: `Operator '${operator}' is not compatible with question type '${questionType}'. Valid operators: ${validOperators.join(', ')}`
        };
    }
    return { isValid: true };
}
// NEW: Helper function to check circular dependencies
function checkCircularDependency(sourceQuestionId_1, targetQuestionId_1) {
    return __awaiter(this, arguments, void 0, function* (sourceQuestionId, targetQuestionId, visited = new Set()) {
        var _a;
        const targetIdStr = targetQuestionId.toString();
        const sourceIdStr = sourceQuestionId.toString();
        if (visited.has(targetIdStr)) {
            return false; // Already checked this path
        }
        visited.add(targetIdStr);
        const targetQuestion = yield mongoose_1.default.model('Question').findById(targetQuestionId);
        if (!targetQuestion || !((_a = targetQuestion.conditionalLogic) === null || _a === void 0 ? void 0 : _a.enabled)) {
            return false;
        }
        // Check if target depends on source (circular)
        for (const condition of targetQuestion.conditionalLogic.conditions || []) {
            if (condition.questionId.toString() === sourceIdStr) {
                return true; // Circular dependency found
            }
            // Check nested dependencies
            const hasNested = yield checkCircularDependency(sourceQuestionId, condition.questionId, visited);
            if (hasNested) {
                return true;
            }
        }
        return false;
    });
}
// NEW: Instance method to get conditional dependencies
questionSchema.methods.getConditionalDependencies = function () {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (!((_a = this.conditionalLogic) === null || _a === void 0 ? void 0 : _a.enabled) || !this.conditionalLogic.conditions.length) {
            return [];
        }
        const questionIds = this.conditionalLogic.conditions.map(c => c.questionId);
        return mongoose_1.default.model('Question').find({
            _id: { $in: questionIds },
            archived: { $ne: true }
        });
    });
};
// NEW: Static method to get questions with their dependencies
questionSchema.statics.getQuestionsWithDependencies = function (questionIds) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const questions = yield this.find({
            _id: { $in: questionIds },
            archived: { $ne: true }
        });
        const allDependencies = new Set();
        // Collect all dependencies
        for (const question of questions) {
            if ((_a = question.conditionalLogic) === null || _a === void 0 ? void 0 : _a.enabled) {
                for (const condition of question.conditionalLogic.conditions || []) {
                    allDependencies.add(condition.questionId.toString());
                }
            }
        }
        // Fetch dependencies
        if (allDependencies.size > 0) {
            const dependencies = yield this.find({
                _id: { $in: Array.from(allDependencies) },
                archived: { $ne: true }
            });
            return [...questions, ...dependencies];
        }
        return questions;
    });
};
// Instance method to check if question is eligible for a specific audience
questionSchema.methods.isEligibleForAudience = function (audience) {
    var _a;
    if (!this.isStandardDemographic)
        return true;
    const recommendedAudiences = ((_a = this.demographicMetadata) === null || _a === void 0 ? void 0 : _a.recommendedForAudience) || [];
    return recommendedAudiences.includes(audience) || recommendedAudiences.includes('both');
};
// Instance method to get compliance information
questionSchema.methods.getDemographicCompliance = function () {
    if (!this.isStandardDemographic || !this.demographicMetadata) {
        return {
            gdprRelevant: false,
            sensitivityLevel: 'low',
            anonymizationRequired: false
        };
    }
    return {
        gdprRelevant: this.demographicMetadata.complianceRelevant,
        sensitivityLevel: this.demographicMetadata.sensitivityLevel,
        retentionPeriod: this.demographicMetadata.dataRetentionPeriod,
        anonymizationRequired: this.demographicMetadata.anonymizationRequired
    };
};
// NEW: Check if user can approve this bespoke question
questionSchema.methods.canBeApprovedBy = function (userId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (!this.isBespoke || !this.bespokeMetadata)
            return false;
        if (this.bespokeMetadata.status !== 'pending')
            return false;
        const Project = mongoose_1.default.model('Project');
        const project = yield Project.findById(this.bespokeMetadata.project);
        if (!project)
            return false;
        // Check if user is project creator
        if (project.creator.toString() === userId.toString())
            return true;
        // Check if user is project manager (has role 'manager' in team)
        const teamMember = (_a = project.team) === null || _a === void 0 ? void 0 : _a.find((member) => member.user.toString() === userId.toString() && member.role === 'manager');
        return !!teamMember;
    });
};
// NEW: Approve bespoke question
questionSchema.methods.approveBespokeQuestion = function (approverId) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!this.isBespoke || !this.bespokeMetadata) {
            throw new Error('Only bespoke questions can be approved');
        }
        if (this.bespokeMetadata.status !== 'pending') {
            throw new Error('Only pending questions can be approved');
        }
        const canApprove = yield this.canBeApprovedBy(approverId);
        if (!canApprove) {
            throw new Error('User does not have permission to approve this question');
        }
        this.bespokeMetadata.status = 'approved';
        this.bespokeMetadata.approvedBy = approverId;
        this.bespokeMetadata.approvedAt = new Date();
        this.status = 'published';
        yield this.save();
    });
};
// NEW: Reject bespoke question
questionSchema.methods.rejectBespokeQuestion = function (rejectorId, reason) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!this.isBespoke || !this.bespokeMetadata) {
            throw new Error('Only bespoke questions can be rejected');
        }
        if (this.bespokeMetadata.status !== 'pending') {
            throw new Error('Only pending questions can be rejected');
        }
        const canApprove = yield this.canBeApprovedBy(rejectorId);
        if (!canApprove) {
            throw new Error('User does not have permission to reject this question');
        }
        this.bespokeMetadata.status = 'rejected';
        this.bespokeMetadata.rejectionReason = reason;
        this.status = 'archived';
        yield this.save();
    });
};
// NEW: Elevate bespoke question to regular question
questionSchema.methods.elevateBespokeQuestion = function (staffId) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!this.isBespoke || !this.bespokeMetadata) {
            throw new Error('Only bespoke questions can be elevated');
        }
        if (this.bespokeMetadata.status === 'elevated') {
            throw new Error('Question has already been elevated');
        }
        // Verify staff user
        const User = mongoose_1.default.model('User');
        const staff = yield User.findById(staffId);
        if (!staff || !staff.isConnectGoStaff) {
            throw new Error('Only ConnectGo staff can elevate questions');
        }
        // Create a new regular question (elevated copy)
        const Question = mongoose_1.default.model('Question');
        const elevatedQuestion = new Question({
            text: this.text,
            description: this.description,
            type: this.type,
            required: this.required,
            options: this.options,
            validation: this.validation,
            creator: staffId, // Staff becomes the creator
            categories: this.categories, // was: category
            theme: this.theme,
            subThemes: this.subThemes,
            targetAudience: this.targetAudience,
            tags: this.tags,
            selectedIndicatorTags: this.selectedIndicatorTags,
            selectedSdgTags: this.selectedSdgTags,
            selectedResilienceTags: this.selectedResilienceTags,
            selectedEsgTags: this.selectedEsgTags,
            selectedStandardTags: this.selectedStandardTags,
            status: 'published',
            isTemplate: false,
            isBespoke: false, // This is now a regular question
            isStandardDemographic: this.isStandardDemographic,
            demographicType: this.demographicType,
            demographicCategory: this.demographicCategory,
            isGlobalStandard: this.isGlobalStandard,
            demographicMetadata: this.demographicMetadata
        });
        yield elevatedQuestion.save();
        // Mark original as elevated
        this.bespokeMetadata.status = 'elevated';
        this.bespokeMetadata.elevatedBy = staffId;
        this.bespokeMetadata.elevatedAt = new Date();
        this.bespokeMetadata.originalQuestionId = elevatedQuestion._id;
        yield this.save();
        return elevatedQuestion;
    });
};
// Static method to get standard demographic questions with filters
questionSchema.statics.getStandardDemographics = function () {
    return __awaiter(this, arguments, void 0, function* (filters = {}) {
        const query = {
            isStandardDemographic: true,
            archived: { $ne: true }
        };
        if (filters.demographicType) {
            query.demographicType = filters.demographicType;
        }
        if (filters.category) {
            query.demographicCategory = filters.category;
        }
        if (filters.globalOnly) {
            query.isGlobalStandard = true;
        }
        let questions = yield this.find(query).populate('categories theme subThemes');
        // Filter by audience eligibility if specified
        if (filters.audience && filters.audience !== 'both') {
            questions = questions.filter((q) => q.isEligibleForAudience(filters.audience));
        }
        return questions;
    });
};
// Static method to get demographics by category
questionSchema.statics.getDemographicsByCategory = function (category) {
    return __awaiter(this, void 0, void 0, function* () {
        return this.find({
            isStandardDemographic: true,
            demographicCategory: category,
            archived: { $ne: true }
        }).populate('categories theme subThemes');
    });
};
// Static method to get recommended demographics for an audience
questionSchema.statics.getRecommendedDemographics = function (audience) {
    return __awaiter(this, void 0, void 0, function* () {
        const allDemographics = yield this.find({
            isStandardDemographic: true,
            archived: { $ne: true }
        }).populate('categories theme subThemes');
        return allDemographics.filter((q) => q.isEligibleForAudience(audience));
    });
};
// NEW: Get bespoke questions by project
questionSchema.statics.getBespokeQuestionsByProject = function (projectId_1) {
    return __awaiter(this, arguments, void 0, function* (projectId, filters = {}) {
        const query = {
            isBespoke: true,
            'bespokeMetadata.project': projectId,
            archived: { $ne: true }
        };
        if (filters.status) {
            query['bespokeMetadata.status'] = filters.status;
        }
        else if (!filters.includeElevated) {
            query['bespokeMetadata.status'] = { $ne: 'elevated' };
        }
        if (filters.createdBy) {
            query['bespokeMetadata.createdBy'] = filters.createdBy;
        }
        return this.find(query)
            .populate('bespokeMetadata.createdBy', 'name email')
            .populate('bespokeMetadata.approvedBy', 'name email')
            .populate('bespokeMetadata.elevatedBy', 'name email')
            .populate('bespokeMetadata.project', 'name')
            .populate('categories', 'name')
            .sort('-createdAt');
    });
};
// NEW: Get bespoke questions by organization
questionSchema.statics.getBespokeQuestionsByOrganization = function (organizationId_1) {
    return __awaiter(this, arguments, void 0, function* (organizationId, filters = {}) {
        const query = {
            isBespoke: true,
            'bespokeMetadata.organization': organizationId,
            archived: { $ne: true }
        };
        if (filters.status) {
            query['bespokeMetadata.status'] = filters.status;
        }
        if (filters.project) {
            query['bespokeMetadata.project'] = filters.project;
        }
        return this.find(query)
            .populate('bespokeMetadata.createdBy', 'name email')
            .populate('bespokeMetadata.approvedBy', 'name email')
            .populate('bespokeMetadata.project', 'name')
            .populate('categories', 'name')
            .sort('-createdAt');
    });
};
// NEW: Get approved bespoke questions available for a project
questionSchema.statics.getAvailableBespokeQuestionsForProject = function (projectId) {
    return __awaiter(this, void 0, void 0, function* () {
        return this.find({
            isBespoke: true,
            'bespokeMetadata.project': projectId,
            'bespokeMetadata.status': { $in: ['pending', 'approved'] }, // ← usable within originating project
            archived: { $ne: true }
        })
            .populate('bespokeMetadata.createdBy', 'name email')
            .populate('categories', 'name')
            .sort('-createdAt');
    });
};
// Existing validation methods (keeping your original logic)
questionSchema.methods.validateSelectedTags = function () {
    return __awaiter(this, void 0, void 0, function* () {
        if (!this.subThemes || this.subThemes.length === 0)
            return true;
        const SubTheme = mongoose_1.default.model('SubTheme');
        const subThemeDocs = yield SubTheme.find({ _id: { $in: this.subThemes } });
        // Merge all available tags across selected subThemes
        const mergeIds = (arr) => new Set(arr.flat().map(id => id.toString()));
        const availableIndicators = mergeIds(subThemeDocs.map(st => st.indicatorTags || []));
        const availableSdgs = mergeIds(subThemeDocs.map(st => st.sdgTags || []));
        const availableResilience = mergeIds(subThemeDocs.map(st => st.resilienceTags || []));
        const availableEsg = mergeIds(subThemeDocs.map(st => st.esgTags || []));
        const availableStandards = mergeIds(subThemeDocs.map(st => st.standardTags || []));
        const isSubset = (selected, available) => selected.every(id => available.has(id.toString()));
        return (isSubset(this.selectedIndicatorTags, availableIndicators) &&
            isSubset(this.selectedSdgTags, availableSdgs) &&
            isSubset(this.selectedResilienceTags, availableResilience) &&
            isSubset(this.selectedEsgTags, availableEsg) &&
            isSubset(this.selectedStandardTags, availableStandards));
    });
};
questionSchema.methods.getAvailableTagsFromSubtheme = function () {
    return __awaiter(this, void 0, void 0, function* () {
        if (!this.subThemes || this.subThemes.length === 0)
            return null;
        const SubTheme = mongoose_1.default.model('SubTheme');
        const subThemeDocs = yield SubTheme.find({ _id: { $in: this.subThemes } })
            .populate('indicatorTags', 'name description')
            .populate('sdgTags', 'code name description')
            .populate('resilienceTags', 'code name description')
            .populate('esgTags', 'code name description type')
            .populate('standardTags', 'code name description issuingBody');
        // Deduplicate by _id across all subThemes
        const dedupe = (items) => {
            const seen = new Set();
            return items.filter(item => {
                const id = item._id.toString();
                if (seen.has(id))
                    return false;
                seen.add(id);
                return true;
            });
        };
        return {
            availableIndicators: dedupe(subThemeDocs.flatMap(st => st.indicatorTags || [])),
            availableSdgs: dedupe(subThemeDocs.flatMap(st => st.sdgTags || [])),
            availableResilience: dedupe(subThemeDocs.flatMap(st => st.resilienceTags || [])),
            availableEsg: dedupe(subThemeDocs.flatMap(st => st.esgTags || [])),
            availableStandards: dedupe(subThemeDocs.flatMap(st => st.standardTags || [])),
        };
    });
};
const Question = mongoose_1.default.model('Question', questionSchema);
exports.default = Question;
//# sourceMappingURL=question.model.js.map