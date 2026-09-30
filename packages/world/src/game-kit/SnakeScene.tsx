import type { AvatarRecipe } from "@pieai/swimmer-avatar-kit";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";

import { Stage } from "../Stage.js";
import { usePrefersReducedMotion } from "../reduced-motion.js";
import { Block, Disc, Parcel } from "../toy-play/parts.js";
import { TOY } from "../toy-play/style.js";
import { LAWN, type Cell, type SnakeSession, type SnakeState } from "./rules/snake.js";
import { AnchoredLabels, type AnchoredLabel } from "./scene/AnchoredLabels.js";
import { Courtyard } from "./scene/Courtyard.js";
import { GameHero, type GameHeroHandle } from "./scene/GameHero.js";
import { LAWN_TOP, Lawn, lawnBox, lawnCell } from "./scene/Lawn.js";
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
 * 贪吃蛇's scene: the courtyard with a garden bed for a lawn (ADR-0011). The
 * learner's avatar leads; each right bite adds a wagon behind it. It reads
 * the session and never writes it, except to advance time; a tap on a crate
 * asks the session to steer there.
 */
export interface SnakeSceneProps {
  readonly session: SnakeSession;
  readonly snapshot: SnakeState;
  readonly recipe?: AvatarRecipe | null;
  readonly frozen: boolean;
  readonly booting: boolean;
  readonly hud: HudInset;
  readonly describeCrate: (text: string, next: boolean, aimed: boolean) => string;
  readonly onAim: (pieceId: string) => void;
  readonly onReady: () => void;
  readonly onFailure: () => void;
}

const WAGON_COLOURS = TOY.channels;
const box = () => lawnBox(LAWN);
const world = (cell: Cell) => lawnCell(cell.c, cell.r, LAWN);

/** Where segment `index` stands this frame, gliding from its last cell. */
function segmentAt(state: Readonly<SnakeState>, index: number, out: THREE.Vector3) {
  const from = world(state.prev[index] ?? state.body[index]!);
  const to = world(state.body[index]!);
  const k = state.stride > 0 ? Math.min(1, state.moving / state.stride) : 1;
  // Across the lawn only; a jump (a wagon added on the tail) is not a glide.
  const jump = Math.abs(from.x - to.x) + Math.abs(from.z - to.z) > 1;
  out.set(
    jump ? to.x : from.x + (to.x - from.x) * k,
    LAWN_TOP,
    jump ? to.z : from.z + (to.z - from.z) * k,
  );
  return out;
}

function Leader({
  session,
  hero,
  recipe,
  reducedMotion,
  paused,
}: {
  session: SnakeSession;
  hero: RefObject<GameHeroHandle | null>;
  recipe: AvatarRecipe | null;
  reducedMotion: boolean;
  paused: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const at = useMemo(() => new THREE.Vector3(), []);
  const ahead = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const node = group.current;
    if (!node) return;
    const s = session.getState();
    segmentAt(s, 0, at);
    node.position.copy(at);
    const step = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[s.dir];
    ahead.set(at.x + step[0]! * 2, at.y + 0.6, at.z + step[1]! * 2);
    hero.current?.look(ahead);
  });
  return (
    <group ref={group} name="snake-leader">
      <GameHero
        ref={hero}
        position={[0, 0, 0]}
        recipe={recipe}
        height={1.2}
        reducedMotion={reducedMotion}
        paused={paused}
      />
    </group>
  );
}

function Wagon({ index, session }: { index: number; session: SnakeSession }) {
  const group = useRef<THREE.Group>(null);
  const at = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const node = group.current;
    if (!node) return;
    const s = session.getState();
    node.visible = index < s.body.length;
    if (!node.visible) return;
    segmentAt(s, index, at);
    node.position.copy(at);
    const ahead = s.body[index - 1];
    if (ahead) {
      const target = world(ahead);
      node.rotation.y = Math.atan2(target.x - at.x, target.z - at.z);
    }
  });
  const colour = WAGON_COLOURS[(index - 1) % WAGON_COLOURS.length]!;
  return (
    <group ref={group} name={`snake-wagon-${index}`}>
      <Block position={[0, 0.2, 0]} size={[0.42, 0.26, 0.5]} color={TOY.cream} />
      <Block position={[0, 0.36, 0]} size={[0.46, 0.07, 0.54]} color={colour} />
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.23, 0.09, 0]} rotation={[0, 0, Math.PI / 2]}>
          <Disc position={[0, 0, 0.14]} radius={0.08} height={0.05} color={TOY.ink} />
          <Disc position={[0, 0, -0.14]} radius={0.08} height={0.05} color={TOY.ink} />
        </group>
      ))}
    </group>
  );
}

function CrateView({ id, session, next }: { id: string; session: SnakeSession; next: boolean }) {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    const node = group.current;
    if (!node) return;
    const crate = session.getState().crates.find((candidate) => candidate.id === id);
    node.visible = Boolean(crate);
    if (!crate) return;
    const { x, z } = world(crate);
    node.position.set(x, LAWN_TOP + 0.21, z);
  });
  return (
    <group ref={group} name={`snake-crate-${id}`} scale={0.62}>
      <Parcel color={TOY.cream} selected={next} />
    </group>
  );
}

function Director({
  session,
  hero,
  reducedMotion,
  addEffect,
}: {
  session: SnakeSession;
  hero: RefObject<GameHeroHandle | null>;
  reducedMotion: boolean;
  addEffect: (effect: Omit<Effect, "key">) => void;
}) {
  const seen = useRef(0);
  const head = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const s = session.getState();
    for (const event of s.events) {
      if (event.id <= seen.current) continue;
      seen.current = event.id;
      segmentAt(s, 0, head);
      const at = head.clone().setY(LAWN_TOP + 0.7);
      switch (event.kind) {
        case "bite":
          hero.current?.act("hop");
          hero.current?.feel("happy", 0.7);
          if (!reducedMotion) addEffect({ kind: "stars", from: at });
          break;
        case "wrong":
          hero.current?.act("flinch");
          hero.current?.feel("surprised", 0.9);
          if (!reducedMotion) addEffect({ kind: "puff", from: at });
          break;
        case "escaped":
          hero.current?.feel("sad", 1);
          if (!reducedMotion) addEffect({ kind: "splash", from: at });
          break;
        case "complete":
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

export function SnakeScene(props: SnakeSceneProps) {
  const { session, snapshot, frozen, booting, hud } = props;
  const reducedMotion = usePrefersReducedMotion();
  const hero = useRef<GameHeroHandle>(null);
  const round = snapshot.rounds[snapshot.roundIndex]?.round ?? null;
  const { effects, addEffect, dropEffect } = useEffects();
  const roundKey = `${snapshot.roundIndex}/${round?.id ?? ""}`;
  const ids = new Map(round?.items.map((piece, index) => [piece.id, index + 1]) ?? []);
  const byLabel = new Map([...ids].map(([pieceId, labelId]) => [labelId, pieceId]));

  const labels: AnchoredLabel[] = snapshot.crates.flatMap((crate) => {
    const piece = round?.items.find((candidate) => candidate.id === crate.id);
    if (!piece) return [];
    const next = snapshot.revealed.includes(crate.id);
    const aimed = snapshot.aim === crate.id;
    return [
      {
        id: ids.get(crate.id)!,
        priority: aimed ? 20 : 10,
        selected: aimed,
        ...(next ? { className: "game-label--next" } : {}),
        ariaLabel: props.describeCrate(piece.text, next, aimed),
        ...(crate.id === snapshot.crates[0]?.id ? { guide: "snake-crate" } : {}),
        onPick: () => props.onAim(crate.id),
        content: piece.text,
      } satisfies AnchoredLabel,
    ];
  });
  const anchor = (id: number, out: THREE.Vector3) => {
    const crate = session.getState().crates.find((candidate) => candidate.id === byLabel.get(id));
    if (!crate) return false;
    const { x, z } = world(crate);
    out.set(x, LAWN_TOP + 0.75, z);
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
        <Framing hud={hud} box={box} />
        <Clock session={session} frozen={frozen} />
        <Courtyard baskets={0} pond={false} />
        <Lawn cols={LAWN.cols} rows={LAWN.rows} />
        <Leader
          session={session}
          hero={hero}
          recipe={props.recipe ?? null}
          reducedMotion={reducedMotion}
          paused={frozen && !booting}
        />
        {Array.from({ length: Math.max(0, snapshot.body.length - 1) }, (_, i) => (
          <Wagon key={`${roundKey}/${i + 1}`} index={i + 1} session={session} />
        ))}
        {snapshot.crates.map((crate) => (
          <CrateView
            key={`${roundKey}/${crate.id}`}
            id={crate.id}
            session={session}
            next={snapshot.revealed.includes(crate.id) || snapshot.aim === crate.id}
          />
        ))}
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
