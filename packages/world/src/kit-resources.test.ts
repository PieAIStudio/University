import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";

import {
  cloneOwnedPartGeometry,
  disposeOwnedPartResources,
  type OwnedPartResources,
} from "./kit-resources.js";

describe("kit field resource ownership", () => {
  it("detaches projection metadata from the cached source geometry", () => {
    const sourceGeometry = new THREE.BufferGeometry();
    sourceGeometry.userData = { sourceTag: "cached" };

    const geometry = cloneOwnedPartGeometry(sourceGeometry);
    geometry.userData.lifted = true;

    expect(geometry).not.toBe(sourceGeometry);
    expect(geometry.userData).not.toBe(sourceGeometry.userData);
    expect(sourceGeometry.userData).toEqual({ sourceTag: "cached" });
  });

  it("disposes owned geometry and material exactly once, preserving shared source resources", () => {
    const sourceGeometry = new THREE.BufferGeometry();
    const texture = new THREE.Texture();
    const source = new THREE.MeshStandardMaterial({ map: texture });
    const geometry = cloneOwnedPartGeometry(sourceGeometry);
    const material = source.clone();
    expect(geometry).not.toBe(sourceGeometry);
    expect(material).not.toBe(source);
    expect(material.map).toBe(texture);

    const geometryDispose = vi.spyOn(geometry, "dispose");
    const materialDispose = vi.spyOn(material, "dispose");
    const sourceDispose = vi.spyOn(source, "dispose");
    const sourceGeometryDispose = vi.spyOn(sourceGeometry, "dispose");
    const textureDispose = vi.spyOn(texture, "dispose");

    const parts: readonly OwnedPartResources[] = [
      { geometry, material },
      // Repeated resources must not double-dispose one owned object.
      { geometry, material },
    ];
    disposeOwnedPartResources(parts);

    expect(geometryDispose).toHaveBeenCalledOnce();
    expect(materialDispose).toHaveBeenCalledOnce();
    expect(sourceDispose).not.toHaveBeenCalled();
    expect(sourceGeometryDispose).not.toHaveBeenCalled();
    expect(textureDispose).not.toHaveBeenCalled();
  });

  it("releases the old and new projection allocations when switching projections", () => {
    const sourceGeometry = new THREE.BufferGeometry();
    const texture = new THREE.Texture();
    const source = new THREE.MeshStandardMaterial({ map: texture });
    const world = { geometry: cloneOwnedPartGeometry(sourceGeometry), material: source.clone() };
    const course = { geometry: cloneOwnedPartGeometry(sourceGeometry), material: source.clone() };
    const worldGeometryDispose = vi.spyOn(world.geometry, "dispose");
    const worldMaterialDispose = vi.spyOn(world.material, "dispose");
    const courseGeometryDispose = vi.spyOn(course.geometry, "dispose");
    const courseMaterialDispose = vi.spyOn(course.material, "dispose");
    const sourceDispose = vi.spyOn(source, "dispose");
    const sourceGeometryDispose = vi.spyOn(sourceGeometry, "dispose");
    const textureDispose = vi.spyOn(texture, "dispose");

    disposeOwnedPartResources([world]);
    disposeOwnedPartResources([course]);

    expect(worldGeometryDispose).toHaveBeenCalledOnce();
    expect(worldMaterialDispose).toHaveBeenCalledOnce();
    expect(courseGeometryDispose).toHaveBeenCalledOnce();
    expect(courseMaterialDispose).toHaveBeenCalledOnce();
    expect(sourceDispose).not.toHaveBeenCalled();
    expect(sourceGeometryDispose).not.toHaveBeenCalled();
    expect(textureDispose).not.toHaveBeenCalled();
  });
});
