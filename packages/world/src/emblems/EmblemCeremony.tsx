import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { usePrefersReducedMotion } from "../reduced-motion.js";
import { hasWebGLContext } from "../webgl-capability.js";
import {
  EMBLEM_EXPOSURE,
  EMBLEM_TONE_MAPPING,
  frameEmblem,
  lightEmblemStage,
} from "./emblem-stage.js";
import { buildRankEmblem } from "./emblems.js";

/**
 * A rank emblem, live, for the one moment it changes (V7 mechanic 11): when
 * the learner's remembered cards cross a rank's line, the new emblem turns
 * once, its wings open and it settles beside the avatar. Everywhere else the
 * emblem is a still image (emblem-images.ts); this is the single live one.
 *
 * `play` going true starts the ceremony; the canvas draws only while it runs.
 * Under reduced motion the emblem simply appears, and `onDone` follows at once.
 */
export function EmblemCeremony({
  tierId,
  play,
  label,
  size = 160,
  onDone,
}: {
  /** A `LEAGUE_TIERS` id. */
  readonly tierId: string;
  readonly play: boolean;
  /** The rank's name, read in place of the picture. */
  readonly label: string;
  readonly size?: number;
  readonly onDone?: () => void;
}) {
  const [running, setRunning] = useState(false);
  if (!hasWebGLContext()) return null;
  return (
    <div role="img" aria-label={label} style={{ width: size, height: size }}>
      <Canvas
        frameloop={running ? "always" : "demand"}
        dpr={[1, 1.5]}
        gl={{
          antialias: true,
          alpha: true,
          toneMapping: EMBLEM_TONE_MAPPING,
          toneMappingExposure: EMBLEM_EXPOSURE,
        }}
        camera={{ fov: 24, near: 0.1, far: 100, position: [0, 0, 9] }}
      >
        <Ceremony
          tierId={tierId}
          play={play}
          onRunning={setRunning}
          {...(onDone ? { onDone } : {})}
        />
      </Canvas>
    </div>
  );
}

const SECONDS = 1.6;
/** Where the emblem rests: a slight turn, as in the still images. */
const REST_TURN = -0.28;

const easeOut = (x: number) => 1 - (1 - x) ** 3;
/** Past one and back, for the wings snapping open. */
const overshoot = (x: number) => 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2;

function Ceremony({
  tierId,
  play,
  onRunning,
  onDone,
}: {
  tierId: string;
  play: boolean;
  onRunning: (running: boolean) => void;
  onDone?: () => void;
}) {
  const { scene, gl, camera, invalidate } = useThree();
  const reducedMotion = usePrefersReducedMotion();
  const emblem = useMemo(() => buildRankEmblem(tierId), [tierId]);
  useEffect(() => () => emblem.dispose(), [emblem]);
  useEffect(() => lightEmblemStage(scene, gl), [scene, gl]);
  useLayoutEffect(() => {
    emblem.group.rotation.y = REST_TURN;
    frameEmblem(camera as THREE.PerspectiveCamera, emblem.group);
    invalidate();
  }, [emblem, camera, invalidate]);

  const clock = useRef<number | null>(null);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    if (!play) return;
    if (reducedMotion) {
      done.current?.();
      return;
    }
    clock.current = 0;
    onRunning(true);
  }, [play, reducedMotion, onRunning]);

  useFrame((_, delta) => {
    if (clock.current === null) return;
    clock.current = Math.min(SECONDS, clock.current + Math.min(delta, 0.05));
    const t = clock.current / SECONDS;
    emblem.group.rotation.y = REST_TURN + easeOut(Math.min(1, t / 0.8)) * Math.PI * 2;
    const pop = t < 0.45 ? 0.8 + (t / 0.45) * 0.3 : 1.1 - ((t - 0.45) / 0.55) * 0.1;
    emblem.group.scale.setScalar(pop);
    const open = overshoot(THREE.MathUtils.clamp((t - 0.3) / 0.5, 0, 1));
    emblem.wings.forEach((wing, index) => {
      const side = index === 0 ? -1 : 1;
      const k = 0.25 + 0.75 * open;
      wing.scale.set(side * k, k, 1);
    });
    if (clock.current < SECONDS) return;
    clock.current = null;
    emblem.group.rotation.y = REST_TURN;
    emblem.group.scale.setScalar(1);
    onRunning(false);
    done.current?.();
  });

  return <primitive object={emblem.group} />;
}
