// routes/subscription.routes.ts
// Mounted at /api/v1/subscriptions. Org-scoped billing actions (checkout, portal, status)
// live under /api/v1/organizations/:organizationId/subscription instead - see
// routes/organizationSubscription.routes.ts. This router holds the two things that aren't
// org-scoped: the public pricing catalogue, and the Stripe webhook (unauthenticated -
// Stripe can't send a JWT - verified by signature instead).
import { Router } from "express";
import { getCatalogue, handleStripeWebhook } from "../controllers/subscription.controller";

const subscriptionRouter = Router();

subscriptionRouter.get("/catalogue", getCatalogue);
subscriptionRouter.post("/webhook", handleStripeWebhook);

export default subscriptionRouter;
