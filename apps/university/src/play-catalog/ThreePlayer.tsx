import type { ThreeGame } from "@pieai/university-ui/play-catalog/three-games.js";
import { CourseGameLab } from "../game/CourseGameLab.js";
import { KitGameLab } from "../game/KitGameLab.js";

/** The island games, assembled from the game kit (ADR-0011). */
export function ThreePlayer({ mode }: { mode: ThreeGame }) {
  if (mode === "courtyard") return <CourseGameLab />;
  return <KitGameLab game={mode} />;
}
