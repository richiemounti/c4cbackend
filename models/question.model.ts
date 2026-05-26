// models/question.model.ts (Enhanced with Conditional Logic)
import mongoose from "mongoose";

// Interface for option (multiple choice, dropdown, etc.)
interface IQuestionOption {
    value: string;
    label: string;
    descriptor?: string;   // Optional explanation prompt for this choice (e.g. "Please tell us more")
    placeholder?: string;  // Optional custom placeholder text for the descriptor input
}

// NEW: Interface for conditional logic
interface IConditionalLogic {
    enabled: boolean;
    conditions: Array<{
        questionId: mongoose.Types.ObjectId; // References another Question in the library
        operator: 'equals' | 'notEquals' | 'contains' | 'notContains' | 'greaterThan' | 'lessThan';
        value: any;
    }>;
    action: 'show' | 'hide';
    logicOperator?: 'AND' | 'OR'; // How to combine multiple conditions
}

// Interface for scale/rating question configuration
interface IScaleConfig {
    min: number;
    max: number;
    step?: number;
    minLabel?: string;
    maxLabel?: string;
    showNAOption?: boolean;
}

// Interfaces for matrix question configuration
interface IMatrixRow {
    label: string;
}

interface IMatrixColumn {
    value: string;
    label: string;
}

interface IMatrixConfig {
    rows: IMatrixRow[];
    columns: IMatrixColumn[];
    allowMultiple?: boolean;
}

// Interface for the Question document
interface IQuestion {
    text: string;
    description?: string;
    type: 'text' | 'textarea' | 'number' | 'date' | 'time' | 'datetime' | 'radio' | 'checkbox' | 'dropdown' | 'scale' | 'matrix' | 'file' | 'location';
    required: boolean;
    options: IQuestionOption[];
    validation?: {
        min?: number;
        max?: number;
        pattern?: string;
        errorMessage?: string;
    };
    creator: mongoose.Types.ObjectId;
    categories: mongoose.Types.ObjectId[];   // one-to-many
    theme: mongoose.Types.ObjectId;
    subThemes: mongoose.Types.ObjectId[];    // one-to-many
    targetAudience: 'internal' | 'external' | 'both';
    status: 'draft' | 'published' | 'archived';
    isTemplate: boolean;
    tags: string[];

    // NEW: Conditional Logic at Question Template Level
    conditionalLogic?: IConditionalLogic;

    // Bespoke Question Fields
    isBespoke: boolean;
    bespokeMetadata?: {
        createdBy: mongoose.Types.ObjectId;
        project: mongoose.Types.ObjectId;
        organization: mongoose.Types.ObjectId;
        status: 'pending' | 'approved' | 'rejected' | 'elevated';
        approvedBy?: mongoose.Types.ObjectId;
        approvedAt?: Date;
        elevatedBy?: mongoose.Types.ObjectId;
        elevatedAt?: Date;
        originalQuestionId?: mongoose.Types.ObjectId;
        rejectionReason?: string;
    };
    
    // Standard Demographics Configuration
    isStandardDemographic: boolean;
    demographicType?: 'age' | 'gender' | 'education' | 'income' | 'location' | 'employment' | 'household_size' | 'marital_status' | 'ethnicity' | 'language' | 'disability' | 'other';
    demographicCategory?: 'basic' | 'socioeconomic' | 'cultural' | 'accessibility';
    isGlobalStandard: boolean;
    demographicMetadata?: {
        isRequired: boolean;
        recommendedForAudience: ('internal' | 'external' | 'both')[];
        complianceRelevant: boolean;
        sensitivityLevel: 'low' | 'medium' | 'high';
        dataRetentionPeriod?: number;
        anonymizationRequired: boolean;
    };
    
    // User-selected tags from subtheme's available tags
    selectedIndicatorTags: mongoose.Types.ObjectId[];
    selectedSdgTags: mongoose.Types.ObjectId[];
    selectedResilienceTags: mongoose.Types.ObjectId[];
    selectedEsgTags: mongoose.Types.ObjectId[];
    selectedStandardTags: mongoose.Types.ObjectId[];
    scaleConfig?: IScaleConfig;
    matrixConfig?: IMatrixConfig;
    archived: boolean;
    archivedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

// Interface for instance methods
interface IQuestionMethods {
    validateSelectedTags(): Promise<boolean>;
    getAvailableTagsFromSubtheme(): Promise<any>;
    
    // Demographic handling methods
    isEligibleForAudience(audience: 'internal' | 'external' | 'both'): boolean;
    getDemographicCompliance(): {
        gdprRelevant: boolean;
        sensitivityLevel: string;
        retentionPeriod?: number;
        anonymizationRequired: boolean;
    };

    // Bespoke Question Methods
    canBeApprovedBy(userId: mongoose.Types.ObjectId): Promise<boolean>;
    approveBespokeQuestion(approverId: mongoose.Types.ObjectId): Promise<void>;
    rejectBespokeQuestion(rejectorId: mongoose.Types.ObjectId, reason: string): Promise<void>;
    elevateBespokeQuestion(staffId: mongoose.Types.ObjectId): Promise<IQuestionDocument>;

    // NEW: Conditional Logic Methods
    validateConditionalLogic(): Promise<{
        isValid: boolean;
        errors: string[];
        warnings: string[];
    }>;
    getConditionalDependencies(): Promise<IQuestionDocument[]>;
}

// Combined interface for the document
interface IQuestionDocument extends mongoose.Document, IQuestion, IQuestionMethods {}

// Interface for the model
interface IQuestionModel extends mongoose.Model<IQuestionDocument> {
    getStandardDemographics(filters?: any): Promise<IQuestionDocument[]>;
    getDemographicsByCategory(category: string): Promise<IQuestionDocument[]>;
    getRecommendedDemographics(audience: 'internal' | 'external' | 'both'): Promise<IQuestionDocument[]>;
    getBespokeQuestionsByProject(projectId: string, filters?: any): Promise<IQuestionDocument[]>;
    getBespokeQuestionsByOrganization(organizationId: string, filters?: any): Promise<IQuestionDocument[]>;
    getAvailableBespokeQuestionsForProject(projectId: string): Promise<IQuestionDocument[]>;
    // NEW: Get questions with their conditional dependencies
    getQuestionsWithDependencies(questionIds: string[]): Promise<IQuestionDocument[]>;
}

// Schema for option
const questionOptionSchema = new mongoose.Schema({
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
const scaleConfigSchema = new mongoose.Schema({
    min: { type: Number, required: true },
    max: { type: Number, required: true },
    step: { type: Number, default: 1 },
    minLabel: { type: String, trim: true, maxLength: 100 },
    maxLabel: { type: String, trim: true, maxLength: 100 },
    showNAOption: { type: Boolean, default: false }
}, { _id: false });

// Schema for matrix question configuration
const matrixConfigSchema = new mongoose.Schema({
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
const conditionalLogicSchema = new mongoose.Schema({
    enabled: {
        type: Boolean,
        default: false
    },
    conditions: [{
        questionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Question',
            required: true
        },
        operator: {
            type: String,
            enum: ['equals', 'notEquals', 'contains', 'notContains', 'greaterThan', 'lessThan'],
            required: true
        },
        value: {
            type: mongoose.Schema.Types.Mixed,
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

const questionSchema = new mongoose.Schema({
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
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    categories: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        index: true,
    }],
    theme: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Theme',
        required: true,
        index: true,
    },
    subThemes: [{
        type: mongoose.Schema.Types.ObjectId,
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
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: function(this: IQuestion) {
                return this.isBespoke;
            }
        },
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Project',
            required: function(this: IQuestion) {
                return this.isBespoke;
            },
            index: true
        },
        organization: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            required: function(this: IQuestion) {
                return this.isBespoke;
            },
            index: true
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected', 'elevated'],
            default: 'pending',
            required: function(this: IQuestion) {
                return this.isBespoke;
            },
            index: true
        },
        approvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        approvedAt: Date,
        elevatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        elevatedAt: Date,
        originalQuestionId: {
            type: mongoose.Schema.Types.ObjectId,
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
        required: function(this: IQuestion) {
            return this.isStandardDemographic;
        },
        index: true
    },
    demographicCategory: {
        type: String,
        enum: ['basic', 'socioeconomic', 'cultural', 'accessibility'],
        required: function(this: IQuestion) {
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
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Indicator'
    }],
    selectedSdgTags: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SDG'
    }],
    selectedResilienceTags: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ResilienceDimension'
    }],
    selectedEsgTags: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ESGCategory'
    }],
    selectedStandardTags: [{
        type: mongoose.Schema.Types.ObjectId,
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
questionSchema.pre('save', function(this: IQuestionDocument, next) {
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
  } else {
    if (!this.theme && !this.isBespoke) {
      return next(new Error('Theme is required for non-demographic questions'));
    }
  }
  
  next();
});

// Pre-save middleware for bespoke questions
questionSchema.pre('save', function(this: IQuestionDocument, next) {
    if (this.isBespoke) {
        if (!this.bespokeMetadata?.createdBy || !this.bespokeMetadata?.project || !this.bespokeMetadata?.organization) {
            return next(new Error('Bespoke questions require createdBy, project, and organization in bespokeMetadata'));
        }
        
        if (!this.theme) {
            this.theme = null as any;
        }
        
        if (this.status !== 'published') {
            this.status = 'draft';
        }
    }
    
    next();
});

// NEW: Pre-save middleware to validate conditional logic
questionSchema.pre('save', async function(this: IQuestionDocument, next) {
    if (this.conditionalLogic?.enabled && this.conditionalLogic.conditions.length > 0) {
        try {
            const validation = await this.validateConditionalLogic();
            
            // Log warnings but don't block save
            if (validation.warnings.length > 0) {
                console.warn(`⚠️ Conditional logic warnings for question ${this._id}:`, validation.warnings);
            }
            
            // Only block save if there are critical errors
            if (!validation.isValid && validation.errors.length > 0) {
                return next(new Error(`Conditional logic validation failed: ${validation.errors.join(', ')}`));
            }
        } catch (error) {
            console.error('Error validating conditional logic:', error);
            // Don't block save on validation errors, just log
        }
    }
    
    next();
});

// NEW: Instance method to validate conditional logic
questionSchema.methods.validateConditionalLogic = async function(this: IQuestionDocument): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
}> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    if (!this.conditionalLogic?.enabled) {
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
            const referencedQuestion = await mongoose.model('Question').findById(condition.questionId);
            
            if (!referencedQuestion) {
                warnings.push(`Condition ${i + 1}: Referenced question ${condition.questionId} not found`);
                continue;
            }
            
            if (referencedQuestion.archived) {
                warnings.push(`Condition ${i + 1}: Referenced question is archived`);
            }
            
            // Validate operator compatibility with question type
            const operatorCompatibility = validateOperatorCompatibility(
                referencedQuestion.type,
                condition.operator
            );
            
            if (!operatorCompatibility.isValid) {
                errors.push(`Condition ${i + 1}: ${operatorCompatibility.error}`);
            }
            
            // Check for circular dependencies
            if (referencedQuestion.conditionalLogic?.enabled) {
                const hasCircularDep = await checkCircularDependency(
                    this._id as mongoose.Types.ObjectId,
                    condition.questionId
                );
                
                if (hasCircularDep) {
                    errors.push(`Condition ${i + 1}: Circular dependency detected`);
                }
            }
            
        } catch (error) {
            warnings.push(`Condition ${i + 1}: Error validating referenced question - ${error}`);
        }
    }
    
    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
};

// NEW: Helper function to validate operator compatibility
function validateOperatorCompatibility(
    questionType: string,
    operator: string
): { isValid: boolean; error?: string } {
    const compatibilityMap: Record<string, string[]> = {
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
async function checkCircularDependency(
    sourceQuestionId: mongoose.Types.ObjectId,
    targetQuestionId: mongoose.Types.ObjectId,
    visited: Set<string> = new Set()
): Promise<boolean> {
    const targetIdStr = targetQuestionId.toString();
    const sourceIdStr = sourceQuestionId.toString();
    
    if (visited.has(targetIdStr)) {
        return false; // Already checked this path
    }
    
    visited.add(targetIdStr);
    
    const targetQuestion = await mongoose.model('Question').findById(targetQuestionId);
    
    if (!targetQuestion || !targetQuestion.conditionalLogic?.enabled) {
        return false;
    }
    
    // Check if target depends on source (circular)
    for (const condition of targetQuestion.conditionalLogic.conditions || []) {
        if (condition.questionId.toString() === sourceIdStr) {
            return true; // Circular dependency found
        }
        
        // Check nested dependencies
        const hasNested = await checkCircularDependency(
            sourceQuestionId,
            condition.questionId,
            visited
        );
        
        if (hasNested) {
            return true;
        }
    }
    
    return false;
}

// NEW: Instance method to get conditional dependencies
questionSchema.methods.getConditionalDependencies = async function(this: IQuestionDocument): Promise<IQuestionDocument[]> {
    if (!this.conditionalLogic?.enabled || !this.conditionalLogic.conditions.length) {
        return [];
    }
    
    const questionIds = this.conditionalLogic.conditions.map(c => c.questionId);
    
    return mongoose.model('Question').find({
        _id: { $in: questionIds },
        archived: { $ne: true }
    });
};

// NEW: Static method to get questions with their dependencies
questionSchema.statics.getQuestionsWithDependencies = async function(
    questionIds: string[]
): Promise<IQuestionDocument[]> {
    const questions = await this.find({
        _id: { $in: questionIds },
        archived: { $ne: true }
    });
    
    const allDependencies = new Set<string>();
    
    // Collect all dependencies
    for (const question of questions) {
        if (question.conditionalLogic?.enabled) {
            for (const condition of question.conditionalLogic.conditions || []) {
                allDependencies.add(condition.questionId.toString());
            }
        }
    }
    
    // Fetch dependencies
    if (allDependencies.size > 0) {
        const dependencies = await this.find({
            _id: { $in: Array.from(allDependencies) },
            archived: { $ne: true }
        });
        
        return [...questions, ...dependencies];
    }
    
    return questions;
};

// Instance method to check if question is eligible for a specific audience
questionSchema.methods.isEligibleForAudience = function(this: IQuestionDocument, audience: 'internal' | 'external' | 'both'): boolean {
    if (!this.isStandardDemographic) return true;
    
    const recommendedAudiences = this.demographicMetadata?.recommendedForAudience || [];
    return recommendedAudiences.includes(audience) || recommendedAudiences.includes('both');
};

// Instance method to get compliance information
questionSchema.methods.getDemographicCompliance = function(this: IQuestionDocument) {
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
questionSchema.methods.canBeApprovedBy = async function(this: IQuestionDocument, userId: mongoose.Types.ObjectId): Promise<boolean> {
    if (!this.isBespoke || !this.bespokeMetadata) return false;
    if (this.bespokeMetadata.status !== 'pending') return false;
    
    const Project = mongoose.model('Project');
    const project = await Project.findById(this.bespokeMetadata.project);
    
    if (!project) return false;
    
    // Check if user is project creator
    if (project.creator.toString() === userId.toString()) return true;
    
    // Check if user is project manager (has role 'manager' in team)
    const teamMember = project.team?.find((member: any) => 
        member.user.toString() === userId.toString() && member.role === 'manager'
    );
    
    return !!teamMember;
};

// NEW: Approve bespoke question
questionSchema.methods.approveBespokeQuestion = async function(this: IQuestionDocument, approverId: mongoose.Types.ObjectId): Promise<void> {
    if (!this.isBespoke || !this.bespokeMetadata) {
        throw new Error('Only bespoke questions can be approved');
    }
    
    if (this.bespokeMetadata.status !== 'pending') {
        throw new Error('Only pending questions can be approved');
    }
    
    const canApprove = await this.canBeApprovedBy(approverId);
    if (!canApprove) {
        throw new Error('User does not have permission to approve this question');
    }
    
    this.bespokeMetadata.status = 'approved';
    this.bespokeMetadata.approvedBy = approverId;
    this.bespokeMetadata.approvedAt = new Date();
    this.status = 'published';
    
    await this.save();
};

// NEW: Reject bespoke question
questionSchema.methods.rejectBespokeQuestion = async function(this: IQuestionDocument, rejectorId: mongoose.Types.ObjectId, reason: string): Promise<void> {
    if (!this.isBespoke || !this.bespokeMetadata) {
        throw new Error('Only bespoke questions can be rejected');
    }
    
    if (this.bespokeMetadata.status !== 'pending') {
        throw new Error('Only pending questions can be rejected');
    }
    
    const canApprove = await this.canBeApprovedBy(rejectorId);
    if (!canApprove) {
        throw new Error('User does not have permission to reject this question');
    }
    
    this.bespokeMetadata.status = 'rejected';
    this.bespokeMetadata.rejectionReason = reason;
    this.status = 'archived';
    
    await this.save();
};

// NEW: Elevate bespoke question to regular question
questionSchema.methods.elevateBespokeQuestion = async function(this: IQuestionDocument, staffId: mongoose.Types.ObjectId): Promise<IQuestionDocument> {
    if (!this.isBespoke || !this.bespokeMetadata) {
        throw new Error('Only bespoke questions can be elevated');
    }
    
    if (this.bespokeMetadata.status === 'elevated') {
        throw new Error('Question has already been elevated');
    }
    
    // Verify staff user
    const User = mongoose.model('User');
    const staff = await User.findById(staffId);
    if (!staff || !staff.isConnectGoStaff) {
        throw new Error('Only ConnectGo staff can elevate questions');
    }
    
    // Create a new regular question (elevated copy)
    const Question = mongoose.model('Question');
    const elevatedQuestion = new Question({
        text: this.text,
        description: this.description,
        type: this.type,
        required: this.required,
        options: this.options,
        validation: this.validation,
        creator: staffId, // Staff becomes the creator
        categories: this.categories,         // was: category
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
    
    await elevatedQuestion.save();
    
    // Mark original as elevated
    this.bespokeMetadata.status = 'elevated';
    this.bespokeMetadata.elevatedBy = staffId;
    this.bespokeMetadata.elevatedAt = new Date();
    this.bespokeMetadata.originalQuestionId = elevatedQuestion._id as mongoose.Types.ObjectId;
    
    await this.save();
    
    return elevatedQuestion;
};

// Static method to get standard demographic questions with filters
questionSchema.statics.getStandardDemographics = async function(
    filters: {
        demographicType?: string;
        category?: string;
        audience?: string;
        globalOnly?: boolean;
    } = {}
) {
    const query: any = { 
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
    
    let questions = await this.find(query).populate('categories theme subThemes');
    
    // Filter by audience eligibility if specified
    if (filters.audience && filters.audience !== 'both') {
        questions = questions.filter((q: any) => q.isEligibleForAudience(filters.audience as any));
    }
    
    return questions;
};

// Static method to get demographics by category
questionSchema.statics.getDemographicsByCategory = async function(category: string) {
    return this.find({
        isStandardDemographic: true,
        demographicCategory: category,
        archived: { $ne: true }
    }).populate('categories theme subThemes');
};

// Static method to get recommended demographics for an audience
questionSchema.statics.getRecommendedDemographics = async function(
    audience: 'internal' | 'external' | 'both'
) {
    const allDemographics = await this.find({
        isStandardDemographic: true,
        archived: { $ne: true }
    }).populate('categories theme subThemes');
    
    return allDemographics.filter((q: any) => q.isEligibleForAudience(audience));
};

// NEW: Get bespoke questions by project
questionSchema.statics.getBespokeQuestionsByProject = async function(
    projectId: string,
    filters: {
        status?: string;
        createdBy?: string;
        includeElevated?: boolean;
    } = {}
) {
    const query: any = {
        isBespoke: true,
        'bespokeMetadata.project': projectId,
        archived: { $ne: true }
    };
    
    if (filters.status) {
        query['bespokeMetadata.status'] = filters.status;
    } else if (!filters.includeElevated) {
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
};

// NEW: Get bespoke questions by organization
questionSchema.statics.getBespokeQuestionsByOrganization = async function(
    organizationId: string,
    filters: {
        status?: string;
        project?: string;
    } = {}
) {
    const query: any = {
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
};

// NEW: Get approved bespoke questions available for a project
questionSchema.statics.getAvailableBespokeQuestionsForProject = async function(projectId: string) {
    return this.find({
        isBespoke: true,
        'bespokeMetadata.project': projectId,
        'bespokeMetadata.status': { $in: ['pending', 'approved'] }, // ← usable within originating project
        archived: { $ne: true }
    })
    .populate('bespokeMetadata.createdBy', 'name email')
    .populate('categories', 'name')
    .sort('-createdAt');
};

// Existing validation methods (keeping your original logic)
questionSchema.methods.validateSelectedTags = async function(this: IQuestionDocument): Promise<boolean> {
    if (!this.subThemes || this.subThemes.length === 0) return true;

    const SubTheme = mongoose.model('SubTheme');
    const subThemeDocs = await SubTheme.find({ _id: { $in: this.subThemes } });

    // Merge all available tags across selected subThemes
    const mergeIds = (arr: mongoose.Types.ObjectId[][]) =>
        new Set(arr.flat().map(id => id.toString()));

    const availableIndicators = mergeIds(subThemeDocs.map(st => st.indicatorTags || []));
    const availableSdgs       = mergeIds(subThemeDocs.map(st => st.sdgTags || []));
    const availableResilience = mergeIds(subThemeDocs.map(st => st.resilienceTags || []));
    const availableEsg        = mergeIds(subThemeDocs.map(st => st.esgTags || []));
    const availableStandards  = mergeIds(subThemeDocs.map(st => st.standardTags || []));

    const isSubset = (selected: mongoose.Types.ObjectId[], available: Set<string>): boolean =>
        selected.every(id => available.has(id.toString()));

    return (
        isSubset(this.selectedIndicatorTags, availableIndicators) &&
        isSubset(this.selectedSdgTags, availableSdgs) &&
        isSubset(this.selectedResilienceTags, availableResilience) &&
        isSubset(this.selectedEsgTags, availableEsg) &&
        isSubset(this.selectedStandardTags, availableStandards)
    );
};

questionSchema.methods.getAvailableTagsFromSubtheme = async function(this: IQuestionDocument) {
    if (!this.subThemes || this.subThemes.length === 0) return null;

    const SubTheme = mongoose.model('SubTheme');
    const subThemeDocs = await SubTheme.find({ _id: { $in: this.subThemes } })
        .populate('indicatorTags', 'name description')
        .populate('sdgTags', 'code name description')
        .populate('resilienceTags', 'code name description')
        .populate('esgTags', 'code name description type')
        .populate('standardTags', 'code name description issuingBody');

    // Deduplicate by _id across all subThemes
    const dedupe = (items: any[]) => {
        const seen = new Set<string>();
        return items.filter(item => {
            const id = item._id.toString();
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
        });
    };

    return {
        availableIndicators: dedupe(subThemeDocs.flatMap(st => (st.indicatorTags as any[]) || [])),
        availableSdgs:       dedupe(subThemeDocs.flatMap(st => (st.sdgTags as any[]) || [])),
        availableResilience: dedupe(subThemeDocs.flatMap(st => (st.resilienceTags as any[]) || [])),
        availableEsg:        dedupe(subThemeDocs.flatMap(st => (st.esgTags as any[]) || [])),
        availableStandards:  dedupe(subThemeDocs.flatMap(st => (st.standardTags as any[]) || [])),
    };
};

const Question = mongoose.model<IQuestionDocument>('Question', questionSchema);

export default Question;
export type { IQuestionDocument, IQuestion, IQuestionMethods, IConditionalLogic, IScaleConfig, IMatrixConfig };