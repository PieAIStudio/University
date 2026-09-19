import type { AvatarBounds } from "@pieai/swimmer-avatar-kit";

/** Full-body studio fit, unlike the square navigation bust. No fixed head
 * height: different species/recipes must remain visible when comparing clay.
 */
export function previewFrame(bounds: AvatarBounds, fovDegrees: number, aspect: number) {
  if (
    ![bounds.w, bounds.h, bounds.minY, bounds.maxY, fovDegrees, aspect].every(Number.isFinite) ||
    bounds.w <= 0 ||
    bounds.h <= 0 ||
    aspect <= 0 ||
    fovDegrees <= 0 ||
    fovDegrees >= 170
  )
    throw new RangeError("Avatar preview needs finite positive bounds and camera dimensions");
  const halfVertical = (fovDegrees * Math.PI) / 360;
  const halfHorizontal = Math.atan(Math.tan(halfVertical) * aspect);
  const radius = Math.max(bounds.w, bounds.h) * 0.5;
  return {
    centreY: (bounds.minY + bounds.maxY) * 0.5,
    distance: (radius * 1.15) / Math.sin(Math.min(halfVertical, halfHorizontal)),
    minDistance: radius * 1.2,
  };
}
