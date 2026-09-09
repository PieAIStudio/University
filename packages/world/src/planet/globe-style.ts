/** Named material families for domain metadata, not per-planet scene code.
 * Values are linear RGB, consumed identically by vertex fallback and texture
 * baking. Stage still owns the only tone mapping / output encoding.
 */
import * as THREE from "three";

export type DomainSurfaceStyle = "meadow" | "dawn" | "iris" | "lagoon";

export const DOMAIN_SURFACE_PALETTES = {
  meadow: {
    deep: new THREE.Color(0.18, 0.35, 0.54),
    shallow: new THREE.Color(0.28, 0.48, 0.62),
    shore: new THREE.Color(0.88, 0.84, 0.72),
    land: new THREE.Color(0.38, 0.5, 0.38),
    highland: new THREE.Color(0.29, 0.4, 0.3),
  },
  dawn: {
    deep: new THREE.Color(0.19, 0.34, 0.4),
    shallow: new THREE.Color(0.35, 0.58, 0.57),
    shore: new THREE.Color(0.9, 0.82, 0.63),
    land: new THREE.Color(0.65, 0.43, 0.27),
    highland: new THREE.Color(0.46, 0.28, 0.23),
  },
  iris: {
    deep: new THREE.Color(0.24, 0.23, 0.45),
    shallow: new THREE.Color(0.38, 0.4, 0.66),
    shore: new THREE.Color(0.83, 0.78, 0.9),
    land: new THREE.Color(0.55, 0.35, 0.56),
    highland: new THREE.Color(0.34, 0.23, 0.4),
  },
  lagoon: {
    deep: new THREE.Color(0.19, 0.25, 0.42),
    shallow: new THREE.Color(0.29, 0.43, 0.6),
    shore: new THREE.Color(0.91, 0.8, 0.65),
    land: new THREE.Color(0.26, 0.55, 0.54),
    highland: new THREE.Color(0.18, 0.38, 0.4),
  },
} as const;

export function domainSurfacePalette(style: DomainSurfaceStyle = "meadow") {
  return Object.hasOwn(DOMAIN_SURFACE_PALETTES, style)
    ? DOMAIN_SURFACE_PALETTES[style]
    : DOMAIN_SURFACE_PALETTES.meadow;
}
