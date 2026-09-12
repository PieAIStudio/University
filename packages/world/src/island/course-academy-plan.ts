import type { IslandBlueprint } from "./island-blueprint.js";
import type { IslandDressingPlan } from "./island-dressing.js";
import { islandTerrainFootprintRange } from "./island-geometry.js";
export function courseAcademyPlan(bp: IslandBlueprint, dressing: IslandDressingPlan) {
  const members = dressing.placements.filter((p) => p.assemblyId === "summit-academy-building");
  const roof = members.find((p) => p.assetId === "roof-gable"),
    door = members.find((p) => p.assetId === "wall-doorway-square");
  if (
    !roof ||
    !door ||
    members.length !== 5 ||
    members.filter((p) => p.assetId === "wall").length !== 3
  )
    return [];
  const size = door.height,
    turn = Math.atan2(door.x - roof.x, door.z - roof.z);
  const footprint = [
    [-0.49, -0.49],
    [0.49, -0.49],
    [0.49, 0.49],
    [-0.49, 0.49],
  ].map(([x, z]) => ({
    x: roof.x + (x! * Math.cos(turn) + z! * Math.sin(turn)) * size,
    z: roof.z + (-x! * Math.sin(turn) + z! * Math.cos(turn)) * size,
  }));
  const ground = islandTerrainFootprintRange(bp, footprint, "course");
  if (!ground || ground.maxY - ground.minY > 0.22) return [];
  const foundationY = (ground.minY - 0.012 - door.y) / size;
  if (foundationY < -0.16 || foundationY > 0.02) return [];
  return [
    {
      id: "summit-academy-building",
      sourceIds: members.map((p) => p.id),
      x: roof.x,
      y: door.y,
      z: roof.z,
      turn,
      size,
      foundationY,
    },
  ];
}
export type CourseAcademy = ReturnType<typeof courseAcademyPlan>[number];
