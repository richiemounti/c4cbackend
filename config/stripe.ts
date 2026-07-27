import Stripe from "stripe";
import { env } from "./env";

if (!env.STRIPE_SECRET_KEY) {
  console.warn("⚠️  STRIPE_SECRET_KEY is not set. Stripe features will fail until it is configured.");
}

export const stripe = new Stripe(env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2026-06-24.dahlia",
});
