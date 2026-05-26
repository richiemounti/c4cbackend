// models/notification.model.ts
import mongoose, { Document, Schema, Model } from 'mongoose';
import { IContextLink, ResourceType } from './message.model';

export type NotificationType =
  | 'mention_in_message'   // @mentioned inside a DM or group chat message
  | 'mention_on_page'      // @mentioned from a platform page (review, report, etc.)
  | 'new_message'          // new message in a conversation the user belongs to
  | 'system';              // platform system alerts

export interface IPageContext {
  resourceType: ResourceType;
  resourceId: mongoose.Types.ObjectId;
  label: string;
  href: string;
}

export interface INotification extends Document {
  recipient: mongoose.Types.ObjectId;
  organization: mongoose.Types.ObjectId;
  type: NotificationType;
  triggeredBy: mongoose.Types.ObjectId;

  // Linked conversation/message (for message-based notifications)
  conversation?: mongoose.Types.ObjectId;
  message?: mongoose.Types.ObjectId;

  // Where the mention happened (for mention_on_page)
  pageContext?: IPageContext;

  // The deep link to navigate to when clicked
  contextLink?: IContextLink;

  // Short preview of the triggering content (~120 chars)
  preview: string;

  read: boolean;
  readAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export interface INotificationModel extends Model<INotification> {}

const pageContextSchema = new Schema<IPageContext>(
  {
    resourceType: { type: String, required: true },
    resourceId: { type: Schema.Types.ObjectId, required: true },
    label: { type: String, required: true, trim: true },
    href: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const contextLinkSchema = new Schema(
  {
    label: { type: String, required: true, trim: true },
    resourceType: { type: String, required: true },
    resourceId: { type: Schema.Types.ObjectId, required: true },
    projectId: { type: Schema.Types.ObjectId, default: null },
    siteId: { type: Schema.Types.ObjectId, default: null },
    href: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const notificationSchema = new Schema<INotification>(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    organization: {
      type: Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['mention_in_message', 'mention_on_page', 'new_message', 'system'],
      required: true,
      index: true,
    },
    triggeredBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    conversation: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      default: null,
    },
    message: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    pageContext: {
      type: pageContextSchema,
      default: null,
    },
    contextLink: {
      type: contextLinkSchema,
      default: null,
    },
    preview: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Fast unread notifications lookup per user
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
// Fast org-scoped notification queries
notificationSchema.index({ recipient: 1, organization: 1, createdAt: -1 });

const Notification = mongoose.model<INotification, INotificationModel>(
  'Notification',
  notificationSchema
);

export default Notification;