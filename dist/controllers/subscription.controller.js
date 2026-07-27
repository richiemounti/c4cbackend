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
exports.handleStripeWebhook = exports.getProjectCreationGate = exports.getOrganizationSubscription = exports.createPortalSession = exports.createCheckoutSession = exports.getCatalogue = void 0;
exports.syncSubscriptionFromStripe = syncSubscriptionFromStripe;
const stripe_1 = require("../config/stripe");
const env_1 = require("../config/env");
const subscription_model_1 = __importDefault(require("../models/subscription.model"));
const organization_model_1 = __importDefault(require("../models/organization.model"));
const stripeCatalogue_service_1 = require("../services/stripeCatalogue.service");
const subscriptionGating_service_1 = require("../services/subscriptionGating.service");
const stripeCatalogue_constants_1 = require("../constants/stripeCatalogue.constants");
function isUserAuthenticated(req) {
    return req.user !== undefined;
}
const TIER_VALUES = ["tier_1", "tier_2", "tier_3"];
const SELLABLE_BUNDLE_TRACKS = ["self_serve", "supported"];
const INTERVAL_VALUES = ["year", "month"];
const CORE_BUNDLE_KEY = {
    self_serve: "om_self_serve",
    supported: "om_supported",
};
function badRequest(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
}
function authRequired() {
    const error = new Error("Authentication required");
    error.statusCode = 401;
    return error;
}
/**
 * SROI (and any other flat-rate add-on) was only seeded with a single tier_1 Price
 * since it costs the same regardless of the org's project-count band.
 */
function resolveTierForProduct(catalogueKey, requestedTier) {
    const product = stripeCatalogue_constants_1.STRIPE_CATALOGUE.find((p) => p.key === catalogueKey);
    return product && product.tiers.length === 1 ? product.tiers[0].tier : requestedTier;
}
function getOrCreateStripeCustomer(organizationId, organizationName) {
    return __awaiter(this, void 0, void 0, function* () {
        const existing = yield subscription_model_1.default.findOne({ organization: organizationId });
        if (existing === null || existing === void 0 ? void 0 : existing.stripeCustomerId) {
            return existing.stripeCustomerId;
        }
        const customer = yield stripe_1.stripe.customers.create({
            name: organizationName,
            metadata: { organizationId },
        });
        yield subscription_model_1.default.findOneAndUpdate({ organization: organizationId }, { organization: organizationId, stripeCustomerId: customer.id }, { upsert: true, setDefaultsOnInsert: true });
        return customer.id;
    });
}
// Public - just the pricing matrix (names/descriptions/GBP amounts), no Stripe IDs or
// anything sensitive. Lets the frontend render pricing without duplicating the catalogue
// as a second hand-typed source of truth that could drift from the real Stripe prices.
const getCatalogue = (_req, res) => {
    res.status(200).json({ success: true, data: stripeCatalogue_constants_1.STRIPE_CATALOGUE });
};
exports.getCatalogue = getCatalogue;
const createCheckoutSession = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req))
            throw authRequired();
        const { organizationId } = req.params;
        const { bundleTrack, tier, interval, addOns } = req.body;
        if (!bundleTrack || !SELLABLE_BUNDLE_TRACKS.includes(bundleTrack)) {
            throw badRequest(`"bundleTrack" must be one of: ${SELLABLE_BUNDLE_TRACKS.join(", ")}`);
        }
        if (!tier || !TIER_VALUES.includes(tier)) {
            throw badRequest(`"tier" must be one of: ${TIER_VALUES.join(", ")}`);
        }
        if (!interval || !INTERVAL_VALUES.includes(interval)) {
            throw badRequest(`"interval" must be one of: ${INTERVAL_VALUES.join(", ")}`);
        }
        if (!Array.isArray(addOns !== null && addOns !== void 0 ? addOns : [])) {
            throw badRequest(`"addOns" must be an array of catalogue keys`);
        }
        const organization = yield organization_model_1.default.findById(organizationId);
        if (!organization || organization.archived) {
            const error = new Error("Organization not found");
            error.statusCode = 404;
            throw error;
        }
        const coreCatalogueKey = CORE_BUNDLE_KEY[bundleTrack];
        const corePrice = yield (0, stripeCatalogue_service_1.getCataloguePrice)(coreCatalogueKey, tier, interval);
        const lineItems = [
            { price: corePrice.priceId, quantity: 1 },
        ];
        for (const addOnKey of addOns !== null && addOns !== void 0 ? addOns : []) {
            const addOnProduct = stripeCatalogue_constants_1.STRIPE_CATALOGUE.find((p) => p.key === addOnKey);
            if (!addOnProduct) {
                throw badRequest(`Unknown add-on "${addOnKey}"`);
            }
            if (addOnProduct.bundleTrack !== "any" && addOnProduct.bundleTrack !== bundleTrack) {
                throw badRequest(`Add-on "${addOnKey}" is not available on the "${bundleTrack}" track`);
            }
            const addOnTier = resolveTierForProduct(addOnKey, tier);
            const addOnPrice = yield (0, stripeCatalogue_service_1.getCataloguePrice)(addOnKey, addOnTier, interval);
            lineItems.push({ price: addOnPrice.priceId, quantity: 1 });
        }
        const stripeCustomerId = yield getOrCreateStripeCustomer(organizationId, organization.name);
        // Stamped on both the Checkout Session and the resulting Subscription (via subscription_data),
        // so the webhook handler can always resolve which org/tier/track a Stripe event belongs to.
        const sessionMetadata = { organizationId, bundleTrack, tier, interval };
        const session = yield stripe_1.stripe.checkout.sessions.create({
            mode: "subscription",
            customer: stripeCustomerId,
            line_items: lineItems,
            automatic_tax: { enabled: true },
            success_url: `${env_1.env.FRONTEND_URL}/dashboard/organization/${organizationId}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${env_1.env.FRONTEND_URL}/dashboard/organization/${organizationId}/billing?checkout=cancelled`,
            metadata: sessionMetadata,
            subscription_data: {
                metadata: sessionMetadata,
            },
        });
        res.status(200).json({ success: true, data: { url: session.url } });
    }
    catch (error) {
        next(error);
    }
});
exports.createCheckoutSession = createCheckoutSession;
const createPortalSession = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req))
            throw authRequired();
        const { organizationId } = req.params;
        const subscription = yield subscription_model_1.default.findOne({ organization: organizationId });
        if (!(subscription === null || subscription === void 0 ? void 0 : subscription.stripeCustomerId)) {
            const error = new Error("This organization has no billing account yet");
            error.statusCode = 404;
            throw error;
        }
        const portalSession = yield stripe_1.stripe.billingPortal.sessions.create({
            customer: subscription.stripeCustomerId,
            return_url: `${env_1.env.FRONTEND_URL}/dashboard/organization/${organizationId}/billing`,
        });
        res.status(200).json({ success: true, data: { url: portalSession.url } });
    }
    catch (error) {
        next(error);
    }
});
exports.createPortalSession = createPortalSession;
const getOrganizationSubscription = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req))
            throw authRequired();
        const { organizationId } = req.params;
        const subscription = yield subscription_model_1.default.findOne({ organization: organizationId });
        // No subscription yet is a normal state for a new org, not an error.
        res.status(200).json({ success: true, data: subscription || null });
    }
    catch (error) {
        next(error);
    }
});
exports.getOrganizationSubscription = getOrganizationSubscription;
const getProjectCreationGate = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!isUserAuthenticated(req))
            throw authRequired();
        const { organizationId } = req.params;
        const gate = yield (0, subscriptionGating_service_1.evaluateProjectCreationGate)(organizationId);
        res.status(200).json({ success: true, data: gate });
    }
    catch (error) {
        next(error);
    }
});
exports.getProjectCreationGate = getProjectCreationGate;
/**
 * Upserts the local Subscription doc from a Stripe Subscription object. Shared by every
 * webhook event that carries (or points to) a subscription, so all of them converge on
 * the same state instead of hand-rolling per-event field mapping.
 */
function syncSubscriptionFromStripe(subscription) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        const organizationId = (_a = subscription.metadata) === null || _a === void 0 ? void 0 : _a.organizationId;
        if (!organizationId) {
            console.warn(`Stripe subscription ${subscription.id} has no organizationId metadata - skipping sync`);
            return;
        }
        const items = subscription.items.data.map((item) => {
            var _a, _b, _c, _d, _e;
            return ({
                catalogueKey: ((_a = item.price.metadata) === null || _a === void 0 ? void 0 : _a.catalogueKey) || "unknown",
                tier: (((_b = item.price.metadata) === null || _b === void 0 ? void 0 : _b.tier) || ((_c = subscription.metadata) === null || _c === void 0 ? void 0 : _c.tier) || "tier_1"),
                interval: (((_d = item.price.metadata) === null || _d === void 0 ? void 0 : _d.interval) || ((_e = subscription.metadata) === null || _e === void 0 ? void 0 : _e.interval) || "year"),
                stripePriceId: item.price.id,
                stripeSubscriptionItemId: item.id,
            });
        });
        // Billing period lives on each item (not the subscription) as of this API version;
        // the core-bundle item's period is used as the subscription-level period.
        const primaryItem = (_b = subscription.items.data.find((item) => {
            const product = stripeCatalogue_constants_1.STRIPE_CATALOGUE.find((p) => { var _a; return p.key === ((_a = item.price.metadata) === null || _a === void 0 ? void 0 : _a.catalogueKey); });
            return product === null || product === void 0 ? void 0 : product.isCoreBundle;
        })) !== null && _b !== void 0 ? _b : subscription.items.data[0];
        yield subscription_model_1.default.findOneAndUpdate({ organization: organizationId }, {
            organization: organizationId,
            stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
            stripeSubscriptionId: subscription.id,
            status: subscription.status,
            bundleTrack: (_c = subscription.metadata) === null || _c === void 0 ? void 0 : _c.bundleTrack,
            currentTier: (_d = subscription.metadata) === null || _d === void 0 ? void 0 : _d.tier,
            items,
            currentPeriodStart: primaryItem ? new Date(primaryItem.current_period_start * 1000) : undefined,
            currentPeriodEnd: primaryItem ? new Date(primaryItem.current_period_end * 1000) : undefined,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
        }, { upsert: true, setDefaultsOnInsert: true });
    });
}
const handleStripeWebhook = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const signature = req.headers["stripe-signature"];
    let event;
    try {
        if (!signature || !env_1.env.STRIPE_WEBHOOK_SECRET) {
            throw new Error("Missing Stripe signature or webhook secret");
        }
        // req.body is the raw Buffer here - app.ts registers express.raw() for this
        // path specifically, ahead of the global express.json() parser, so signature
        // verification below sees the exact bytes Stripe signed.
        event = stripe_1.stripe.webhooks.constructEvent(req.body, signature, env_1.env.STRIPE_WEBHOOK_SECRET);
    }
    catch (err) {
        const error = new Error(`Webhook signature verification failed: ${err.message}`);
        error.statusCode = 400;
        return next(error);
    }
    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object;
                if (session.mode === "subscription" && session.subscription) {
                    const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
                    const subscription = yield stripe_1.stripe.subscriptions.retrieve(subscriptionId);
                    yield syncSubscriptionFromStripe(subscription);
                }
                break;
            }
            case "customer.subscription.updated":
            case "customer.subscription.deleted": {
                const subscription = event.data.object;
                yield syncSubscriptionFromStripe(subscription);
                break;
            }
            case "invoice.payment_failed": {
                const invoice = event.data.object;
                const subscriptionRef = (_b = (_a = invoice.parent) === null || _a === void 0 ? void 0 : _a.subscription_details) === null || _b === void 0 ? void 0 : _b.subscription;
                if (subscriptionRef) {
                    const subscriptionId = typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef.id;
                    const subscription = yield stripe_1.stripe.subscriptions.retrieve(subscriptionId);
                    yield syncSubscriptionFromStripe(subscription);
                }
                break;
            }
            default:
                break;
        }
        res.status(200).json({ received: true });
    }
    catch (error) {
        // Verified event, but processing failed (likely transient) - let Stripe retry.
        next(error);
    }
});
exports.handleStripeWebhook = handleStripeWebhook;
//# sourceMappingURL=subscription.controller.js.map