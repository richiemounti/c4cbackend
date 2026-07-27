// routes/organizationSubscription.routes.ts
// Mounted (mergeParams) at /api/v1/organizations/:organizationId/subscription
import { Router } from "express";
import {
    createCheckoutSession,
    createPortalSession,
    getOrganizationSubscription,
    getProjectCreationGate,
} from "../controllers/subscription.controller";
import authorize from "../middlewares/auth.middleware";
import { hasPermission, hasOrganizationAccess } from "../middlewares/role.middleware";

const organizationSubscriptionRouter = Router({ mergeParams: true });

const requireBillingAccess = hasPermission(["manage_billing", "billing_access", "manage_all"]);

organizationSubscriptionRouter.get(
    "/",
    authorize,
    requireBillingAccess,
    hasOrganizationAccess(),
    getOrganizationSubscription
);

organizationSubscriptionRouter.post(
    "/checkout-session",
    authorize,
    requireBillingAccess,
    hasOrganizationAccess(),
    createCheckoutSession
);

organizationSubscriptionRouter.post(
    "/portal-session",
    authorize,
    requireBillingAccess,
    hasOrganizationAccess(),
    createPortalSession
);

// Deliberately not behind requireBillingAccess: any org member who hits the project-creation
// paywall/upgrade prompt should be able to see why, not just billing admins.
organizationSubscriptionRouter.get(
    "/project-gate",
    authorize,
    hasOrganizationAccess(),
    getProjectCreationGate
);

export default organizationSubscriptionRouter;
