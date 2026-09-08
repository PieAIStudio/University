import { describe, expect, it } from "vitest";
import { mapDomainForStudy } from "./map-domain-catalog.js";

describe("map domain catalogue", () => {
  it("groups the existing programming series into one domain", () => {
    const domains = ["general", "buzz", "supaluv", "turing-pact"].map(mapDomainForStudy);
    expect(new Set(domains.map((domain) => domain.id))).toEqual(new Set(["programming"]));
  });

  it("keeps unknown studies visible without guessing from their names", () => {
    for (const id of ["aigc-video", "programming-basics", "toString", "__proto__", ""]) {
      expect(mapDomainForStudy(id)).toEqual({ id: "unclassified", title: "未分类" });
    }
  });
});
