// models/sniQuestion.model.ts
// The single most important model in the SNI build. `questionRole` drives all
// engine behaviour (roster / repeating-group / piping) — see design brief §3.
//
// Business rules enforced below (not just documented) because getting this
// schema wrong is explicitly called out in the brief as something that
// "cannot be backfilled":
//   1. `section` is required for name_generator / tie_quality / standard, and
//      must be absent for alter_attribute (which attaches at survey level —
//      brief §3 "Alongside that, Kate and Belinda need to be able to... attach
//      alter attribute questions at survey level rather than to one sub-theme").
//   2. `responseType: 'alter_identifier'` and `questionRole: 'name_generator'`
//      always pair together, in both directions (brief §3 response-type table:
//      "Alter identifier — Name generator questions only").
//   3. `temporality` is required for alter_attribute (brief §4.5's stable/
//      time-varying split) and not stored for tie_quality, which is *always*
//      time-varying and doesn't need the field (brief §4.5 table).
//   4. `conditionalLogic` (one-level show/hide) is only meaningful for
//      questionRole 'standard' — brief §2: "conditional logic shows or hides a
//      question based on an answer. Nothing in the roster mechanism is shown
//      or hidden on that basis." Enabling it on any other role is rejected.
import mongoose from "mongoose";

interface ISniQuestionOption {
    value: string;
    label: string;
    descriptor?: string;
    placeholder?: string;
}

// One-level show/hide — a flat condition list plus a single AND/OR combinator,
// no nested groups (brief §3: "one-level show/hide logic"). Mirrors Question's
// conditionalLogic shape exactly, including logicOperator — which the existing
// SurveyQuestion schema is missing (confirmed platform gap, not ported here).
interface ISniConditionalLogic {
    enabled: boolean;
    conditions: Array<{
        questionId: mongoose.Types.ObjectId; // references another SniQuestion
        operator: 'equals' | 'notEquals' | 'contains' | 'notContains' | 'greaterThan' | 'lessThan';
        value: any;
    }>;
    action: 'show' | 'hide';
    logicOperator: 'AND' | 'OR';
}

interface IAlterIdentifierField {
    key: string;
    label: string;
    required: boolean;
    type: 'text' | 'url';
}

interface IAlterIdentifierConfig {
    maxEntries: number;
    fields: IAlterIdentifierField[];
}

// Mirrors the existing platform's Question.scaleConfig/matrixConfig shape
// exactly (question.model.ts) — 'scale' and 'matrix' are valid responseType
// values here (Kind B reuses "everything else that already exists," brief §3)
// but had nowhere to store their configuration until now.
interface ISniScaleConfig {
    min: number;
    max: number;
    step?: number;
    minLabel?: string;
    maxLabel?: string;
    showNAOption?: boolean;
}

interface ISniMatrixConfig {
    rows: Array<{ label: string }>;
    columns: Array<{ value: string; label: string }>;
    allowMultiple?: boolean;
}

type SniQuestionRole = 'standard' | 'name_generator' | 'alter_attribute' | 'tie_quality';
type SniResponseType = 'text' | 'textarea' | 'number' | 'date' | 'time' | 'datetime'
    | 'radio' | 'checkbox' | 'dropdown' | 'scale' | 'matrix' | 'file' | 'location'
    | 'alter_identifier';

interface ISniQuestion extends mongoose.Document {
    survey: mongoose.Types.ObjectId;
    section?: mongoose.Types.ObjectId;
    order: number;
    text: string; // may contain a literal [name] piping token
    description?: string;
    questionRole: SniQuestionRole;
    responseType: SniResponseType;
    options: ISniQuestionOption[];
    alterIdentifierConfig?: IAlterIdentifierConfig;
    scaleConfig?: ISniScaleConfig;
    matrixConfig?: ISniMatrixConfig;
    // Which Relational Wellbeing dimension a tie_quality question maps to
    // (brief §4.2's Others/Self/Environment framework, section 11's export
    // table columns tie_others/tie_self/tie_environment). Optional and only
    // meaningful for questionRole 'tie_quality' — left unset, a tie_quality
    // question still works (engine behavior doesn't depend on it), it just
    // falls back to a generic dynamic column at export time instead of one of
    // the three fixed ones. Not required at the schema layer because a future
    // instrument's tie-quality framework might not be RWB-shaped at all.
    rwbDimension?: 'others' | 'self' | 'environment';
    temporality?: 'stable' | 'time_varying';
    indicatorLabel?: string; // e.g. "2.1" — provenance back to the Notion KB, a label only
    conditionalLogic?: ISniConditionalLogic;
    required: boolean;
    validation?: {
        min?: number;
        max?: number;
        pattern?: string;
        errorMessage?: string;
    };
    archived: boolean;
    archivedAt?: Date;
    creator: mongoose.Types.ObjectId;
    lastUpdatedBy?: mongoose.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const alterIdentifierFieldSchema = new mongoose.Schema({
    key: { type: String, required: true, trim: true },
    label: { type: String, required: true, trim: true },
    required: { type: Boolean, default: false },
    type: { type: String, enum: ['text', 'url'], default: 'text' },
}, { _id: false });

const sniQuestionSchema = new mongoose.Schema({
    survey: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SniSurvey',
        required: true,
        index: true,
    },
    section: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SniSection',
        index: true,
        default: null,
    },
    order: {
        type: Number,
        required: true,
        default: 0,
    },
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
    questionRole: {
        type: String,
        enum: ['standard', 'name_generator', 'alter_attribute', 'tie_quality'],
        required: true,
        default: 'standard',
        index: true,
    },
    responseType: {
        type: String,
        enum: ['text', 'textarea', 'number', 'date', 'time', 'datetime', 'radio', 'checkbox', 'dropdown', 'scale', 'matrix', 'file', 'location', 'alter_identifier'],
        required: [true, 'Response type is required'],
    },
    options: [{
        value: { type: String },
        label: { type: String },
        descriptor: { type: String, trim: true, maxLength: 500, default: null },
        placeholder: { type: String, trim: true, maxLength: 200, default: null },
    }],
    alterIdentifierConfig: {
        maxEntries: { type: Number, default: 3, min: 1 },
        fields: {
            type: [alterIdentifierFieldSchema],
            default: () => ([
                { key: 'name', label: 'Name', required: true, type: 'text' },
                { key: 'facebookUrl', label: 'Facebook URL', required: false, type: 'url' },
            ]),
        },
    },
    scaleConfig: {
        min: { type: Number, default: null },
        max: { type: Number, default: null },
        step: { type: Number, default: null },
        minLabel: { type: String, default: null },
        maxLabel: { type: String, default: null },
        showNAOption: { type: Boolean, default: false },
    },
    matrixConfig: {
        rows: [{ label: { type: String, required: true } }],
        columns: [{
            value: { type: String, required: true },
            label: { type: String, required: true, trim: true, maxLength: 200 },
        }],
        allowMultiple: { type: Boolean, default: false },
    },
    rwbDimension: {
        type: String,
        enum: ['others', 'self', 'environment'],
        default: null,
    },
    temporality: {
        type: String,
        enum: ['stable', 'time_varying'],
        default: null,
    },
    indicatorLabel: {
        type: String,
        trim: true,
        maxLength: 50,
        default: null,
    },
    conditionalLogic: {
        enabled: { type: Boolean, default: false },
        conditions: [{
            questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'SniQuestion' },
            operator: {
                type: String,
                enum: ['equals', 'notEquals', 'contains', 'notContains', 'greaterThan', 'lessThan'],
            },
            value: mongoose.Schema.Types.Mixed,
        }],
        action: { type: String, enum: ['show', 'hide'], default: 'show' },
        logicOperator: { type: String, enum: ['AND', 'OR'], default: 'AND' },
    },
    required: {
        type: Boolean,
        default: true,
    },
    validation: {
        min: Number,
        max: Number,
        pattern: String,
        errorMessage: String,
    },
    archived: {
        type: Boolean,
        default: false,
    },
    archivedAt: {
        type: Date,
        default: null,
    },
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    lastUpdatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
}, { timestamps: true });

sniQuestionSchema.index({ survey: 1, questionRole: 1 });
sniQuestionSchema.index({ 'conditionalLogic.enabled': 1 });
sniQuestionSchema.index({ 'conditionalLogic.conditions.questionId': 1 });

// Pre-save hook: sequential order within survey+section (mirrors surveyQuestion.model.ts)
sniQuestionSchema.pre('save', async function (this: ISniQuestion, next: mongoose.CallbackWithoutResultAndOptionalError) {
    if (this.isNew && this.order === 0) {
        try {
            const SniQuestionModel = mongoose.model<ISniQuestion>('SniQuestion');
            const query: { survey: mongoose.Types.ObjectId; section?: mongoose.Types.ObjectId | null } = {
                survey: this.survey,
            };
            if (this.section) query.section = this.section;

            const highestOrder = await SniQuestionModel.findOne(query).sort('-order').exec();
            this.order = highestOrder ? highestOrder.order + 1 : 1;
        } catch (error) {
            if (error instanceof Error) return next(error);
            return next(new Error('Unknown error occurred'));
        }
    }
    next();
});

// Pre-validate hook: the business rules listed in the file header. Validation
// (not just documentation) because these can't be backfilled once content and
// responses exist against a wrongly-shaped question.
sniQuestionSchema.pre('validate', function (this: ISniQuestion, next: mongoose.CallbackWithoutResultAndOptionalError) {
    const role = this.questionRole;

    // Rule 1 — section required unless alter_attribute (survey-scoped)
    if (role === 'alter_attribute') {
        if (this.section) {
            return next(new Error('alter_attribute questions attach at survey level and must not have a section'));
        }
    } else if (!this.section) {
        return next(new Error(`${role} questions must belong to a section (sub-theme)`));
    }

    // Rule 2 — alter_identifier <-> name_generator, both directions
    if (this.responseType === 'alter_identifier' && role !== 'name_generator') {
        return next(new Error("responseType 'alter_identifier' is only valid for questionRole 'name_generator'"));
    }
    if (role === 'name_generator' && this.responseType !== 'alter_identifier') {
        return next(new Error("questionRole 'name_generator' requires responseType 'alter_identifier'"));
    }

    // Rule 3 — temporality required for alter_attribute; not stored for tie_quality
    if (role === 'alter_attribute' && !this.temporality) {
        return next(new Error('alter_attribute questions must specify temporality (stable or time_varying)'));
    }
    if (role !== 'alter_attribute' && this.temporality) {
        return next(new Error('temporality only applies to alter_attribute questions — tie_quality is always time-varying implicitly, others are not wave-aware'));
    }

    // Rule 4 — conditional logic only meaningful for standard (Kind B) questions
    if (this.conditionalLogic?.enabled && role !== 'standard') {
        return next(new Error("conditionalLogic can only be enabled on questionRole 'standard' — the roster mechanism does not use show/hide logic"));
    }

    next();
});

const SniQuestion = mongoose.model<ISniQuestion>('SniQuestion', sniQuestionSchema);

export default SniQuestion;
