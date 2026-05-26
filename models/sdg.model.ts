// models/sdg.model.ts
import mongoose from "mongoose";

const sdgSchema = new mongoose.Schema({
    code: {
        type: String,
        required: [true, 'SDG code is required'],
        unique: true,
        trim: true,
        enum: [
            'SDG1', 'SDG2', 'SDG3', 'SDG4', 'SDG5', 
            'SDG6', 'SDG7', 'SDG8', 'SDG9', 'SDG10', 
            'SDG11', 'SDG12', 'SDG13', 'SDG14', 'SDG15', 
            'SDG16', 'SDG17'
        ]
    },
    name: {
        type: String,
        required: [true, 'SDG name is required'],
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    iconUrl: {
        type: String,
        trim: true
    },
    color: {
        type: String,
        trim: true
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

const SDG = mongoose.model('SDG', sdgSchema);

export default SDG;