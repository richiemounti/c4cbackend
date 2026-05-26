// models/surveySection.model.ts
import mongoose from "mongoose";

// Define interface for the document
interface ISurveySection extends mongoose.Document {
    title: string;
    description?: string;
    survey: mongoose.Types.ObjectId;
    order: number;
    archived: boolean;
    archivedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const surveySectionSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Section title is required'],
        trim: true,
        minLength: 2,
        maxLength: 200,
    },
    description: {
        type: String,
        trim: true,
        maxLength: 1000,
    },
    survey: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Survey',
        required: true,
        index: true,
    },
    order: {
        type: Number,
        required: true,
        default: 0
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

// Pre-save hook to ensure orders are sequential
surveySectionSchema.pre('save', async function(this: ISurveySection, next: mongoose.CallbackWithoutResultAndOptionalError) {
    if (this.isNew && this.order === 0) {
        try {
            const SurveySectionModel = mongoose.model<ISurveySection>('SurveySection');
            const highestOrder = await SurveySectionModel.findOne({ survey: this.survey })
                .sort('-order')
                .exec();
            
            if (highestOrder) {
                this.order = highestOrder.order + 1;
            } else {
                this.order = 1;
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

const SurveySection = mongoose.model<ISurveySection>('SurveySection', surveySectionSchema);

export default SurveySection;
