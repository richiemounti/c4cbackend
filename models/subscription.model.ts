import mongoose, { Schema } from "mongoose";
import type { BundleTrack, TierKey } from "../constants/stripeCatalogue.constants";

const TIER_VALUES: TierKey[] = ["tier_1", "tier_2", "tier_3"];
const BUNDLE_TRACK_VALUES: BundleTrack[] = ["self_serve", "supported", "any"];
const BILLING_INTERVAL_VALUES = ["year", "month"] as const;

// Mirrors Stripe's Subscription.status values - only ever written by the webhook handler.
const SUBSCRIPTION_STATUS_VALUES = [
    "incomplete",
    "incomplete_expired",
    "trialing",
    "active",
    "past_due",
    "canceled",
    "unpaid",
    "paused",
] as const;

// One line item per Stripe subscription item: either the core bundle or one add-on module.
const subscriptionItemSchema = new Schema(
    {
        catalogueKey: {
            type: String,
            required: true,
        },
        tier: {
            type: String,
            enum: TIER_VALUES,
            required: true,
        },
        interval: {
            type: String,
            enum: BILLING_INTERVAL_VALUES,
            required: true,
        },
        stripePriceId: {
            type: String,
            required: true,
        },
        stripeSubscriptionItemId: {
            type: String,
        },
    },
    { _id: false }
);

const subscriptionSchema = new Schema(
    {
        // One Subscription document per Organization - it is the org's whole Stripe subscription
        // (core bundle + add-ons as line items), not a single product purchase.
        organization: {
            type: Schema.Types.ObjectId,
            ref: "Organization",
            required: true,
            unique: true,
            index: true,
        },
        stripeCustomerId: {
            type: String,
            required: true,
            index: true,
        },
        stripeSubscriptionId: {
            type: String,
            index: true,
        },
        status: {
            type: String,
            enum: SUBSCRIPTION_STATUS_VALUES,
            default: "incomplete",
        },
        // Denormalized from the core-bundle item for cheap gating checks (Phase 3);
        // the `items` array remains the source of truth.
        bundleTrack: {
            type: String,
            enum: BUNDLE_TRACK_VALUES,
        },
        currentTier: {
            type: String,
            enum: TIER_VALUES,
        },
        items: {
            type: [subscriptionItemSchema],
            default: [],
        },
        // Enterprise (5+ projects) orgs are sales-negotiated and never run through Stripe
        // Checkout, so they have no Stripe subscription for the tier gate to check. Setting
        // this bypasses project-count gating entirely for that org.
        manuallyManaged: {
            type: Boolean,
            default: false,
        },
        currentPeriodStart: Date,
        currentPeriodEnd: Date,
        cancelAtPeriodEnd: {
            type: Boolean,
            default: false,
        },
        canceledAt: Date,
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

const Subscription = mongoose.model("Subscription", subscriptionSchema);

export default Subscription;
