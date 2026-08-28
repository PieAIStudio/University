/**
 * One locked technique per island element. See ADR-0008.
 *
 * This file is the machine-readable half of a decision that used to live only
 * in people's heads, which is why the same questions kept being reopened. The
 * prose half — the measurements, the rejected options and the amendment rule —
 * is `docs/adr/ADR-0008-one-locked-technique-per-island-element.md`.
 *
 * The rule it encodes: a lock is changed by amending the ADR with a measurement
 * in hand, never by editing the renderer and hoping nobody notices. The test
 * beside this file is what turns that from an intention into a gate.
 *
 * `rejected` is not documentation of failure for its own sake. Each entry is an
 * option that cost a real session to try, with the number that killed it, so
 * the next session spends its budget on how well the chosen technique is used
 * rather than on rediscovering why the other one lost.
 */

export interface IslandTechniqueRejection {
  /** The option that was tried. */
  readonly option: string;
  /** The measurement or observation that killed it. Never a bare opinion. */
  readonly why: string;
  readonly on: `${number}-${number}-${number}`;
}

export interface IslandTechniqueEntry {
  /** What draws this element, in one sentence a person can check against code. */
  readonly technique: string;
  /** Where the technique came from. Media provenance, if any, lives in the asset manifests. */
  readonly source: string;
  /** The budget this element may spend, in whatever unit the test can assert. */
  readonly budget: string;
  readonly rejected: readonly IslandTechniqueRejection[];
}

/**
 * Triangle ceilings the tests assert directly, so a rewrite cannot quietly
 * reintroduce the cost this ADR was written to remove.
 */
export const ISLAND_GRASS_BLADE_TRIANGLE_CEILING = {
  /** A curved, tapered blade: the learner is standing next to it. */
  near: 6,
  /** One triangle, all shape from the vertex shader. */
  mid: 1,
  /** The aerial band draws no grass; the terrain's own colour carries it. */
  far: 0,
} as const;

/**
 * Scattered decoration: the hundred-odd trees, bushes and rocks strewn by
 * island-dressing. Kenney's largest shipped mesh is 1,002 triangles.
 */
export const ISLAND_DECORATION_TRIANGLE_CEILING = 1200;

/**
 * Landmarks are the other half of the scale hierarchy the art reference has and
 * this island does not: a handful of large, authored things that anchor the eye
 * while everything else stays small. They are allowed to be expensive precisely
 * because there are so few, so the cap that matters is the count, not the mesh.
 */
export const ISLAND_LANDMARK_TRIANGLE_CEILING = 8000;
export const ISLAND_LANDMARK_MAX_PER_ISLAND = 6;

export const ISLAND_TECHNIQUE_LOCK: Readonly<Record<string, IslandTechniqueEntry>> = {
  grass: {
    technique:
      "One generated tapered strip. Segment count comes from the existing LOD tier: " +
      "curved near the learner, a single camera-facing triangle in the middle band, " +
      "nothing at the aerial distance. Root-to-tip lightness ramp is load-bearing.",
    source:
      "Our own geometry. Techniques adapted narrowly from elemental-serenity " +
      "(single-triangle billboard, non-linear root shadow, two-layer FBM wind) and " +
      "three-stylized (tapered strip, tip mask, shadow-depth sync). Both MIT; " +
      "neither donates media.",
    budget: "near <= 6 tris/blade, mid = 1, far = 0",
    rejected: [
      {
        option: "Shipping elemental-serenity's grass_blade.glb directly, now that media is permitted",
        why:
          "Permitted since 2026-08-28 and still not chosen: the blade is three vertices. " +
          "Generating it costs one function and no fetch, no decoder and no 1.2 KB, and " +
          "it lets the LOD tier vary the segment count, which a fixed GLB cannot.",
        on: "2026-08-28",
      },
      {
        option: "Five-leaf volumetric rosette clump",
        why:
          "45 triangles per instance against the donor's 1. At the shipped 16,000 " +
          "instances that is 720,000 of the scene's 777,008 triangles — 92.7% of the " +
          "frame — and from above the evenly spaced five leaves read as a starfish.",
        on: "2026-08-28",
      },
      {
        option: "Porting camera-facing billboard rotation onto the volumetric clump",
        why:
          "Isolated and measured: no visual change at this camera, because a rosette " +
          "already has thickness from every angle. This rejection does NOT transfer to " +
          "the single-triangle blade, where billboarding is mandatory or the blade " +
          "vanishes edge-on.",
        on: "2026-08-27",
      },
      {
        option: "Replacing the root-to-tip ramp with ground colour plus a tip lift",
        why: "Removed the only per-blade contrast; blades stopped reading as blades.",
        on: "2026-08-27",
      },
    ],
  },
  decoration: {
    technique: "Instanced Kenney GLBs placed by island-dressing against the island field.",
    source: "kenney nature-kit and fantasy-town-kit, CC0, shipped under public/kenney/r01.",
    budget: `<= ${ISLAND_DECORATION_TRIANGLE_CEILING} tris per asset`,
    rejected: [
      {
        option: "Rewriting trees before the grass, on the theory that they were the cost",
        why:
          "Measured: the whole shipped Kenney kit is 2,518 triangles across fourteen " +
          "models, against grass's 720,000. Trees were 0.3% of the frame and two rounds " +
          "were spent on them. Order the work by what the measurement says is expensive.",
        on: "2026-08-28",
      },
    ],
  },
  tree: {
    technique:
      "Trunk mesh plus billboarded leaf cards, the elemental-serenity construction. " +
      "The switch from Kenney's solid cones lands with a measured before/after at the " +
      "low camera; the grass rewrite is what pays for it.",
    source:
      "elemental-serenity treeTrunks.glb (2,032 tris across three trunks) and leaf.glb " +
      "(16 tris per card). Author permission granted 2026-08-28.",
    budget:
      "<= 900 tris per tree. At ~128 trees that is ~115,000, affordable only against " +
      "the ~640,000 the grass rewrite returns — so it does not land before the grass does.",
    rejected: [],
  },
  landmark: {
    technique:
      "A handful of large authored props placed at composition anchors, so the island " +
      "has a scale hierarchy instead of one uniform size of clutter.",
    source:
      "elemental-serenity bridge / camp / tent / rocks, author permission granted " +
      "2026-08-28, plus Kenney fantasy-town for towers and walls.",
    budget: `<= ${ISLAND_LANDMARK_TRIANGLE_CEILING} tris each, <= ${ISLAND_LANDMARK_MAX_PER_ISLAND} per island`,
    rejected: [
      {
        option: "Scattering more small props to fill the island",
        why:
          "Ran three times. Density without scale hierarchy reads as noise: at the " +
          "course camera every prop is the same handful of pixels, so more of them adds " +
          "clutter rather than structure. The art reference fixes this with a few big " +
          "things, not many small ones.",
        on: "2026-08-28",
      },
    ],
  },
  undersideWorldLod: {
    technique:
      "Silhouette, one value break and one bright pixel: a pale collar under the lip " +
      "plus an emissive bead at the root.",
    source: "Our own geometry.",
    budget: "<= 2 draws",
    rejected: [
      {
        option: "A hull plate with radial ribs and a central core",
        why:
          "569 lines that cannot be seen. On the world map an island is about 120px " +
          "across with roughly 20px of underside, and the world-design capture puts a " +
          "whole island inside 40px. Structure does not exist at 8px.",
        on: "2026-08-28",
      },
    ],
  },
  lessonNode: {
    technique:
      "A shallow disc with the unit cue engraved into its own face as a notched ring; " +
      "the arc count carries unit identity so it survives greyscale (v5 decision D).",
    source: "Our own geometry.",
    budget: "1 mesh per marker plus one shared ring geometry per sigil",
    rejected: [
      {
        option: "A coloured ring with a solid octahedron/cone/sphere standing on the disc",
        why:
          "Reads as 'a circle with an inexplicable little thing in the middle'; the art " +
          "reference the product aims at has clean pale discs with nothing on them.",
        on: "2026-08-28",
      },
    ],
  },
  environmentLight: {
    technique: "PMREM generated once from our own procedural skydome into scene.environment.",
    source: "Our own sky. No donated cubemap.",
    budget: "64² cube on desktop, 32² on mobile; regenerated only when the sky config changes",
    rejected: [],
  },
} as const;
