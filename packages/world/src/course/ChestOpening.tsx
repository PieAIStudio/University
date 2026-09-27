import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import { islandLookFrozen } from "../island/island-surface-style.js";
import { usePrefersReducedMotion } from "../reduced-motion.js";
import { CHEST_COLOURS, CHEST_WIDTH } from "./chest-geometry.js";
import { OPENING_FX, openingTimeline, type OpeningEvent } from "./chest-opening.js";
import type { GuardedStop } from "./chest-sequence.js";
import type { ChestTier, CourseChest } from "./chests-and-monsters.js";
import { buildHeroChest, type HeroChest } from "./hero-chest.js";
import { OpeningParticles, softDotTexture } from "./opening-particles.js";

/** An all-correct chest flashes up a tier before it charges (V7: 「升级！」). */
export const UPGRADE_LEAD = 0.6;
const LID_SECONDS = 0.45;

export type OpeningPhase = "waiting" | "upgrade" | "charge" | "burst" | "settled";

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
/** Overshoots a little and settles: a lid thrown open. */
const easeOutBack = (x: number) => 1 + 2.2 * (x - 1) ** 3 + 1.2 * (x - 1) ** 2;

function ringTexture(size = 64): THREE.DataTexture {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y += 1)
    for (let x = 0; x < size; x += 1) {
      const d = Math.hypot(x - size / 2 + 0.5, y - size / 2 + 0.5) / (size / 2);
      const a = d > 1 ? 0 : Math.max(0, 1 - Math.abs(d - 0.8) / 0.2);
      data.set([255, 255, 255, Math.round(a * 230)], (y * size + x) * 4);
    }
  const texture = new THREE.DataTexture(data, size, size);
  texture.needsUpdate = true;
  return texture;
}

/**
 * The close-up opening of one lesson's chest, standing exactly where the map
 * chest stands. Waits bobbing ("tap me") until `started`, then plays the
 * tier's timeline: an optional upgrade flash, the charge, the burst and its
 * waves, the settle. Reports the burst and the settle so the host can reveal
 * rewards and move on; everything a learner reads stays DOM.
 */
export function ChestOpening({
  chest,
  tier,
  from = tier,
  started,
  slow = false,
  onPhase,
  onTap,
}: {
  readonly chest: CourseChest;
  /** The tier it opens as: one up from `from` when every answer was right first time. */
  readonly tier: ChestTier;
  readonly from?: ChestTier;
  readonly started: boolean;
  readonly slow?: boolean;
  readonly onPhase?: (phase: OpeningPhase) => void;
  readonly onTap?: () => void;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const upgrade = from !== tier;
  const [heroes, setHeroes] = useState<{ from: HeroChest; to: HeroChest } | null>(null);
  useEffect(() => {
    const to = buildHeroChest(tier);
    const before = upgrade ? buildHeroChest(from) : to;
    setHeroes({ from: before, to });
    return () => {
      to.dispose();
      if (before !== to) before.dispose();
    };
  }, [from, tier, upgrade]);

  const particles = useMemo(
    () => new OpeningParticles(Math.floor(chest.position.x * 1e3) + 7),
    [chest],
  );
  useEffect(() => () => particles.dispose(), [particles]);
  const glow = CHEST_COLOURS[tier].glow;
  const effects = useMemo(() => {
    const dot = softDotTexture(64);
    const ring = ringTexture();
    const flash = new THREE.Mesh(
      new THREE.PlaneGeometry(4.5, 4.5),
      new THREE.MeshBasicMaterial({
        map: dot,
        color: glow,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    flash.position.set(0, 0.7, 0.2);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.6, 2.8, 24, 1, true),
      new THREE.MeshBasicMaterial({
        map: dot,
        color: glow,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    beam.position.set(0, 1.9, 0);
    const shocks = Array.from({ length: 4 }, () => {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({
          map: ring,
          color: glow,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.03;
      return { mesh, bornAt: Number.NaN, reach: 1 };
    });
    for (const object of [flash, beam, ...shocks.map((shock) => shock.mesh)])
      object.raycast = () => {};
    return { dot, ring, flash, beam, shocks };
  }, [glow]);
  useEffect(
    () => () => {
      for (const mesh of [
        effects.flash,
        effects.beam,
        ...effects.shocks.map((shock) => shock.mesh),
      ]) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
      effects.dot.dispose();
      effects.ring.dispose();
    },
    [effects],
  );

  const timeline = useMemo<readonly OpeningEvent[]>(
    () => openingTimeline(tier, { slow, reduced: reducedMotion }),
    [tier, slow, reducedMotion],
  );
  const lead = upgrade && !reducedMotion ? UPGRADE_LEAD : 0;
  const clock = useRef({ idle: 0, t: 0, fired: 0, phase: "waiting" as OpeningPhase });
  const holder = useRef<THREE.Group>(null);
  const report = useRef(onPhase);
  report.current = onPhase;
  const setPhase = (phase: OpeningPhase) => {
    if (clock.current.phase === phase) return;
    clock.current.phase = phase;
    report.current?.(phase);
  };
  useEffect(() => {
    clock.current = { idle: 0, t: 0, fired: 0, phase: "waiting" };
  }, [chest.id, tier, from]);

  const fx = OPENING_FX[tier];
  const burstAt = lead + (timeline.find((event) => event.kind === "burst")?.at ?? 0);
  useFrame(({ camera }, delta) => {
    const pair = heroes;
    const group = holder.current;
    if (!pair || !group) return;
    const frozen = islandLookFrozen();
    const dt = frozen ? 0 : Math.min(delta, 0.05);
    const state = clock.current;
    const shown = started && state.t >= lead / 2 ? pair.to : pair.from;
    pair.from.group.visible = shown === pair.from;
    pair.to.group.visible = shown === pair.to;
    const chestObject = shown.group;

    if (!started) {
      state.idle += dt;
      const t = state.idle;
      chestObject.position.y = reducedMotion ? 0 : Math.abs(Math.sin(t * 2.4)) * 0.05;
      const cycle = t % 3.2;
      chestObject.rotation.z =
        !reducedMotion && cycle < 0.35 ? Math.sin(cycle * 40) * 0.05 * (1 - cycle / 0.35) : 0;
      return;
    }
    state.t += dt;
    const t = state.t;
    // Fire every timeline event that has come due.
    while (state.fired < timeline.length && lead + timeline[state.fired]!.at <= t) {
      const event = timeline[state.fired]!;
      state.fired += 1;
      if (event.kind === "burst") setPhase("burst");
      else if (event.kind === "settled") setPhase("settled");
      else if (event.kind === "wave") {
        particles.spray(
          event.pieces,
          1 + (event.wave - 1) * 0.12,
          shown.rim,
          glow,
          tier === "legendary",
        );
        if (event.wave === 1 && fx.rain) particles.rain(slow ? fx.rain / 2 : fx.rain);
        if (event.wave <= fx.shocks) {
          const shock = effects.shocks[event.wave - 1]!;
          shock.bornAt = t;
          shock.reach = 2.2 + event.wave * 0.8;
        }
        if (event.wave > 1)
          for (
            let index = 0;
            index < Math.ceil(fx.fireworks / Math.max(1, fx.waves - 1));
            index += 1
          )
            particles.firework();
      }
    }
    if (upgrade && t < lead) setPhase("upgrade");
    else if (t < burstAt) setPhase("charge");

    chestObject.position.y = 0;
    if (t < lead) {
      // The upgrade: a pop and a flash, and the new colour takes over halfway.
      const k = t / lead;
      const pop = 1 + Math.sin(k * Math.PI) * 0.18;
      chestObject.scale.setScalar(pop);
      (effects.flash.material as THREE.MeshBasicMaterial).opacity = Math.sin(k * Math.PI) * 0.8;
      chestObject.rotation.z = 0;
    } else if (t < burstAt) {
      const k = clamp01((t - lead) / fx.charge);
      const amp = 0.03 + k * k * 0.12;
      chestObject.rotation.z = Math.sin(t * (40 + k * 30)) * amp;
      chestObject.rotation.y = Math.sin(t * 31) * amp * 0.6;
      shown.setLeak(k);
      const squash = 1 - 0.12 * k ** 3;
      chestObject.scale.set(1 + (1 - squash) * 0.9, squash, 1 + (1 - squash) * 0.9);
      (effects.flash.material as THREE.MeshBasicMaterial).opacity = 0;
    } else {
      const since = t - burstAt;
      chestObject.rotation.set(0, 0, 0);
      shown.setLeak(0);
      shown.setOpen(reducedMotion ? 1 : easeOutBack(clamp01(since / LID_SECONDS)));
      chestObject.scale.setScalar(1 + 0.12 * Math.sin(Math.min(1, since / 0.3) * Math.PI));
      const waves = timeline.filter((event) => event.kind === "wave");
      const lastWave = waves.filter((event) => lead + event.at <= t).at(-1);
      const sinceWave = lastWave ? t - (lead + lastWave.at) : since;
      const flash =
        Math.max(0, 1 - since / 0.35) +
        (waves.length > 1 ? Math.max(0, 1 - sinceWave / 0.3) * 0.6 : 0);
      (effects.flash.material as THREE.MeshBasicMaterial).opacity = reducedMotion
        ? 0
        : Math.min(0.8, flash * 0.8);
      (effects.beam.material as THREE.MeshBasicMaterial).opacity = reducedMotion
        ? 0.25
        : Math.min(0.5 + fx.waves * 0.08, since * 1.4) * (0.75 + 0.25 * Math.sin(since * 3));
      effects.beam.rotation.y += dt * 0.6;
    }
    // The chest shakes the ground it stands on, a little more each wave.
    const shaking = fx.shake * Math.max(0, 1 - (t - burstAt) / 0.6);
    group.position.x = t > burstAt && !reducedMotion ? (Math.random() - 0.5) * shaking : 0;
    for (const shock of effects.shocks) {
      const age = t - shock.bornAt;
      const material = shock.mesh.material as THREE.MeshBasicMaterial;
      if (!(age >= 0)) {
        material.opacity = 0;
        continue;
      }
      const k = clamp01(age / 0.9);
      shock.mesh.scale.setScalar(0.5 + k * shock.reach);
      material.opacity = (1 - k) * 0.9;
    }
    effects.flash.lookAt(camera.position);
    particles.update(dt);
  });

  const size = CHEST_WIDTH * chest.scale;
  return (
    <group
      position={chest.position}
      rotation={[0, chest.yaw, 0]}
      name="course-chest-opening"
      onClick={(event: ThreeEvent<MouseEvent>) => {
        if (!onTap) return;
        event.stopPropagation();
        onTap();
      }}
    >
      <group ref={holder} scale={size}>
        {heroes ? <primitive object={heroes.from.group} /> : null}
        {heroes && heroes.to !== heroes.from ? <primitive object={heroes.to.group} /> : null}
        <primitive object={effects.flash} />
        <primitive object={effects.beam} />
        {effects.shocks.map((shock, index) => (
          <primitive key={index} object={shock.mesh} />
        ))}
        <primitive object={particles.group} />
      </group>
    </group>
  );
}

/** What the course scene needs to stage one lesson's opening (V7 station 4). */
export interface CourseOpening {
  /** The lesson whose chest opens. */
  readonly lessonId: string;
  /** The tier it opens as; `from` is the map's tier when it upgraded. */
  readonly tier: ChestTier;
  readonly from: ChestTier;
  /** The learner has tapped the chest. */
  readonly started: boolean;
  /** The camera settles beside the avatar and the chest; false sends it home. */
  readonly closeUp: boolean;
  /**
   * The stop whose monster the chest's knowledge star chases away: the next
   * lesson, or the segment's gate when this lesson cleared the segment.
   */
  readonly guard?: GuardedStop | null;
  /** The learner has asked to throw the star; `onDone` once the monster has run. */
  readonly throwing?: { readonly started: boolean; readonly onDone?: () => void } | null;
  readonly onPhase?: (phase: OpeningPhase) => void;
  readonly onTap?: () => void;
}
