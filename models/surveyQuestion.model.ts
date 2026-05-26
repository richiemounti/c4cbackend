// models/surveyQuestion.model.ts
import mongoose from "mongoose";

// Define interface for the document
interface ISurveyQuestion extends mongoose.Document {
    question: mongoose.Types.ObjectId;
    survey: mongoose.Types.ObjectId;
    section?: mongoose.Types.ObjectId;
    order: number;
    required?: boolean;
    customText?: string;
    customDescription?: string;
    customOptions?: Array<{
        value: string;
        label: string;
        descriptor?: string;   // ← add
        placeholder?: string;  // ← add
    }>;
    conditionalLogic?: {
        enabled: boolean;
        conditions: Array<{
            questionId: mongoose.Types.ObjectId;
            operator: string;
            value: any;
        }>;
        action: string;
    };
    archived: boolean;
    archivedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const surveyQuestionSchema = new mongoose.Schema({
    question: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question',
        required: true,
        index: true,
    },
    survey: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Survey',
        required: true,
        index: true,
    },
    section: {
        type: mongoose.Schema.Types.ObjectId,
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
                type: mongoose.Schema.Types.ObjectId,
                ref: 'SurveyQuestion'
            },
            operator: {
                type: String,
                enum: ['equals', 'notEquals', 'contains', 'notContains', 'greaterThan', 'lessThan']
            },
            value: mongoose.Schema.Types.Mixed
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
surveyQuestionSchema.pre('save', async function(this: ISurveyQuestion, next: mongoose.CallbackWithoutResultAndOptionalError) {
    if (this.isNew && this.order === 0) {
        try {
            const SurveyQuestionModel = mongoose.model<ISurveyQuestion>('SurveyQuestion');
            const QuestionModel = mongoose.model('Question');
            
            // Check if this question is a demographic
            const questionDoc = await QuestionModel.findById(this.question);
            const isDemographic = questionDoc?.isStandardDemographic || false;
            
            // Build query
            const query: { survey: mongoose.Types.ObjectId; section?: mongoose.Types.ObjectId } = { 
                survey: this.survey 
            };
            
            if (this.section) {
                query.section = this.section;
            }

            // Get all existing questions in this survey/section
            const existingQuestions = await SurveyQuestionModel.find(query).populate('question');
            
            if (isDemographic) {
                // Demographics go first - find highest demographic order
                const demographicQuestions = existingQuestions.filter((q: any) => 
                    q.question?.isStandardDemographic
                );
                
                if (demographicQuestions.length > 0) {
                    const highestDemographicOrder = Math.max(...demographicQuestions.map(q => q.order));
                    this.order = highestDemographicOrder + 1;
                } else {
                    // First demographic question
                    this.order = 1;
                }
                
                // Shift non-demographic questions down
                const nonDemographicQuestions = existingQuestions.filter((q: any) => 
                    !q.question?.isStandardDemographic && q.order >= this.order
                );
                
                for (const q of nonDemographicQuestions) {
                    await SurveyQuestionModel.updateOne(
                        { _id: q._id },
                        { $inc: { order: 1 } }
                    );
                }
            } else {
                // Non-demographic questions go after demographics
                const allQuestions = existingQuestions;
                
                if (allQuestions.length > 0) {
                    const highestOrder = Math.max(...allQuestions.map(q => q.order));
                    this.order = highestOrder + 1;
                } else {
                    this.order = 1;
                }
            }
        } catch (error) {
            if (error instanceof Error) {
                return next(error);
            }
            return next(new Error('Unknown error occurred'));
        }
    }
    next();
});


const SurveyQuestion = mongoose.model<ISurveyQuestion>('SurveyQuestion', surveyQuestionSchema);

export default SurveyQuestion;
