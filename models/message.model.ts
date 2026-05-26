// models/message.model.ts
import mongoose, { Document, Schema, Model } from 'mongoose';

// All linkable resource types across the Youth Impact platform
export type ResourceType =
  | 'project'
  | 'project_site'
  | 'survey'
  | 'survey_response'
  | 'stakeholder_group'
  | 'stakeholder_action'
  | 'risk_register_entry'
  | 'theory_of_change'
  | 'consultation_plan'
  | 'review'
  | 'report'
  | 'project_setup'
  | 'site_setup';

export interface IContextLink {
  label: string;           // e.g. "Q2 Stakeholder Survey"
  resourceType: ResourceType;
  resourceId: mongoose.Types.ObjectId;
  projectId?: mongoose.Types.ObjectId;
  siteId?: mongoose.Types.ObjectId;
  href: string;            // resolved frontend URL path e.g. /projects/abc/surveys/xyz
}

export interface IReadReceipt {
  user: mongoose.Types.ObjectId;
  readAt: Date;
}

export interface IMessage extends Document {
  conversation: mongoose.Types.ObjectId;
  organization: mongoose.Types.ObjectId;   // denormalized for scoped queries
  sender: mongoose.Types.ObjectId;
  content: string;
  mentions: mongoose.Types.ObjectId[];     // @mentioned users
  contextLink?: IContextLink;              // optional deep link to a platform resource
  readBy: IReadReceipt[];
  editedAt?: Date;
  deleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMessageModel extends Model<IMessage> {}

const contextLinkSchema = new Schema<IContextLink>(
  {
    label: { type: String, required: true, trim: true },
    resourceType: {
      type: String,
      required: true,
      enum: [
        'project',
        'project_site',
        'survey',
        'survey_response',
        'stakeholder_group',
        'stakeholder_action',
        'risk_register_entry',
        'theory_of_change',
        'consultation_plan',
        'review',
        'report',
        'project_setup',
        'site_setup',
      ],
    },
    resourceId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      default: null,
    },
    siteId: {
      type: Schema.Types.ObjectId,
      ref: 'ProjectSite',
      default: null,
    },
    href: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const readReceiptSchema = new Schema<IReadReceipt>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    readAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const messageSchema = new Schema<IMessage>(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    organization: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    mentions: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    contextLink: {
      type: contextLinkSchema,
      default: null,
    },
    readBy: [readReceiptSchema],
    editedAt: {
      type: Date,
      default: null,
    },
    deleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Fast retrieval of messages in a conversation (paginated, newest first)
messageSchema.index({ conversation: 1, createdAt: -1 });
// Fast unread count queries
messageSchema.index({ conversation: 1, 'readBy.user': 1 });

const Message = mongoose.model<IMessage, IMessageModel>('Message', messageSchema);

export default Message;