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
