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

/**
 * Course `buildIslandGeometry` mesh triangles, measured 2026-09-06 on the
 * `terrain/{count}` fixtures. The count grows with the in-mesh soil path, not
 * with a second route draw.
 */
export const ISLAND_COURSE_TERRAIN_TRIANGLES = {
  6: 15_234,
  12: 14_805,
  24: 16_820,
  41: 16_629,
} as const;

export const ISLAND_TECHNIQUE_LOCK: Readonly<Record<string, IslandTechniqueEntry>> = {
  terrain: {
    technique:
      "One lathe-style BufferGeometry from IslandBlueprint: fifty-two course " +
      "rings, outline samples, an in-mesh soil path, a faceted cliff and a " +
      "tapered root. Vertex colour carries meadow, shore, rock and route tint; " +
      "there is no second route mesh.",
    source: "Our own geometry in island-geometry.ts buildTerrain.",
    budget:
      "course mesh triangles measured 2026-09-06 after soil clipping: " +
      "15234 / 14805 / 16820 / 16629 at 6 / 12 / 24 / 41 lessons (seed terrain/{count})",
    rejected: [
      {
        option: "Hex tiles as the course terrain draw",
        why:
          "HexField rebuilt a second height and route from a grid projection, so " +
          "markers, dressing and the ground disagreed. V5 already specified one " +
          "continuous field; reconnecting this mesh is the locked course draw.",
        on: "2026-09-06",
      },
    ],
  },
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
          "grass. The solid foliage construction stays at 624 triangles per tree (384 trunk + " +
          "240 canopy) and 60 per bush, so the visual mismatch—not raw triangles—decides this switch.",
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
      "Six registered meshes from elemental-serenity treeTrunks.glb plus 3 instanced " +
      "IcosahedronGeometry(1,1) crown lobes (80 tris each) overlapping as one rounded " +
      "mass in course view; world view keeps one selected trunk silhouette and a single " +
      "low-poly canopy, never course crown lobes.",
    source:
      "elemental-serenity treeTrunks.glb (six variants: 288/304/384/288/384/384 tris) " +
      "plus our own welded icosahedron crown volumes (detail 1, 80 tris per lobe); author " +
      "permission granted 2026-08-28.",
    budget:
      "course <= 624 tris/tree (384-tri trunk max + 3 x 80-tri lobes); world <= 396 " +
      "tris/tree (384-tri trunk + 12-tri canopy silhouette); trunk shadow pass omitted " +
      "in course to keep the measured frame budget",
    rejected: [
      {
        option: "Rounded UV-mask PlaneGeometry cards around crown",
        why:
          "Intersecting flat discs still visible in combined-v4 camera shots; solid " +
          "icosahedron lobes (3 x 80 + 384 = 624) fit within the 900-triangle ceiling.",
        on: "2026-09-06",
      },
    ],
  },
  bush: {
    technique:
      "Three flattened IcosahedronGeometry(1,0) lobes (20 tris each) in one instanced " +
      "field, slightly buried; no bushEmitter sampling and no alpha cards.",
    source:
      "Our own welded icosahedron crown volumes (detail 0, 20 tris per lobe). " +
      "bushEmitter.glb stays the dressing asset id but is not fetched for course draw.",
    budget: "course <= 60 tris/bush (3 x 20-tri lobes); world = 0 bush lobes",
    rejected: [
      {
        option: "MeshSurfaceSampler + 12 cards with UV alpha mask from bushEmitter.glb",
        why:
          "Bristly fragments in combined-v4 and unnecessary GLB fetch; 3 welded " +
          "icosahedron lobes cost 60 tris and draw in a single shared instanced mesh.",
        on: "2026-09-06",
      },
    ],
  },
  landmark: {
    technique:
      "A handful of large authored props placed at composition anchors, so the island " +
      "has a scale hierarchy instead of one uniform size of clutter.",
    source:
      "elemental-serenity bridge / camp / tent / rocks, author permission granted " +
      "2026-08-28, plus Kenney fantasy-town for towers and walls.",
    budget: `<= ${ISLAND_LANDMARK_TRIANGLE_CEILING} tris per asset; <= ${ISLAND_LANDMARK_MAX_PER_ISLAND} semantic landmark places per island (complete assemblies/outposts count once, not once per wall)`,
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
      "One pale 14-segment bevelled medallion lathe, instanced at the original lesson " +
      "footprint; upward notched unit rings in at most six shared batches. A merged " +
      "terrain-split footing closes contact. Unsafe rigid fits use bounded refitting " +
      "then a terrain-clipped shallow inlay with the same ID, engraving and pick target.",
    source: "Our own lesson-medallion.ts, medallion-grounding.ts and unit-sigil.ts.",
    budget:
      "168 tris/body + 48-50 tris/unit ring; one merged footing draw (exposure <= 0.25); " +
      "at most one merged inlay draw. Measured 6/24/41 switchback footings: 814/3292/5594 tris.",
    rejected: [
      {
        option: "Throw on a rigid marker's first oversized footing",
        why: "Two of 120 seed fixtures exceeded 0.25 (0.260/0.253), which could blank a valid course. Bounded refit/inlay preserves all targets and passed the expanded contact envelope without raising the ceiling.",
        on: "2026-09-06",
      },
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
