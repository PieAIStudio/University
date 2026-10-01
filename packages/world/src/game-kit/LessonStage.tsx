import type { LessonStageCue } from "@pieai/university-core";
import type { AvatarRecipe } from "@pieai/swimmer-avatar-kit";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";

import { Stage } from "../Stage.js";
import { Ball, Block, Disc } from "../toy-play/parts.js";
import { TOY } from "../toy-play/style.js";
import { AnchoredLabels, type AnchoredLabel } from "./scene/AnchoredLabels.js";
import { basketSpots, COURTYARD, Courtyard, courtyardBox } from "./scene/Courtyard.js";
import { GameHero, type GameHeroHandle } from "./scene/GameHero.js";
import { Basket } from "./scene/props.js";
import { EffectView, Framing, SceneBoundary, useEffects } from "./scene/stage-parts.js";

/**
 * A step lesson's stage (V7 amendment one): the courtyard the island games
 * use, with the learner's avatar on the terrace and the AI as a lighthouse in
 * the pond. The reader says where the lesson is; this follows and never makes
 * the lesson wait. The only words here are one- to six-character DOM labels.
 *
 * Each action has its prop: a sort's baskets catch what the avatar throws, a
 * build's wagons queue on the terrace and leave when the request is right, and
 * Make has a workbench where the finished piece is set up.
 */
export interface LessonStageProps {
  readonly cue: LessonStageCue;
  readonly recipe?: AvatarRecipe | null;
  /** The stage cannot draw: the host shows its still instead. */
  readonly onFailure: () => void;
  readonly onReady?: () => void;
  /** The lighthouse's label, in the lesson's language. */
  readonly aiLabel: string;
}

const HERO = new THREE.Vector3(COURTYARD.hero.x, COURTYARD.terrace.top + 0.1, COURTYARD.hero.z);
const HAND = HERO.clone().add(new THREE.Vector3(0.2, 1.3, 0));
const LIGHTHOUSE = new THREE.Vector3(2.3, COURTYARD.pond.surface, -3.2);
const LIGHT_TOP = LIGHTHOUSE.clone().add(new THREE.Vector3(0, 2.25, 0));
const BENCH = new THREE.Vector3(-2.7, COURTYARD.terrace.top, 2.4);
const TRACK_Z = 4.05;
const NO_HUD = { top: 0, bottom: 0 } as const;
const LABEL_AI = 1;
const LABEL_THINKING = 2;

/**
 * Where a bin's basket stands and what colour it is. Two bins follow the flat
 * buttons under the stage: the first bin is the right-hand, green button.
 */
function binBaskets(count: number): readonly { x: number; z: number; colour: number }[] {
  const spots = basketSpots(count);
  if (count === 2)
    return [
      { ...spots[1]!, colour: TOY.mint },
      { ...spots[0]!, colour: TOY.coral },
    ];
  return spots.map((spot, i) => ({ ...spot, colour: TOY.channels[i % TOY.channels.length]! }));
}

function Lighthouse() {
  // Stripes and a lit lamp, standing on a rock in the pond.
  return (
    <group name="lesson-lighthouse" position={LIGHTHOUSE}>
      <Disc position={[0, 0.08, 0]} radius={0.62} height={0.22} color={TOY.cream} />
      {[0, 1, 2, 3].map((i) => (
        <Disc
          key={i}
          position={[0, 0.38 + i * 0.36, 0]}
          radius={0.36 - i * 0.04}
          height={0.36}
          color={i % 2 ? TOY.cream : TOY.coral}
        />
      ))}
      <Disc position={[0, 1.86, 0]} radius={0.3} height={0.12} color={TOY.ink} />
      <Ball position={[0, 2.05, 0]} size={[0.22, 0.22, 0.22]} color={TOY.gold} />
    </group>
  );
}

/** A folded note that flies from the avatar's hand to the lamp once per send. */
function PaperPlane({ onLanded }: { onLanded: () => void }) {
  const group = useRef<THREE.Group>(null);
  const age = useRef(0);
  const landed = useRef(false);
  useFrame((_, delta) => {
    const node = group.current;
    if (!node) return;
    age.current += delta;
    const k = Math.min(1, age.current / 1.1);
    node.position.lerpVectors(HAND, LIGHT_TOP, k);
    node.position.y += Math.sin(Math.PI * k) * 1.4;
    node.lookAt(LIGHT_TOP);
    if (k >= 1 && !landed.current) {
      landed.current = true;
      onLanded();
    }
  });
  return (
    <group ref={group} name="lesson-paper-plane">
      <Block position={[0.07, 0, 0]} size={[0.14, 0.02, 0.42]} color={TOY.cream} />
      <Block position={[-0.07, 0, 0]} size={[0.14, 0.02, 0.42]} color={0xf6e2bb} />
    </group>
  );
}

/** The request being built, as a little train on the terrace's front edge. */
function Train({ wagons, departing }: { wagons: number; departing: boolean }) {
  const group = useRef<THREE.Group>(null);
  const x = useRef(-3.2);
  useFrame((_, delta) => {
    const node = group.current;
    if (!node) return;
    if (departing) x.current += delta * 4.5;
    node.position.x = x.current;
  });
  return (
    <group ref={group} name="lesson-train" position={[-3.2, COURTYARD.terrace.top, TRACK_Z]}>
      <Block position={[0, 0.3, 0]} size={[0.62, 0.42, 0.42]} color={TOY.coral} />
      <Disc position={[0.14, 0.62, 0]} radius={0.08} height={0.26} color={TOY.ink} />
      {Array.from({ length: Math.min(6, wagons) }, (_, i) => (
        <Block
          key={i}
          position={[-0.62 - i * 0.56, 0.26, 0]}
          size={[0.48, 0.34, 0.4]}
          color={TOY.channels[i % TOY.channels.length]!}
        />
      ))}
    </group>
  );
}

/** Make's workbench; the finished piece stands up on it once it passes. */
function Workbench({ finished }: { finished: boolean }) {
  const piece = useRef<THREE.Group>(null);
  const grow = useRef(0);
  useFrame((_, delta) => {
    grow.current = finished ? Math.min(1, grow.current + delta * 3) : 0;
    piece.current?.scale.setScalar(Math.max(0.001, grow.current));
  });
  return (
    <group name="lesson-workbench" position={BENCH}>
      <Block position={[0, 0.4, 0]} size={[1.3, 0.12, 0.7]} color={TOY.bark} />
      {[-0.55, 0.55].map((x) => (
        <Block key={x} position={[x, 0.18, 0]} size={[0.1, 0.36, 0.6]} color={TOY.bark} />
      ))}
      <Block position={[0.35, 0.5, 0.12]} size={[0.32, 0.06, 0.1]} color={TOY.ink} />
      <group ref={piece} position={[-0.15, 0.62, 0]}>
        <Block size={[0.5, 0.36, 0.04]} color={TOY.gold} />
      </group>
    </group>
  );
}

/** Answers each settled action and each new scene with the avatar's own moves. */
function Director({
  cue,
  hero,
  fly,
  throwTo,
  cheer,
}: {
  cue: LessonStageCue;
  hero: RefObject<GameHeroHandle | null>;
  fly: () => void;
  throwTo: (bin: number) => void;
  cheer: () => void;
}) {
  const lastBeat = useRef(cue.beat);
  const lastScene = useRef<string | null>(null);
  useEffect(() => {
    const key = `${cue.scene}/${cue.action ?? ""}`;
    if (lastScene.current === key) return;
    lastScene.current = key;
    const avatar = hero.current;
    if (!avatar) return;
    if (cue.scene === "intro") avatar.act("hop");
    if (cue.action === "send") avatar.look(LIGHTHOUSE);
    else if (cue.scene === "make") avatar.look(BENCH);
    else avatar.look(null);
    if (cue.scene === "finish") {
      avatar.act("cheer");
      avatar.feel("happy", 1.6);
      cheer();
    }
  }, [cue.scene, cue.action, hero, cheer]);
  useEffect(() => {
    if (cue.beat === lastBeat.current) return;
    lastBeat.current = cue.beat;
    const avatar = hero.current;
    if (!avatar) return;
    if (cue.verdict === "no") {
      avatar.act("flinch");
      avatar.feel("sad");
    } else if (cue.bin !== undefined) {
      avatar.act("throw");
      throwTo(cue.bin);
    } else if (cue.action === "send") {
      avatar.act("throw");
      fly();
    } else {
      avatar.act("cheer");
      avatar.feel("happy");
      if (cue.action === "make") cheer();
    }
  }, [cue.beat, cue.verdict, cue.action, cue.bin, hero, fly, throwTo, cheer]);
  return null;
}

export function LessonStage({ cue, recipe, onFailure, onReady, aiLabel }: LessonStageProps) {
  const hero = useRef<GameHeroHandle>(null);
  const { effects, addEffect, dropEffect } = useEffects();
  const [flights, setFlights] = useState<number[]>([]);
  const serial = useRef(0);
  const baskets = useMemo(() => (cue.bins ? binBaskets(cue.bins) : []), [cue.bins]);
  const [caught, setCaught] = useState<number[]>([]);
  // A new sort starts with empty baskets.
  useEffect(() => setCaught([]), [cue.bins, cue.scene]);
  const fly = useMemo(() => () => setFlights((list) => [...list.slice(-2), ++serial.current]), []);
  const cheer = useMemo(
    () => () => addEffect({ kind: "stars", from: HERO.clone().add(new THREE.Vector3(0, 1.8, 0)) }),
    [addEffect],
  );
  const throwTo = useMemo(
    () => (bin: number) => {
      const spot = baskets[bin];
      if (!spot) return;
      addEffect({
        kind: "note",
        from: HAND.clone(),
        to: new THREE.Vector3(spot.x, COURTYARD.terrace.top + 0.6, spot.z),
      });
      setCaught((list) => {
        const next = [...list];
        next[bin] = (next[bin] ?? 0) + 1;
        return next;
      });
    },
    [addEffect, baskets],
  );
  const building = cue.action === "build";
  const departing = building && cue.verdict === "ok";
  const labels: AnchoredLabel[] = [
    { id: LABEL_AI, content: aiLabel, className: "lesson-stage__label", priority: 2 },
    ...(cue.scene === "predict"
      ? [{ id: LABEL_THINKING, content: "?", className: "lesson-stage__label", priority: 1 }]
      : []),
  ];
  const anchor = (id: number, out: THREE.Vector3) => {
    if (id === LABEL_AI) out.copy(LIGHT_TOP).add(new THREE.Vector3(0, 0.45, 0));
    else out.copy(HERO).add(new THREE.Vector3(0, 1.75, 0));
    return true;
  };
  return (
    <SceneBoundary fail={onFailure}>
      <Stage
        cameraFrom={[0, 9, 11]}
        lookAt={[0, 0, -0.5]}
        cameraFar={120}
        ambientOcclusion={false}
        postProcessing={false}
        {...(onReady ? { onSceneReady: onReady } : {})}
        onRendererUnavailable={onFailure}
        onContextLost={onFailure}
      >
        <color attach="background" args={[TOY.sky]} />
        <Framing hud={NO_HUD} box={courtyardBox} />
        <Courtyard baskets={0} />
        <Lighthouse />
        {baskets.map((spot, i) => (
          <group key={`${spot.x}/${i}`} position={[spot.x, COURTYARD.terrace.top, spot.z]}>
            <Basket colour={spot.colour} notes={caught[i] ?? 0} />
          </group>
        ))}
        {building ? <Train wagons={cue.wagons ?? 0} departing={departing} /> : null}
        {cue.scene === "make" ? (
          <Workbench finished={cue.verdict === "ok" && cue.action === "make"} />
        ) : null}
        <GameHero ref={hero} position={[HERO.x, HERO.y, HERO.z]} recipe={recipe ?? null} />
        {flights.map((key) => (
          <PaperPlane
            key={key}
            onLanded={() => {
              setFlights((list) => list.filter((flight) => flight !== key));
              addEffect({ kind: "puff", from: LIGHT_TOP.clone() });
            }}
          />
        ))}
        {effects.map((effect) => (
          <EffectView key={effect.key} effect={effect} done={dropEffect} />
        ))}
        <Director cue={cue} hero={hero} fly={fly} throwTo={throwTo} cheer={cheer} />
        <AnchoredLabels labels={labels} anchor={anchor} inset={NO_HUD} />
      </Stage>
    </SceneBoundary>
  );
}
