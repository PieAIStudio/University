/**
 * The 3D game registry and the scenes that render it, held together.
 *
 * `THREE_GAMES` in `@pieai/university-ui` is the list of identities; the two
 * engines here are what actually renders one. Nothing connected them, and the
 * list drifted in both directions at once: it names `sky-invaders`,
 * `factory-stack` and `press-words`, which have translated copy but no scene
 * and no engine, while `slice`, `wire` and `rank` have both and never reached
 * the catalogue's `three` group. Neither half could tell.
 *
 * `packages/core` solved the same problem for two-dimensional activities with
 * `ActivityKindsAgree`, after `sort` spent a day with an engine, a renderer and
 * a gate but no name on the wire, and three finished lessons could not land.
 * This is that guard for the 3D half, which is the half about to be worked on.
 *
 * It costs nothing at runtime: every line below is erased by the compiler.
 */
import type { ThreeGame } from "@pieai/university-ui/play-catalog/three-games.js";

import type { ToyMode } from "./material.js";
import type { WorkshopMode } from "./workshop-engine.js";

/** Every mode one of this package's two engines can actually play. */
export type ImplementedThreeGame = ToyMode | WorkshopMode;

/**
 * Registered identities with copy but no scene, as of 2026-09-21.
 *
 * They are not deleted here. A name with two locales of finished copy is more
 * likely a planned game than a mistake, and deciding which is the Owner's call,
 * not a refactor's. The list exists so the gap is counted rather than ambient,
 * and it may only shrink: implement one and the assertion below fails until it
 * is removed from here.
 */
type RegisteredWithoutAScene = "sky-invaders" | "factory-stack" | "press-words";

type Exactly<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;

/** A scene that plays a mode nobody registered is unreachable from the catalogue. */
const everyImplementedGameIsRegistered: ImplementedThreeGame extends ThreeGame ? true : never =
  true;

/** A registered id with no scene must be declared above, not discovered later. */
const everyRegisteredGameIsAccountedFor: Exactly<
  Exclude<ThreeGame, ImplementedThreeGame>,
  RegisteredWithoutAScene
> = true;

void everyImplementedGameIsRegistered;
void everyRegisteredGameIsAccountedFor;

/**
 * Reached only when a mode was added to a union and not to the scene that
 * renders it. The argument is `never`, so that mistake is a type error at the
 * call site; the throw is what happens if it arrives from untyped data anyway.
 */
export function assertEveryThreeGameIsRendered(mode: never): never {
  throw new Error(`3D 游戏 ${JSON.stringify(mode)} 已登记但没有场景渲染它`);
}
