// models/conversation.model.ts
import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IConversation extends Document {
  organization: mongoose.Types.ObjectId;
  project?: mongoose.Types.ObjectId;
  type: 'direct' | 'group';
  name?: string;
  participants: mongoose.Types.ObjectId[];
  createdBy: mongoose.Types.ObjectId;
  lastMessage?: mongoose.Types.ObjectId;
  lastActivityAt: Date;
  // Per-participant archive (soft delete)
  archivedBy: mongoose.Types.ObjectId[];
  archived: boolean;
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IConversationModel extends Model<IConversation> {}

const conversationSchema = new Schema<IConversation>(
  {
    organization: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      index: true,
      default: null,
    },
    type: {
      type: String,
      enum: ['direct', 'group'],
      required: true,
      index: true,
    },
    // Only populated for group conversations
    name: {
      type: String,
      trim: true,
      default: null,
    },
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Denormalized reference to the last message for inbox list rendering
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    // Track which users have "archived" (hidden) this conversation for themselves
    archivedBy: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    // Hard archive — conversation fully removed from system (admin only)
    archived: {
      type: Boolean,
      default: false,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Compound index: enforce uniqueness of direct conversations between two users in the same org
conversationSchema.index(
  { organization: 1, type: 1, participants: 1 },
  { sparse: true }
);

// Fast lookup of all conversations a user participates in
conversationSchema.index({ participants: 1, lastActivityAt: -1 });

const Conversation = mongoose.model<IConversation, IConversationModel>(
  'Conversation',
  conversationSchema
);

export default Conversation;