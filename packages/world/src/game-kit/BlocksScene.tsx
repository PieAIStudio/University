import type { AvatarRecipe } from "@pieai/swimmer-avatar-kit";
import { binColour } from "@pieai/university-ui/game-frame/palette.js";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";

import { Stage } from "../Stage.js";
import { usePrefersReducedMotion } from "../reduced-motion.js";
import { Block } from "../toy-play/parts.js";
import { TOY } from "../toy-play/style.js";
import { WELL_ROWS, type BlocksSession, type BlocksState } from "./rules/blocks.js";
import { AnchoredLabels, type AnchoredLabel } from "./scene/AnchoredLabels.js";
import { Courtyard } from "./scene/Courtyard.js";
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
 * 俄罗斯方块's scene: a toy cabinet standing on the courtyard lawn, one column
 * per bin with the bin's colour at its foot (ADR-0011). It reads the session
 * and never writes it, except to advance time; a tap on a column's sign asks
 * the session to move the block there.
 */
export interface BlocksSceneProps {
  readonly session: BlocksSession;
  readonly snapshot: BlocksState;
  readonly recipe?: AvatarRecipe | null;
  readonly frozen: boolean;
  readonly booting: boolean;
  readonly hud: HudInset;
  readonly describeColumn: (label: string, current: boolean) => string;
  readonly onColumn: (col: number) => void;
  readonly onReady: () => void;
  readonly onFailure: () => void;
}

const COL_W = 2.1;
const ROW_H = 0.52;
const BASE_Y = 0.55;
const WELL_Z = -1.6;
const TOP = BASE_Y + WELL_ROWS * ROW_H;
/** A low camera: the cabinet stands up, so it is seen from the front. */
const PITCH = THREE.MathUtils.degToRad(10);

const colX = (col: number, cols: number) => (col - (cols - 1) / 2) * COL_W;
const rowY = (row: number) => TOP - (row + 0.5) * ROW_H;
const colour = (index: number) => new THREE.Color(binColour(index)).getHex();

/**
 * A front view of the upright cabinet, fitted into the band under the question
 * banner. The shared floor-arena fit aims at the ground, which pushed the top
 * of an upright cabinet — and its column signs — under the banner.
 */
function BlocksCamera({ hud, cols }: { hud: HudInset; cols: number }) {
  const { camera, size } = useThree();
  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera) || !size.height) return;
    const aspect = size.width / size.height;
    const top = Math.min(0.45, (hud.top + 12) / size.height);
    const bottom = Math.min(0.2, (hud.bottom + 8) / size.height);
    const fov = 40;
    const tan = Math.tan(THREE.MathUtils.degToRad(fov / 2));
    // Cabinet with its signs above, and the hero beside it.
    const height = TOP + 1.3;
    const width = cols * COL_W + 3.2;
    const band = 1 - top - bottom;
    const distance = Math.max(height / (band * 2 * tan), width / (0.92 * 2 * tan * aspect));
    const visible = 2 * distance * tan;
    const centre = height / 2;
    // Put the cabinet's middle at the middle of the band, not of the canvas.
    const targetY = centre + ((top - bottom) * visible) / 2;
    const targetX = 0.9;
    camera.fov = fov;
    camera.position.set(
      targetX,
      targetY + distance * Math.sin(PITCH),
      WELL_Z + distance * Math.cos(PITCH),
    );
    camera.lookAt(targetX, targetY, WELL_Z);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height, hud.top, hud.bottom, cols]);
  return null;
}

function Cabinet({ cols }: { cols: number }) {
  const width = cols * COL_W;
  return (
    <group name="blocks-cabinet" position={[0, 0, WELL_Z]}>
      {/* Back board and plinth. */}
      <Block
        position={[0, TOP / 2 + 0.1, -0.42]}
        size={[width + 0.5, TOP + 0.4, 0.14]}
        color={TOY.cream}
      />
      <Block position={[0, 0.22, 0]} size={[width + 0.7, 0.44, 1.1]} color={TOY.bark} />
      {/* Posts between the columns and at the sides. */}
      {Array.from({ length: cols + 1 }, (_, i) => (
        <Block
          key={i}
          position={[-width / 2 + i * COL_W, TOP / 2 + 0.2, -0.1]}
          size={[0.14, TOP + 0.2, 0.62]}
          color={TOY.bark}
        />
      ))}
      <Block position={[0, TOP + 0.36, -0.1]} size={[width + 0.5, 0.2, 0.7]} color={TOY.coral} />
      {/* Each column's foot is its basket, in the bin's colour. */}
      {Array.from({ length: cols }, (_, col) => (
        <Block
          key={`b${col}`}
          position={[colX(col, cols), BASE_Y - 0.04, -0.1]}
          size={[COL_W - 0.2, 0.18, 0.56]}
          color={colour(col)}
        />
      ))}
    </group>
  );
}

function Bricks({ bricks }: { bricks: readonly number[] }) {
  return (
    <group name="blocks-bricks" position={[0, 0, WELL_Z]}>
      {bricks.flatMap((count, col) =>
        Array.from({ length: count }, (_, i) => (
          <Block
            key={`${col}/${i}`}
            position={[colX(col, bricks.length), rowY(WELL_ROWS - 1 - i), -0.1]}
            size={[COL_W - 0.3, ROW_H - 0.06, 0.5]}
            color={0xb9b2a6}
          />
        )),
      )}
    </group>
  );
}

function FallingBlock({
  session,
  reducedMotion,
}: {
  session: BlocksSession;
  reducedMotion: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  // Where it is drawn across; it starts in its own column, then glides.
  const x = useRef<number | null>(null);
  useFrame((_, delta) => {
    const node = group.current;
    if (!node) return;
    const s = session.getState();
    const block = s.block;
    node.visible = Boolean(block);
    if (!block) return;
    const cols = s.bricks.length;
    const target = colX(block.col, cols);
    x.current =
      x.current === null
        ? target
        : x.current + (target - x.current) * Math.min(1, delta * (reducedMotion ? 60 : 14));
    node.position.set(x.current, rowY(block.y), WELL_Z - 0.1);
    let scale = 1;
    if (block.landed?.right) scale = Math.max(0.01, 1 - block.landed.since / 0.5);
    node.scale.set(1, scale, 1);
  });
  const s = session.getState();
  const landed = s.block?.landed;
  return (
    <group ref={group} name="blocks-falling">
      <Block
        size={[COL_W - 0.3, ROW_H - 0.06, 0.5]}
        color={landed && !landed.right ? 0xb9b2a6 : TOY.cream}
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
  session: BlocksSession;
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
        case "move":
          hero.current?.look(new THREE.Vector3(colX(event.col, s.bricks.length), 2.5, WELL_Z));
          break;
        case "land": {
          const at = new THREE.Vector3(
            colX(event.col, s.bricks.length),
            BASE_Y + 0.6,
            WELL_Z + 0.3,
          );
          if (event.right) {
            hero.current?.act("hop");
            hero.current?.feel("happy", 0.8);
            if (!reducedMotion) addEffect({ kind: "stars", from: at });
          } else {
            hero.current?.act("flinch");
            hero.current?.feel("surprised", 0.9);
            if (!reducedMotion) addEffect({ kind: "puff", from: at });
          }
          break;
        }
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

export function BlocksScene(props: BlocksSceneProps) {
  const { session, snapshot, frozen, booting, hud } = props;
  const reducedMotion = usePrefersReducedMotion();
  const hero = useRef<GameHeroHandle>(null);
  const round = snapshot.rounds[snapshot.roundIndex]?.round ?? null;
  const bins = round?.bins ?? [];
  const cols = Math.max(2, bins.length);
  const { effects, addEffect, dropEffect } = useEffects();
  const heroAt = useMemo(() => [(cols * COL_W) / 2 + 1.1, 0.08, WELL_Z + 0.9] as const, [cols]);
  const block = snapshot.block;
  const item = block ? round?.items.find((candidate) => candidate.id === block.itemId) : null;

  const labels: AnchoredLabel[] = [
    ...bins.map((bin, col) => ({
      id: col + 1,
      priority: 5,
      className: "game-label--basket",
      selected: block?.col === col,
      ariaLabel: props.describeColumn(bin.label, block?.col === col),
      onPick: () => props.onColumn(col),
      ...(col === 0 ? { guide: "blocks-column" } : {}),
      content: bin.label,
    })),
    ...(item && block && !block.landed
      ? [{ id: 100, priority: 20, content: item.text } satisfies AnchoredLabel]
      : []),
  ];
  const anchor = (id: number, out: THREE.Vector3) => {
    const s = session.getState();
    if (id === 100) {
      const b = s.block;
      if (!b || b.landed) return false;
      out.set(colX(b.col, s.bricks.length), rowY(b.y) + 0.35, WELL_Z + 0.2);
      return true;
    }
    const col = id - 1;
    if (col >= s.bricks.length) return false;
    out.set(colX(col, s.bricks.length), TOP + 0.5, WELL_Z);
    return true;
  };

  return (
    <SceneBoundary fail={props.onFailure}>
      <Stage
        cameraFrom={[0, 4, 11]}
        lookAt={[0, 2.6, WELL_Z]}
        cameraFar={200}
        paused={frozen && !booting}
        onSceneReady={props.onReady}
        onRendererUnavailable={props.onFailure}
        onContextLost={props.onFailure}
      >
        <color attach="background" args={[TOY.sky]} />
        <BlocksCamera hud={hud} cols={cols} />
        <Clock session={session} frozen={frozen} />
        <Courtyard baskets={0} pond={false} />
        <Cabinet cols={cols} />
        <Bricks bricks={snapshot.bricks} />
        <FallingBlock key={block?.id ?? 0} session={session} reducedMotion={reducedMotion} />
        <GameHero
          ref={hero}
          position={heroAt}
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
