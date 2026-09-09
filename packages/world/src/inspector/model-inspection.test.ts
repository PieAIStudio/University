import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { islandRuntimeAssets } from "../island/island-asset-registry.js";
import { glbModelInfo } from "./triangle-count.js";
import { previewReplacementReason } from "./preview-runtime.js";
import type { InspectorModelInfo } from "./types.js";

const models = new Map<string, InspectorModelInfo>();
for (const asset of islandRuntimeAssets()) {
  const bytes = readFileSync(
    new URL(`../../../../apps/university/public${asset.src}`, import.meta.url),
  );
  const model = glbModelInfo(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
  if (model) models.set(`${asset.pack}/${asset.assetId}`, model);
}

describe("registered model inspection and safe preview", () => {
  it("reads actual source scene bounds and source primitive counts", () => {
    expect(models.size).toBe(islandRuntimeAssets().length);
    const bridge = models.get("elemental-serenity/bridge")!;
    expect(bridge.size![0]).toBeCloseTo(11.077947, 3);
    expect(bridge.size![1]).toBeCloseTo(3.585405, 3);
    expect(bridge.size![2]).toBeCloseTo(5.073553, 3);
    expect(models.get("elemental-serenity/treeTrunks")?.triangles).toBe(2032);
    expect(models.get("elemental-serenity/tent")?.primitives).toBeGreaterThan(1);
    expect(glbModelInfo(new ArrayBuffer(12))).toBeNull();
  });

  it("permits a genuinely different registered rock that fits, but never an unvalidated assembly or effect swap", () => {
    const rocks = islandRuntimeAssets().filter(
      (asset) => asset.pack === "nature-kit" && /^rock[-_]/u.test(asset.assetId),
    );
    const pair = rocks.flatMap((source) =>
      rocks
        .filter(
          (target) =>
            source.assetId !== target.assetId &&
            previewReplacementReason(
              { role: "rock", fromKeys: [`${source.pack}/${source.assetId}`], target },
              models,
            ) === null,
        )
        .map((target) => ({ source, target })),
    )[0];
    expect(
      pair,
      "the picker must offer an actual safe alternative, not only the current asset",
    ).toBeDefined();
    for (const role of ["tree", "bush", "landmark", "prop"] as const) {
      expect(
        previewReplacementReason(
          {
            role,
            fromKeys: ["elemental-serenity/camp"],
            target: { pack: "elemental-serenity", assetId: "tent" },
          },
          models,
        ),
      ).not.toBeNull();
    }
    expect(
      previewReplacementReason(
        {
          role: "rock",
          fromKeys: ["nature-kit/rock-large"],
          target: { pack: "elemental-serenity", assetId: "camp" },
        },
        models,
      ),
    ).not.toBeNull();
    if (!pair) throw new Error("No safe rock fixture");
    const key = `${pair.target.pack}/${pair.target.assetId}`;
    const changed = new Map(models);
    changed.set(key, { ...changed.get(key)!, size: [1000, 1, 1000] });
    expect(
      previewReplacementReason(
        {
          role: "rock",
          fromKeys: [`${pair.source.pack}/${pair.source.assetId}`],
          target: pair.target,
        },
        changed,
      ),
    ).not.toBeNull();
  });
});
