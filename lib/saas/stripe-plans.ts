import { normalizePlanId, PLAN_LIMITS, type TooliaPlanId } from "./plan-config";

export type StripePlanConfig = {
  id: TooliaPlanId;
  name: string;
  monthlyPriceEur: number;
  setupPriceEur: number;
  monthlyPriceEnvKey: string;
  setupPriceEnvKey: string;
  monthlyPriceId: string;
  setupPriceId: string;
};

const STRIPE_PRICE_ENV_KEYS: Record<
  TooliaPlanId,
  Pick<StripePlanConfig, "monthlyPriceEnvKey" | "setupPriceEnvKey">
> = {
  starter: {
    monthlyPriceEnvKey: "STRIPE_STARTER_MONTHLY_PRICE_ID",
    setupPriceEnvKey: "STRIPE_STARTER_SETUP_PRICE_ID",
  },
  pro: {
    monthlyPriceEnvKey: "STRIPE_PRO_MONTHLY_PRICE_ID",
    setupPriceEnvKey: "STRIPE_PRO_SETUP_PRICE_ID",
  },
  premium: {
    monthlyPriceEnvKey: "STRIPE_PREMIUM_MONTHLY_PRICE_ID",
    setupPriceEnvKey: "STRIPE_PREMIUM_SETUP_PRICE_ID",
  },
};

function readEnv(name: string) {
  return (process.env[name] || "").trim();
}

export function getStripePlanConfig(plan: string): StripePlanConfig {
  const id = normalizePlanId(plan);
  const limits = PLAN_LIMITS[id];
  const envKeys = STRIPE_PRICE_ENV_KEYS[id];

  return {
    id,
    name: limits.name,
    monthlyPriceEur: limits.monthlyPrice,
    setupPriceEur: limits.setupPrice,
    monthlyPriceEnvKey: envKeys.monthlyPriceEnvKey,
    setupPriceEnvKey: envKeys.setupPriceEnvKey,
    monthlyPriceId: readEnv(envKeys.monthlyPriceEnvKey),
    setupPriceId: readEnv(envKeys.setupPriceEnvKey),
  };
}

export function getMissingStripePriceEnvKeys(plan: string) {
  const config = getStripePlanConfig(plan);
  const missing: string[] = [];

  if (!config.monthlyPriceId) missing.push(config.monthlyPriceEnvKey);
  if (!config.setupPriceId) missing.push(config.setupPriceEnvKey);

  return missing;
}

export function hasStripePriceConfig(plan: string) {
  return getMissingStripePriceEnvKeys(plan).length === 0;
}

export function getStripeSecretKey() {
  return readEnv("STRIPE_SECRET_KEY");
}

export function getStripeWebhookSecret() {
  return readEnv("STRIPE_WEBHOOK_SECRET");
}

export function getStripePublishableKey() {
  return readEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
}

export function formatMissingStripeEnvMessage(missing: string[]) {
  if (missing.length === 0) return "";

  const separator = missing.length === 2 ? " ou " : ", ";
  const list = missing.join(separator);
  return `Configuration Stripe incomplète : ${list} manquant.`;
}

export function getPublicAppUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function getPlanFromStripePriceId(priceId: string | null | undefined) {
  if (!priceId) return null;

  for (const planId of Object.keys(STRIPE_PRICE_ENV_KEYS) as TooliaPlanId[]) {
    const config = getStripePlanConfig(planId);
    if (config.monthlyPriceId === priceId || config.setupPriceId === priceId) {
      return planId;
    }
  }

  return null;
}
