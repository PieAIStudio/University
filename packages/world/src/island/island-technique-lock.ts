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

/** The explicit tree ceiling written into the tree lock below. */
export const ISLAND_TREE_TRIANGLE_CEILING = 900;

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
      "One generated three-vertex card, shipped 2026-08-28. Taper, wind bend, " +
      "camera-facing Y rotation and terrain-normal replacement all happen in the " +
      "vertex shader, so a single instance is one triangle. LOD varies instance " +
      "count, not segment count. Root-to-tip lightness ramp is load-bearing.",
    source:
      "Our own geometry. Techniques adapted narrowly from elemental-serenity " +
      "(single-triangle billboard, non-linear root shadow, two-layer FBM wind) and " +
      "three-stylized (tapered strip, tip mask, shadow-depth sync). Both MIT; " +
      "neither donates media.",
    budget: "1 tri/blade at every band; near <= 6 stays the ceiling, not the shape",
    rejected: [
      {
        option:
          "Shipping elemental-serenity's grass_blade.glb directly, now that media is permitted",
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
    technique:
      "Instanced Kenney GLBs for fantasy-town architecture and the retained rock choice, " +
      "placed by island-dressing against the island field; natural tree/bush IDs are not drawn.",
    source:
      "Kenney fantasy-town-kit and the compared nature-kit rocks, CC0, shipped under " +
      "public/kenney/r01; elemental-serenity foliage is locked in the tree/bush entries.",
    budget: `<= ${ISLAND_DECORATION_TRIANGLE_CEILING} tris per asset`,
    rejected: [
      {
        option: "Keeping Kenney's block trees and plant_bushDetailed as natural vegetation",
        why:
          "The 114/402/246-triangle cones and 104-triangle bush are cheaper, but their " +
          "hard stacked geometry visibly conflicts with the already painterly terrain and " +
          "grass. The donor construction stays below 408 triangles per tree and 24 per " +
          "bush, so the visual mismatch—not raw triangles—decides this switch.",
        on: "2026-08-29",
      },
      {
        option: "Replacing the retained Kenney rocks with elemental-serenity rocks.glb",
        why:
          "Same 1440x900 course shot: donor rocks raised the frame from 340,880 to " +
          "556,944 triangles (+63.4%) and the repeated pale assembled clusters read as " +
          "noise beside the painterly foliage; Kenney stayed quieter at 80/16 triangles.",
        on: "2026-08-29",
      },
    ],
  },
  tree: {
    technique:
      "One selected mesh from elemental-serenity treeTrunks.glb plus 12 instanced " +
      "procedural PlaneGeometry leaf cards around its crown in course view; world view " +
      "keeps the trunk silhouette and a single low-poly canopy, never leaf instances.",
    source:
      "elemental-serenity treeTrunks.glb (six variants: 288/304/384/288/384/384 tris) " +
      "plus the donor BushManager PlaneGeometry(1,1) card (2 tris per card); author " +
      "permission granted 2026-08-28.",
    budget:
      "course <= 408 tris/tree (384-tri trunk max + 12 x 2-tri cards); world <= 396 " +
      "tris/tree (384-tri trunk + 12-tri canopy silhouette); trunk shadow pass omitted " +
      "in course to keep the measured frame budget",
    rejected: [],
  },
  bush: {
    technique:
      "MeshSurfaceSampler points from bushEmitter.glb become 12 oriented PlaneGeometry " +
      "leaf cards with a procedural UV alpha mask; shadow/mid/highlight colours are a " +
      "normal ramp and customDepthMaterial repeats the mask for correct shadows.",
    source:
      "elemental-serenity BushManager.class.js and bush vertex/fragment GLSL, using " +
      "bushEmitter.glb (192-tri emitter only) and the shared 2-triangle leaf-card technique; " +
      "author permission granted 2026-08-28.",
    budget: "course <= 24 tris/bush (12 x 2-tri cards); world = 0 leaf cards",
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
      "A small carved stone in one of four deterministic procedural variants, with the " +
      "unit cue engraved into its top face as a notched ring; the arc count carries unit " +
      "identity so it survives greyscale (v5 decision D).",
    source: "Our own geometry.",
    budget: "1 body mesh per marker from 4 shared geometries, plus one shared ring geometry per sigil",
    rejected: [
      {
        option: "A coloured ring with a solid octahedron/cone/sphere standing on the disc",
        why:
          "Reads as 'a circle with an inexplicable little thing in the middle'; the art " +
          "reference the product aims at has clean pale discs with nothing on them.",
        on: "2026-08-28",
      },
      {
        option: "Keeping the shallow disc after the camera was tightened",
        why:
          "The disc was chosen for a near-global view where a marker was a few pixels. " +
          "Once COURSE_DISTANCE fell from 36 to 23 a marker became a few dozen pixels " +
          "and the same shape read as a coin lying on the grass. The owner set the pale " +
          "disc reference above and revised it on this date; this is a changed decision, " +
          "not a rediscovery of the one above it.",
        on: "2026-08-30",
      },
      {
        option: "A textured model generated by an external service",
        why:
          "At a few dozen pixels silhouette carries recognition and texture does not, and " +
          "a GLB adds a download plus an asset-pipeline dependency to a map that is " +
          "otherwise one procedural pipeline. Priced against the procedural variants " +
          "before being declined.",
        on: "2026-08-30",
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
