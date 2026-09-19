import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { islandBlueprint } from "./island-blueprint.js";
import { islandThemeSelectionForCourse } from "./kenney-recipes.js";
import { planIslandDressing } from "./island-dressing.js";
import { islandFieldFor, sampleIslandField } from "./island-field.js";
import {
  acquireCourseSurface,
  courseSurfaceData,
  COURSE_SURFACE_SIZE,
} from "./course-surface-atlas.js";
import { createSurfaceMaterialDetail } from "./surface-material-detail.js";

const blueprint = (courseId = "foundations-before-zero") =>
  islandBlueprint({
    studyId: "turing-pact",
    courseId,
    lessonCount: 41,
    themeSelection: islandThemeSelectionForCourse("turing-pact", "foundations-before-zero"),
  });

describe("course field-backed surface masks", () => {
  it("does not let abandoned React render adapters pin a committed course texture", () => {
    const bp = blueprint();
    const abandoned = createSurfaceMaterialDetail("terrain", bp);
    const committed = createSurfaceMaterialDetail("terrain", bp);
    expect(abandoned.uniforms.uSurfaceSwatch.value).toBeNull();
    expect(abandoned.uniforms.uCourseSurface?.value).toBeNull();
    committed.activate();
    committed.activate();
    const texture = committed.uniforms.uCourseSurface!.value!;
    const disposed = vi.fn();
    texture.addEventListener("dispose", disposed);
    committed.dispose();
    expect(disposed).toHaveBeenCalledTimes(1);
    // There is deliberately no cleanup of `abandoned`: React never committed
    // it, so it never had an effect cleanup. It must own no GPU reservation.
  });

  it("rebinds the same uniform handles across effect cleanup/setup without retaining old maps", () => {
    const detail = createSurfaceMaterialDetail("terrain", blueprint());
    const handle = detail.uniforms.uCourseSurface!;
    detail.activate();
    const first = handle.value!;
    const disposed = vi.fn();
    first.addEventListener("dispose", disposed);
    detail.dispose();
    expect(handle.value).toBeNull();
    detail.activate();
    expect(detail.uniforms.uCourseSurface).toBe(handle);
    expect(handle.value).not.toBe(first);
    expect(disposed).toHaveBeenCalledTimes(1);
    detail.dispose();
  });

  it("is deterministic and leaves the real route, supports and dressing unchanged", () => {
    const bp = blueprint();
    const plan = planIslandDressing(bp, "course");
    const before = JSON.stringify({ nodes: bp.nodes, route: bp.centerline, plan });
    const a = courseSurfaceData(bp);
    expect(a.data).toEqual(courseSurfaceData(bp).data);
    expect(a.data.byteLength).toBe(COURSE_SURFACE_SIZE ** 2 * 4);
    expect(JSON.stringify({ nodes: bp.nodes, route: bp.centerline, plan })).toBe(before);
    // Scalar masks retain real meadow identity even on canopy-free ground.
    // Reconstruct the previous pigment floors; masks are NOT colour values.
    let openTurf = 0;
    for (let i = 0; i < a.data.length; i += 4) {
      const canopy = a.data[i]! / 255,
        meadow = a.data[i + 1]! / 255;
      const wear = a.data[i + 3]! / 255;
      if (canopy < 0.04 && meadow > 0.25) openTurf++;
      expect(
        Math.round((0.99 - canopy * 0.24 - meadow * 0.018 + wear * 0.035) * 255),
      ).toBeGreaterThanOrEqual(180);
      expect(Math.round((1 - canopy * 0.075 - wear * 0.07) * 255)).toBeGreaterThanOrEqual(215);
      expect(Math.round((0.97 - canopy * 0.25 - wear * 0.18) * 255)).toBeGreaterThanOrEqual(160);
    }
    expect(openTurf).toBeGreaterThan(150);
    const field = islandFieldFor(bp);
    for (let y = 0; y < COURSE_SURFACE_SIZE; y += 7)
      for (let x = 0; x < COURSE_SURFACE_SIZE; x += 7) {
        const step = (a.extent * 2) / COURSE_SURFACE_SIZE;
        const s = sampleIslandField(
          field,
          (x + 0.5) * step - a.extent,
          (y + 0.5) * step - a.extent,
        );
        const offset = (y * COURSE_SURFACE_SIZE + x) * 4;
        expect(a.data[offset + 2]).toBe(Math.round(s.route * 255));
        expect(a.data[offset + 1]).toBe(Math.round(s.grass * (1 - s.route) * (s.inside ? 255 : 0)));
      }
  });

  it("shares and releases per-course masks without applying colour-space conversion", () => {
    const bp = blueprint();
    const a = acquireCourseSurface(bp),
      b = acquireCourseSurface(bp);
    const disposed = vi.fn();
    a.texture.addEventListener("dispose", disposed);
    expect(a.texture).toBe(b.texture);
    expect(a.texture.colorSpace).toBe(THREE.NoColorSpace);
    expect(a.texture.generateMipmaps).toBe(true);
    expect(a.texture.wrapS).toBe(THREE.ClampToEdgeWrapping);
    a.dispose();
    a.dispose();
    expect(disposed).not.toHaveBeenCalled();
    b.dispose();
    expect(disposed).toHaveBeenCalledTimes(1);
  });

  it("supports bare-blueprint previews and isolates different course identities", () => {
    const a = blueprint("garden-a"),
      b = blueprint("garden-b");
    expect(courseSurfaceData(a, 32).data).not.toEqual(courseSurfaceData(b, 32).data);
    const bare = islandBlueprint({ studyId: "preview", courseId: "empty", lessonCount: 6 });
    expect(courseSurfaceData(bare, 32).data.length).toBe(32 * 32 * 4);
    expect(() => courseSurfaceData(a, 1024)).toThrow(RangeError);
  });

  it("uses a distinct real shader variant while leaving position and output ownership alone", () => {
    const detail = createSurfaceMaterialDetail("terrain", blueprint());
    try {
      const shader = {
        vertexShader: THREE.ShaderLib.standard.vertexShader,
        fragmentShader: THREE.ShaderLib.standard.fragmentShader,
        uniforms: {},
      } as THREE.WebGLProgramParametersWithUniforms;
      detail.onBeforeCompile(shader);
      expect(detail.customProgramCacheKey()).toBe("university-surface-swatch-v5/garden");
      expect(shader.fragmentShader).toContain("texture2D(uCourseSurface");
      expect(shader.fragmentShader).toContain("gardenFace * gardenSurface.a");
      expect(shader.fragmentShader).toContain("gardenTurf");
      expect(shader.fragmentShader).toContain("turfFootprint");
      // R55 rejects raised short-grass relief, not the approved low scenery.
      expect(shader.fragmentShader).not.toContain("surfaceRelief +=");
      expect(shader.uniforms.uMeadowStrength).toBe(detail.uniforms.uMeadowStrength);
      expect(shader.vertexShader).not.toContain("transformed +=");
      expect(shader.fragmentShader.match(/#include <colorspace_fragment>/g)).toHaveLength(1);
      expect(shader.fragmentShader.match(/#include <tonemapping_fragment>/g)).toHaveLength(1);
    } finally {
      detail.dispose();
    }
  });
});
