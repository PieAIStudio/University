import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { createCraftMaterialDetail } from "./craft-material.js";
import { createSurfaceMaterialDetail } from "./surface-material-detail.js";
import { CRAFT_SURFACE, prepareCraftSurface } from "./craft-surface.js";
import { createCourseAcademyGeometry } from "./course-academy-geometry.js";
import { createCourseStallGeometry } from "./course-stall-geometry.js";
import { buildCourseLandscapeGeometry } from "./course-landscape-geometry.js";

describe("crafted scenery material identity inside one merged batch", () => {
  it("records explicit factory roles without interpolating between unrelated materials", () => {
    for (const [g, required] of [
      [createCourseAcademyGeometry(), [0, 1, 2, 3, 5]],
      [createCourseStallGeometry(), [0, 1, 4]],
    ] as const) {
      try {
        const a = g.getAttribute("craftSurface"),
          ids = g.index!;
        const roles = new Set<number>();
        for (let i = 0; i < ids.count; i += 3) {
          const r = a.getZ(ids.getX(i));
          roles.add(r);
          expect(a.getZ(ids.getX(i + 1))).toBe(r);
          expect(a.getZ(ids.getX(i + 2))).toBe(r);
        }
        expect([...roles].sort()).toEqual(required);
        expect(Array.from(a.array).every(Number.isFinite)).toBe(true);
      } finally {
        g.dispose();
      }
    }
  });
  it("keeps model-locked coordinates while placement transforms change real geometry", () => {
    const g = new THREE.BoxGeometry(1, 2, 1);
    try {
      const before = g.getAttribute("position").array.slice();
      prepareCraftSurface(g, CRAFT_SURFACE.timber);
      const coordinates = g.getAttribute("craftSurface").array.slice();
      expect(g.getAttribute("position").array).toEqual(before);
      g.rotateY(0.9).scale(3, 3, 3).translate(10, 4, 15);
      expect(g.getAttribute("craftSurface").array).toEqual(coordinates);
      expect(g.getAttribute("position").array).not.toEqual(before);
    } finally {
      g.dispose();
    }
  });
  it("preserves zero material-role on natural flora in the production merger", () => {
    const g = buildCourseLandscapeGeometry({
      outcrops: [],
      flora: [
        {
          id: "test",
          asset: "grass",
          x: 0,
          y: 0,
          z: 0,
          size: 1,
          radius: 0.2,
          turn: 0,
          anchorId: "test",
          groundRange: [0, 0],
        },
      ],
      spring: null,
      search: {},
    });
    try {
      expect(Array.from(g.flora!.getAttribute("craftSurface").array).every((n) => n === 0)).toBe(
        true,
      );
    } finally {
      g.dispose();
    }
  });
  it("shares the existing scalar texture, with no reservation from an abandoned render", () => {
    const abandoned = createCraftMaterialDetail();
    const craft = createCraftMaterialDetail(),
      rock = createSurfaceMaterialDetail("stone");
    expect(abandoned.uniforms.uSurfaceSwatch.value).toBeNull();
    craft.activate();
    craft.activate();
    rock.activate();
    const texture = craft.uniforms.uSurfaceSwatch.value!,
      dispose = vi.fn();
    texture.addEventListener("dispose", dispose);
    expect(texture).toBe(rock.uniforms.uSurfaceSwatch.value);
    craft.dispose();
    craft.dispose();
    expect(dispose).not.toHaveBeenCalled();
    rock.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
    const handle = craft.uniforms.uSurfaceSwatch;
    craft.activate();
    expect(craft.uniforms.uSurfaceSwatch).toBe(handle);
    expect(handle.value).not.toBe(texture);
    craft.dispose();
  });
  it("extends installed Standard material only at colour/roughness, retaining one output owner", () => {
    const detail = createCraftMaterialDetail();
    const shader = {
      vertexShader: THREE.ShaderLib.standard.vertexShader,
      fragmentShader: THREE.ShaderLib.standard.fragmentShader,
      uniforms: {},
    } as THREE.WebGLProgramParametersWithUniforms;
    try {
      detail.onBeforeCompile(shader);
      expect(shader.fragmentShader).toContain("fwidth(craftSeamAxis)");
      expect(shader.fragmentShader).toContain("craftPhysical");
      expect(shader.fragmentShader.match(/#include <colorspace_fragment>/g)).toHaveLength(1);
      expect(shader.fragmentShader.match(/#include <tonemapping_fragment>/g)).toHaveLength(1);
      expect(shader.vertexShader).not.toContain("transformed +=");
      expect(shader.uniforms.uSurfaceDetailMode).toBe(detail.uniforms.uSurfaceDetailMode);
    } finally {
      detail.dispose();
    }
  });
});
