// models/category.model.ts
import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Category name is required'],
        trim: true,
        minLength: 2,
        maxLength: 100,
    },
    description: {
        type: String,
        trim: true,
        maxLength: 500,
    },
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    status: {
        type: String,
        enum: ['draft', 'published', 'archived'],
        default: 'draft'
    },
    inclusion: {
        type: [String],
        enum: [
            'people with disability',
            'women and girls',
            'LGBTQ',
            'young people',
            'indigenous persons'
        ],
        default: []
    },
    // NEW FIELD: Population estimate at site level
    estimatedPopulation: {
        type: Number,
        min: 0,
        default: null // Optional field
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

const Category = mongoose.model('Category', categorySchema);

export default Category;