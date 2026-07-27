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
exports.getProjectCountBand = getProjectCountBand;
exports.countOrganizationProjects = countOrganizationProjects;
exports.evaluateProjectCreationGate = evaluateProjectCreationGate;
exports.assertOrganizationCanCreateProject = assertOrganizationCanCreateProject;
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
const project_model_1 = __importDefault(require("../models/project.model"));
const subscription_model_1 = __importDefault(require("../models/subscription.model"));
const ENTITLED_STATUSES = ["active", "trialing"];
const BAND_ORDER = {
    tier_1: 1,
    tier_2: 2,
    tier_3: 3,
    enterprise: 4,
};
/** 1 project -> tier_1, 2-3 -> tier_2, 4-5 -> tier_3, 6+ -> enterprise (negotiated, no Stripe Price). */
function getProjectCountBand(projectCount) {
    if (projectCount <= 0)
        return null;
    if (projectCount === 1)
        return "tier_1";
    if (projectCount <= 3)
        return "tier_2";
    if (projectCount <= 5)
        return "tier_3";
    return "enterprise";
}
function countOrganizationProjects(organizationId) {
    return __awaiter(this, void 0, void 0, function* () {
        return project_model_1.default.countDocuments({ organization: organizationId, archived: { $ne: true } });
    });
}
/**
 * Read-only evaluation - never throws. Used both by the enforcing check below and by a
 * status endpoint so the frontend can show "you're on Tier 2, this will need Tier 3"
 * before the user attempts creation.
 */
function evaluateProjectCreationGate(organizationId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const subscription = yield subscription_model_1.default.findOne({ organization: organizationId });
        const manuallyManaged = !!(subscription === null || subscription === void 0 ? void 0 : subscription.manuallyManaged);
        const currentTier = (_a = subscription === null || subscription === void 0 ? void 0 : subscription.currentTier) !== null && _a !== void 0 ? _a : null;
        const currentProjectCount = yield countOrganizationProjects(organizationId);
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
    });
}
/**
 * Enforces the hard paywall (no active subscription -> no project #1). Does NOT block on
 * `upgradeRequired` - that's the soft gate, left for the caller to surface as a prompt.
 */
function assertOrganizationCanCreateProject(organizationId_1) {
    return __awaiter(this, arguments, void 0, function* (organizationId, options = {}) {
        const gate = yield evaluateProjectCreationGate(organizationId);
        if (!gate.isEntitled && !options.bypassPaywall) {
            const error = new Error("An active subscription is required before creating a project.");
            error.statusCode = 402;
            throw error;
        }
        return gate;
    });
}
//# sourceMappingURL=subscriptionGating.service.js.map