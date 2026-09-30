import type { AvatarRecipe } from "@pieai/swimmer-avatar-kit";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";

import { Stage } from "../Stage.js";
import { usePrefersReducedMotion } from "../reduced-motion.js";
import { Ball, Block, Disc } from "../toy-play/parts.js";
import { TOY } from "../toy-play/style.js";
import { DUCK_SECONDS, HOLES, MolesSession, RISE_SECONDS, type MolesState } from "./rules/moles.js";
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
 * 打地鼠's scene: six molehills on the courtyard lawn (ADR-0011). It reads the
 * session and never writes it, except to advance time; a whack reaches the
 * session through a mole's label or the mole itself.
 */
export interface MolesSceneProps {
  readonly session: MolesSession;
  readonly snapshot: MolesState;
  readonly recipe?: AvatarRecipe | null;
  readonly frozen: boolean;
  readonly booting: boolean;
  readonly hud: HudInset;
  readonly describeMole: (text: string) => string;
  readonly onWhack: (moleId: number) => void;
  readonly onReady: () => void;
  readonly onFailure: () => void;
}

const GROUND = 0.12;
/** Two rows of three, the near row a little wider so the far row shows between. */
export function holeSpots(): readonly { x: number; z: number }[] {
  const rows = [
    { z: -3.3, xs: [-2.5, 0, 2.5] },
    { z: -0.7, xs: [-2.9, 0, 2.9] },
  ];
  return rows.flatMap(({ z, xs }) => xs.map((x) => ({ x, z }))).slice(0, HOLES);
}

/** How far out of its hole a mole stands: 0 underground, 1 fully up. */
function heightOf(mole: MolesState["moles"][number]): number {
  if (mole.state === "ducking") return Math.max(0, 1 - mole.gone / DUCK_SECONDS);
  if (mole.state === "hit") return Math.max(0, 1 - mole.gone / 0.45) * 0.6;
  return Math.min(1, mole.age / RISE_SECONDS);
}

/** A soil ring with a dark hole in the middle: the hole must read from the camera. */
function Molehill() {
  return (
    <group>
      <Disc position={[0, 0.06, 0]} radius={0.62} height={0.14} color={TOY.soil} />
      <Ball position={[0, 0.12, 0]} size={[0.66, 0.12, 0.6]} color={TOY.soil} />
      <Disc position={[0, 0.2, 0]} radius={0.38} height={0.03} color={TOY.ink} />
    </group>
  );
}

function MoleView({
  id,
  session,
  onWhack,
}: {
  id: number;
  session: MolesSession;
  onWhack: (id: number) => void;
}) {
  const body = useRef<THREE.Group>(null);
  useFrame(() => {
    const node = body.current;
    if (!node) return;
    const mole = session.getState().moles.find((candidate) => candidate.id === id);
    node.visible = Boolean(mole);
    if (!mole) return;
    const h = heightOf(mole);
    node.position.y = GROUND - 0.55 + h * 0.62;
    // A hit squashes it flat before it sinks.
    node.scale.set(1, mole.state === "hit" ? 0.55 : 1, 1);
  });
  return (
    <group
      ref={body}
      name={`mole-${id}`}
      scale={1.45}
      onClick={(event) => {
        event.stopPropagation();
        onWhack(id);
      }}
    >
      <Ball position={[0, 0.3, 0]} size={[0.34, 0.4, 0.32]} color={TOY.bark} />
      <Ball position={[0, 0.26, 0.2]} size={[0.2, 0.24, 0.14]} color={TOY.cream} />
      <Ball position={[0, 0.44, 0.3]} size={[0.07, 0.06, 0.06]} color={TOY.coral} />
      {[-0.11, 0.11].map((x) => (
        <Ball key={x} position={[x, 0.53, 0.26]} size={[0.035, 0.045, 0.03]} color={TOY.ink} />
      ))}
      {[-0.26, 0.26].map((x) => (
        <Ball key={x} position={[x, 0.22, 0.14]} size={[0.09, 0.06, 0.1]} color={TOY.coral} />
      ))}
    </group>
  );
}

/** The toy mallet: drops onto a mole, bounces once, and is gone. */
function Mallet({ at }: { at: THREE.Vector3 }) {
  const group = useRef<THREE.Group>(null);
  const age = useRef(0);
  useFrame((_, delta) => {
    age.current += delta;
    const node = group.current;
    if (!node) return;
    const k = Math.min(1, age.current / 0.18);
    node.position.set(at.x + 0.35, at.y + 0.9 - 0.55 * k, at.z);
    node.rotation.z = 0.9 - 1.4 * k;
    node.visible = age.current < 0.55;
  });
  return (
    <group ref={group} name="mallet">
      <Block position={[0.25, 0, 0]} size={[0.5, 0.07, 0.07]} color={TOY.bark} />
      <Block position={[-0.05, 0, 0]} size={[0.2, 0.26, 0.26]} color={TOY.coral} />
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
  session: MolesSession;
  hero: RefObject<GameHeroHandle | null>;
  spots: readonly { x: number; z: number }[];
  reducedMotion: boolean;
  addEffect: (effect: Omit<Effect, "key">) => void;
}) {
  const seen = useRef(0);
  useFrame(() => {
    const s = session.getState();
    for (const event of s.events) {
      if (event.id <= seen.current) continue;
      seen.current = event.id;
      const mole = "moleId" in event ? s.moles.find((m) => m.id === event.moleId) : null;
      const spot = mole ? spots[mole.hole] : null;
      const at = spot ? new THREE.Vector3(spot.x, GROUND + 0.6, spot.z) : null;
      switch (event.kind) {
        case "pop":
          if (at) hero.current?.look(at);
          break;
        case "whack":
          hero.current?.act("throw", { speed: 1.8 });
          if (event.right) {
            hero.current?.feel("happy", 0.8);
            if (at && !reducedMotion) addEffect({ kind: "stars", from: at });
          } else {
            hero.current?.feel("surprised", 0.9);
            if (at && !reducedMotion) addEffect({ kind: "puff", from: at });
          }
          break;
        case "escaped":
          hero.current?.act("flinch");
          hero.current?.feel("sad", 1);
          if (at && !reducedMotion) addEffect({ kind: "splash", from: at });
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

export function MolesScene(props: MolesSceneProps) {
  const { session, snapshot, frozen, booting, hud } = props;
  const reducedMotion = usePrefersReducedMotion();
  const hero = useRef<GameHeroHandle>(null);
  const spots = useMemo(() => holeSpots(), []);
  const round = snapshot.rounds[snapshot.roundIndex]?.round ?? null;
  const { effects, addEffect, dropEffect } = useEffects();
  const roundKey = `${snapshot.roundIndex}/${round?.id ?? ""}`;
  const heroY = COURTYARD.terrace.top + 0.1;

  const labels: AnchoredLabel[] = snapshot.moles
    .filter((mole) => mole.state === "up")
    .flatMap((mole) => {
      const item = round?.items.find((candidate) => candidate.id === mole.itemId);
      if (!item) return [];
      return [
        {
          id: mole.id,
          priority: 10 - mole.age,
          ariaLabel: props.describeMole(item.text),
          onPick: () => props.onWhack(mole.id),
          content: item.text,
        } satisfies AnchoredLabel,
      ];
    });
  const anchor = (id: number, out: THREE.Vector3) => {
    const mole = session.getState().moles.find((candidate) => candidate.id === id);
    const spot = mole ? spots[mole.hole] : null;
    if (!mole || !spot || mole.state !== "up" || heightOf(mole) < 0.6) return false;
    out.set(spot.x, GROUND + 1.2, spot.z);
    return true;
  };
  const hits = snapshot.moles.filter((mole) => mole.state === "hit");

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
        <Courtyard baskets={0} pond={false} />
        {spots.map((spot, hole) => (
          <group key={hole} position={[spot.x, GROUND, spot.z]}>
            <Molehill />
          </group>
        ))}
        {snapshot.moles.map((mole) => {
          const spot = spots[mole.hole];
          return spot ? (
            <group key={`${roundKey}/${mole.id}`} position={[spot.x, 0, spot.z]}>
              <MoleView id={mole.id} session={session} onWhack={props.onWhack} />
            </group>
          ) : null;
        })}
        {!reducedMotion
          ? hits.map((mole) => {
              const spot = spots[mole.hole];
              return spot ? (
                <Mallet key={`m${mole.id}`} at={new THREE.Vector3(spot.x, GROUND + 0.3, spot.z)} />
              ) : null;
            })
          : null}
        <GameHero
          ref={hero}
          position={[COURTYARD.hero.x, heroY, COURTYARD.hero.z]}
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
          spots={spots}
          reducedMotion={reducedMotion}
          addEffect={addEffect}
        />
        <AnchoredLabels labels={labels} anchor={anchor} inset={hud} />
      </Stage>
    </SceneBoundary>
  );
}
