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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCataloguePrice = getCataloguePrice;
exports.invalidateCataloguePriceCache = invalidateCataloguePriceCache;
// services/stripeCatalogue.service.ts
//
// Resolves (catalogueKey, tier, interval) -> the live Stripe Price/Product IDs.
// IDs are looked up from Stripe (matched via the metadata.catalogueKey/tier/interval
// set by scripts/seedStripeCatalogue.ts) rather than hardcoded, so the same code works
// unmodified against test mode and live mode - each Stripe mode has its own IDs.
const node_cache_1 = __importDefault(require("node-cache"));
const stripe_1 = require("../config/stripe");
const stripeCatalogue_constants_1 = require("../constants/stripeCatalogue.constants");
const CACHE_KEY = "stripe:catalogue:priceMap";
const CACHE_TTL_SECONDS = 3600;
const cache = new node_cache_1.default({ stdTTL: CACHE_TTL_SECONDS, checkperiod: 300, useClones: false });
function mapKey(catalogueKey, tier, interval) {
    return `${catalogueKey}:${tier}:${interval}`;
}
function buildPriceMap() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, e_1, _b, _c;
        var _d;
        const catalogueByKey = new Map(stripeCatalogue_constants_1.STRIPE_CATALOGUE.map((product) => [product.key, product]));
        const map = {};
        try {
            for (var _e = true, _f = __asyncValues(stripe_1.stripe.prices.list({ limit: 100, active: true })), _g; _g = yield _f.next(), _a = _g.done, !_a; _e = true) {
                _c = _g.value;
                _e = false;
                const price = _c;
                const { catalogueKey, tier, interval } = price.metadata || {};
                if (!catalogueKey || !tier || !interval)
                    continue;
                const catalogueProduct = catalogueByKey.get(catalogueKey);
                if (!catalogueProduct)
                    continue;
                map[mapKey(catalogueKey, tier, interval)] = {
                    catalogueKey,
                    productId: typeof price.product === "string" ? price.product : price.product.id,
                    priceId: price.id,
                    tier: tier,
                    interval: interval,
                    bundleTrack: catalogueProduct.bundleTrack,
                    isCoreBundle: catalogueProduct.isCoreBundle,
                    unitAmount: (_d = price.unit_amount) !== null && _d !== void 0 ? _d : 0,
                };
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (!_e && !_a && (_b = _f.return)) yield _b.call(_f);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return map;
    });
}
function getPriceMap() {
    return __awaiter(this, arguments, void 0, function* (forceRefresh = false) {
        if (!forceRefresh) {
            const cached = cache.get(CACHE_KEY);
            if (cached)
                return cached;
        }
        const map = yield buildPriceMap();
        cache.set(CACHE_KEY, map);
        return map;
    });
}
/**
 * Resolves a catalogue entry to its live Stripe Price/Product ID.
 * Retries once against a fresh (uncached) Stripe fetch before failing, so a price
 * created moments ago (e.g. right after re-running the seed script) is still found.
 */
function getCataloguePrice(catalogueKey, tier, interval) {
    return __awaiter(this, void 0, void 0, function* () {
        const key = mapKey(catalogueKey, tier, interval);
        const map = yield getPriceMap();
        if (map[key])
            return map[key];
        const refreshed = yield getPriceMap(true);
        if (refreshed[key])
            return refreshed[key];
        throw new Error(`No Stripe Price found for catalogueKey="${catalogueKey}" tier="${tier}" interval="${interval}". ` +
            `Run "npm run seed:stripe-catalogue:apply" to create it.`);
    });
}
function invalidateCataloguePriceCache() {
    cache.del(CACHE_KEY);
}
//# sourceMappingURL=stripeCatalogue.service.js.map