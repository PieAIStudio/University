import { useFrame, useThree } from "@react-three/fiber";
import { Component, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";

import { Ball as ToyBall, Block, Star } from "../../toy-play/parts.js";
import { TOY } from "../../toy-play/style.js";
import { Note } from "./props.js";
import { fitStage, type ArenaBox } from "./stage-fit.js";

/**
 * What every game's scene needs around its own props (ADR-0011, scene layer):
 * a boundary that turns a render failure into the frame's "3D unavailable"
 * panel, a camera that keeps the arena clear of the frame's HUD, the clock
 * that advances the session, and short effects for verdicts.
 */
export class SceneBoundary extends Component<
  { children: ReactNode; fail: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.fail();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Pixels the frame covers over the canvas's top and bottom edges. */
export interface HudInset {
  readonly top: number;
  readonly bottom: number;
}

export function Framing({ hud, box }: { hud: HudInset; box: (aspect: number) => ArenaBox }) {
  const { camera, size } = useThree();
  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera) || !size.height) return;
    const aspect = size.width / size.height;
    const fit = fitStage(box(aspect), aspect, {
      top: Math.min(0.4, (hud.top + 8) / size.height),
      bottom: Math.min(0.2, (hud.bottom + 6) / size.height),
    });
    camera.fov = fit.fov;
    camera.position.copy(fit.position);
    camera.lookAt(fit.target);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height, hud.top, hud.bottom, box]);
  return null;
}

/** Time reaches the session only from here, and only while nothing freezes it. */
export function Clock({
  session,
  frozen,
}: {
  session: { advance(seconds: number): void };
  frozen: boolean;
}) {
  useFrame((_, delta) => {
    if (!frozen) session.advance(delta);
  }, -2);
  return null;
}

export interface Effect {
  readonly key: number;
  readonly kind: "stars" | "puff" | "splash" | "note";
  readonly from: THREE.Vector3;
  readonly to?: THREE.Vector3;
}

/** A short list of live effects; each removes itself when it has played. */
export function useEffects() {
  const [effects, setEffects] = useState<Effect[]>([]);
  const serial = useRef(0);
  const addEffect = useCallback((effect: Omit<Effect, "key">) => {
    setEffects((list) => [...list.slice(-11), { ...effect, key: ++serial.current }]);
  }, []);
  const dropEffect = useCallback((key: number) => {
    setEffects((list) => list.filter((effect) => effect.key !== key));
  }, []);
  return { effects, addEffect, dropEffect };
}

export function EffectView({ effect, done }: { effect: Effect; done: (key: number) => void }) {
  const group = useRef<THREE.Group>(null);
  const age = useRef(0);
  const life = effect.kind === "note" ? 0.65 : 0.7;
  useFrame((_, delta) => {
    age.current += delta;
    const node = group.current;
    if (!node) return;
    const k = Math.min(1, age.current / life);
    if (effect.kind === "note" && effect.to) {
      node.position.lerpVectors(effect.from, effect.to, k);
      node.position.y += Math.sin(Math.PI * k) * 1.6;
      node.rotation.y = k * 6;
    } else {
      node.children.forEach((child, i) => {
        const a = (i / node.children.length) * Math.PI * 2;
        const r = k * (effect.kind === "splash" ? 0.7 : 0.9);
        child.position.set(
          Math.cos(a) * r,
          k * (effect.kind === "splash" ? 0.6 : 1.1),
          Math.sin(a) * r,
        );
        child.scale.setScalar(Math.max(0.01, 1 - k));
      });
    }
    if (age.current >= life) done(effect.key);
  });
  const bits = effect.kind === "stars" ? 5 : 4;
  return (
    <group ref={group} position={effect.from}>
      {effect.kind === "note" ? (
        <Note />
      ) : (
        Array.from({ length: bits }, (_, i) => (
          <group key={i}>
            {effect.kind === "stars" ? (
              <Star scale={0.16} />
            ) : effect.kind === "splash" ? (
              <ToyBall position={[0, 0, 0]} size={[0.09, 0.09, 0.09]} color={TOY.water} />
            ) : (
              <Block size={[0.12, 0.12, 0.12]} color={TOY.coral} />
            )}
          </group>
        ))
      )}
    </group>
  );
}
