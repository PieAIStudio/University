import { readFileSync } from "node:fs";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { bakeMonsterPose, bakedMonsterTriangles } from "./monster-pose.js";
import { describe, expect, it } from "vitest";
import { WEEKLY_BOSS_ROSTER, weeklyBossSpecies } from "./weekly-species.js";
import { monsterWorldHeight } from "./monster-size.js";
import {
  BOSS_HEIGHT,
  MONSTER_ROLE_HEIGHT,
  WEEKLY_BOSS_SIZE,
  courseWeeklyBoss,
} from "./chests-and-monsters.js";
import { placements } from "./course-placements.fixture.js";
import { courseLearningSites } from "./learning-sites.js";
it.each(WEEKLY_BOSS_ROSTER)(
  "%s loads its actual shipped single-part skeletal model",
  async (role) => {
    const bytes = readFileSync(
      new URL(`../../../../apps/university/public/kit/monster-${role}.glb`, import.meta.url),
    );
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const gltf = await loader.parseAsync(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      "",
    );
    const baked = bakeMonsterPose(gltf.scene, gltf.animations, 0.35);
    try {
      expect(baked.skinned).toBe(true);
      expect(baked.parts).toHaveLength(1);
      expect(
        baked.aspect * BOSS_HEIGHT * MONSTER_ROLE_HEIGHT[role] * WEEKLY_BOSS_SIZE,
      ).toBeLessThan(3);
      let meshes = 0;
      gltf.scene.traverse((object) => {
        if ("isMesh" in object && object.isMesh) meshes++;
      });
      expect(meshes).toBeLessThanOrEqual(6);
      expect(bakedMonsterTriangles(baked)).toBeLessThanOrEqual(6000);
      console.log(
        JSON.stringify({
          role,
          meshes,
          bakedParts: baked.parts.length,
          triangles: bakedMonsterTriangles(baked),
          aspect: baked.aspect,
        }),
      );
    } finally {
      for (const part of baked.parts) {
        part.geometry.dispose();
        if (part.owned) part.material.dispose();
      }
    }
  },
);

it("rotates shipped species once per week and preserves the original delivered week", () => {
  const seen = new Set<string>();
  for (let week = 0; week < WEEKLY_BOSS_ROSTER.length; week++) {
    const date = new Date(Date.UTC(2026, 8, 28 + week * 7)).toISOString().slice(0, 10);
    seen.add(weeklyBossSpecies(date));
  }
  expect([...seen]).toEqual(WEEKLY_BOSS_ROSTER);
  expect(weeklyBossSpecies("2026-09-28")).toBe("boss");
  expect(weeklyBossSpecies("2026-10-05")).toBe("frog");
  expect(weeklyBossSpecies("invalid")).toBe("boss");
});

describe("weekly species keep the approved size and proportions", () => {
  const lessons = placements("browser-ai", "run-a-real-project-with-ai", [4, 4]);
  const boss = courseWeeklyBoss(lessons, courseLearningSites(lessons), "2026-09-28")!;
  it("keeps the original boss size", () =>
    expect(monsterWorldHeight(boss)).toBe(BOSS_HEIGHT * WEEKLY_BOSS_SIZE));
  it.each(WEEKLY_BOSS_ROSTER)("%s remains 20 percent larger than its gate-boss scale", (role) => {
    const height = monsterWorldHeight({ ...boss, role });
    expect(height).toBe(BOSS_HEIGHT * MONSTER_ROLE_HEIGHT[role] * WEEKLY_BOSS_SIZE);
    expect(height).toBeGreaterThan(BOSS_HEIGHT * MONSTER_ROLE_HEIGHT[role]);
  });
});
