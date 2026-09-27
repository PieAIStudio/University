import { describe, expect, it } from "vitest";

import { METERED_GRADING_COST_POWER_UNITS } from "@pieai/university-core";

import { METERED_GRADING } from "./config.js";

describe("metered grading configuration", () => {
  it("keeps the model route, provisional prices, and wallet charge in one place", () => {
    expect(METERED_GRADING.modelAlias).toBe("google:gemini");
    expect(METERED_GRADING.openRouterModel).toBe("google/gemini-2.5-flash");
    expect(METERED_GRADING.reservationPowerUnits).toBe(METERED_GRADING_COST_POWER_UNITS);
    expect(METERED_GRADING.reservationPowerUnits).toBe("100");
    expect(METERED_GRADING.price).toEqual({
      inputUsdPerMillion: 0.3,
      outputUsdPerMillion: 2.5,
      status: "待产品确认",
    });
  });
});
