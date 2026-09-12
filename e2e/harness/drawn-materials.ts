import type { Page } from "@playwright/test";

/** Observe real main-pass submissions; visibility flags alone do not prove
 * that a material was actually drawn. Restore every hook before returning.
 */
export async function captureDrawnMaterials(page: Page) {
  return page.evaluate(async () => {
    const state = (window as any).three;
    const originals: { mesh: any; callback: any }[] = [];
    const draws = new Map<string, any>();
    const targets = new Map<string, any>();
    const originalTarget = state.gl.setRenderTarget;
    state.gl.setRenderTarget = function (target: any, ...args: any[]) {
      if (target)
        targets.set(target.texture?.uuid ?? String(target.id), {
          width: target.width,
          height: target.height,
          samples: target.samples,
          depthBuffer: target.depthBuffer,
          stencilBuffer: target.stencilBuffer,
          colourTextures: (target.textures ?? [target.texture]).map((t: any) => ({
            name: t.name,
            type: t.type,
            format: t.format,
            internalFormat: t.internalFormat,
          })),
        });
      return originalTarget.call(this, target, ...args);
    };
    const texture = (t: any) =>
      t?.isTexture
        ? {
            uuid: t.uuid,
            name: t.name,
            width: t.image?.width ?? null,
            height: t.image?.height ?? null,
            colourSpace: t.colorSpace,
            mipmaps: t.generateMipmaps,
            baseDataBytes: t.image?.data?.byteLength ?? null,
          }
        : null;
    state.scene.traverse((mesh: any) => {
      if (!mesh.isMesh) return;
      const original = mesh.onAfterRender;
      originals.push({ mesh, callback: original });
      mesh.onAfterRender = function (...args: any[]) {
        const material = args[4];
        const surface = material.userData?.surfaceDetail;
        const maps: Record<string, any> = {};
        for (const key of ["map", "normalMap", "bumpMap", "roughnessMap", "aoMap", "emissiveMap"])
          if (material[key]) maps[key] = texture(material[key]);
        for (const key of ["uSurfaceSwatch", "uCourseSurface"])
          if (surface?.[key]) maps[key] = texture(surface[key].value);
        const craft = mesh.geometry.getAttribute("craftSurface");
        const craftRoles = new Set<number>();
        if (craft) for (let i = 0; i < craft.count; i++) craftRoles.add(craft.getZ(i));
        draws.set(`${mesh.uuid}/${material.uuid}`, {
          mesh: mesh.name || mesh.type,
          material: material.type,
          roughness: material.roughness ?? null,
          metalness: material.metalness ?? null,
          vertexColors: material.vertexColors ?? false,
          uv: !!mesh.geometry.attributes.uv,
          stableSurfaceCoordinates: !!mesh.geometry.attributes.surfaceCoordinate,
          craftRoles: [...craftRoles].sort(),
          craftCoordinateBytes: craft?.array.byteLength ?? 0,
          surfaceInfo: material.userData?.surfaceDetailInfo ?? null,
          instances: mesh.isInstancedMesh ? mesh.count : 1,
          maps,
        });
        original.apply(this, args);
      };
    });
    try {
      for (let i = 0; i < 3; i++) await new Promise(requestAnimationFrame);
    } finally {
      state.gl.setRenderTarget = originalTarget;
      for (const { mesh, callback } of originals) mesh.onAfterRender = callback;
    }
    return {
      url: location.href,
      visibility: document.visibilityState,
      viewport: [innerWidth, innerHeight],
      dpr: devicePixelRatio,
      browser: navigator.userAgent,
      scene: state.scene.uuid,
      materials: [...draws.values()],
      renderTargets: [...targets.values()],
      scope:
        "Observed onAfterRender on the current Stage's real main-pass meshes; no shadow-pass or total VRAM claim",
    };
  });
}
