import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import manifest from "../island/kenney-r01-assets.json";
import { TOY_DONORS, toyAsset } from "./assets.js";

const root = new URL("../../../../apps/university/public/", import.meta.url);
describe("toy asset reuse", () => {
  it("uses four exact licensed assets, not fallback aliases or a host donor path", () => {
    expect(TOY_DONORS).toHaveLength(4);
    let totalBytes = 0;
    const dependencies = new Set<string>();
    for (const id of TOY_DONORS) {
      const asset = toyAsset(id);
      const bytes = readFileSync(fileURLToPath(new URL(asset.src.slice(1), root)));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(asset.sha256);
      expect(asset.license.spdx).toBe("CC0-1.0");
      expect(asset.license.commercialUse).toBe(true);
      expect(asset.src).not.toMatch(/\/Users\/|_donors|https?:/);
      totalBytes += bytes.byteLength;
      asset.dependencies.forEach((path) => dependencies.add(path));
    }
    for (const path of dependencies) {
      const bytes = readFileSync(fileURLToPath(new URL(path.slice(1), root)));
      const record = manifest.dependencies.find((entry) => entry.src === path)!;
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(record.sha256);
      totalBytes += bytes.byteLength;
    }
    // Budget for this subset only; no new downloads are required by the toys.
    expect(totalBytes).toBeLessThan(250_000);
  });
});
