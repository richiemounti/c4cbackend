// constants/stripeCatalogue.constants.ts
//
// Source of truth for the C4C Stripe product/price catalogue, transcribed from the
// "C4C Pricing Matrix" Notion export. Amounts are integer pence (GBP, tax-exclusive).
//
// Tier bands are flat-rate, not per-project multiplication: Tier 2 (2-3 projects) and
// Tier 3 (4-5 projects) both charge a single price regardless of whether the org has
// the lower or upper number of projects in that band. "Enterprise" (5+ projects) has
// no fixed price - it is a negotiated/sales-assisted plan and intentionally has no
// entry in `tiers`, so no Stripe Price is ever created for it.

export type TierKey = 'tier_1' | 'tier_2' | 'tier_3';
export type BundleTrack = 'self_serve' | 'supported' | 'any';

export interface StripeTierPrice {
  tier: TierKey;
  projectRange: string;
  annualAmountPence: number;
  monthlyAmountPence: number;
}

export interface StripeCatalogueProduct {
  /** Stable identifier stored in Stripe metadata.catalogueKey - never rename once live. */
  key: string;
  name: string;
  description: string;
  isCoreBundle: boolean;
  /** Which core-bundle track this add-on pairs with; 'any' for track-agnostic add-ons. */
  bundleTrack: BundleTrack;
  tiers: StripeTierPrice[];
}

const TIER_RANGES: Record<TierKey, string> = {
  tier_1: '1 project',
  tier_2: '2-3 projects',
  tier_3: '4-5 projects',
};

export const STRIPE_CATALOGUE: StripeCatalogueProduct[] = [
  {
    key: 'om_self_serve',
    name: 'Outcome Mapping & Monitoring — Self-Serve',
    description:
      'Core bundle: Stakeholder mapping, ToC design, Survey build & data collection, Data visualisation.',
    isCoreBundle: true,
    bundleTrack: 'self_serve',
    tiers: [
      { tier: 'tier_1', projectRange: TIER_RANGES.tier_1, annualAmountPence: 686600, monthlyAmountPence: 57200 },
      { tier: 'tier_2', projectRange: TIER_RANGES.tier_2, annualAmountPence: 1647800, monthlyAmountPence: 137300 },
      { tier: 'tier_3', projectRange: TIER_RANGES.tier_3, annualAmountPence: 2231500, monthlyAmountPence: 186000 },
    ],
  },
  {
    key: 'om_supported',
    name: 'Outcome Mapping & Monitoring — Supported',
    description:
      'Core bundle plus account management and mentoring (~25% of Hannah\'s time). Learning infrastructure with human support, not just platform access.',
    isCoreBundle: true,
    bundleTrack: 'supported',
    tiers: [
      { tier: 'tier_1', projectRange: TIER_RANGES.tier_1, annualAmountPence: 2612500, monthlyAmountPence: 217700 },
      { tier: 'tier_2', projectRange: TIER_RANGES.tier_2, annualAmountPence: 6270000, monthlyAmountPence: 522500 },
      { tier: 'tier_3', projectRange: TIER_RANGES.tier_3, annualAmountPence: 8490600, monthlyAmountPence: 707600 },
    ],
  },
  {
    key: 'insight_self_serve',
    name: 'Learning Infrastructure — Insight (Self-Serve)',
    description:
      'Add-on to the Self-Serve core bundle. Moves from monitoring to learning - understanding what is working, why, and what to do differently.',
    isCoreBundle: false,
    bundleTrack: 'self_serve',
    tiers: [
      { tier: 'tier_1', projectRange: TIER_RANGES.tier_1, annualAmountPence: 275000, monthlyAmountPence: 22900 },
      { tier: 'tier_2', projectRange: TIER_RANGES.tier_2, annualAmountPence: 659100, monthlyAmountPence: 54900 },
      { tier: 'tier_3', projectRange: TIER_RANGES.tier_3, annualAmountPence: 893800, monthlyAmountPence: 74500 },
    ],
  },
  {
    key: 'insight_supported',
    name: 'Learning Infrastructure — Insight (Supported)',
    description: 'Add-on to the Supported core bundle. Systematises learning.',
    isCoreBundle: false,
    bundleTrack: 'supported',
    tiers: [
      { tier: 'tier_1', projectRange: TIER_RANGES.tier_1, annualAmountPence: 1045000, monthlyAmountPence: 87100 },
      { tier: 'tier_2', projectRange: TIER_RANGES.tier_2, annualAmountPence: 2508000, monthlyAmountPence: 209000 },
      { tier: 'tier_3', projectRange: TIER_RANGES.tier_3, annualAmountPence: 3396300, monthlyAmountPence: 283000 },
    ],
  },
  {
    // Social Networks Instrument (SNI) — a distinct product from 'sna_*' below.
    // SNA (Social Network Analysis) is marketed as mapping the ORGANIZATION's own
    // network of actors/alliances (see app/page.tsx's marketing copy) — sociocentric/
    // organizational mapping. SNI is the opposite: an individual respondent's personal
    // ego network (who they rely on), and the design brief is explicit that SNI is NOT
    // sociocentric/whole-community mapping. Confirmed with Sam (2026-09-16) these are
    // two separate products, not a rename of one into the other.
    //
    // PLACEHOLDER PRICING — not business-approved. Copied insight_*'s price shape as a
    // structurally similar-sized add-on, purely so this entry has *a* number rather than
    // zero. Do NOT run `seed:stripe-catalogue:apply` against these amounts without real
    // pricing sign-off first (the seed script's dry-run mode is safe to run anytime —
    // it only prints a plan, see scripts/seedStripeCatalogue.ts).
    key: 'sni_self_serve',
    name: 'Social Networks Instrument — Self-Serve',
    description:
      'Add-on to the Self-Serve core bundle. Ego-network survey engine for measuring who a respondent relies on, what those relationships give them, and how that changes over time.',
    isCoreBundle: false,
    bundleTrack: 'self_serve',
    tiers: [
      { tier: 'tier_1', projectRange: TIER_RANGES.tier_1, annualAmountPence: 275000, monthlyAmountPence: 22900 },
      { tier: 'tier_2', projectRange: TIER_RANGES.tier_2, annualAmountPence: 659100, monthlyAmountPence: 54900 },
      { tier: 'tier_3', projectRange: TIER_RANGES.tier_3, annualAmountPence: 893800, monthlyAmountPence: 74500 },
    ],
  },
  {
    // See placeholder-pricing note on sni_self_serve above — applies here too.
    key: 'sni_supported',
    name: 'Social Networks Instrument — Supported',
    description: 'Add-on to the Supported core bundle. Includes fieldwork/methodology support for deploying ego-network surveys (roster cap, safeguarding split, longitudinal waves).',
    isCoreBundle: false,
    bundleTrack: 'supported',
    tiers: [
      { tier: 'tier_1', projectRange: TIER_RANGES.tier_1, annualAmountPence: 1045000, monthlyAmountPence: 87100 },
      { tier: 'tier_2', projectRange: TIER_RANGES.tier_2, annualAmountPence: 2508000, monthlyAmountPence: 209000 },
      { tier: 'tier_3', projectRange: TIER_RANGES.tier_3, annualAmountPence: 3396300, monthlyAmountPence: 283000 },
    ],
  },
  {
    key: 'sna_self_serve',
    name: 'Social Network Analysis (Self-Serve)',
    description:
      'Add-on to the Self-Serve core bundle. Maps stakeholder relationships and influence networks across project communities.',
    isCoreBundle: false,
    bundleTrack: 'self_serve',
    tiers: [
      { tier: 'tier_1', projectRange: TIER_RANGES.tier_1, annualAmountPence: 137300, monthlyAmountPence: 11400 },
      { tier: 'tier_2', projectRange: TIER_RANGES.tier_2, annualAmountPence: 329500, monthlyAmountPence: 27500 },
      { tier: 'tier_3', projectRange: TIER_RANGES.tier_3, annualAmountPence: 446200, monthlyAmountPence: 37200 },
    ],
  },
  {
    key: 'sna_supported',
    name: 'Social Network Analysis (Supported)',
    description:
      'Add-on to the Supported core bundle. Includes facilitated stakeholder mapping workshops and analysis.',
    isCoreBundle: false,
    bundleTrack: 'supported',
    tiers: [
      { tier: 'tier_1', projectRange: TIER_RANGES.tier_1, annualAmountPence: 522500, monthlyAmountPence: 43500 },
      { tier: 'tier_2', projectRange: TIER_RANGES.tier_2, annualAmountPence: 1254000, monthlyAmountPence: 104500 },
      { tier: 'tier_3', projectRange: TIER_RANGES.tier_3, annualAmountPence: 1698100, monthlyAmountPence: 141500 },
    ],
  },
  {
    key: 'sroi_analysis',
    name: 'SROI Analysis',
    description:
      'One-off Social Return on Investment analysis and report. Available as an add-on to both Self-Serve and Supported bundles. Flat fee across all tiers.',
    isCoreBundle: false,
    bundleTrack: 'any',
    tiers: [
      // Flat across all tiers - a single price band covers every org regardless of project count.
      { tier: 'tier_1', projectRange: 'All tiers', annualAmountPence: 190000, monthlyAmountPence: 15800 },
    ],
  },
];
