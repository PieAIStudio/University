import { METERED_GRADING_COST_POWER_UNITS } from "@pieai/university-core";

/**
 * The one product-owned home for tier-two model and wallet policy.
 *
 * The provider prices are copied as provisional reference values from
 * TuringPact's model-cost contract. They are not a University price decision;
 * the status field keeps that distinction visible until product confirms it.
 */
export const METERED_GRADING = {
  modelAlias: "google:gemini",
  openRouterModel: "google/gemini-2.5-flash",
  maxOutputTokens: 256,
  reservationPowerUnits: METERED_GRADING_COST_POWER_UNITS,
  price: {
    inputUsdPerMillion: 0.3,
    outputUsdPerMillion: 2.5,
    status: "待产品确认",
  },
} as const;

/**
 * Daily free allowance for structured tier-two grading.
 *
 * The product decision budgets a serious learner's day at four open
 * answers that need semantic help. One request is currently estimated at 100
 * internal accounting units, so 4 × 100 = 400 internal units per UTC day.
 * That is enough to complete a normal day's learning without a surprise wall,
 * while the daily hard cap keeps the free tier from becoming an unmetered API.
 * Product keeps this cap fixed at four learner-facing AI grading attempts per
 * day.
 */
export const FREE_TIER_STRUCTURED_GRADING_QUOTA_POWER_UNITS_PER_DAY = "400";
