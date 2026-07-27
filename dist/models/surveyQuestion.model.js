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
// models/surveyQuestion.model.ts
const mongoose_1 = __importDefault(require("mongoose"));
const surveyQuestionSchema = new mongoose_1.default.Schema({
    question: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'Question',
        required: true,
        index: true,
    },
    survey: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'Survey',
        required: true,
        index: true,
    },
    section: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'SurveySection',
        index: true,
    },
    order: {
        type: Number,
        required: true,
        default: 0
    },
    required: {
        type: Boolean
    },
    customText: {
        type: String,
        trim: true
    },
    customDescription: {
        type: String,
        trim: true
    },
    customOptions: [{
            value: String,
            label: String,
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
        }],
    conditionalLogic: {
        enabled: {
            type: Boolean,
            default: false
        },
        conditions: [{
                questionId: {
                    type: mongoose_1.default.Schema.Types.ObjectId,
                    ref: 'SurveyQuestion'
                },
                operator: {
                    type: String,
                    enum: ['equals', 'notEquals', 'contains', 'notContains', 'greaterThan', 'lessThan']
                },
                value: mongoose_1.default.Schema.Types.Mixed
            }],
        action: {
            type: String,
            enum: ['show', 'hide'],
            default: 'show'
        }
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
// Pre-save hook to ensure orders are sequential within a section
surveyQuestionSchema.pre('save', function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (this.isNew && this.order === 0) {
            try {
                const SurveyQuestionModel = mongoose_1.default.model('SurveyQuestion');
                const QuestionModel = mongoose_1.default.model('Question');
                // Check if this question is a demographic
                const questionDoc = yield QuestionModel.findById(this.question);
                const isDemographic = (questionDoc === null || questionDoc === void 0 ? void 0 : questionDoc.isStandardDemographic) || false;
                // Build query
                const query = {
                    survey: this.survey
                };
                if (this.section) {
                    query.section = this.section;
                }
                // Get all existing questions in this survey/section
                const existingQuestions = yield SurveyQuestionModel.find(query).populate('question');
                if (isDemographic) {
                    // Demographics go first - find highest demographic order
                    const demographicQuestions = existingQuestions.filter((q) => { var _a; return (_a = q.question) === null || _a === void 0 ? void 0 : _a.isStandardDemographic; });
                    if (demographicQuestions.length > 0) {
                        const highestDemographicOrder = Math.max(...demographicQuestions.map(q => q.order));
                        this.order = highestDemographicOrder + 1;
                    }
                    else {
                        // First demographic question
                        this.order = 1;
                    }
                    // Shift non-demographic questions down
                    const nonDemographicQuestions = existingQuestions.filter((q) => { var _a; return !((_a = q.question) === null || _a === void 0 ? void 0 : _a.isStandardDemographic) && q.order >= this.order; });
                    for (const q of nonDemographicQuestions) {
                        yield SurveyQuestionModel.updateOne({ _id: q._id }, { $inc: { order: 1 } });
                    }
                }
                else {
                    // Non-demographic questions go after demographics
                    const allQuestions = existingQuestions;
                    if (allQuestions.length > 0) {
                        const highestOrder = Math.max(...allQuestions.map(q => q.order));
                        this.order = highestOrder + 1;
                    }
                    else {
                        this.order = 1;
                    }
                }
            }
            catch (error) {
                if (error instanceof Error) {
                    return next(error);
                }
                return next(new Error('Unknown error occurred'));
            }
        }
        next();
    });
});
const SurveyQuestion = mongoose_1.default.model('SurveyQuestion', surveyQuestionSchema);
exports.default = SurveyQuestion;
//# sourceMappingURL=surveyQuestion.model.js.map