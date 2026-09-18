// models/sniSection.model.ts
// A sub-theme within an SniSurvey (e.g. "Practical & Material Support").
import mongoose from "mongoose";

interface ISniSection extends mongoose.Document {
    survey: mongoose.Types.ObjectId;
    title: string;
    description?: string;
    order: number;
    // Safeguarding split (brief §10): this sub-theme must be administered as a
    // separate part — different session/setting, trained data collector — while
    // still rolling up to one submission record and one export for analysis.
    separatelyAdministered: boolean;
    archived: boolean;
    archivedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const sniSectionSchema = new mongoose.Schema({
    survey: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SniSurvey',
        required: true,
        index: true,
    },
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
    order: {
        type: Number,
        required: true,
        default: 0,
    },
    separatelyAdministered: {
        type: Boolean,
        default: false,
    },
    archived: {
        type: Boolean,
        default: false,
    },
    archivedAt: {
        type: Date,
        default: null,
    },
}, { timestamps: true });

// Pre-save hook to ensure orders are sequential — mirrors surveySection.model.ts
sniSectionSchema.pre('save', async function (this: ISniSection, next: mongoose.CallbackWithoutResultAndOptionalError) {
    if (this.isNew && this.order === 0) {
        try {
            const SniSectionModel = mongoose.model<ISniSection>('SniSection');
            const highestOrder = await SniSectionModel.findOne({ survey: this.survey })
                .sort('-order')
                .exec();

            this.order = highestOrder ? highestOrder.order + 1 : 1;
        } catch (error) {
            if (error instanceof Error) return next(error);
            return next(new Error('Unknown error occurred'));
        }
    }
    next();
});

const SniSection = mongoose.model<ISniSection>('SniSection', sniSectionSchema);

export default SniSection;
