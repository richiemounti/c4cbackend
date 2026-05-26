import mongoose from "mongoose";


const organizationSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Organization name is required'],
        trim: true,
        minLength: 2,
        maxLength: 100,
    },
    country: {
        type: String,
        required: [true, 'Organization country is required']
    },
    city: {
        type: String,
        required: [true, 'Organization city is required']
    },
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    archived: {
        type: Boolean,
        default: false
    },
    archivedAt: {
        type: Date,
        default: null
    }
}, {timestamps: true})


const Organization = mongoose.model('Organization', organizationSchema)

export default Organization

