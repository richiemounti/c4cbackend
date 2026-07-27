// services/stripeCatalogue.service.ts
//
// Resolves (catalogueKey, tier, interval) -> the live Stripe Price/Product IDs.
// IDs are looked up from Stripe (matched via the metadata.catalogueKey/tier/interval
// set by scripts/seedStripeCatalogue.ts) rather than hardcoded, so the same code works
// unmodified against test mode and live mode - each Stripe mode has its own IDs.
import NodeCache from "node-cache";
import { stripe } from "../config/stripe";
import { STRIPE_CATALOGUE, type BundleTrack, type TierKey } from "../constants/stripeCatalogue.constants";

export type BillingInterval = "year" | "month";

export interface CataloguePriceEntry {
    catalogueKey: string;
    productId: string;
    priceId: string;
    tier: TierKey;
    interval: BillingInterval;
    bundleTrack: BundleTrack;
    isCoreBundle: boolean;
    unitAmount: number;
}

const CACHE_KEY = "stripe:catalogue:priceMap";
const CACHE_TTL_SECONDS = 3600;

const cache = new NodeCache({ stdTTL: CACHE_TTL_SECONDS, checkperiod: 300, useClones: false });

function mapKey(catalogueKey: string, tier: TierKey, interval: BillingInterval): string {
    return `${catalogueKey}:${tier}:${interval}`;
}

async function buildPriceMap(): Promise<Record<string, CataloguePriceEntry>> {
    const catalogueByKey = new Map(STRIPE_CATALOGUE.map((product) => [product.key, product]));
    const map: Record<string, CataloguePriceEntry> = {};

    for await (const price of stripe.prices.list({ limit: 100, active: true })) {
        const { catalogueKey, tier, interval } = price.metadata || {};
        if (!catalogueKey || !tier || !interval) continue;

        const catalogueProduct = catalogueByKey.get(catalogueKey);
        if (!catalogueProduct) continue;

        map[mapKey(catalogueKey, tier as TierKey, interval as BillingInterval)] = {
            catalogueKey,
            productId: typeof price.product === "string" ? price.product : price.product.id,
            priceId: price.id,
            tier: tier as TierKey,
            interval: interval as BillingInterval,
            bundleTrack: catalogueProduct.bundleTrack,
            isCoreBundle: catalogueProduct.isCoreBundle,
            unitAmount: price.unit_amount ?? 0,
        };
    }

    return map;
}

async function getPriceMap(forceRefresh = false): Promise<Record<string, CataloguePriceEntry>> {
    if (!forceRefresh) {
        const cached = cache.get<Record<string, CataloguePriceEntry>>(CACHE_KEY);
        if (cached) return cached;
    }
    const map = await buildPriceMap();
    cache.set(CACHE_KEY, map);
    return map;
}

/**
 * Resolves a catalogue entry to its live Stripe Price/Product ID.
 * Retries once against a fresh (uncached) Stripe fetch before failing, so a price
 * created moments ago (e.g. right after re-running the seed script) is still found.
 */
export async function getCataloguePrice(
    catalogueKey: string,
    tier: TierKey,
    interval: BillingInterval
): Promise<CataloguePriceEntry> {
    const key = mapKey(catalogueKey, tier, interval);

    const map = await getPriceMap();
    if (map[key]) return map[key];

    const refreshed = await getPriceMap(true);
    if (refreshed[key]) return refreshed[key];

    throw new Error(
        `No Stripe Price found for catalogueKey="${catalogueKey}" tier="${tier}" interval="${interval}". ` +
            `Run "npm run seed:stripe-catalogue:apply" to create it.`
    );
}

export function invalidateCataloguePriceCache(): void {
    cache.del(CACHE_KEY);
}
