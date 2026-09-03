// utils/reviewNotifications.ts
// In-app notification helpers for review workflow events, ported from
// smrvbackend. Design: broadcast events (review created, status changes) post
// system notifications to every relevant participant. Action-required events
// (issue added, escalated, issue resolved) send targeted notifications to only
// the person who needs to act.

import mongoose from 'mongoose';
import Notification from '../models/notification.model';
import { IReview } from '../models/review.model';
import { emitToUser } from '../services/socket.service';
import { ReviewModule } from '../models/review.model';

// ─── URL helpers ─────────────────────────────────────────────────────────────

const SOURCE_PATHS: Record<ReviewModule, (r: IReview) => string> = {
  stakeholder_group:     (r) => `/dashboard/stakeholders/tasks/${r.moduleItemId}`,
  project_setup:         (r) => `/dashboard/project/${r.projectId}/setup`,
  project_site_setup:    (r) => `/dashboard/site/${r.projectSiteId ?? r.moduleItemId}/setup`,
  stakeholder_action:    (r) => `/dashboard/project/${r.projectId}/theory-of-change/stage1/actions/${r.nestedItemId ?? r.moduleItemId}/edit`,
  social_impact:         (r) => `/dashboard/project/${r.projectId}/theory-of-change/stage2${r.projectSiteId ? `?siteId=${r.projectSiteId}` : ''}`,
  toc_consultation_plan: (r) => `/dashboard/project/${r.projectId}/theory-of-change/consultation-plan${r.projectSiteId ? `?siteId=${r.projectSiteId}` : ''}`,
  survey:                (r) => `/dashboard/project/${r.projectId}/surveys/${r.moduleItemId}`,
  survey_question:       (r) => `/dashboard/project/${r.projectId}/surveys/${r.moduleItemId}`,
  survey_translation:    (r) => `/dashboard/project/${r.projectId}/surveys/${r.moduleItemId}/translations`,
};

function reviewDashboardHref(review: IReview): string {
  return `/dashboard/project/${review.projectId}/review/${review._id}`;
}

function sourceRecordHref(review: IReview): string {
  return SOURCE_PATHS[review.module]?.(review) ?? `/dashboard/reviews/${review._id}`;
}

// ─── Core helper ─────────────────────────────────────────────────────────────

interface NotifyParams {
  recipient: mongoose.Types.ObjectId;
  organization: mongoose.Types.ObjectId;
  triggeredBy: mongoose.Types.ObjectId;
  review: IReview;
  preview: string;
}

async function sendReviewNotification(params: NotifyParams): Promise<void> {
  const { recipient, organization, triggeredBy, review, preview } = params;

  // Don't notify the user who triggered the event
  if (recipient.toString() === triggeredBy.toString()) return;

  const notification = await Notification.create({
    recipient,
    organization,
    type: 'system',
    triggeredBy,
    preview: preview.substring(0, 120),
    pageContext: {
      resourceType: 'review',
      resourceId: review._id,
      label: review.title,
      href: reviewDashboardHref(review),
    },
    contextLink: {
      resourceType: review.module,
      resourceId: review.moduleItemId,
      label: 'View source record',
      href: sourceRecordHref(review),
    },
  });

  await notification.populate('triggeredBy', 'name photo userName');
  emitToUser(recipient.toString(), 'notification', notification);
}

// ─── Public event functions ───────────────────────────────────────────────────

/**
 * Send input_request notifications to a list of colleagues for a review.
 * Returns the number of notifications successfully sent.
 */
export async function notifySeekInput(
  review: IReview,
  recipientIds: mongoose.Types.ObjectId[],
  triggeredBy: mongoose.Types.ObjectId,
  message: string,
  deadline?: Date
): Promise<number> {
  let sent = 0;
  for (const recipientId of recipientIds) {
    if (recipientId.toString() === triggeredBy.toString()) continue;
    const notification = await Notification.create({
      recipient: recipientId,
      organization: review.organizationId,
      type: 'input_request',
      triggeredBy,
      preview: message.substring(0, 200),
      deadline: deadline ?? null,
      pageContext: {
        resourceType: 'review',
        resourceId: review._id,
        label: review.title,
        href: reviewDashboardHref(review),
      },
      contextLink: {
        resourceType: review.module,
        resourceId: review.moduleItemId,
        label: 'View source record',
        href: sourceRecordHref(review),
      },
    });
    await notification.populate('triggeredBy', 'name photo userName');
    emitToUser(recipientId.toString(), 'notification', notification);
    sent++;
  }
  return sent;
}

/**
 * Notify all assigned reviewers when a review is created.
 */
export async function notifyReviewCreated(
  review: IReview,
  triggeredBy: mongoose.Types.ObjectId
): Promise<void> {
  const preview = `New review ready for your input: "${review.title}"`;
  await Promise.all(
    review.reviewers.map((reviewerId) =>
      sendReviewNotification({
        recipient: reviewerId,
        organization: review.organizationId,
        triggeredBy,
        review,
        preview,
      })
    )
  );
}

/**
 * Notify the submitter (and escalated AM if applicable) when an issue is added.
 * The submitter needs to know they have something to fix.
 */
export async function notifyIssueAdded(
  review: IReview,
  issueDescription: string,
  triggeredBy: mongoose.Types.ObjectId
): Promise<void> {
  const preview = `New issue flagged on "${review.title}": ${issueDescription}`;

  const recipients = new Set<string>();

  // Always notify the submitter — they need to fix it
  if (review.submittedBy) {
    recipients.add(review.submittedBy.toString());
  }

  // Also notify the AM if the review is escalated
  if (review.escalatedTo) {
    recipients.add(review.escalatedTo.toString());
  }

  await Promise.all(
    [...recipients].map((id) =>
      sendReviewNotification({
        recipient: new mongoose.Types.ObjectId(id),
        organization: review.organizationId,
        triggeredBy,
        review,
        preview,
      })
    )
  );
}

/**
 * Notify the user who raised an issue when it is resolved.
 */
export async function notifyIssueResolved(
  review: IReview,
  issueRaisedBy: mongoose.Types.ObjectId,
  triggeredBy: mongoose.Types.ObjectId
): Promise<void> {
  const preview = `An issue on "${review.title}" has been resolved`;
  await sendReviewNotification({
    recipient: issueRaisedBy,
    organization: review.organizationId,
    triggeredBy,
    review,
    preview,
  });
}

/**
 * Notify the account manager when a review is escalated to them.
 */
export async function notifyReviewEscalated(
  review: IReview,
  triggeredBy: mongoose.Types.ObjectId
): Promise<void> {
  if (!review.escalatedTo) return;
  const preview = `Review escalated to you: "${review.title}"`;
  await sendReviewNotification({
    recipient: review.escalatedTo,
    organization: review.organizationId,
    triggeredBy,
    review,
    preview,
  });
}

/**
 * Notify the submitter when a reviewer starts reviewing (status → in_review).
 */
export async function notifyStatusChanged(
  review: IReview,
  triggeredBy: mongoose.Types.ObjectId
): Promise<void> {
  if (!review.submittedBy) return;
  const preview = `Your review "${review.title}" is now being reviewed`;
  await sendReviewNotification({
    recipient: review.submittedBy,
    organization: review.organizationId,
    triggeredBy,
    review,
    preview,
  });
}

/**
 * Notify all participants when a review is approved or resolved.
 * The submitter and all reviewers should know the review is closed.
 */
export async function notifyReviewClosed(
  review: IReview,
  triggeredBy: mongoose.Types.ObjectId
): Promise<void> {
  const verb = review.status === 'approved' ? 'approved' : 'resolved';
  const preview = `Review "${review.title}" has been ${verb}`;

  const recipients = new Set<string>();
  if (review.submittedBy) recipients.add(review.submittedBy.toString());
  review.reviewers.forEach((r) => recipients.add(r.toString()));
  if (review.escalatedTo) recipients.add(review.escalatedTo.toString());

  await Promise.all(
    [...recipients].map((id) =>
      sendReviewNotification({
        recipient: new mongoose.Types.ObjectId(id),
        organization: review.organizationId,
        triggeredBy,
        review,
        preview,
      })
    )
  );
}
