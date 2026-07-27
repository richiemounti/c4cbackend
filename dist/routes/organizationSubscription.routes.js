"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// routes/organizationSubscription.routes.ts
// Mounted (mergeParams) at /api/v1/organizations/:organizationId/subscription
const express_1 = require("express");
const subscription_controller_1 = require("../controllers/subscription.controller");
const auth_middleware_1 = __importDefault(require("../middlewares/auth.middleware"));
const role_middleware_1 = require("../middlewares/role.middleware");
const organizationSubscriptionRouter = (0, express_1.Router)({ mergeParams: true });
const requireBillingAccess = (0, role_middleware_1.hasPermission)(["manage_billing", "billing_access", "manage_all"]);
organizationSubscriptionRouter.get("/", auth_middleware_1.default, requireBillingAccess, (0, role_middleware_1.hasOrganizationAccess)(), subscription_controller_1.getOrganizationSubscription);
organizationSubscriptionRouter.post("/checkout-session", auth_middleware_1.default, requireBillingAccess, (0, role_middleware_1.hasOrganizationAccess)(), subscription_controller_1.createCheckoutSession);
organizationSubscriptionRouter.post("/portal-session", auth_middleware_1.default, requireBillingAccess, (0, role_middleware_1.hasOrganizationAccess)(), subscription_controller_1.createPortalSession);
// Deliberately not behind requireBillingAccess: any org member who hits the project-creation
// paywall/upgrade prompt should be able to see why, not just billing admins.
organizationSubscriptionRouter.get("/project-gate", auth_middleware_1.default, (0, role_middleware_1.hasOrganizationAccess)(), subscription_controller_1.getProjectCreationGate);
exports.default = organizationSubscriptionRouter;
//# sourceMappingURL=organizationSubscription.routes.js.map