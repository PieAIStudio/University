import type { ThreeGame } from "@pieai/university-ui/play-catalog/three-games.js";
import { ArcadePlayer } from "./ArcadePlayer.js";
import { WorkshopPlayer } from "./WorkshopPlayer.js";
import { CourseGameLab } from "../game/CourseGameLab.js";

/** Old game IDs retain their original garden edition; no redirect or replacement. */
export function ThreePlayer({ mode }: { mode: ThreeGame }) {
  if (mode === "courtyard") return <CourseGameLab />;
  if (mode === "sky-invaders")
    return <ArcadePlayer mode="invaders" displayMode={mode} edition="purpose" />;
  if (mode === "factory-stack")
    return <ArcadePlayer mode="stack" displayMode={mode} edition="purpose" />;
  if (mode === "press-words")
    return <ArcadePlayer mode="cloze-tetris" displayMode={mode} edition="purpose" />;
  if (mode === "slice" || mode === "wire" || mode === "rank") return <WorkshopPlayer mode={mode} />;
  return <ArcadePlayer mode={mode} />;
}
