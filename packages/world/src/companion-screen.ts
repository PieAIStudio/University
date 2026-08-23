/**
 * NDC to screen pixels. Same test LabelProbe's loop is doing, extracted so
 * a unit test does not have to stand up a renderer to check the arithmetic.
 */
export interface CompanionAnchor {
  readonly id: string;
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
}

export function screenFromProjected(
  ndc: { readonly x: number; readonly y: number; readonly z: number },
  width: number,
  height: number,
): { x: number; y: number } | null {
  if (ndc.z >= 1 || Math.abs(ndc.x) > 1 || Math.abs(ndc.y) > 1) return null;
  return {
    x: ((ndc.x + 1) / 2) * width,
    y: ((1 - ndc.y) / 2) * height,
  };
}
