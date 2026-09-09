/** Stable peers in a shared view plane, never satellites of the selected domain. */
import * as THREE from "three";
import { DOMAIN_RADIUS } from "./atmospheric-regions.js";

export const DOMAIN_VIEW_FRONT = new THREE.Vector3(0, 0.12, -1).normalize();
export const DOMAIN_VIEW_UP = new THREE.Vector3(0, -DOMAIN_VIEW_FRONT.z, DOMAIN_VIEW_FRONT.y);
export const DOMAIN_OUTER_RADIUS = DOMAIN_RADIUS * 1.26;
const DOMAIN_SPACING = DOMAIN_OUTER_RADIUS * 2.5;

/**
 * A name's full border box must fit its projected planet's allotted width.
 * Viewport vw alone ignores the short globe row above a mobile catalogue.
 */
export function domainLabelWidth(pixelsPerUnit: number): number {
  return Math.max(1, Math.min(176, Math.max(0, pixelsPerUnit) * DOMAIN_SPACING - 12));
}

export interface DomainPlacement {
  readonly domainId: string;
  readonly position: readonly [number, number, number];
  readonly viewX: number;
  readonly viewY: number;
}

/** Only catalogue membership determines position; selection/progress never does. */
export function layoutDomainPlan(domainIds: readonly string[]): readonly DomainPlacement[] {
  const ids = [...domainIds].sort((a, b) => a.localeCompare(b, "en"));
  if (new Set(ids).size !== ids.length) throw new Error("Domain layout requires unique IDs");
  const columns = Math.max(1, Math.ceil(Math.sqrt(ids.length)));
  const rows = Math.ceil(ids.length / columns);
  return ids.map((domainId, index) => {
    const row = Math.floor(index / columns);
    const rowLength = Math.min(columns, ids.length - row * columns);
    const x = ((index % columns) - (rowLength - 1) / 2) * DOMAIN_SPACING;
    const y = ((rows - 1) / 2 - row) * DOMAIN_SPACING;
    return {
      domainId,
      // From the negative-z camera, screen-right is world negative-x.
      position: [-x, y * DOMAIN_VIEW_UP.y, y * DOMAIN_VIEW_UP.z],
      viewX: x,
      viewY: y,
    };
  });
}

/**
 * Fit spheres, not their centre points, inside the usable off-axis frustum.
 * The sphere's distance to each side plane must be >= its radius. This also
 * includes the atmospheric course islands and room for the DOM domain name.
 */
export function domainCameraDistance(
  placements: readonly DomainPlacement[],
  viewport: {
    readonly height: number;
    readonly usableWidth: number;
    readonly usableHeight: number;
    readonly fovDegrees: number;
  },
): number {
  const tangent = Math.tan(THREE.MathUtils.degToRad(viewport.fovDegrees / 2));
  const height = Math.max(1, viewport.height);
  const horizontal = Math.atan((tangent * Math.max(1, viewport.usableWidth)) / height);
  const vertical = Math.atan((tangent * Math.max(1, viewport.usableHeight)) / height);
  const halfWidth = Math.max(0, ...placements.map((entry) => Math.abs(entry.viewX)));
  const halfHeight = Math.max(0, ...placements.map((entry) => Math.abs(entry.viewY)));
  return Math.max(
    halfWidth / Math.tan(horizontal) + DOMAIN_OUTER_RADIUS / Math.sin(horizontal),
    halfHeight / Math.tan(vertical) + DOMAIN_OUTER_RADIUS / Math.sin(vertical),
  );
}
