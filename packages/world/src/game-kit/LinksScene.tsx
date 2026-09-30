import type { AvatarRecipe } from "@pieai/swimmer-avatar-kit";
import type { LinkRound } from "@pieai/university-core";
import { binColour } from "@pieai/university-ui/game-frame/palette.js";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";

import { Stage } from "../Stage.js";
import { usePrefersReducedMotion } from "../reduced-motion.js";
import { Ball as ToyBall, Block, Bridge, Disc } from "../toy-play/parts.js";
import { TOY } from "../toy-play/style.js";
import type { LinksSession, LinksState } from "./rules/links.js";
import { AnchoredLabels, type AnchoredLabel } from "./scene/AnchoredLabels.js";
import { COURTYARD, Courtyard, courtyardBox } from "./scene/Courtyard.js";
import { GameHero, type GameHeroHandle } from "./scene/GameHero.js";
import {
  Clock,
  EffectView,
  Framing,
  SceneBoundary,
  useEffects,
  type Effect,
  type HudInset,
} from "./scene/stage-parts.js";

/**
 * 连连看's scene: stepping stones in the courtyard pond (ADR-0011). It reads
 * the session and never writes it, except to advance time; a pick reaches the
 * session through a stone's label or the stone itself.
 */
export interface LinksSceneProps {
  readonly session: LinksSession;
  readonly snapshot: LinksState;
  readonly recipe?: AvatarRecipe | null;
  readonly frozen: boolean;
  readonly booting: boolean;
  readonly hud: HudInset;
  /** What a stone's label says to a screen reader. */
  readonly describeStone: (label: string, picked: boolean, done: boolean) => string;
  readonly onPick: (nodeId: string) => void;
  readonly onReady: () => void;
  readonly onFailure: () => void;
}

const STONE_SIDE = 0xcdbb9c;
const STONE_TOP = 0xf1e4c8;
const STONE_Y = COURTYARD.pond.surface + 0.02;
/** How far the stones settle as the tide runs out. */
const TIDE_SINK = 0.16;

/** Where each stone of a round stands in the pond, row by row, rows centred. */
export function stoneSpots(count: number): readonly { x: number; z: number }[] {
  const cols = count <= 4 ? 2 : 3;
  const rows = Math.ceil(count / cols);
  const gap = cols === 2 ? 3.6 : 2.7;
  const zs = rows === 1 ? [-1.6] : rows === 2 ? [-3.1, -0.1] : [-3.9, -1.6, 0.7];
  const spots: { x: number; z: number }[] = [];
  for (let row = 0; row < rows; row += 1) {
    const inRow = Math.min(cols, count - row * cols);
    // A small stagger, so labels in one column do not stack into a wall.
    const stagger = row % 2 ? 0.45 : -0.2;
    for (let col = 0; col < inRow; col += 1)
      spots.push({ x: (col - (inRow - 1) / 2) * gap + stagger, z: zs[row]! });
  }
  return spots;
}

function useSpots(round: LinkRound | null, snapshot: LinksState) {
  return useMemo(() => {
    const spots = stoneSpots(round?.nodes.length ?? 0);
    const at = new Map<string, THREE.Vector3>();
    for (const stone of snapshot.stones) {
      const spot = spots[stone.slot];
      if (spot) at.set(stone.id, new THREE.Vector3(spot.x, STONE_Y, spot.z));
    }
    return at;
    // Slots change only when a new round is set up.
  }, [round?.id, snapshot.roundIndex, snapshot.stones.map((s) => `${s.id}:${s.slot}`).join()]);
}

/** Tide as a fraction: 1 just refilled, 0 about to take a link. */
const tideOf = (state: Readonly<LinksState>) =>
  state.open.length && state.window > 0 ? Math.max(0, state.tide / state.window) : 1;

function StoneView({
  id,
  at,
  session,
  reducedMotion,
  onPick,
}: {
  id: string;
  at: THREE.Vector3;
  session: LinksSession;
  reducedMotion: boolean;
  onPick: (nodeId: string) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const phase = useMemo(() => (at.x * 1.7 + at.z * 0.9) % (Math.PI * 2), [at]);
  const state = session.getState();
  const stone = state.stones.find((candidate) => candidate.id === id);
  const picked = state.picked === id;
  useFrame(() => {
    const node = group.current;
    if (!node) return;
    const s = session.getState();
    const tide = tideOf(s);
    const t = s.elapsed;
    const low = tide < 0.25 && !reducedMotion ? Math.sin(t * 18 + phase) * 0.012 : 0;
    const bob = reducedMotion ? 0 : Math.sin(t * 1.8 + phase) * 0.015;
    const lift = s.picked === id ? 0.1 : 0;
    node.position.set(at.x, STONE_Y - TIDE_SINK * (1 - tide) + bob + low + lift, at.z);
  });
  return (
    <group
      ref={group}
      name={`link-stone-${id}`}
      onClick={(event) => {
        event.stopPropagation();
        onPick(id);
      }}
    >
      {picked ? (
        <Disc position={[0, 0.02, 0]} radius={0.78} height={0.04} color={TOY.gold} />
      ) : null}
      <Disc position={[0, 0.05, 0]} radius={0.62} height={0.22} color={STONE_SIDE} />
      <Disc
        position={[0, 0.17, 0]}
        radius={0.56}
        height={0.05}
        color={stone?.done ? TOY.leafLight : picked ? TOY.gold : STONE_TOP}
      />
    </group>
  );
}

/** The plank bridge between two stones, growing from the first toward the second. */
function BridgeView({
  from,
  to,
  how,
  reducedMotion,
}: {
  from: THREE.Vector3;
  to: THREE.Vector3;
  how: LinksState["bridges"][number]["how"];
  reducedMotion: boolean;
}) {
  const grow = useRef<THREE.Group>(null);
  const age = useRef(how === "given" || reducedMotion ? 1 : 0);
  const dx = to.x - from.x,
    dz = to.z - from.z;
  const distance = Math.hypot(dx, dz);
  const length = Math.max(0.4, distance - 1.1);
  const angle = Math.atan2(dx, dz);
  const mid = useMemo(
    () => new THREE.Vector3((from.x + to.x) / 2, 0, (from.z + to.z) / 2),
    [from, to],
  );
  useFrame((_, delta) => {
    age.current = Math.min(1, age.current + delta / 0.35);
    const node = grow.current;
    if (!node) return;
    const k = 1 - (1 - age.current) ** 3;
    node.scale.set(1, 1, Math.max(0.001, k));
    node.position.z = (-length / 2) * (1 - k);
  });
  const escaped = how === "escaped";
  return (
    <group position={[mid.x, STONE_Y + 0.12, mid.z]} rotation-y={angle} name="link-bridge">
      <group ref={grow}>
        {escaped ? (
          // The tide laid a rope, not a bridge: it stands, but nobody built it.
          <Block position={[0, 0.02, 0]} size={[0.06, 0.06, length]} color={TOY.ink} />
        ) : (
          <group scale={[0.55, 0.55, 1]}>
            <Bridge x={0} z={0} length={length} />
          </group>
        )}
      </group>
      {/* A chevron on the planks keeps the lesson's direction readable. */}
      {[-1, 1].map((side) => (
        <Block
          key={side}
          position={[side * 0.07, escaped ? 0.1 : 0.2, 0]}
          size={[0.06, 0.05, 0.26]}
          rotation={side * 0.62}
          color={escaped ? TOY.ink : TOY.coral}
        />
      ))}
    </group>
  );
}

/** A marble that walks the finished picture along the lesson's probe. */
function ProbeView({ path }: { path: readonly THREE.Vector3[] }) {
  const group = useRef<THREE.Group>(null);
  const age = useRef(0);
  useFrame((_, delta) => {
    age.current += delta;
    const node = group.current;
    if (!node || path.length < 2) return;
    const legs = path.length - 1;
    const k = Math.min(1, age.current / 1.5) * legs;
    const leg = Math.min(legs - 1, Math.floor(k));
    const t = k - leg;
    node.position.lerpVectors(path[leg]!, path[leg + 1]!, t);
    node.position.y = STONE_Y + 0.45 + Math.sin(Math.PI * t) * 0.35;
    node.visible = age.current < 1.8;
  });
  return (
    <group ref={group} name="link-probe">
      <ToyBall position={[0, 0, 0]} size={[0.16, 0.16, 0.16]} color={TOY.gold} />
    </group>
  );
}

function Director({
  session,
  hero,
  spots,
  reducedMotion,
  addEffect,
}: {
  session: LinksSession;
  hero: RefObject<GameHeroHandle | null>;
  spots: Map<string, THREE.Vector3>;
  reducedMotion: boolean;
  addEffect: (effect: Omit<Effect, "key">) => void;
}) {
  const seen = useRef(0);
  useFrame(() => {
    const state = session.getState();
    const lift = (point: THREE.Vector3 | undefined) =>
      point ? point.clone().setY(STONE_Y + 0.4) : null;
    const middle = (edgeId: string) => {
      const edge = session.edgeOf(edgeId);
      const a = edge && spots.get(edge.from);
      const b = edge && spots.get(edge.to);
      return a && b
        ? a
            .clone()
            .lerp(b, 0.5)
            .setY(STONE_Y + 0.4)
        : null;
    };
    for (const event of state.events) {
      if (event.id <= seen.current) continue;
      seen.current = event.id;
      switch (event.kind) {
        case "pick":
          hero.current?.look(lift(spots.get(event.nodeId)));
          break;
        case "link": {
          const at = middle(event.edgeId);
          if (at) hero.current?.look(at);
          hero.current?.act("hop");
          hero.current?.feel("happy", 0.8);
          if (at && !reducedMotion) addEffect({ kind: "stars", from: at });
          break;
        }
        case "wrong":
          hero.current?.act("flinch");
          hero.current?.feel("surprised", 0.9);
          for (const id of [event.from, event.to]) {
            const at = lift(spots.get(id));
            if (at && !reducedMotion) addEffect({ kind: "puff", from: at });
          }
          break;
        case "escaped": {
          hero.current?.act("flinch");
          hero.current?.feel("sad", 1);
          const at = middle(event.edgeId);
          if (at && !reducedMotion) addEffect({ kind: "splash", from: at });
          break;
        }
        case "linked":
          hero.current?.look(null);
          hero.current?.act("cheer");
          hero.current?.feel("happy", 1.6);
          break;
        case "round-clear":
        case "won":
          hero.current?.look(null);
          hero.current?.act("cheer");
          hero.current?.feel("happy", 1.6);
          break;
        case "lost":
          hero.current?.look(null);
          hero.current?.feel("sad", 4);
          break;
      }
    }
  });
  return null;
}

export function LinksScene(props: LinksSceneProps) {
  const { session, snapshot, frozen, booting, hud } = props;
  const reducedMotion = usePrefersReducedMotion();
  const hero = useRef<GameHeroHandle>(null);
  const round = snapshot.rounds[snapshot.roundIndex]?.round ?? null;
  const spots = useSpots(round, snapshot);
  const { effects, addEffect, dropEffect } = useEffects();
  const probePath = useMemo(() => {
    const path = round?.probes[0] ?? [];
    return path.flatMap((id) => {
      const at = spots.get(id);
      return at ? [at] : [];
    });
  }, [round, spots]);
  const roundKey = `${snapshot.roundIndex}/${round?.id ?? ""}`;
  const heroY = COURTYARD.terrace.top + 0.1;

  // Pairs shown after a mistake carry the same numbered tag on both stones.
  const shown = new Map<string, number[]>();
  snapshot.revealed
    .filter((edgeId) => snapshot.open.includes(edgeId))
    .forEach((edgeId, index) => {
      const edge = round?.items.find((candidate) => candidate.id === edgeId);
      if (!edge) return;
      for (const id of [edge.from, edge.to]) shown.set(id, [...(shown.get(id) ?? []), index]);
    });

  const ids = new Map(round?.nodes.map((node, index) => [node.id, index + 1]) ?? []);
  const labels: AnchoredLabel[] = (round?.nodes ?? []).map((node) => {
    const stone = snapshot.stones.find((candidate) => candidate.id === node.id);
    const done = Boolean(stone?.done);
    const picked = snapshot.picked === node.id;
    const tags = shown.get(node.id) ?? [];
    return {
      id: ids.get(node.id)!,
      priority: picked ? 20 : done ? 1 : 10,
      selected: picked,
      className: done ? "game-label--done" : undefined,
      ariaLabel: props.describeStone(node.label, picked, done),
      // The first stone is where a first-use guide asks for a first pick.
      ...(node.id === round?.nodes[0]?.id ? { guide: "links-stone" } : {}),
      ...(done ? {} : { onPick: () => props.onPick(node.id) }),
      content: (
        <>
          {node.label}
          {tags.map((tag) => (
            <small key={tag} className="game-label__pair" style={{ background: binColour(tag) }}>
              {tag + 1}
            </small>
          ))}
        </>
      ),
    } satisfies AnchoredLabel;
  });
  const byLabel = new Map([...ids].map(([nodeId, labelId]) => [labelId, nodeId]));
  const anchor = (id: number, out: THREE.Vector3) => {
    const at = spots.get(byLabel.get(id) ?? "");
    if (!at) return false;
    // Labels hold still while the stones sink and bob: a word that drifts
    // under a finger is a target, and this game's judgement is not aiming.
    out.set(at.x, STONE_Y + 0.75, at.z);
    return true;
  };

  return (
    <SceneBoundary fail={props.onFailure}>
      <Stage
        cameraFrom={[0, 12, 13]}
        lookAt={[0, 0, -0.5]}
        cameraFar={200}
        paused={frozen && !booting}
        onSceneReady={props.onReady}
        onRendererUnavailable={props.onFailure}
        onContextLost={props.onFailure}
      >
        <color attach="background" args={[TOY.sky]} />
        <Framing hud={hud} box={courtyardBox} />
        <Clock session={session} frozen={frozen} />
        <Courtyard baskets={0} />
        <GameHero
          ref={hero}
          position={[COURTYARD.hero.x, heroY, COURTYARD.hero.z]}
          recipe={props.recipe ?? null}
          reducedMotion={reducedMotion}
          paused={frozen && !booting}
        />
        {snapshot.stones.map((stone) => {
          const at = spots.get(stone.id);
          return at ? (
            <StoneView
              key={`${roundKey}/${stone.id}`}
              id={stone.id}
              at={at}
              session={session}
              reducedMotion={reducedMotion}
              onPick={props.onPick}
            />
          ) : null;
        })}
        {snapshot.bridges.map((bridge) => {
          const edge = round?.items.find((candidate) => candidate.id === bridge.edgeId);
          const from = edge && spots.get(edge.from);
          const to = edge && spots.get(edge.to);
          return from && to ? (
            <BridgeView
              key={`${roundKey}/${bridge.edgeId}`}
              from={from}
              to={to}
              how={bridge.how}
              reducedMotion={reducedMotion}
            />
          ) : null;
        })}
        {/* The finished picture's moment: the marble walks the lesson's probe. */}
        {!snapshot.open.length && snapshot.settle > 0 && probePath.length >= 2 && !reducedMotion ? (
          <ProbeView key={roundKey} path={probePath} />
        ) : null}
        {effects.map((effect) => (
          <EffectView key={effect.key} effect={effect} done={dropEffect} />
        ))}
        <Director
          session={session}
          hero={hero}
          spots={spots}
          reducedMotion={reducedMotion}
          addEffect={addEffect}
        />
        <AnchoredLabels labels={labels} anchor={anchor} inset={hud} />
      </Stage>
    </SceneBoundary>
  );
}
