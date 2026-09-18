// services/sniAccessGating.service.ts
//
// The SNI payment gate — brief §12: "The Social Networks Instrument is a
// separately priced product, gated behind a payment block... One gate covers
// the whole Instrument, all six sub-themes." Org-level, not per-project: an
// organization either has the SNI add-on line item on its subscription or it
// doesn't, mirroring how every other add-on (Insight, SROI, SNA) is modeled —
// see constants/stripeCatalogue.constants.ts.
//
// Deliberately shaped exactly like subscriptionGating.service.ts's
// evaluate/assert pair (same read-only-then-throwing split, same 402), rather
// than introducing a new pattern for the same kind of check.
import Subscription from "../models/subscription.model";
import { CustomError } from "../middlewares/error.middleware";

const ENTITLED_STATUSES = ["active", "trialing"];
const SNI_CATALOGUE_KEYS = ["sni_self_serve", "sni_supported"];

export interface SniAccessGate {
    isEntitled: boolean;
    manuallyManaged: boolean;
    hasSniLineItem: boolean;
    subscriptionStatus: string | null;
}

/**
 * Read-only evaluation — never throws. Used both by the enforcing check below
 * and by a status endpoint so the frontend can show an upgrade prompt before
 * the user attempts activation.
 */
export async function evaluateSniAccessGate(organizationId: string): Promise<SniAccessGate> {
    const subscription = await Subscription.findOne({ organization: organizationId });
    const manuallyManaged = !!subscription?.manuallyManaged;
    const hasSniLineItem = !!subscription?.items?.some((item: any) => SNI_CATALOGUE_KEYS.includes(item.catalogueKey));

    if (manuallyManaged) {
        return { isEntitled: true, manuallyManaged: true, hasSniLineItem, subscriptionStatus: subscription?.status ?? null };
    }

    const hasActiveSubscription = !!subscription && ENTITLED_STATUSES.includes(subscription.status);

    return {
        isEntitled: hasActiveSubscription && hasSniLineItem,
        manuallyManaged: false,
        hasSniLineItem,
        subscriptionStatus: subscription?.status ?? null,
    };
}

/**
 * Enforces the gate. No soft-gate/upgrade-required concept here (unlike the
 * project-creation gate) — SNI access is binary: either the org bought the
 * add-on or it didn't.
 */
export async function assertOrganizationHasSniAccess(
    organizationId: string,
    options: { bypassPaywall?: boolean } = {}
): Promise<SniAccessGate> {
    const gate = await evaluateSniAccessGate(organizationId);

    if (!gate.isEntitled && !options.bypassPaywall) {
        const error = new Error("The Social Networks Instrument add-on is required to activate this survey.") as CustomError;
        error.statusCode = 402;
        throw error;
    }

    return gate;
}
