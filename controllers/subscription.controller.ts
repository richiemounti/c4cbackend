// controllers/subscription.controller.ts
import mongoose from "mongoose";
import { Request, Response, NextFunction } from "express";
import Stripe from "stripe";
import { stripe } from "../config/stripe";
import { env } from "../config/env";
import Subscription from "../models/subscription.model";
import Organization from "../models/organization.model";
import { CustomError } from "../middlewares/error.middleware";
import { IUserDocument } from "../models/user.model";
import { getCataloguePrice } from "../services/stripeCatalogue.service";
import { evaluateProjectCreationGate } from "../services/subscriptionGating.service";
import { evaluateSniAccessGate } from "../services/sniAccessGating.service";
import { STRIPE_CATALOGUE, type BundleTrack, type TierKey } from "../constants/stripeCatalogue.constants";

type AuthUser = IUserDocument & { _id: mongoose.Types.ObjectId };

function isUserAuthenticated(req: Request): req is Request & { user: AuthUser } {
    return req.user !== undefined;
}

const TIER_VALUES: TierKey[] = ["tier_1", "tier_2", "tier_3"];
const SELLABLE_BUNDLE_TRACKS = ["self_serve", "supported"] as const;
type SellableBundleTrack = (typeof SELLABLE_BUNDLE_TRACKS)[number];
const INTERVAL_VALUES = ["year", "month"] as const;
type BillingInterval = (typeof INTERVAL_VALUES)[number];

const CORE_BUNDLE_KEY: Record<SellableBundleTrack, string> = {
    self_serve: "om_self_serve",
    supported: "om_supported",
};

function badRequest(message: string): CustomError {
    const error = new Error(message) as CustomError;
    error.statusCode = 400;
    return error;
}

function authRequired(): CustomError {
    const error = new Error("Authentication required") as CustomError;
    error.statusCode = 401;
    return error;
}

/**
 * SROI (and any other flat-rate add-on) was only seeded with a single tier_1 Price
 * since it costs the same regardless of the org's project-count band.
 */
function resolveTierForProduct(catalogueKey: string, requestedTier: TierKey): TierKey {
    const product = STRIPE_CATALOGUE.find((p) => p.key === catalogueKey);
    return product && product.tiers.length === 1 ? product.tiers[0].tier : requestedTier;
}

async function getOrCreateStripeCustomer(organizationId: string, organizationName: string): Promise<string> {
    const existing = await Subscription.findOne({ organization: organizationId });
    if (existing?.stripeCustomerId) {
        return existing.stripeCustomerId;
    }

    const customer = await stripe.customers.create({
        name: organizationName,
        metadata: { organizationId },
    });

    await Subscription.findOneAndUpdate(
        { organization: organizationId },
        { organization: organizationId, stripeCustomerId: customer.id },
        { upsert: true, setDefaultsOnInsert: true }
    );

    return customer.id;
}

// Public - just the pricing matrix (names/descriptions/GBP amounts), no Stripe IDs or
// anything sensitive. Lets the frontend render pricing without duplicating the catalogue
// as a second hand-typed source of truth that could drift from the real Stripe prices.
export const getCatalogue = (_req: Request, res: Response) => {
    res.status(200).json({ success: true, data: STRIPE_CATALOGUE });
};

export const createCheckoutSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!isUserAuthenticated(req)) throw authRequired();

        const { organizationId } = req.params;
        const { bundleTrack, tier, interval, addOns } = req.body as {
            bundleTrack?: SellableBundleTrack;
            tier?: TierKey;
            interval?: BillingInterval;
            addOns?: string[];
        };

        if (!bundleTrack || !SELLABLE_BUNDLE_TRACKS.includes(bundleTrack)) {
            throw badRequest(`"bundleTrack" must be one of: ${SELLABLE_BUNDLE_TRACKS.join(", ")}`);
        }
        if (!tier || !TIER_VALUES.includes(tier)) {
            throw badRequest(`"tier" must be one of: ${TIER_VALUES.join(", ")}`);
        }
        if (!interval || !INTERVAL_VALUES.includes(interval)) {
            throw badRequest(`"interval" must be one of: ${INTERVAL_VALUES.join(", ")}`);
        }
        if (!Array.isArray(addOns ?? [])) {
            throw badRequest(`"addOns" must be an array of catalogue keys`);
        }

        const organization = await Organization.findById(organizationId);
        if (!organization || organization.archived) {
            const error = new Error("Organization not found") as CustomError;
            error.statusCode = 404;
            throw error;
        }

        const coreCatalogueKey = CORE_BUNDLE_KEY[bundleTrack];
        const corePrice = await getCataloguePrice(coreCatalogueKey, tier, interval);

        const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
            { price: corePrice.priceId, quantity: 1 },
        ];

        for (const addOnKey of addOns ?? []) {
            const addOnProduct = STRIPE_CATALOGUE.find((p) => p.key === addOnKey);
            if (!addOnProduct) {
                throw badRequest(`Unknown add-on "${addOnKey}"`);
            }
            if (addOnProduct.bundleTrack !== "any" && addOnProduct.bundleTrack !== bundleTrack) {
                throw badRequest(`Add-on "${addOnKey}" is not available on the "${bundleTrack}" track`);
            }
            const addOnTier = resolveTierForProduct(addOnKey, tier);
            const addOnPrice = await getCataloguePrice(addOnKey, addOnTier, interval);
            lineItems.push({ price: addOnPrice.priceId, quantity: 1 });
        }

        const stripeCustomerId = await getOrCreateStripeCustomer(organizationId, organization.name);

        // Stamped on both the Checkout Session and the resulting Subscription (via subscription_data),
        // so the webhook handler can always resolve which org/tier/track a Stripe event belongs to.
        const sessionMetadata = { organizationId, bundleTrack, tier, interval };

        const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            customer: stripeCustomerId,
            line_items: lineItems,
            automatic_tax: { enabled: true },
            // We pass an existing (addressless) Customer above - without this, Checkout won't
            // collect/attach a billing address to it, so Stripe Tax has no location to compute
            // from and every session fails with `customer_tax_location_invalid`.
            billing_address_collection: "required",
            customer_update: { address: "auto", name: "auto" },
            success_url: `${env.FRONTEND_URL}/dashboard/organization/${organizationId}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${env.FRONTEND_URL}/dashboard/organization/${organizationId}/billing?checkout=cancelled`,
            metadata: sessionMetadata,
            subscription_data: {
                metadata: sessionMetadata,
            },
        });

        res.status(200).json({ success: true, data: { url: session.url } });
    } catch (error) {
        next(error);
    }
};

export const createPortalSession = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!isUserAuthenticated(req)) throw authRequired();

        const { organizationId } = req.params;
        const subscription = await Subscription.findOne({ organization: organizationId });

        if (!subscription?.stripeCustomerId) {
            const error = new Error("This organization has no billing account yet") as CustomError;
            error.statusCode = 404;
            throw error;
        }

        const portalSession = await stripe.billingPortal.sessions.create({
            customer: subscription.stripeCustomerId,
            return_url: `${env.FRONTEND_URL}/dashboard/organization/${organizationId}/billing`,
        });

        res.status(200).json({ success: true, data: { url: portalSession.url } });
    } catch (error) {
        next(error);
    }
};

export const getOrganizationSubscription = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!isUserAuthenticated(req)) throw authRequired();

        const { organizationId } = req.params;
        const subscription = await Subscription.findOne({ organization: organizationId });

        // No subscription yet is a normal state for a new org, not an error.
        res.status(200).json({ success: true, data: subscription || null });
    } catch (error) {
        next(error);
    }
};

export const getProjectCreationGate = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!isUserAuthenticated(req)) throw authRequired();

        const { organizationId } = req.params;
        const gate = await evaluateProjectCreationGate(organizationId);

        res.status(200).json({ success: true, data: gate });
    } catch (error) {
        next(error);
    }
};

// Read-only SNI access check — lets a future client-facing "activate SNI"
// flow show an upgrade prompt before attempting activation, same reasoning
// as getProjectCreationGate above.
export const getSniAccessGateStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!isUserAuthenticated(req)) throw authRequired();

        const { organizationId } = req.params;
        const gate = await evaluateSniAccessGate(organizationId);

        res.status(200).json({ success: true, data: gate });
    } catch (error) {
        next(error);
    }
};

/**
 * Upserts the local Subscription doc from a Stripe Subscription object. Shared by every
 * webhook event that carries (or points to) a subscription, so all of them converge on
 * the same state instead of hand-rolling per-event field mapping.
 */
export async function syncSubscriptionFromStripe(subscription: Stripe.Subscription): Promise<void> {
    const organizationId = subscription.metadata?.organizationId;
    if (!organizationId) {
        console.warn(`Stripe subscription ${subscription.id} has no organizationId metadata - skipping sync`);
        return;
    }

    const items = subscription.items.data.map((item) => ({
        catalogueKey: item.price.metadata?.catalogueKey || "unknown",
        tier: (item.price.metadata?.tier || subscription.metadata?.tier || "tier_1") as TierKey,
        interval: (item.price.metadata?.interval || subscription.metadata?.interval || "year") as BillingInterval,
        stripePriceId: item.price.id,
        stripeSubscriptionItemId: item.id,
    }));

    // Billing period lives on each item (not the subscription) as of this API version;
    // the core-bundle item's period is used as the subscription-level period.
    const primaryItem =
        subscription.items.data.find((item) => {
            const product = STRIPE_CATALOGUE.find((p) => p.key === item.price.metadata?.catalogueKey);
            return product?.isCoreBundle;
        }) ?? subscription.items.data[0];

    await Subscription.findOneAndUpdate(
        { organization: organizationId },
        {
            organization: organizationId,
            stripeCustomerId:
                typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
            stripeSubscriptionId: subscription.id,
            status: subscription.status,
            bundleTrack: subscription.metadata?.bundleTrack,
            currentTier: subscription.metadata?.tier,
            items,
            currentPeriodStart: primaryItem ? new Date(primaryItem.current_period_start * 1000) : undefined,
            currentPeriodEnd: primaryItem ? new Date(primaryItem.current_period_end * 1000) : undefined,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
        },
        { upsert: true, setDefaultsOnInsert: true }
    );
}

export const handleStripeWebhook = async (req: Request, res: Response, next: NextFunction) => {
    const signature = req.headers["stripe-signature"];

    let event: Stripe.Event;
    try {
        if (!signature || !env.STRIPE_WEBHOOK_SECRET) {
            throw new Error("Missing Stripe signature or webhook secret");
        }
        // req.body is the raw Buffer here - app.ts registers express.raw() for this
        // path specifically, ahead of the global express.json() parser, so signature
        // verification below sees the exact bytes Stripe signed.
        event = stripe.webhooks.constructEvent(req.body, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        const error = new Error(`Webhook signature verification failed: ${(err as Error).message}`) as CustomError;
        error.statusCode = 400;
        return next(error);
    }

    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object as Stripe.Checkout.Session;
                if (session.mode === "subscription" && session.subscription) {
                    const subscriptionId =
                        typeof session.subscription === "string" ? session.subscription : session.subscription.id;
                    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                    await syncSubscriptionFromStripe(subscription);
                }
                break;
            }
            case "customer.subscription.updated":
            case "customer.subscription.deleted": {
                const subscription = event.data.object as Stripe.Subscription;
                await syncSubscriptionFromStripe(subscription);
                break;
            }
            case "invoice.payment_failed": {
                const invoice = event.data.object as Stripe.Invoice;
                const subscriptionRef = invoice.parent?.subscription_details?.subscription;
                if (subscriptionRef) {
                    const subscriptionId = typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef.id;
                    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                    await syncSubscriptionFromStripe(subscription);
                }
                break;
            }
            default:
                break;
        }

        res.status(200).json({ received: true });
    } catch (error) {
        // Verified event, but processing failed (likely transient) - let Stripe retry.
        next(error);
    }
};
