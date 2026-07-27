"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// models/eulaSignature.model.ts
const mongoose_1 = __importDefault(require("mongoose"));
const eulaSignatureSchema = new mongoose_1.default.Schema({
    // User who signed the EULA
    user: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    // EULA version identifier (e.g., "v3-16.06.2025")
    eulaVersion: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    // When the EULA was signed
    signedAt: {
        type: Date,
        required: true,
        default: Date.now,
        index: true
    },
    // User's IP address when signing
    ipAddress: {
        type: String,
        required: true,
        trim: true
    },
    // User's browser/device information
    userAgent: {
        type: String,
        required: true,
        trim: true
    },
    // Signature details
    signatureData: {
        fullName: {
            type: String,
            required: true,
            trim: true
        },
        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true
        },
        position: {
            type: String,
            trim: true
        },
        organization: {
            type: String,
            trim: true
        }
    },
    // Status tracking
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    // Revocation tracking (if needed)
    revokedAt: {
        type: Date,
        default: null
    },
    revokedBy: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    revokedReason: {
        type: String,
        trim: true,
        default: null
    }
}, {
    timestamps: true,
    // Add version key for optimistic concurrency control
    versionKey: '__v'
});
// Compound index to ensure one active signature per user per EULA version
eulaSignatureSchema.index({ user: 1, eulaVersion: 1, isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true } });
// Index for efficient querying by version
eulaSignatureSchema.index({ eulaVersion: 1, signedAt: -1 });
// Index for audit queries
eulaSignatureSchema.index({ signedAt: -1 });
// Static method to check if user has signed current EULA
eulaSignatureSchema.statics.hasUserSignedCurrentEula = function (userId_1) {
    return __awaiter(this, arguments, void 0, function* (userId, currentVersion = "v3-16.06.2025") {
        const signature = yield this.findOne({
            user: userId,
            eulaVersion: currentVersion,
            isActive: true
        });
        return !!signature;
    });
};
// Static method to get user's latest signature
eulaSignatureSchema.statics.getUserLatestSignature = function (userId) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield this.findOne({
            user: userId,
            isActive: true
        })
            .sort({ signedAt: -1 })
            .populate('user', 'name email userName');
    });
};
// Static method to revoke signature
eulaSignatureSchema.statics.revokeSignature = function (signatureId_1, revokedBy_1) {
    return __awaiter(this, arguments, void 0, function* (signatureId, revokedBy, reason = "Manual revocation") {
        return yield this.findByIdAndUpdate(signatureId, {
            isActive: false,
            revokedAt: new Date(),
            revokedBy,
            revokedReason: reason
        }, { new: true });
    });
};
// Instance method to revoke this signature
eulaSignatureSchema.methods.revoke = function (revokedBy, reason = "Manual revocation") {
    this.isActive = false;
    this.revokedAt = new Date();
    this.revokedBy = revokedBy;
    this.revokedReason = reason;
    return this.save();
};
// Pre-save middleware to validate email matches user
eulaSignatureSchema.pre('save', function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        if (this.isNew) {
            try {
                // Check if signatureData exists
                if (!this.signatureData || !this.signatureData.email) {
                    const error = new Error('Signature data is required');
                    return next(error);
                }
                // Import User model (you may need to adjust the import path)
                const User = mongoose_1.default.model('User');
                // Find the user by ID to validate email
                const user = yield User.findById(this.user).select('email');
                if (!user) {
                    const error = new Error('User not found');
                    return next(error);
                }
                if (user.email !== this.signatureData.email) {
                    const error = new Error('Signature email must match user email');
                    return next(error);
                }
                next();
            }
            catch (error) {
                next(error);
            }
        }
        else {
            next();
        }
    });
});
// Virtual for checking if signature is expired (if you implement expiration)
eulaSignatureSchema.virtual('isExpired').get(function () {
    // Add expiration logic here if needed
    // For now, signatures don't expire
    return false;
});
const EulaSignature = mongoose_1.default.model('EulaSignature', eulaSignatureSchema);
exports.default = EulaSignature;
//# sourceMappingURL=eulaSignature.model.js.map