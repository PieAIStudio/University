import type { AvatarRecipe } from "@pieai/swimmer-avatar-kit";
import { binColour } from "@pieai/university-ui/game-frame/palette.js";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";

import { Stage } from "../Stage.js";
import { usePrefersReducedMotion } from "../reduced-motion.js";
import { Block, Disc, Flower, ToyLighting, Tree } from "../toy-play/parts.js";
import { TOY } from "../toy-play/style.js";
import type { RunnerSession, RunnerState } from "./rules/runner.js";
import { AnchoredLabels, type AnchoredLabel } from "./scene/AnchoredLabels.js";
import { GameHero, type GameHeroHandle } from "./scene/GameHero.js";
import {
  Clock,
  EffectView,
  SceneBoundary,
  useEffects,
  type Effect,
  type HudInset,
} from "./scene/stage-parts.js";

/**
 * 三岔路's scene: a garden path that runs toward the horizon, the learner's
 * avatar running it, and a row of arches for each fork (ADR-0011). It reads
 * the session and never writes it, except to advance time; a tap on an arch's
 * sign asks the session to take that lane.
 */
export interface RunnerSceneProps {
  readonly session: RunnerSession;
  readonly snapshot: RunnerState;
  readonly recipe?: AvatarRecipe | null;
  readonly frozen: boolean;
  readonly booting: boolean;
  readonly hud: HudInset;
  readonly describeArch: (label: string, lane: number, current: boolean) => string;
  readonly onLane: (lane: number) => void;
  readonly onReady: () => void;
  readonly onFailure: () => void;
}

export const LANE_WIDTH = 2.2;
/** Where a fork appears, down the path; the avatar runs at z = 0. */
const FAR_Z = -24;
const TILE = 1.2;
const TILES = 30;
const SIDE_STEP = 6;
const SIDES = 10;

const laneX = (lane: number, lanes: number) => (lane - (lanes - 1) / 2) * LANE_WIDTH;
const colour = (lane: number) => new THREE.Color(binColour(lane)).getHex();

/** Where the fork's arches stand now: far away, closing in, then behind. */
function forkZ(state: Readonly<RunnerState>): number {
  const fork = state.fork;
  if (!fork) return FAR_Z;
  if (fork.taken === null) return FAR_Z * (1 - fork.progress);
  return fork.since * 12;
}

function ChaseCamera({ hud }: { hud: HudInset }) {
  const { camera, size } = useThree();
  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera) || !size.height) return;
    const aspect = size.width / size.height;
    // A tall phone needs a wider lens to keep all three lanes in view.
    camera.fov = aspect < 0.8 ? 68 : aspect < 1.2 ? 56 : 46;
    // Lift the view a little when the question banner covers more of the top.
    const lift = Math.min(1.2, hud.top / Math.max(1, size.height)) * 2;
    camera.position.set(0, 3.1 + lift, 5.6);
    camera.lookAt(0, 0.5, -7);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height, hud.top]);
  return null;
}

/** The path and its verges, scrolled by distance so the world runs past. */
function Ground({ session }: { session: RunnerSession }) {
  const tiles = useRef<THREE.Group>(null);
  const sides = useRef<THREE.Group>(null);
  useFrame(() => {
    const d = session.getState().distance;
    if (tiles.current) tiles.current.position.z = d % TILE;
    if (sides.current) sides.current.position.z = d % SIDE_STEP;
  });
  return (
    <group name="runner-ground">
      <Block position={[0, -0.05, -20]} size={[40, 0.1, 60]} color={TOY.grass} />
      <group ref={tiles}>
        {Array.from({ length: TILES }, (_, i) => (
          <Block
            key={i}
            position={[0, 0.02, 2 - i * TILE]}
            size={[LANE_WIDTH * 3 + 0.3, 0.06, TILE - 0.08]}
            color={TOY.cream}
          />
        ))}
      </group>
      <group ref={sides}>
        {Array.from({ length: SIDES }, (_, i) => (
          <group key={i} position={[0, 0, 4 - i * SIDE_STEP]}>
            <Tree x={i % 2 ? -4.4 : -5.2} z={0} scale={0.9} />
            <Tree x={i % 2 ? 5.1 : 4.3} z={-3} scale={0.8} />
            <Flower x={-3.3} z={-1.5} />
            <Flower x={3.4} z={-4} />
          </group>
        ))}
      </group>
    </group>
  );
}

function Arches({ session, lanes }: { session: RunnerSession; lanes: number }) {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    const node = group.current;
    if (!node) return;
    const s = session.getState();
    node.visible = Boolean(s.fork);
    node.position.z = forkZ(s);
  });
  return (
    <group ref={group} name="runner-arches">
      {Array.from({ length: lanes }, (_, lane) => {
        const x = laneX(lane, lanes);
        return (
          <group key={lane} position={[x, 0, 0]}>
            {[-1, 1].map((side) => (
              <Disc
                key={side}
                position={[side * (LANE_WIDTH / 2 - 0.14), 1.2, 0]}
                radius={0.13}
                height={2.4}
                color={colour(lane)}
              />
            ))}
            <Block
              position={[0, 2.45, 0]}
              size={[LANE_WIDTH + 0.05, 0.26, 0.3]}
              color={colour(lane)}
            />
            {/* A cream board under the lintel, where the option's sign hangs. */}
            <Block
              position={[0, 2.05, 0.05]}
              size={[LANE_WIDTH - 0.5, 0.5, 0.08]}
              color={TOY.cream}
            />
          </group>
        );
      })}
      {/* Low hedges between the lanes, from the arches back toward the runner. */}
      {Array.from({ length: Math.max(0, lanes - 1) }, (_, i) => (
        <Block
          key={`h${i}`}
          position={[laneX(i, lanes) + LANE_WIDTH / 2, 0.22, 1.6]}
          size={[0.22, 0.4, 3.2]}
          color={TOY.leaf}
        />
      ))}
    </group>
  );
}

function Runner({
  session,
  hero,
  recipe,
  reducedMotion,
  paused,
}: {
  session: RunnerSession;
  hero: RefObject<GameHeroHandle | null>;
  recipe: AvatarRecipe | null;
  reducedMotion: boolean;
  paused: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const ahead = useMemo(() => new THREE.Vector3(0, 0.6, -20), []);
  useFrame(() => {
    const node = group.current;
    if (!node) return;
    const s = session.getState();
    const lanes = s.fork?.lanes.length ?? 3;
    node.position.x = laneX(s.laneX, lanes);
    // A running bob; still when motion is reduced.
    node.position.y = reducedMotion ? 0 : Math.abs(Math.sin(s.distance * 2.2)) * 0.12;
    ahead.x = node.position.x;
    hero.current?.look(ahead);
  });
  return (
    <group ref={group} name="runner-hero">
      <GameHero
        ref={hero}
        position={[0, 0.05, 0]}
        recipe={recipe}
        height={1.3}
        reducedMotion={reducedMotion}
        paused={paused}
      />
    </group>
  );
}

function Director({
  session,
  hero,
  reducedMotion,
  addEffect,
}: {
  session: RunnerSession;
  hero: RefObject<GameHeroHandle | null>;
  reducedMotion: boolean;
  addEffect: (effect: Omit<Effect, "key">) => void;
}) {
  const seen = useRef(0);
  useFrame(() => {
    const s = session.getState();
    for (const event of s.events) {
      if (event.id <= seen.current) continue;
      seen.current = event.id;
      switch (event.kind) {
        case "steer":
          hero.current?.act("hop", { speed: 1.6 });
          break;
        case "fork": {
          const lanes = s.fork?.lanes.length ?? 3;
          const at = new THREE.Vector3(laneX(event.lane, lanes), 1.7, -0.4);
          if (event.right) {
            hero.current?.act("cheer");
            hero.current?.feel("happy", 0.9);
            if (!reducedMotion) addEffect({ kind: "stars", from: at });
          } else {
            hero.current?.act("flinch");
            hero.current?.feel("surprised", 1);
            if (!reducedMotion) addEffect({ kind: "puff", from: at });
          }
          break;
        }
        case "round-clear":
        case "won":
          hero.current?.act("cheer");
          hero.current?.feel("happy", 1.6);
          break;
        case "lost":
          hero.current?.feel("sad", 4);
          break;
      }
    }
  });
  return null;
}

export function RunnerScene(props: RunnerSceneProps) {
  const { session, snapshot, frozen, booting, hud } = props;
  const reducedMotion = usePrefersReducedMotion();
  const hero = useRef<GameHeroHandle>(null);
  const round = snapshot.rounds[snapshot.roundIndex]?.round ?? null;
  const fork = snapshot.fork;
  const item = fork ? round?.items.find((candidate) => candidate.id === fork.itemId) : null;
  const lanes = fork?.lanes.length ?? 3;
  const { effects, addEffect, dropEffect } = useEffects();

  // The number signs appear once the arches are close enough to tell apart.
  const near = Boolean(fork && fork.progress >= 0.3);
  const labels: AnchoredLabel[] =
    fork && item && fork.taken === null && near
      ? fork.lanes.map((optionId, lane) => {
          const label = item.options.find((option) => option.id === optionId)?.label ?? "";
          const current = snapshot.lane === lane;
          return {
            id: lane + 1,
            priority: 10 - lane,
            selected: current,
            className: "game-label--arch",
            ariaLabel: props.describeArch(label, lane, current),
            onPick: () => props.onLane(lane),
            // Only the lane's number: two signs of words never fit side by
            // side at a distance, and the button of the same number and
            // colour below carries the option's words.
            content: (
              <span aria-hidden="true" style={{ background: binColour(lane) }}>
                {lane + 1}
              </span>
            ),
          } satisfies AnchoredLabel;
        })
      : [];
  const anchor = (id: number, out: THREE.Vector3) => {
    const s = session.getState();
    if (!s.fork || s.fork.taken !== null) return false;
    out.set(laneX(id - 1, s.fork.lanes.length), 2.05, forkZ(s));
    return true;
  };

  return (
    <SceneBoundary fail={props.onFailure}>
      <Stage
        cameraFrom={[0, 3.2, 5.6]}
        lookAt={[0, 0.5, -7]}
        cameraFar={120}
        paused={frozen && !booting}
        onSceneReady={props.onReady}
        onRendererUnavailable={props.onFailure}
        onContextLost={props.onFailure}
      >
        <color attach="background" args={[TOY.sky]} />
        <fog attach="fog" args={[TOY.sky, 18, 38]} />
        <ChaseCamera hud={hud} />
        <Clock session={session} frozen={frozen} />
        <ToyLighting />
        <Ground session={session} />
        <Arches
          key={`${snapshot.roundIndex}/${fork?.itemId ?? ""}`}
          session={session}
          lanes={lanes}
        />
        <Runner
          session={session}
          hero={hero}
          recipe={props.recipe ?? null}
          reducedMotion={reducedMotion}
          paused={frozen && !booting}
        />
        {effects.map((effect) => (
          <EffectView key={effect.key} effect={effect} done={dropEffect} />
        ))}
        <Director
          session={session}
          hero={hero}
          reducedMotion={reducedMotion}
          addEffect={addEffect}
        />
        <AnchoredLabels labels={labels} anchor={anchor} inset={hud} />
      </Stage>
    </SceneBoundary>
  );
}
