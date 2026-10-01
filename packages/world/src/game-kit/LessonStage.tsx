import type { LessonStageCue } from "@pieai/university-core";
import type { AvatarRecipe } from "@pieai/swimmer-avatar-kit";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";

import { Stage } from "../Stage.js";
import { Ball, Block, Disc } from "../toy-play/parts.js";
import { TOY } from "../toy-play/style.js";
import { AnchoredLabels, type AnchoredLabel } from "./scene/AnchoredLabels.js";
import { COURTYARD, Courtyard, courtyardBox } from "./scene/Courtyard.js";
import { GameHero, type GameHeroHandle } from "./scene/GameHero.js";
import { EffectView, Framing, SceneBoundary, useEffects } from "./scene/stage-parts.js";

/**
 * A step lesson's stage (V7 amendment one): the courtyard the island games
 * use, with the learner's avatar on the terrace and the AI as a lighthouse in
 * the pond. The reader says where the lesson is; this follows and never makes
 * the lesson wait. The only words here are one- to six-character DOM labels.
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
const LIGHTHOUSE = new THREE.Vector3(2.3, COURTYARD.pond.surface, -3.2);
const LIGHT_TOP = LIGHTHOUSE.clone().add(new THREE.Vector3(0, 2.25, 0));
const NO_HUD = { top: 0, bottom: 0 } as const;
const LABEL_AI = 1;
const LABEL_THINKING = 2;

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
  const from = useMemo(() => HERO.clone().add(new THREE.Vector3(0.2, 1.3, -0.2)), []);
  const landed = useRef(false);
  useFrame((_, delta) => {
    const node = group.current;
    if (!node) return;
    age.current += delta;
    const k = Math.min(1, age.current / 1.1);
    node.position.lerpVectors(from, LIGHT_TOP, k);
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

/** Answers each settled action and each new scene with the avatar's own moves. */
function Director({
  cue,
  hero,
  fly,
  cheer,
}: {
  cue: LessonStageCue;
  hero: RefObject<GameHeroHandle | null>;
  fly: () => void;
  cheer: () => void;
}) {
  const lastBeat = useRef(cue.beat);
  const lastScene = useRef<string | null>(null);
  useEffect(() => {
    if (lastScene.current === cue.scene) return;
    lastScene.current = cue.scene;
    const avatar = hero.current;
    if (!avatar) return;
    if (cue.scene === "intro") avatar.act("hop");
    if (cue.scene === "run" || cue.scene === "modify") avatar.look(LIGHTHOUSE);
    else avatar.look(null);
    if (cue.scene === "finish") {
      avatar.act("cheer");
      avatar.feel("happy", 1.6);
      cheer();
    }
  }, [cue.scene, hero, cheer]);
  useEffect(() => {
    if (cue.beat === lastBeat.current) return;
    lastBeat.current = cue.beat;
    const avatar = hero.current;
    if (!avatar) return;
    if (cue.verdict === "no") {
      avatar.act("flinch");
      avatar.feel("sad");
    } else if (cue.action === "send") {
      avatar.act("throw");
      fly();
    } else {
      avatar.act("cheer");
      avatar.feel("happy");
    }
  }, [cue.beat, cue.verdict, cue.action, hero, fly]);
  return null;
}

export function LessonStage({ cue, recipe, onFailure, onReady, aiLabel }: LessonStageProps) {
  const hero = useRef<GameHeroHandle>(null);
  const { effects, addEffect, dropEffect } = useEffects();
  const [flights, setFlights] = useState<number[]>([]);
  const serial = useRef(0);
  const fly = useMemo(() => () => setFlights((list) => [...list.slice(-2), ++serial.current]), []);
  const cheer = useMemo(
    () => () => addEffect({ kind: "stars", from: HERO.clone().add(new THREE.Vector3(0, 1.8, 0)) }),
    [addEffect],
  );
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
        <Director cue={cue} hero={hero} fly={fly} cheer={cheer} />
        <AnchoredLabels labels={labels} anchor={anchor} inset={NO_HUD} />
      </Stage>
    </SceneBoundary>
  );
}
