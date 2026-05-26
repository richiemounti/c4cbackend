import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Subscription name is required'],
        trim: true,
        minLength: 2,
        maxLength: 100,
    },
    price: {
        type: Number,
        required: [true, 'Subscription price is required'],
        min: [0, 'Price must be greater than 0'],
    },
    currency: {
        type: String,
        enum: ['USD', 'EUR', 'GBP', 'KES'],
        default: 'USD'
    },
    frequency: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', 'yearly'],
        required: true
    },
    category: {
        type: String,
        enum: ['YOUTH_IMPACT'],
        required: true
    },
    paymentMethod: {
        type: String,
        required: true,
        trim: true
    },
    status: {
        type: String,
        enum: ['active', 'cancelled', 'expired'],
        default: 'active'
    },
    startDate: {
        type: Date,
        required: true,
        validate: {
            validator: function(value: Date): boolean {
                return value <= new Date();
            },
            message: 'Start date must be in the past'
        }
    },
    renewalDate: {
        type: Date
    },
    user: {
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
}, {timestamps: true});

// Add custom validation for comparing dates as a pre-save hook
subscriptionSchema.pre('save', function(next) {
    if(!this.renewalDate && this.startDate && this.frequency) {
        const renewalPeriods: Record<string, number> = {
            daily: 1,
            weekly: 7,
            monthly: 30,
            yearly: 365,
        };

        // Make sure frequency is a valid key before accessing
        const period = renewalPeriods[this.frequency as keyof typeof renewalPeriods];
        
        if (period) {
            const newRenewalDate = new Date(this.startDate);
            newRenewalDate.setDate(newRenewalDate.getDate() + period);
            this.renewalDate = newRenewalDate;
        }
    }

    // Validate renewal date is after start date
    if (this.renewalDate && this.startDate && this.renewalDate <= this.startDate) {
        const err = new Error('Renewal date must be after the start date');
        return next(err);
    }

    // Auto update the status if renewal date has passed
    if (this.renewalDate && this.renewalDate < new Date()) {
        this.status = 'expired';
    }

    next();
});

const Subscription = mongoose.model('Subscription', subscriptionSchema);

export default Subscription;