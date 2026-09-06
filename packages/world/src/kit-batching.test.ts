import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { bakeBatchedColourBuffer } from "./kit.js";

const here = dirname(fileURLToPath(import.meta.url));

describe("batched colour bake", () => {
  it("multiplies material factor with vertex colours when both are present", () => {
    const source = new THREE.BufferAttribute(new Float32Array([0.5, 0.25, 0.2, 1, 0.5, 0.1]), 3);
    const factor = new THREE.Color(0.4, 0.5, 0.8);
    const baked = bakeBatchedColourBuffer(2, source, factor, true);
    expect(baked[0]).toBeCloseTo(0.5 * 0.4);
    expect(baked[1]).toBeCloseTo(0.25 * 0.5);
    expect(baked[2]).toBeCloseTo(0.2 * 0.8);
    expect(baked[3]).toBeCloseTo(1 * 0.4);
    expect(baked[4]).toBeCloseTo(0.5 * 0.5);
    expect(baked[5]).toBeCloseTo(0.1 * 0.8);
  });

  it("fills from the factor when there is no COLOR_0", () => {
    const factor = new THREE.Color(0.12, 0.34, 0.56);
    const baked = bakeBatchedColourBuffer(1, undefined, factor, true);
    expect(baked[0]).toBeCloseTo(factor.r);
    expect(baked[1]).toBeCloseTo(factor.g);
    expect(baked[2]).toBeCloseTo(factor.b);
  });

  it("copies vertex colours without the family factor, matching the hex grid path", () => {
    const source = new THREE.BufferAttribute(new Float32Array([0.2, 0.3, 0.4]), 3);
    const factor = new THREE.Color(0.5, 0.5, 0.5);
    const baked = bakeBatchedColourBuffer(1, source, factor, false);
    expect(baked[0]).toBeCloseTo(0.2);
    expect(baked[1]).toBeCloseTo(0.3);
    expect(baked[2]).toBeCloseTo(0.4);
  });
});

describe("kit batching source", () => {
  it("does not depend on private SCRATCH paths", () => {
    const source = readFileSync(resolve(here, "kit.tsx"), "utf8");
    expect(source).not.toMatch(/SCRATCH\//);
    expect(source).toMatch("layoutKey");
    expect(source).toMatch(
      /\[castShadow, colorSource, layoutKey, name, partsBySource, roughness\]/,
    );
  });
});
