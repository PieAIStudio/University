import type { IslandPick } from "@pieai/university-core";
import type { AvatarRecipe } from "@pieai/university-world/avatar.js";
import { lazy } from "react";

/**
 * The island game a challenge node picked (`pickIslandGame`), each loaded only
 * when a node plays it. Every game takes the same host callbacks.
 */
const InterceptGame = lazy(() =>
  import("./InterceptGame.js").then((m) => ({ default: m.InterceptGame })),
);
const LinksGame = lazy(() => import("./LinksGame.js").then((m) => ({ default: m.LinksGame })));
const SnakeGame = lazy(() => import("./SnakeGame.js").then((m) => ({ default: m.SnakeGame })));
const MolesGame = lazy(() => import("./MolesGame.js").then((m) => ({ default: m.MolesGame })));
const RunnerGame = lazy(() => import("./RunnerGame.js").then((m) => ({ default: m.RunnerGame })));
const BlocksGame = lazy(() => import("./BlocksGame.js").then((m) => ({ default: m.BlocksGame })));

export interface IslandGameHost {
  readonly recipe?: AvatarRecipe | null;
  readonly onClose?: () => void;
  readonly onOpenLesson?: (lessonId: string) => void;
  readonly onUnavailable?: () => void;
  readonly onPlain?: () => void;
  readonly onWon?: () => void;
}

export function IslandGame({ pick, ...host }: IslandGameHost & { pick: IslandPick }) {
  switch (pick.game) {
    case "courtyard":
      return <InterceptGame rounds={pick.rounds} {...host} />;
    case "links":
      return <LinksGame rounds={pick.rounds} {...host} />;
    case "snake":
      return <SnakeGame rounds={pick.rounds} {...host} />;
    case "moles":
      return <MolesGame rounds={pick.rounds} {...host} />;
    case "runner":
      return <RunnerGame rounds={pick.rounds} {...host} />;
    case "blocks":
      return <BlocksGame rounds={pick.rounds} {...host} />;
  }
}
