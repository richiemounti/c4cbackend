// models/eulaSignature.model.ts
import mongoose from "mongoose";

// Define interface for TypeScript
export interface IEulaSignature {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  eulaVersion: string;
  signedAt: Date;
  ipAddress: string;
  userAgent: string;
  signatureData: {
    fullName: string;
    email: string;
    position?: string;
    organization?: string;
  };
  isActive: boolean;
  revokedAt?: Date;
  revokedBy?: mongoose.Types.ObjectId;
  revokedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Define interface for instance methods
export interface IEulaSignatureMethods {
  revoke(revokedBy: mongoose.Types.ObjectId, reason?: string): Promise<this>;
}

// Define interface for static methods
export interface IEulaSignatureStatics {
  hasUserSignedCurrentEula(
    userId: mongoose.Types.ObjectId, 
    currentVersion?: string
  ): Promise<boolean>;
  
  getUserLatestSignature(
    userId: mongoose.Types.ObjectId
  ): Promise<(mongoose.Document<unknown, {}, IEulaSignature> & IEulaSignature & IEulaSignatureMethods) | null>;
  
  revokeSignature(
    signatureId: mongoose.Types.ObjectId,
    revokedBy: mongoose.Types.ObjectId,
    reason?: string
  ): Promise<(mongoose.Document<unknown, {}, IEulaSignature> & IEulaSignature & IEulaSignatureMethods) | null>;
}

// Create the model type
export type EulaSignatureModel = mongoose.Model<IEulaSignature, {}, IEulaSignatureMethods> & IEulaSignatureStatics;

const eulaSignatureSchema = new mongoose.Schema({
  // User who signed the EULA
  user: {
    type: mongoose.Schema.Types.ObjectId,
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
    type: mongoose.Schema.Types.ObjectId,
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
eulaSignatureSchema.index(
  { user: 1, eulaVersion: 1, isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);

// Index for efficient querying by version
eulaSignatureSchema.index({ eulaVersion: 1, signedAt: -1 });

// Index for audit queries
eulaSignatureSchema.index({ signedAt: -1 });

// Static method to check if user has signed current EULA
eulaSignatureSchema.statics.hasUserSignedCurrentEula = async function(
  userId: mongoose.Types.ObjectId, 
  currentVersion: string = "v3-16.06.2025"
): Promise<boolean> {
  const signature = await this.findOne({
    user: userId,
    eulaVersion: currentVersion,
    isActive: true
  });
  
  return !!signature;
};

// Static method to get user's latest signature
eulaSignatureSchema.statics.getUserLatestSignature = async function(
  userId: mongoose.Types.ObjectId
) {
  return await this.findOne({
    user: userId,
    isActive: true
  })
  .sort({ signedAt: -1 })
  .populate('user', 'name email userName');
};

// Static method to revoke signature
eulaSignatureSchema.statics.revokeSignature = async function(
  signatureId: mongoose.Types.ObjectId,
  revokedBy: mongoose.Types.ObjectId,
  reason: string = "Manual revocation"
) {
  return await this.findByIdAndUpdate(
    signatureId,
    {
      isActive: false,
      revokedAt: new Date(),
      revokedBy,
      revokedReason: reason
    },
    { new: true }
  );
};

// Instance method to revoke this signature
eulaSignatureSchema.methods.revoke = function(
  revokedBy: mongoose.Types.ObjectId,
  reason: string = "Manual revocation"
) {
  this.isActive = false;
  this.revokedAt = new Date();
  this.revokedBy = revokedBy;
  this.revokedReason = reason;
  
  return this.save();
};

// Pre-save middleware to validate email matches user
eulaSignatureSchema.pre('save', async function(next) {
  if (this.isNew) {
    try {
      // Check if signatureData exists
      if (!this.signatureData || !this.signatureData.email) {
        const error = new Error('Signature data is required');
        return next(error);
      }

      // Import User model (you may need to adjust the import path)
      const User = mongoose.model('User');
      
      // Find the user by ID to validate email
      const user = await User.findById(this.user).select('email');
      
      if (!user) {
        const error = new Error('User not found');
        return next(error);
      }
      
      if (user.email !== this.signatureData.email) {
        const error = new Error('Signature email must match user email');
        return next(error);
      }
      
      next();
    } catch (error) {
      next(error as Error);
    }
  } else {
    next();
  }
});

// Virtual for checking if signature is expired (if you implement expiration)
eulaSignatureSchema.virtual('isExpired').get(function() {
  // Add expiration logic here if needed
  // For now, signatures don't expire
  return false;
});

const EulaSignature = mongoose.model<IEulaSignature, EulaSignatureModel>('EulaSignature', eulaSignatureSchema);

export default EulaSignature;