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
 * R53 course `buildIslandGeometry` mesh triangles, measured 2026-09-18 on the
 * `terrain/{count}` fixtures. The count grows with the in-mesh soil path, not
 * with a second route draw.
 */
export const ISLAND_COURSE_TERRAIN_TRIANGLES = {
  6: 16_800,
  12: 16_335,
  24: 18_362,
  41: 18_153,
} as const;

import {
  REMOTE_ISLAND_BUDGET_PER_ISLAND,
  REMOTE_ISLAND_TERRAIN_TRIANGLES,
  REMOTE_PAVILION_TRIANGLES,
  REMOTE_PROPS_MAX_TRIANGLES_PER_ISLAND,
  REMOTE_PROPS_PER_ISLAND_MAX,
  REMOTE_PROPS_PER_ISLAND_MIN,
  REMOTE_TREE_TRIANGLES,
  REMOTE_TREE_MAX_PER_ISLAND,
} from "./remote-props.js";

/**
 * Remote / world catalogue projection shared geometry budgets.
 * Imported and re-exported from remote-props.ts (single source of truth).
 */
export {
  REMOTE_ISLAND_BUDGET_PER_ISLAND,
  REMOTE_ISLAND_BUDGET_PER_ISLAND as REMOTE_ISLAND_MAX_BUDGET,
  REMOTE_ISLAND_TERRAIN_TRIANGLES,
  REMOTE_PAVILION_TRIANGLES,
  REMOTE_PROPS_MAX_TRIANGLES_PER_ISLAND,
  REMOTE_PROPS_PER_ISLAND_MAX,
  REMOTE_PROPS_PER_ISLAND_MIN,
  REMOTE_TREE_TRIANGLES,
  REMOTE_TREE_MAX_PER_ISLAND,
};

export const ISLAND_TECHNIQUE_LOCK: Readonly<Record<string, IslandTechniqueEntry>> = {
  terrain: {
    technique:
      "Course view: one lathe-style BufferGeometry from IslandBlueprint: fifty-two course " +
      "rings, outline samples, an in-mesh soil path, a faceted cliff and a " +
      "tapered root. Vertex colour carries meadow, shore, rock and route tint; " +
      "there is no second route mesh. Remote catalogue / world projection: shared " +
      "bounded 1600-triangle terrain mesh per island (352 top, counted jointed cliff, 0 route clips) " +
      "batched into one merged BufferGeometry across all catalogue islands. One bounded linear " +
      "colour atlas bakes actual terrain and static miniature caster shadows; no contact mesh.",
    source:
      "Our own geometry in island-geometry.ts (buildTerrain) and remote-island-field.ts " +
      "(buildRemoteIslandBatch).",
    budget:
      "R53 retains the top/route and five root contours; closed bevel panels use actual counted " +
      "topology: sixteen unequal primary masses, clipped corners and shallow crowned faces, " +
      "with bounded splits at broad headlands/tight bays. Remote catalogue <= 1600 triangles/island; " +
      "course terrain/{6,12,24,41} fixtures: 16800 / 16335 / 18362 / 18153 triangles, " +
      "including the unchanged soil-path clipping. " +
      "the unchanged CPU gates are 30 ms/island and 500 ms for 50 distinct islands. " +
      "Historical R44 (640 triangles) CPU 3.8-14.2 ms/island is not a claim about R53; " +
      "R44 catalogue ceiling: 4 base-pass draws including terrain and all miniature scenery, not whole frame; " +
      "one RGBA atlas <= 2048 per side, 31 islands measured at 1024x512 / 2 MiB base plus mipmaps)",
    rejected: [
      {
        option: "Hex tiles as the course terrain draw",
        why:
          "HexField rebuilt a second height and route from a grid projection, so " +
          "markers, dressing and the ground disagreed. V5 already specified one " +
          "continuous field; reconnecting this mesh is the locked course draw.",
        on: "2026-09-06",
      },
      {
        option: "Dense course field or route-clipped mesh in remote catalogue view",
        why:
          "ADR-0009 requires spending budget by screen pixels. Dense field generation " +
          "costs ~150-180 ms per island; the then-current 640-triangle world tier generated in " +
          "3.8-6.3 ms/island and shares 1 merged BufferGeometry for the whole catalogue.",
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
      "placed by island-dressing against the island field in course view; natural tree/bush IDs are not drawn. " +
      "Remote catalogue projection draws zero decoration GLBs (uses low-cost procedural silhouettes only).",
    source:
      "Kenney fantasy-town-kit and the compared nature-kit rocks, CC0, shipped under " +
      "public/kenney/r01; elemental-serenity foliage is locked in the tree/bush entries; " +
      "remote props in remote-props.ts.",
    budget: `course <= ${ISLAND_DECORATION_TRIANGLE_CEILING} tris per asset; remote catalogue = 0 decoration GLBs`,
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
      "Course view: complete shared procedural fir (312 tris) and broadleaf (368 tris) " +
      "trees, one instanced field per form. Broadleaf course lobes use IcosahedronGeometry(1,1); " +
      "treeTrunks.glb is a retained provenance id, not a loaded course draw. " +
      "IslandDressing and IslandFoliage are course-only; they do not accept " +
      "a world detail. Production world catalogue uses RemotePropsField: the R44 named miniature kit " +
      "with up to 5 rounded trees per island in one merged vegetation batch, zero course GLBs. " +
      "Actual world-triangle footprint coverage and finite local searches govern placement; " +
      "props are optional on failed bounded fit, with no blanket zero-floating promise. " +
      "Planet representatives remain terrain-only.",
    source:
      "miniature-assets.ts owns both projection tiers, course-trees.tsx instances the course tier. " +
      "The retired elemental-serenity trunk source remains attributed in the asset registry; " +
      "no new model file is imported or fetched for course trees.",
    budget:
      "course actual 312/368, below 624 tris/tree previous ceiling; R44 remote kit <= 600 " +
      "tris/asset, <= 4800 opaque prop tris/island and <= 6000 including water/bank, 0 course GLBs; " +
      "4 base-pass draws including terrain, not whole frame; contact lives in the atlas, not a mesh. " +
      "Complete course trees cast shadows in the existing light pass; no separate trunk batch. " +
      "New GPU time and VRAM require separate measurements.",
    rejected: [
      {
        option: "Rounded UV-mask PlaneGeometry cards around crown",
        why:
          "Intersecting flat discs still visible in combined-v4 camera shots; solid " +
          "icosahedron lobes (3 x 80 + 384 = 624) fit within the 900-triangle ceiling.",
        on: "2026-09-06",
      },
      {
        option: "Loading treeTrunks.glb in remote catalogue projection",
        why:
          "Fetching and parsing treeTrunks.glb (2,032 triangles source) for distant 40px " +
          "islands violates ADR-0009 pixel budget and causes network/parsing bottleneck; " +
          "12-triangle procedural cone trees achieve legible silhouette at 0 GLB fetch cost.",
        on: "2026-09-06",
      },
      {
        option:
          "IslandDressing(detail=world) donor trunk silhouette plus a 12-triangle cone canopy",
        why:
          "That path was a second renderer and a second 396-triangle budget beside RemotePropsField. " +
          "Production world and planet draws are RemoteIslandField plus RemotePropsField only; " +
          "IslandDressing and IslandFoliage are course-only as of 2026-09-07.",
        on: "2026-09-07",
      },
    ],
  },
  bush: {
    technique:
      "Three flattened IcosahedronGeometry(1,0) lobes (20 tris each) in one instanced " +
      "field, slightly buried; no bushEmitter sampling and no alpha cards. Remote " +
      "catalogue projection draws 0 bush lobes (bush is omitted in remote view).",
    source:
      "Our own welded icosahedron crown volumes (detail 1, 80 tris per lobe). " +
      "bushEmitter.glb stays the dressing asset id but is not fetched for course draw.",
    budget:
      "course <= 240 tris/bush (3 x 80-tri lobes); world = 0 bush lobes; remote catalogue = 0 bush lobes",
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
      "Course view: a handful of large authored props placed at composition anchors, so the " +
      "island has a scale hierarchy instead of one uniform size of clutter. R46 reserves up to " +
      "four decorative rock/ruin volumes and an optional supported coastal spring before vegetation; " +
      "rock, garden flora and water occupy at most three course batches; the supported cliff garden " +
      "adds at most one merged course draw and 288 triangles. Remote catalogue " +
      "projection (RemotePropsField): up to 1 recipe-matched miniature focal assembly plus natural " +
      "companions, combined into one opaque scenery batch with zero course GLBs. Footprints use " +
      "actual world terrain triangles; props are optional on failed bounded fit, with " +
      "no blanket zero-floating promise. Planet representatives carry no landmark props.",
    source:
      "Course: elemental-serenity bridge / camp / tent / rocks, author permission granted " +
      "2026-08-28, plus Kenney fantasy-town for towers and walls. Remote catalogue: our own " +
      "procedural miniature-assets.ts kit and miniature-layout.ts placement plan.",
    budget:
      `course <= ${ISLAND_LANDMARK_TRIANGLE_CEILING} tris per asset, <= ${ISLAND_LANDMARK_MAX_PER_ISLAND} semantic landmark places per island (complete assemblies/outposts count once, not once per wall); ` +
      "R44 remote <= 600 tris per miniature asset; bounded omission, 0 course GLBs; shared 6000-triangle scenery ceiling includes water and bank. Contact is baked into the ground atlas. " +
      "R53 course landscape <= 50000 tris / 220 low flora groups; each rock cluster 196 CC0 donor-derived " +
      "triangles (formerly 572), ruin 348, one spring including banks <= 800. " +
      "Cliff garden <= 12 supported plants / 288 triangles / one additional merged draw. " +
      "At most four added base-pass meshes with water, not full-frame cost.",
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
      {
        option:
          "Loading course landmark GLBs (bridge/camp/tent/rocks) for remote catalogue islands",
        why:
          "Course landmark GLBs reach up to 1,120-3,600 triangles and require multi-mesh " +
          "materials. At world/planet distance (island span ~40-120px) structure is not " +
          "resolvable; 36-triangle stone pavilion silhouette anchors hero identity at zero GLB cost.",
        on: "2026-09-06",
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
  learningNode: {
    technique:
      "Three procedural low-poly objects told apart by silhouette — a red torii gate " +
      "spanning the road at a segment's end (checkpoint), a pennant on a pole (challenge), " +
      "a notice board with one pinned note (personal) — plus stepping stones from the road. " +
      "Only the learner's nearby segment draws; the DOM chip above each stays the pick " +
      "target and the accessible name. Placed by courseLearningSites, which searches for " +
      "free ground and never moves an existing tree, rock, landmark courtyard or path.",
    source:
      "Our own course/learning-sites.ts, learning-node-geometry.ts and LearningNodeField.tsx.",
    budget:
      "<= 48/36/60 tris for gate/pennant/board and 18 per stepping stone; at most 3 objects " +
      "and one merged stone draw at a time. Measured on three real course shapes: 46 of 51 " +
      "nodes find free ground; the rest keep their chip and draw nothing.",
    rejected: [
      {
        option: "A token standing on a disc, the lesson medallion with a symbol on top",
        why: "Already rejected for lesson nodes on 2026-08-28 as 'a circle with an inexplicable little thing in the middle'.",
        on: "2026-09-23",
      },
      {
        option: "The gate beside the road, facing the camera",
        why: "Road verges are deliberately planted; with courtyards reserved only 6 of 11 gates found ground. Spanning the road needs only two free post spots: 10 of 11.",
        on: "2026-09-23",
      },
      {
        option: "Every object facing the road",
        why: "The course camera pans but never turns, so a pennant or board facing the road was often seen edge-on as a line. The pennant and board now face the camera heading; posts sink deeper than the steepest accepted slope so a turn cannot lift a foot.",
        on: "2026-09-23",
      },
      {
        option: "Brown gate posts under a red lintel",
        why: "The posts vanished against the brown road and the Π read as one red stub; the whole gate now uses the accent ramp.",
        on: "2026-09-23",
      },
    ],
  },
  environmentLight: {
    technique: "PMREM generated once from our own procedural skydome into scene.environment.",
    source: "Our own sky. No donated cubemap.",
    budget: "64² cube on desktop, 32² on mobile; regenerated only when the sky config changes",
    rejected: [],
  },
  domainPlanet: {
    technique:
      "One SphereGeometry(1, 64, 32) domain globe under the 5000-triangle surface ceiling, " +
      "shared sampled land/ocean texture with named linear surface palettes, up to 7 clusters of merged shallow cloud banks " +
      "(radial flatten 0.55; protected region directions remain clear; no independent cloud drift), " +
      "under the 7000-triangle cloud ceiling, and representative course islands from the remote " +
      "bounded 1600-triangle terrain (desktop at most 5 / mobile at most 3 per study). Design ceiling 8 scene " +
      "draws per populated domain, counting atmosphere and submitted hit geometry. " +
      "prepareDomain in a module worker reuses those same generators; it has no early self-proof " +
      "of cold-load duration. GPU time and VRAM are unknown.",
    source:
      "planet/globe-geometry.ts (DOMAIN_GLOBE_TRIANGLES_MAX, DOMAIN_CLOUD_TRIANGLES_MAX), " +
      "planet/atmospheric-regions.ts (planetRepresentativeLimit), planet/domain-preparation.ts.",
    budget:
      "surface <= 5000 tris; cloud <= 7000 tris; 8 draws/domain design ceiling; " +
      "representatives 5 desktop / 3 mobile; GPU time and VRAM unmeasured",
    rejected: [
      {
        option: "Giant planar study islands or vertex-only globe colour as the domain container",
        why:
          "V5 M rejected the first; browser view exposed blurred land/ocean boundaries in the " +
          "second. Shared sampled texture plus the then-current 640-triangle representatives were the " +
          "candidate, not a competing course field.",
        on: "2026-09-07",
      },
    ],
  },
} as const;
