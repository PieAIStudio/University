import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

import manifest from "../../../packages/world/src/grid/grid-assets.json" with { type: "json" };
import { APP_ROOT, resolveDonorRoot } from "./kenney-donor.mjs";
import {
  GridBakeError,
  assertBakedGlbLossless,
  bakeColormapToVertexColors,
  readGlb,
} from "./kenney-grid-bake.mjs";

const donorRoot = resolveDonorRoot(process.env.KENNEY_DONOR_ROOT);
const publicRoot = resolve(APP_ROOT, "public");

function bytes(path) {
  return readFileSync(path);
}

test("every checked-in baked grid model is lossless and texture-free", () => {
  const bakedAssets = manifest.assets.filter((asset) => asset.bake);
  assert.equal(bakedAssets.length, manifest.summary.bakedModelCount);
  for (const asset of bakedAssets) {
    const sourceBytes = bytes(join(donorRoot, asset.source));
    const colormapBytes = bytes(join(donorRoot, asset.colormap.source));
    const bakedBytes = bytes(join(publicRoot, asset.src.replace(/^\/+/, "")));
    const result = assertBakedGlbLossless({
      sourceBytes,
      bakedBytes,
      colormapBytes,
      label: asset.source,
    });
    assert.equal(result.comparedVertices, asset.losslessCheck.comparedVertices, asset.assetId);
    assert.equal(result.triangles, asset.triangles, asset.assetId);

    const { json } = readGlb(bakedBytes, asset.assetId);
    assert.equal(json.images?.length ?? 0, 0, asset.assetId);
    assert.equal(json.textures?.length ?? 0, 0, asset.assetId);
    for (const mesh of json.meshes ?? []) {
      for (const primitive of mesh.primitives ?? []) {
        assert.deepEqual(
          Object.keys(primitive.attributes ?? {}).filter((name) => name.startsWith("TEXCOORD_")),
          [],
          asset.assetId,
        );
      }
    }
  }
});

test("known cross-colour holiday model trips the importer", () => {
  const sourceBytes = bytes(join(donorRoot, manifest.tripwire.source));
  const colormapBytes = bytes(
    join(donorRoot, "kenney_holiday-kit/Models/GLB format/Textures/colormap.png"),
  );
  assert.throws(
    () =>
      bakeColormapToVertexColors({
        sourceBytes,
        colormapBytes,
        label: manifest.tripwire.source,
      }),
    (error) => {
      assert.ok(error instanceof GridBakeError);
      assert.equal(error.code, "CROSS_COLOUR_TRIANGLE");
      assert.equal(error.crossColourTriangles, manifest.tripwire.crossColourTriangles);
      return true;
    },
  );
});
