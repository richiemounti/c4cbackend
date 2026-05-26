// models/esgCategory.model.ts
import mongoose from "mongoose";

const esgCategorySchema = new mongoose.Schema({
    code: {
        type: String,
        required: [true, 'ESG code is required'],
        unique: true,
        trim: true
    },
    name: {
        type: String,
        required: [true, 'ESG name is required'],
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    type: {
        type: String,
        enum: ['Environmental', 'Social', 'Governance'],
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
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

const ESGCategory = mongoose.model('ESGCategory', esgCategorySchema);

export default ESGCategory;