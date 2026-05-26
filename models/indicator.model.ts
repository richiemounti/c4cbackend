// models/indicator.model.ts
import mongoose from "mongoose";

const evidenceSchema = new mongoose.Schema({
    source: {
        type: String,
        trim: true,
        maxLength: 1000, // Updated from 200
    },
    url: [{  // Changed to array
        type: String,
        trim: true,
        maxLength: 2500, // Updated from 500
        validate: {
            validator: function(v: string) {
                // Optional URL validation - only validates if url is provided
                if (!v) return true;
                return /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/.test(v);
            },
            message: 'Please provide a valid URL'
        }
    }],
    details: {
        type: String,
        trim: true,
        maxLength: 1500, // Updated from 1000
    }
}, { _id: false });

const indicatorSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Indicator name is required'],
        trim: true,
        minLength: 2,
        maxLength: 2000,
    },
    description: {
        type: String,
        trim: true,
        maxLength: 2500,
    },
    evidence: {
        type: evidenceSchema,
        default: null
    },
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
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

const Indicator = mongoose.model('Indicator', indicatorSchema);

export default Indicator;