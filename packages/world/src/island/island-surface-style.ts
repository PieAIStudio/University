/**
 * Development-only surface looks for the island.
 *
 * The island blueprint and its geometry are the product contract. These looks
 * are deliberately a material adapter instead of another renderer: a debug
 * session can compare a few art-direction hypotheses without changing the
 * route, the dressing plan, or the SwimmerRenderKit grade pass.
 */
import * as THREE from "three";

export const ISLAND_SURFACE_STYLE_IDS = ["diorama", "elemental", "mossy", "desert"] as const;
export type IslandSurfaceStyleId = (typeof ISLAND_SURFACE_STYLE_IDS)[number];
export type IslandSurfaceRole = "terrain";

export const DEFAULT_ISLAND_SURFACE_STYLE: IslandSurfaceStyleId = "diorama";
export const ISLAND_SURFACE_SHADER_VARIANT = "island-surface-uniforms-1";

export interface IslandSurfaceStylePreset {
  readonly id: IslandSurfaceStyleId;
  /** Stable numeric label exposed as a uniform for GPU/debug inspection. */
  readonly variant: number;
  /** Small grass-role colour bias; the existing vertex colour stays the base. */
  readonly tint: readonly [number, number, number];
  readonly saturation: number;
  readonly contrast: number;
  readonly brightness: number;
  /** Amount of the world-space macro role mask. */
  readonly macroAmount: number;
  /** A deliberately tiny animated edge modulation; non-zero only for elemental. */
  readonly shimmer: number;
  /** Blend amount for the one terrain surface; route soil remains vertex colour. */
  readonly strength: Readonly<Record<IslandSurfaceRole, number>>;
}

/**
 * Presets are compact and intentionally operate on the material's existing
 * colours. `diorama` keeps the original meadow direction but enables a very
 * small amount of the role mask so the production surface is not a flat card;
 * the other entries are stronger visual hypotheses, not a new palette
 * pipeline.
 */
export const ISLAND_SURFACE_STYLE_PRESETS: Readonly<
  Record<IslandSurfaceStyleId, IslandSurfaceStylePreset>
> = {
  diorama: {
    id: "diorama",
    variant: 0,
    tint: [0.96, 1.02, 0.9],
    saturation: 1.02,
    contrast: 1.035,
    brightness: 0,
    macroAmount: 0.22,
    shimmer: 0,
    strength: { terrain: 0.22 },
  },
  elemental: {
    id: "elemental",
    variant: 1,
    // Keep the donor's fresh green direction without washing the terrain into
    // a mint overlay; role layers below supply the value separation.
    tint: [0.24, 0.52, 0.32],
    saturation: 1.05,
    contrast: 1.08,
    brightness: 0,
    macroAmount: 0.34,
    shimmer: 0.003,
    strength: { terrain: 0.62 },
  },
  mossy: {
    id: "mossy",
    variant: 2,
    tint: [0.18, 0.42, 0.12],
    saturation: 1.05,
    contrast: 1.05,
    brightness: -0.012,
    macroAmount: 0.55,
    shimmer: 0,
    strength: { terrain: 0.82 },
  },
  desert: {
    id: "desert",
    variant: 3,
    tint: [0.78, 0.48, 0.18],
    saturation: 0.92,
    contrast: 1.05,
    brightness: 0.01,
    macroAmount: 0.72,
    shimmer: 0,
    strength: { terrain: 0.92 },
  },
};

const SURFACE_STYLE_UNIFORM_MARKER = "/* university island surface style v1 */";
const SURFACE_STYLE_COLOR_INCLUDE = "#include <color_fragment>";
const SURFACE_STYLE_VERTEX_INCLUDE = "#include <project_vertex>";
const SURFACE_STYLE_COMMON_INCLUDE = "#include <common>";

const SURFACE_STYLE_FRAGMENT_DECLARATIONS = `${SURFACE_STYLE_UNIFORM_MARKER}
uniform vec3 uIslandStyleTint;
uniform float uIslandStyleSaturation;
uniform float uIslandStyleContrast;
uniform float uIslandStyleBrightness;
uniform float uIslandStyleStrength;
uniform float uIslandStyleVariant;
uniform float uIslandStyleMacroAmount;
uniform float uIslandStyleShimmer;
uniform float uIslandStyleTime;
varying vec3 vIslandStyleWorldPosition;
varying float vIslandStyleHeight;
varying float vIslandStyleSlope;

float universityIslandStyleHash(vec2 point) {
  return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
}

float universityIslandStyleNoise(vec2 point) {
  vec2 cell = floor(point);
  vec2 fraction = fract(point);
  fraction = fraction * fraction * (3.0 - 2.0 * fraction);
  float lower = mix(
    universityIslandStyleHash(cell),
    universityIslandStyleHash(cell + vec2(1.0, 0.0)),
    fraction.x
  );
  float upper = mix(
    universityIslandStyleHash(cell + vec2(0.0, 1.0)),
    universityIslandStyleHash(cell + vec2(1.0, 1.0)),
    fraction.x
  );
  return mix(lower, upper, fraction.y);
}`;

/**
 * This patch runs after Three's `color_fragment` on the one terrain material.
 * The existing vertex colour remains the base (including route soil); the
 * procedural roles only make small, value-focused adjustments. It does not
 * tone-map or encode; Stage's SwimmerRenderKit grade remains the sole owner of
 * those operations.
 */
const SURFACE_STYLE_FRAGMENT_PATCH = `vec3 islandStyleColour = diffuseColor.rgb;
float islandStyleLuma = dot(islandStyleColour, vec3(0.299, 0.587, 0.114));
islandStyleColour = mix(vec3(islandStyleLuma), islandStyleColour, uIslandStyleSaturation);
islandStyleColour = (islandStyleColour - vec3(0.5)) * uIslandStyleContrast + vec3(0.5);
islandStyleColour = max(vec3(0.0), islandStyleColour + vec3(uIslandStyleBrightness));
float islandStyleOctaveA = universityIslandStyleNoise(vIslandStyleWorldPosition.xz * 0.085);
float islandStyleOctaveB = universityIslandStyleNoise(
  vIslandStyleWorldPosition.xz * 0.19 + vec2(17.3, 5.1)
);
float islandStyleMacro = mix(islandStyleOctaveA, islandStyleOctaveB, 0.32);
float islandStyleHeightLayer = smoothstep(-0.2, 3.4, vIslandStyleHeight);
float islandStyleSlopeLayer = smoothstep(0.18, 0.74, vIslandStyleSlope);
float islandStyleMacroMask = smoothstep(
  0.22,
  0.78,
  islandStyleMacro * 0.76 + islandStyleHeightLayer * 0.18 - islandStyleSlopeLayer * 0.14
);
// Three cheap roles borrow the donor's explicit ground masks without donor
// bitmaps: broad macro variation chooses grass versus exposed soil, height
// makes lower areas a little earthier, and slope supplies contact/cliff depth.
float islandStyleGrassLayer = clamp(
  islandStyleMacroMask *
    smoothstep(0.18, 0.74, islandStyleHeightLayer) *
    (1.0 - islandStyleSlopeLayer * 0.82),
  0.0,
  1.0
);
float islandStyleSoilLayer = clamp(
  smoothstep(0.28, 0.72, 1.0 - islandStyleMacroMask) *
    (0.72 + (1.0 - islandStyleHeightLayer) * 0.28) *
    (1.0 - islandStyleSlopeLayer * 0.42),
  0.0,
  1.0
);
float islandStyleRoleAmount = clamp(
  0.20 + uIslandStyleMacroAmount * 0.55,
  0.0,
  0.70
);
vec3 islandStyleGrassTone = mix(
  vec3(1.04, 1.08, 0.96),
  min(
    vec3(1.1),
    max(vec3(0.0), uIslandStyleTint * 0.42 + vec3(0.62, 0.66, 0.56))
  ),
  0.24
);
vec3 islandStyleSoilTone = mix(
  vec3(0.96, 0.90, 0.78),
  vec3(0.82, 0.74, 0.62),
  0.36 + (1.0 - islandStyleHeightLayer) * 0.32
);
vec3 islandStyleSlopeTone = mix(
  vec3(0.94, 0.97, 0.88),
  vec3(0.64, 0.69, 0.62),
  islandStyleSlopeLayer
);
islandStyleColour = mix(
  islandStyleColour,
  islandStyleColour * islandStyleGrassTone,
  islandStyleGrassLayer * islandStyleRoleAmount
);
islandStyleColour = mix(
  islandStyleColour,
  islandStyleColour * islandStyleSoilTone,
  islandStyleSoilLayer * islandStyleRoleAmount * 0.90
);
islandStyleColour = mix(
  islandStyleColour,
  islandStyleColour * islandStyleSlopeTone,
  islandStyleSlopeLayer * islandStyleRoleAmount
);
// A restrained micro layer keeps the procedural top from reading like one
// untextured card. It is analytic (no donor bitmap or extra texture upload)
// and remains a subtle modulation of the baked vertex colours, without
// introducing a second material or draw.
float islandStyleMicro = universityIslandStyleNoise(
  vIslandStyleWorldPosition.xz * 0.52 + vec2(4.2, 9.1)
);
float islandStyleMicroTone = mix(0.91, 1.09, islandStyleMicro);
float islandStyleMicroAmount = clamp(0.16 + uIslandStyleMacroAmount * 0.6, 0.0, 1.0);
islandStyleColour *= mix(1.0, islandStyleMicroTone, islandStyleMicroAmount);
islandStyleColour += vec3(
  sin(uIslandStyleTime * 1.7 + dot(vIslandStyleWorldPosition.xz, vec2(0.14, 0.09)))
  * uIslandStyleShimmer
);
diffuseColor.rgb = mix(diffuseColor.rgb, islandStyleColour, clamp(uIslandStyleStrength, 0.0, 1.0));`;

const SURFACE_STYLE_VERTEX_PATCH = `${SURFACE_STYLE_UNIFORM_MARKER}
varying vec3 vIslandStyleWorldPosition;
varying float vIslandStyleHeight;
varying float vIslandStyleSlope;`;

const SURFACE_STYLE_VERTEX_ASSIGNMENT = `
vIslandStyleWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;
vIslandStyleHeight = transformed.y;
// The island never tilts its local up axis. Object-space normal therefore gives
// a camera-stable slope; transformedNormal is view-space and would make the
// terrain bands swim when the camera orbits.
vIslandStyleSlope = 1.0 - clamp(abs(normalize(objectNormal).y), 0.0, 1.0);`;

export interface IslandSurfaceStyleUniforms {
  readonly uIslandStyleTint: { value: THREE.Vector3 };
  readonly uIslandStyleSaturation: { value: number };
  readonly uIslandStyleContrast: { value: number };
  readonly uIslandStyleBrightness: { value: number };
  readonly uIslandStyleStrength: { value: number };
  readonly uIslandStyleVariant: { value: number };
  readonly uIslandStyleMacroAmount: { value: number };
  readonly uIslandStyleShimmer: { value: number };
  readonly uIslandStyleTime: { value: number };
}

export interface IslandSurfaceMaterialAdapter {
  readonly enabled: boolean;
  readonly role: IslandSurfaceRole;
  readonly uniforms: IslandSurfaceStyleUniforms;
  readonly style: IslandSurfaceStyleId;
  /** Stable because style changes are uniforms, not shader-program variants. */
  readonly customProgramCacheKey: () => string;
  readonly onBeforeCompile: (
    shader: THREE.WebGLProgramParametersWithUniforms,
    renderer: THREE.WebGLRenderer,
  ) => void;
  /** Returns false when the requested style is already active. */
  setStyle(style: IslandSurfaceStyleId): boolean;
}

export interface IslandSurfaceTimeUniform {
  value: number;
}

function stylePreset(style: IslandSurfaceStyleId): IslandSurfaceStylePreset {
  return ISLAND_SURFACE_STYLE_PRESETS[style];
}

function isIslandSurfaceStyleId(value: string): value is IslandSurfaceStyleId {
  return (ISLAND_SURFACE_STYLE_IDS as readonly string[]).includes(value);
}

/** Parse a user/debug value without allowing arbitrary shader input. */
export function parseIslandSurfaceStyle(value: unknown): IslandSurfaceStyleId | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return isIslandSurfaceStyleId(normalized) ? normalized : null;
}

function queryFromSearch(search: string | undefined): URLSearchParams {
  if (!search) return new URLSearchParams();
  return new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
}

/**
 * Read the debug-only URL contract. A style query without `mode=debug` is
 * intentionally ignored, which prevents an accidental production bookmark
 * from becoming a visual product setting.
 */
export function islandSurfaceStyleFromSearch(
  search: string | undefined,
  fallback: IslandSurfaceStyleId = DEFAULT_ISLAND_SURFACE_STYLE,
): IslandSurfaceStyleId {
  const params = queryFromSearch(search);
  if (params.get("mode")?.trim().toLowerCase() !== "debug") return fallback;
  return parseIslandSurfaceStyle(params.get("islandStyle")) ?? fallback;
}

/** Resolve one DEV look from the URL. Switching reloads the debug page. */
export function resolveIslandSurfaceStyle(
  search: string | undefined = typeof window === "undefined" ? undefined : window.location?.search,
): IslandSurfaceStyleId {
  return islandSurfaceStyleFromSearch(search);
}

function roleStrength(style: IslandSurfaceStylePreset, role: IslandSurfaceRole): number {
  return style.strength[role];
}

/** Stable key for a material role; style switching stays on the same program. */
export function islandSurfaceMaterialCacheKey(role: IslandSurfaceRole): string {
  return `${ISLAND_SURFACE_SHADER_VARIANT}/${role}`;
}

export function createIslandSurfaceMaterialAdapter(
  role: IslandSurfaceRole,
  initialStyle: IslandSurfaceStyleId = DEFAULT_ISLAND_SURFACE_STYLE,
  enabled = true,
  timeUniform: IslandSurfaceTimeUniform = { value: 0 },
): IslandSurfaceMaterialAdapter {
  const initial = stylePreset(initialStyle);
  const uniforms: IslandSurfaceStyleUniforms = {
    uIslandStyleTint: { value: new THREE.Vector3(...initial.tint) },
    uIslandStyleSaturation: { value: initial.saturation },
    uIslandStyleContrast: { value: initial.contrast },
    uIslandStyleBrightness: { value: initial.brightness },
    uIslandStyleStrength: { value: roleStrength(initial, role) },
    uIslandStyleVariant: { value: initial.variant },
    uIslandStyleMacroAmount: { value: initial.macroAmount },
    uIslandStyleShimmer: { value: initial.shimmer },
    uIslandStyleTime: timeUniform,
  };
  let activeStyle = initialStyle;

  const adapter: IslandSurfaceMaterialAdapter = {
    enabled,
    role,
    uniforms,
    get style() {
      return activeStyle;
    },
    customProgramCacheKey: () => islandSurfaceMaterialCacheKey(role),
    onBeforeCompile(shader) {
      if (!enabled) return;
      const fragmentReady =
        shader.fragmentShader.includes(SURFACE_STYLE_UNIFORM_MARKER) ||
        (shader.fragmentShader.includes(SURFACE_STYLE_COMMON_INCLUDE) &&
          shader.fragmentShader.includes(SURFACE_STYLE_COLOR_INCLUDE));
      const vertexReady =
        shader.vertexShader.includes(SURFACE_STYLE_UNIFORM_MARKER) ||
        (shader.vertexShader.includes(SURFACE_STYLE_COMMON_INCLUDE) &&
          shader.vertexShader.includes(SURFACE_STYLE_VERTEX_INCLUDE));
      // Never inject only one shader stage: a fragment varying without its
      // vertex producer would turn a harmless Three upgrade into a black island.
      if (!fragmentReady || !vertexReady) return;
      Object.assign(shader.uniforms, uniforms);
      if (!shader.fragmentShader.includes(SURFACE_STYLE_UNIFORM_MARKER)) {
        // Three's MeshStandardMaterial has these includes in all supported
        // versions. Failing closed keeps a future Three upgrade safe: the
        // base material is still valid, only the optional DEV look is absent.
        shader.fragmentShader = shader.fragmentShader.replace(
          SURFACE_STYLE_COMMON_INCLUDE,
          `${SURFACE_STYLE_COMMON_INCLUDE}\n${SURFACE_STYLE_FRAGMENT_DECLARATIONS}`,
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          SURFACE_STYLE_COLOR_INCLUDE,
          `${SURFACE_STYLE_COLOR_INCLUDE}\n${SURFACE_STYLE_FRAGMENT_PATCH}`,
        );
      }
      if (!shader.vertexShader.includes(SURFACE_STYLE_UNIFORM_MARKER)) {
        shader.vertexShader = shader.vertexShader.replace(
          SURFACE_STYLE_COMMON_INCLUDE,
          `${SURFACE_STYLE_COMMON_INCLUDE}\n${SURFACE_STYLE_VERTEX_PATCH}`,
        );
        shader.vertexShader = shader.vertexShader.replace(
          SURFACE_STYLE_VERTEX_INCLUDE,
          `${SURFACE_STYLE_VERTEX_ASSIGNMENT}\n${SURFACE_STYLE_VERTEX_INCLUDE}`,
        );
      }
    },
    setStyle(style) {
      if (style === activeStyle) return false;
      const next = stylePreset(style);
      activeStyle = style;
      uniforms.uIslandStyleTint.value.set(...next.tint);
      uniforms.uIslandStyleSaturation.value = next.saturation;
      uniforms.uIslandStyleContrast.value = next.contrast;
      uniforms.uIslandStyleBrightness.value = next.brightness;
      uniforms.uIslandStyleStrength.value = roleStrength(next, role);
      uniforms.uIslandStyleVariant.value = next.variant;
      uniforms.uIslandStyleMacroAmount.value = next.macroAmount;
      uniforms.uIslandStyleShimmer.value = next.shimmer;
      return true;
    },
  };
  return adapter;
}

/** Exported for shader-focused tests without exposing implementation names. */
export const ISLAND_SURFACE_STYLE_SHADER_MARKER = SURFACE_STYLE_UNIFORM_MARKER;
