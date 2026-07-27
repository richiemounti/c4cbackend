"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// routes/subscription.routes.ts
// Mounted at /api/v1/subscriptions. Org-scoped billing actions (checkout, portal, status)
// live under /api/v1/organizations/:organizationId/subscription instead - see
// routes/organizationSubscription.routes.ts. This router holds the two things that aren't
// org-scoped: the public pricing catalogue, and the Stripe webhook (unauthenticated -
// Stripe can't send a JWT - verified by signature instead).
const express_1 = require("express");
const subscription_controller_1 = require("../controllers/subscription.controller");
const subscriptionRouter = (0, express_1.Router)();
subscriptionRouter.get("/catalogue", subscription_controller_1.getCatalogue);
subscriptionRouter.post("/webhook", subscription_controller_1.handleStripeWebhook);
exports.default = subscriptionRouter;
//# sourceMappingURL=subscription.routes.js.map