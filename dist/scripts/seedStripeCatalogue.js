"use strict";
// scripts/seedStripeCatalogue.ts
//
// Creates/reconciles Stripe Products & Prices from constants/stripeCatalogue.constants.ts.
// Idempotent: existing Products/Prices are matched by metadata.catalogueKey (+ tier + interval
// for Prices) and skipped, so re-running this is safe.
//
// Run with:
//   npm run seed:stripe-catalogue          (dry run - prints the plan, touches nothing)
//   npm run seed:stripe-catalogue:apply    (creates missing Products/Prices in Stripe)
//
// Dry run works even without STRIPE_SECRET_KEY set (it just can't check what already
// exists in Stripe, so everything shows as "would create"). Applying requires the key.
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
const stripe_1 = __importDefault(require("stripe"));
const env_1 = require("../config/env");
const stripeCatalogue_constants_1 = require("../constants/stripeCatalogue.constants");
const BILLING_INTERVALS = ['year', 'month'];
function formatGBP(amountPence) {
    return `£${(amountPence / 100).toFixed(2)}`;
}
function priceKeyFor(catalogueKey, tier, interval) {
    return `${catalogueKey}:${tier}:${interval}`;
}
function loadExistingProducts(stripe) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, e_1, _b, _c;
        var _d;
        const map = {};
        try {
            for (var _e = true, _f = __asyncValues(stripe.products.list({ limit: 100 })), _g; _g = yield _f.next(), _a = _g.done, !_a; _e = true) {
                _c = _g.value;
                _e = false;
                const product = _c;
                const key = (_d = product.metadata) === null || _d === void 0 ? void 0 : _d.catalogueKey;
                if (key)
                    map[key] = product;
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
function loadExistingPrices(stripe) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, e_2, _b, _c;
        const map = {};
        try {
            for (var _d = true, _e = __asyncValues(stripe.prices.list({ limit: 100 })), _f; _f = yield _e.next(), _a = _f.done, !_a; _d = true) {
                _c = _f.value;
                _d = false;
                const price = _c;
                const { catalogueKey, tier, interval } = price.metadata || {};
                if (catalogueKey && tier && interval) {
                    map[priceKeyFor(catalogueKey, tier, interval)] = price;
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (!_d && !_a && (_b = _e.return)) yield _b.call(_e);
            }
            finally { if (e_2) throw e_2.error; }
        }
        return map;
    });
}
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        const args = process.argv.slice(2);
        const shouldApply = args.includes('--apply');
        const dryRun = !shouldApply;
        const hasStripeKey = !!env_1.env.STRIPE_SECRET_KEY;
        console.log('='.repeat(60));
        console.log(dryRun ? '🔍 DRY RUN - no changes will be made to Stripe' : '⚠️  APPLYING - this will create Products/Prices in Stripe');
        console.log(`Stripe mode: ${hasStripeKey ? (env_1.env.STRIPE_SECRET_KEY.startsWith('sk_live') ? 'LIVE' : 'TEST') : 'no key set'}`);
        console.log('='.repeat(60));
        if (shouldApply && !hasStripeKey) {
            console.error('\nSTRIPE_SECRET_KEY is not set. Add it to .env.development.local before applying.');
            process.exit(1);
        }
        const stripe = hasStripeKey
            ? new stripe_1.default(env_1.env.STRIPE_SECRET_KEY, { apiVersion: '2026-06-24.dahlia' })
            : null;
        const existingProducts = stripe ? yield loadExistingProducts(stripe) : {};
        const existingPrices = stripe ? yield loadExistingPrices(stripe) : {};
        if (!stripe) {
            console.log('\nNo STRIPE_SECRET_KEY set - skipping existing-state check, showing the full catalogue as a plan.\n');
        }
        let productsToCreate = 0;
        let productsExisting = 0;
        let pricesToCreate = 0;
        let pricesExisting = 0;
        for (const product of stripeCatalogue_constants_1.STRIPE_CATALOGUE) {
            let stripeProduct = existingProducts[product.key];
            if (stripeProduct) {
                productsExisting++;
                console.log(`\n[Product] ${product.name}  (exists: ${stripeProduct.id})`);
            }
            else {
                productsToCreate++;
                if (dryRun || !stripe) {
                    console.log(`\n[Product] ${product.name}  (would create)`);
                }
                else {
                    stripeProduct = yield stripe.products.create({
                        name: product.name,
                        description: product.description,
                        metadata: {
                            catalogueKey: product.key,
                            isCoreBundle: String(product.isCoreBundle),
                            bundleTrack: product.bundleTrack,
                        },
                    });
                    console.log(`\n[Product] ${product.name}  (created: ${stripeProduct.id})`);
                }
            }
            for (const tierPrice of product.tiers) {
                for (const interval of BILLING_INTERVALS) {
                    const amount = interval === 'year' ? tierPrice.annualAmountPence : tierPrice.monthlyAmountPence;
                    const key = priceKeyFor(product.key, tierPrice.tier, interval);
                    const existing = existingPrices[key];
                    if (existing) {
                        pricesExisting++;
                        console.log(`  - ${tierPrice.tier} / ${interval}: ${formatGBP(amount)}  (exists: ${existing.id})`);
                        continue;
                    }
                    pricesToCreate++;
                    if (dryRun || !stripe || !stripeProduct) {
                        console.log(`  - ${tierPrice.tier} / ${interval}: ${formatGBP(amount)}  (would create)`);
                        continue;
                    }
                    const price = yield stripe.prices.create({
                        product: stripeProduct.id,
                        currency: 'gbp',
                        unit_amount: amount,
                        recurring: { interval },
                        tax_behavior: 'exclusive',
                        nickname: `${product.name} — ${tierPrice.tier} — ${interval}`,
                        metadata: {
                            catalogueKey: product.key,
                            tier: tierPrice.tier,
                            interval,
                            projectRange: tierPrice.projectRange,
                        },
                    });
                    console.log(`  - ${tierPrice.tier} / ${interval}: ${formatGBP(amount)}  (created: ${price.id})`);
                }
            }
        }
        console.log('\n' + '='.repeat(60));
        console.log('SUMMARY');
        console.log('='.repeat(60));
        console.log(`Products: ${productsExisting} existing, ${productsToCreate} ${dryRun ? 'to create' : 'created'}`);
        console.log(`Prices:   ${pricesExisting} existing, ${pricesToCreate} ${dryRun ? 'to create' : 'created'}`);
        console.log('\nNote: Enterprise (5+ projects) tiers are intentionally excluded - they are negotiated, sales-assisted plans with no Stripe Price.');
        if (dryRun) {
            console.log('\nRe-run with --apply to create the missing Products/Prices in Stripe.');
        }
        process.exit(0);
    });
}
run().catch((error) => {
    console.error('Seed script failed:', error);
    process.exit(1);
});
//# sourceMappingURL=seedStripeCatalogue.js.map