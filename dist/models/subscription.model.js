"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importStar(require("mongoose"));
const TIER_VALUES = ["tier_1", "tier_2", "tier_3"];
const BUNDLE_TRACK_VALUES = ["self_serve", "supported", "any"];
const BILLING_INTERVAL_VALUES = ["year", "month"];
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
];
// One line item per Stripe subscription item: either the core bundle or one add-on module.
const subscriptionItemSchema = new mongoose_1.Schema({
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
}, { _id: false });
const subscriptionSchema = new mongoose_1.Schema({
    // One Subscription document per Organization - it is the org's whole Stripe subscription
    // (core bundle + add-ons as line items), not a single product purchase.
    organization: {
        type: mongoose_1.Schema.Types.ObjectId,
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
}, { timestamps: true });
const Subscription = mongoose_1.default.model("Subscription", subscriptionSchema);
exports.default = Subscription;
//# sourceMappingURL=subscription.model.js.map