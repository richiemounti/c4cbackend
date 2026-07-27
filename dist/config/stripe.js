"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripe = void 0;
const stripe_1 = __importDefault(require("stripe"));
const env_1 = require("./env");
if (!env_1.env.STRIPE_SECRET_KEY) {
    console.warn("⚠️  STRIPE_SECRET_KEY is not set. Stripe features will fail until it is configured.");
}
exports.stripe = new stripe_1.default(env_1.env.STRIPE_SECRET_KEY || "", {
    apiVersion: "2026-06-24.dahlia",
});
//# sourceMappingURL=stripe.js.map