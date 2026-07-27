// services/subscriptionGating.service.ts
//
// Maps an organization's active project count onto the pricing matrix's tier bands and
// decides whether creating another project is allowed.
//
// Rules (per product decision):
//  - An org needs an active (or manually-managed) subscription before creating its first
//    project - there is no free/trial usage.
//  - Creating a project that pushes the org into a higher band than they're currently paying
//    for is still ALLOWED (soft gate) - the caller surfaces `upgradeRequired` as a prompt
//    rather than blocking the request.
import Project from "../models/project.model";
import Subscription from "../models/subscription.model";
import { CustomError } from "../middlewares/error.middleware";
import type { TierKey } from "../constants/stripeCatalogue.constants";

export type ProjectCountBand = TierKey | "enterprise";

const ENTITLED_STATUSES = ["active", "trialing"];

const BAND_ORDER: Record<ProjectCountBand, number> = {
    tier_1: 1,
    tier_2: 2,
    tier_3: 3,
    enterprise: 4,
};

/** 1 project -> tier_1, 2-3 -> tier_2, 4-5 -> tier_3, 6+ -> enterprise (negotiated, no Stripe Price). */
export function getProjectCountBand(projectCount: number): ProjectCountBand | null {
    if (projectCount <= 0) return null;
    if (projectCount === 1) return "tier_1";
    if (projectCount <= 3) return "tier_2";
    if (projectCount <= 5) return "tier_3";
    return "enterprise";
}

export async function countOrganizationProjects(organizationId: string): Promise<number> {
    return Project.countDocuments({ organization: organizationId, archived: { $ne: true } });
}

export interface ProjectCreationGate {
    isEntitled: boolean;
    manuallyManaged: boolean;
    currentProjectCount: number;
    projectCountAfterCreate: number;
    currentTier: TierKey | null;
    requiredBand: ProjectCountBand | null;
    upgradeRequired: boolean;
    requiresSalesContact: boolean;
}

/**
 * Read-only evaluation - never throws. Used both by the enforcing check below and by a
 * status endpoint so the frontend can show "you're on Tier 2, this will need Tier 3"
 * before the user attempts creation.
 */
export async function evaluateProjectCreationGate(organizationId: string): Promise<ProjectCreationGate> {
    const subscription = await Subscription.findOne({ organization: organizationId });
    const manuallyManaged = !!subscription?.manuallyManaged;
    const currentTier = (subscription?.currentTier as TierKey | undefined) ?? null;
    const currentProjectCount = await countOrganizationProjects(organizationId);
    const projectCountAfterCreate = currentProjectCount + 1;

    if (manuallyManaged) {
        return {
            isEntitled: true,
            manuallyManaged: true,
            currentProjectCount,
            projectCountAfterCreate,
            currentTier,
            requiredBand: null,
            upgradeRequired: false,
            requiresSalesContact: false,
        };
    }

    const isEntitled = !!subscription && ENTITLED_STATUSES.includes(subscription.status);
    const requiredBand = getProjectCountBand(projectCountAfterCreate);
    const upgradeRequired = !!requiredBand && (!currentTier || BAND_ORDER[requiredBand] > BAND_ORDER[currentTier]);

    return {
        isEntitled,
        manuallyManaged: false,
        currentProjectCount,
        projectCountAfterCreate,
        currentTier,
        requiredBand,
        upgradeRequired,
        requiresSalesContact: upgradeRequired && requiredBand === "enterprise",
    };
}

/**
 * Enforces the hard paywall (no active subscription -> no project #1). Does NOT block on
 * `upgradeRequired` - that's the soft gate, left for the caller to surface as a prompt.
 */
export async function assertOrganizationCanCreateProject(
    organizationId: string,
    options: { bypassPaywall?: boolean } = {}
): Promise<ProjectCreationGate> {
    const gate = await evaluateProjectCreationGate(organizationId);

    if (!gate.isEntitled && !options.bypassPaywall) {
        const error = new Error("An active subscription is required before creating a project.") as CustomError;
        error.statusCode = 402;
        throw error;
    }

    return gate;
}
