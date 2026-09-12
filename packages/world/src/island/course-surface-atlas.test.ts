import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { islandBlueprint } from "./island-blueprint.js";
import { islandThemeSelectionForCourse } from "./kenney-recipes.js";
import { planIslandDressing } from "./island-dressing.js";
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

describe("course field-backed colour texture", () => {
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
    // Pigment variation must remain chromatic and bounded, never a dark AO
    // overlay of the directional shadows already drawn by the stage.
    for (let i = 0; i < a.data.length; i += 4) {
      expect(a.data[i]).toBeGreaterThanOrEqual(180);
      expect(a.data[i + 1]).toBeGreaterThanOrEqual(215);
      expect(a.data[i + 2]).toBeGreaterThanOrEqual(160);
    }
  });

  it("shares and releases per-course colour without confusing it with packed scalar data", () => {
    const bp = blueprint();
    const a = acquireCourseSurface(bp),
      b = acquireCourseSurface(bp);
    const disposed = vi.fn();
    a.texture.addEventListener("dispose", disposed);
    expect(a.texture).toBe(b.texture);
    expect(a.texture.colorSpace).toBe(THREE.LinearSRGBColorSpace);
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
      expect(detail.customProgramCacheKey()).toBe("university-surface-swatch-v3/garden");
      expect(shader.fragmentShader).toContain("texture2D(uCourseSurface");
      expect(shader.fragmentShader).toContain("gardenFace * gardenSurface.a");
      expect(shader.vertexShader).not.toContain("transformed +=");
      expect(shader.fragmentShader.match(/#include <colorspace_fragment>/g)).toHaveLength(1);
      expect(shader.fragmentShader.match(/#include <tonemapping_fragment>/g)).toHaveLength(1);
    } finally {
      detail.dispose();
    }
  });
});
