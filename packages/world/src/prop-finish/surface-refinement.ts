import * as THREE from "three";

/** Retained from 1f971a93's successful rock treatment, with all wax scattering
 * removed. Changes shading normals, NOT silhouette, topology, UVs or colliders.
 * Smoothing base normals and suppressing normal-map detail are separate actions.
 */
export function softSculptedNormals(
  source: THREE.BufferGeometry,
  amount = 0.72,
): THREE.BufferGeometry {
  if (!Number.isFinite(amount) || amount < 0 || amount > 1)
    throw new RangeError("Normal softening must be in [0,1]");
  const copy = source.clone();
  copy.userData = { ...source.userData };
  const p = copy.getAttribute("position"),
    n = copy.getAttribute("normal");
  if (!p || !n) return copy;
  const sums = new Map<string, THREE.Vector3>();
  const key = (i: number) =>
    `${Math.round(p.getX(i) * 1e5)},${Math.round(p.getY(i) * 1e5)},${Math.round(p.getZ(i) * 1e5)}`;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    const k = key(i),
      sum = sums.get(k) ?? new THREE.Vector3();
    sum.add(v.set(n.getX(i), n.getY(i), n.getZ(i)));
    sums.set(k, sum);
  }
  for (const sum of sums.values()) sum.normalize();
  for (let i = 0; i < p.count; i++) {
    v.set(n.getX(i), n.getY(i), n.getZ(i))
      .lerp(sums.get(key(i))!, amount)
      .normalize();
    n.setXYZ(i, v.x, v.y, v.z);
  }
  n.needsUpdate = true;
  copy.name = `${source.name}/soft-sculpted`;
  return copy;
}
export function copySurface(source: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  const view = Object.create(source) as THREE.MeshStandardMaterial;
  view.userData = {};
  const material = (source as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial
    ? new THREE.MeshPhysicalMaterial().copy(view as THREE.MeshPhysicalMaterial)
    : new THREE.MeshStandardMaterial().copy(view);
  material.userData = { ...source.userData };
  material.onBeforeCompile = source.onBeforeCompile;
  material.customProgramCacheKey = source.customProgramCacheKey;
  material.onBeforeRender = source.onBeforeRender;
  return material;
}
export function softSculptedSurface(
  source: THREE.MeshStandardMaterial,
  role: "stone" | "plant" | "prop",
) {
  const m = copySurface(source);
  // Preserve translucent water and authored material identity rather than wax-coating everything.
  if (m.transparent || m.opacity < 1) return m;
  m.flatShading = false;
  m.metalness = 0;
  m.roughness = role === "prop" ? 0.8 : 0.86;
  if ((m as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial) {
    const p = m as THREE.MeshPhysicalMaterial;
    p.clearcoat = 0;
    p.sheen = 0;
    p.iridescence = 0;
    p.transmission = 0;
    p.anisotropy = 0;
    p.specularIntensity = 0.38;
  }
  const originalHook = source.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => {
    originalHook.call(m, shader, renderer);
    const anchor = "#include <lights_physical_fragment>";
    if (!shader.fragmentShader.includes(anchor))
      throw new Error("Soft sculpture requires pinned StandardMaterial physical shading");
    shader.fragmentShader = shader.fragmentShader.replace(
      anchor,
      `normal = normalize(mix(normal, nonPerturbedNormal, 0.88));\n${anchor}`,
    );
  };
  m.customProgramCacheKey = () => `${source.customProgramCacheKey()}/soft-sculpted-v1`;
  m.name = `${source.name}/soft-sculpted`;
  return m;
}
