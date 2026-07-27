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

import Stripe from 'stripe';
import { env } from '../config/env';
import { STRIPE_CATALOGUE, type TierKey } from '../constants/stripeCatalogue.constants';

const BILLING_INTERVALS = ['year', 'month'] as const;
type BillingInterval = (typeof BILLING_INTERVALS)[number];

function formatGBP(amountPence: number): string {
  return `£${(amountPence / 100).toFixed(2)}`;
}

function priceKeyFor(catalogueKey: string, tier: TierKey, interval: BillingInterval): string {
  return `${catalogueKey}:${tier}:${interval}`;
}

async function loadExistingProducts(stripe: Stripe): Promise<Record<string, Stripe.Product>> {
  const map: Record<string, Stripe.Product> = {};
  for await (const product of stripe.products.list({ limit: 100 })) {
    const key = product.metadata?.catalogueKey;
    if (key) map[key] = product;
  }
  return map;
}

async function loadExistingPrices(stripe: Stripe): Promise<Record<string, Stripe.Price>> {
  const map: Record<string, Stripe.Price> = {};
  for await (const price of stripe.prices.list({ limit: 100 })) {
    const { catalogueKey, tier, interval } = price.metadata || {};
    if (catalogueKey && tier && interval) {
      map[priceKeyFor(catalogueKey, tier as TierKey, interval as BillingInterval)] = price;
    }
  }
  return map;
}

async function run() {
  const args = process.argv.slice(2);
  const shouldApply = args.includes('--apply');
  const dryRun = !shouldApply;
  const hasStripeKey = !!env.STRIPE_SECRET_KEY;

  console.log('='.repeat(60));
  console.log(dryRun ? '🔍 DRY RUN - no changes will be made to Stripe' : '⚠️  APPLYING - this will create Products/Prices in Stripe');
  console.log(`Stripe mode: ${hasStripeKey ? (env.STRIPE_SECRET_KEY!.startsWith('sk_live') ? 'LIVE' : 'TEST') : 'no key set'}`);
  console.log('='.repeat(60));

  if (shouldApply && !hasStripeKey) {
    console.error('\nSTRIPE_SECRET_KEY is not set. Add it to .env.development.local before applying.');
    process.exit(1);
  }

  const stripe = hasStripeKey
    ? new Stripe(env.STRIPE_SECRET_KEY!, { apiVersion: '2026-06-24.dahlia' })
    : null;

  const existingProducts = stripe ? await loadExistingProducts(stripe) : {};
  const existingPrices = stripe ? await loadExistingPrices(stripe) : {};

  if (!stripe) {
    console.log('\nNo STRIPE_SECRET_KEY set - skipping existing-state check, showing the full catalogue as a plan.\n');
  }

  let productsToCreate = 0;
  let productsExisting = 0;
  let pricesToCreate = 0;
  let pricesExisting = 0;

  for (const product of STRIPE_CATALOGUE) {
    let stripeProduct = existingProducts[product.key];

    if (stripeProduct) {
      productsExisting++;
      console.log(`\n[Product] ${product.name}  (exists: ${stripeProduct.id})`);
    } else {
      productsToCreate++;
      if (dryRun || !stripe) {
        console.log(`\n[Product] ${product.name}  (would create)`);
      } else {
        stripeProduct = await stripe.products.create({
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

        const price = await stripe.prices.create({
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
  console.log(
    '\nNote: Enterprise (5+ projects) tiers are intentionally excluded - they are negotiated, sales-assisted plans with no Stripe Price.'
  );
  if (dryRun) {
    console.log('\nRe-run with --apply to create the missing Products/Prices in Stripe.');
  }

  process.exit(0);
}

run().catch((error) => {
  console.error('Seed script failed:', error);
  process.exit(1);
});
