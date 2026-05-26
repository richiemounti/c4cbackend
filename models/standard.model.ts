// models/standard.model.ts
import mongoose from "mongoose";

const standardSchema = new mongoose.Schema({
    code: {
        type: String,
        required: [true, 'Standard code is required'],
        unique: true,
        trim: true
    },
    name: {
        type: String,
        required: [true, 'Standard name is required'],
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    issuingBody: {
        type: String,
        required: [true, 'Standard issuing body is required'],
        trim: true
    },
    website: {
        type: String,
        trim: true
    },
    version: {
        type: String,
        trim: true
    },
    publishedYear: {
        type: Number
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

const Standard = mongoose.model('Standard', standardSchema);

export default Standard;