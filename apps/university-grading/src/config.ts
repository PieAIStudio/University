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
  reservationPowerUnits: "100",
  price: {
    inputUsdPerMillion: 0.3,
    outputUsdPerMillion: 2.5,
    status: "待产品确认",
  },
} as const;

/**
 * The free baseline currently includes tier one only, so tier-two quota is
 * explicitly zero until the entitlement and product-pricing decision lands.
 * Keeping a named placeholder prevents a future free allowance from appearing
 * as an unexplained literal in the request path.
 */
export const FREE_TIER_STRUCTURED_GRADING_QUOTA_POWER_UNITS_PER_DAY = "0";
