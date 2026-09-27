import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";

import { islandLookFrozen } from "../island/island-surface-style.js";
import { hash, seeded } from "../island/random.js";
import { useKitModels, type Role } from "../kit.js";
import { usePrefersReducedMotion } from "../reduced-motion.js";
import {
  BOSS_HEIGHT,
  MONSTER_HEIGHT,
  MONSTER_ROLE_HEIGHT,
  type CourseMonster,
  type MonsterRole,
} from "./chests-and-monsters.js";
import {
  bakeMonsterPose,
  buildCrownGeometry,
  fidgetClips,
  idleClip,
  usableClips,
  type BakedMonster,
} from "./monster-pose.js";

/** Only this many monsters animate: the ones nearest the learner (V7 decision N1). */
export const LIVE_MONSTERS = 3;
/**
 * Monsters this close to the learner turn to watch them, in blueprint units:
 * about two lesson stones on a long course. Farther ones face the stop before
 * theirs, so the learner arriving there meets them face to face.
 */
export const MONSTER_LOOK_RADIUS = 7;
/** How quickly a monster turns toward what it faces, per second (exponential). */
const TURN_EASE = 4.5;
/** The crown's width as a share of the boss's height. */
const CROWN_SIZE = 0.26;

export interface MonsterPlacement {
  readonly monster: CourseMonster;
  /** Where its feet go: a stone's top, a pad's top, or the ground beside a gate. */
  readonly at: THREE.Vector3;
}

const ROLES = (list: readonly MonsterPlacement[]) =>
  [...new Set(list.map((entry) => entry.monster.role))].sort() as MonsterRole[];
const kitRole = (role: MonsterRole) => `monster-${role}` as Role;
const heightOf = (monster: CourseMonster) =>
  (monster.boss ? BOSS_HEIGHT : MONSTER_HEIGHT) * MONSTER_ROLE_HEIGHT[monster.role];
/** A small stable turn off its heading, so neighbours do not line up like soldiers. */
const jitterOf = (monster: CourseMonster) => (hash(`${monster.id}:turn`) - 0.5) * 0.24;
const yawToward = (from: THREE.Vector3, to: THREE.Vector3) =>
  Math.atan2(to.x - from.x, to.z - from.z);
/** Watching the learner, or null when they are out of sight or standing on this very stop. */
function watching(entry: MonsterPlacement, focus: THREE.Vector3 | null): boolean {
  if (!focus) return false;
  const distance = Math.hypot(focus.x - entry.at.x, focus.z - entry.at.z);
  return distance > 0.3 && distance < MONSTER_LOOK_RADIUS;
}
function targetYaw(entry: MonsterPlacement, focus: THREE.Vector3 | null): number {
  return watching(entry, focus)
    ? yawToward(entry.at, focus!)
    : yawToward(entry.at, entry.monster.faces) + jitterOf(entry.monster);
}
/** The shortest signed turn from `a` to `b`. */
function turnBetween(a: number, b: number): number {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}

/**
 * How a monster takes the learner's knowledge star (V7 station 4): it braces
 * (shakes its head, begging), is hit (ducks), may jump and spin, and then flees
 * — turns away, runs off the stone and shrinks out of sight.
 */
export type MonsterReactionPhase = "brace" | "hit" | "spin" | "flee";
export interface MonsterReaction {
  readonly monsterId: string;
  readonly phase: MonsterReactionPhase;
  /** Which way it runs, world space (away from the learner). */
  readonly away: THREE.Vector3;
  /** Once it has run out of sight. */
  readonly onGone?: () => void;
}
/** Seconds from starting to flee until it is out of sight. */
export const FLEE_SECONDS = 1.4;
const FLEE_DISTANCE = 3.6;

/**
 * The monsters on the course island. Suspends until their models load; wrap it
 * in a Suspense boundary of its own so the island never waits for them.
 */
export function MonsterField({
  placements,
  focus,
  reaction = null,
  onPick,
}: {
  readonly placements: readonly MonsterPlacement[];
  /** The learner's position: the nearest monsters animate, the near ones watch it. */
  readonly focus: THREE.Vector3 | null;
  /** The monster being chased away now, if any; it always animates. */
  readonly reaction?: MonsterReaction | null;
  readonly onPick?: (monster: CourseMonster) => void;
}) {
  const roles = useMemo(() => ROLES(placements), [placements]);
  const gltfs = useKitModels(roles.map(kitRole));
  const models = useMemo(
    () =>
      new Map(
        roles.map((role, index) => {
          const gltf = gltfs[index]!;
          return [
            role,
            { gltf, baked: bakeMonsterPose(gltf.scene, gltf.animations, 0.35) },
          ] as const;
        }),
      ),
    [gltfs, roles],
  );
  useEffect(
    () => () => {
      for (const { baked } of models.values())
        for (const part of baked.parts) {
          part.geometry.dispose();
          if (part.owned) part.material.dispose();
        }
    },
    [models],
  );
  const crown = useMemo(() => buildCrownGeometry(), []);
  const crownMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        flatShading: true,
        roughness: 0.35,
        metalness: 0.3,
      }),
    [],
  );
  useEffect(
    () => () => {
      crown.dispose();
      crownMaterial.dispose();
    },
    [crown, crownMaterial],
  );

  const reactingId = reaction?.monsterId ?? null;
  const live = useMemo(() => {
    const chosen = new Set<string>(reactingId ? [reactingId] : []);
    if (!focus) return chosen;
    for (const entry of placements
      .filter((item) => models.get(item.monster.role)?.baked.skinned)
      .sort((a, b) => a.at.distanceToSquared(focus) - b.at.distanceToSquared(focus))) {
      if (chosen.size >= LIVE_MONSTERS) break;
      chosen.add(entry.monster.id);
    }
    return chosen;
  }, [focus, models, placements, reactingId]);
  const still = useMemo(() => {
    const byRole = new Map<MonsterRole, MonsterPlacement[]>();
    for (const entry of placements) {
      if (live.has(entry.monster.id)) continue;
      byRole.set(entry.monster.role, [...(byRole.get(entry.monster.role) ?? []), entry]);
    }
    return byRole;
  }, [live, placements]);
  const bosses = useMemo(
    () => placements.filter((entry) => entry.monster.boss && !live.has(entry.monster.id)),
    [live, placements],
  );

  const stillRefs = useRef(new Map<string, THREE.InstancedMesh | null>());
  const crownRef = useRef<THREE.InstancedMesh>(null);
  /** Each monster's current heading; eased toward its target every frame. */
  const yaws = useRef(new Map<string, number>());
  const scratch = useMemo(
    () => ({
      matrix: new THREE.Matrix4(),
      turn: new THREE.Quaternion(),
      size: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
      top: new THREE.Vector3(),
    }),
    [],
  );

  const yawOf = (entry: MonsterPlacement) =>
    yaws.current.get(entry.monster.id) ?? targetYaw(entry, focus);
  const placeStill = () => {
    for (const [role, list] of still) {
      const baked = models.get(role)?.baked;
      if (!baked) continue;
      baked.parts.forEach((_, partIndex) => {
        const mesh = stillRefs.current.get(`${role}:${partIndex}`);
        if (!mesh) return;
        list.forEach((entry, slot) => {
          const height = heightOf(entry.monster);
          scratch.turn.setFromAxisAngle(scratch.up, yawOf(entry));
          scratch.size.setScalar(height);
          mesh.setMatrixAt(slot, scratch.matrix.compose(entry.at, scratch.turn, scratch.size));
        });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
      });
    }
    const crowns = crownRef.current;
    if (crowns) {
      bosses.forEach((entry, slot) => {
        const baked = models.get("boss")?.baked;
        const height = heightOf(entry.monster);
        const turn = yawOf(entry);
        scratch.top
          .copy(baked?.top ?? scratch.up)
          .multiplyScalar(height)
          .applyAxisAngle(scratch.up, turn)
          .add(entry.at);
        scratch.top.y -= height * 0.04;
        scratch.turn.setFromAxisAngle(scratch.up, turn);
        scratch.size.setScalar(height * CROWN_SIZE);
        crowns.setMatrixAt(slot, scratch.matrix.compose(scratch.top, scratch.turn, scratch.size));
      });
      crowns.instanceMatrix.needsUpdate = true;
      crowns.computeBoundingSphere();
    }
  };

  const liveGroups = useRef(new Map<string, THREE.Group | null>());
  // A new set of instances starts where every monster already looks.
  useLayoutEffect(() => {
    placeStill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still, bosses, models]);

  // Turn toward the learner when near, back toward the previous stop when not.
  const reducedMotion = usePrefersReducedMotion();
  useFrame((_, delta) => {
    const snap = reducedMotion || islandLookFrozen();
    const ease = snap ? 1 : 1 - Math.exp(-Math.min(delta, 0.1) * TURN_EASE);
    let stillMoved = false;
    for (const entry of placements) {
      const fleeing = reaction?.monsterId === entry.monster.id && reaction.phase === "flee";
      // A fleeing monster turns its back and runs; nothing eases that turn.
      const target = fleeing
        ? Math.atan2(reaction.away.x, reaction.away.z)
        : targetYaw(entry, focus);
      const current = yaws.current.get(entry.monster.id);
      const next = current === undefined ? target : current + turnBetween(current, target) * ease;
      if (current !== undefined && Math.abs(next - current) < 1e-4) continue;
      yaws.current.set(entry.monster.id, next);
      const group = liveGroups.current.get(entry.monster.id);
      if (group) group.rotation.y = next;
      else stillMoved = true;
    }
    if (stillMoved) placeStill();
  });

  if (!placements.length) return null;
  const pickStill =
    (list: readonly MonsterPlacement[]) =>
    (event: ThreeEvent<MouseEvent>): void => {
      const entry = event.instanceId === undefined ? undefined : list[event.instanceId];
      if (!entry || !onPick) return;
      event.stopPropagation();
      onPick(entry.monster);
    };
  return (
    <group name="course-monsters">
      {[...still].flatMap(([role, list]) => {
        const baked = models.get(role)?.baked;
        if (!baked) return [];
        return baked.parts.map((part, partIndex) => (
          <instancedMesh
            key={`${role}:${partIndex}:${list.length}`}
            ref={(node) => {
              stillRefs.current.set(`${role}:${partIndex}`, node);
            }}
            name={`course-monster-${role}-${partIndex}`}
            args={[part.geometry, part.material, list.length]}
            // Still monsters cast no shadow: at map distance it is a few pixels
            // under a creature standing on a stone, and it would double their cost.
            receiveShadow
            frustumCulled={false}
            onClick={pickStill(list)}
          />
        ));
      })}
      {bosses.length ? (
        <instancedMesh
          key={`crowns:${bosses.length}`}
          ref={crownRef}
          name="course-monster-crowns"
          args={[crown, crownMaterial, bosses.length]}
          frustumCulled={false}
          raycast={() => {}}
        />
      ) : null}
      {placements
        .filter((entry) => live.has(entry.monster.id))
        .map((entry) => {
          const model = models.get(entry.monster.role)!;
          return (
            <LiveMonster
              key={entry.monster.id}
              entry={entry}
              gltf={model.gltf}
              baked={model.baked}
              crown={entry.monster.boss ? { geometry: crown, material: crownMaterial } : null}
              alert={watching(entry, focus)}
              reaction={reaction?.monsterId === entry.monster.id ? reaction : null}
              groupRef={(node) => {
                liveGroups.current.set(entry.monster.id, node);
                if (node) node.rotation.y = yawOf(entry);
              }}
              onPick={onPick}
            />
          );
        })}
    </group>
  );
}

interface Rig {
  readonly model: THREE.Object3D;
  readonly mixer: THREE.AnimationMixer;
  readonly idle: THREE.AnimationAction | null;
  readonly fidgets: readonly THREE.AnimationAction[];
  readonly random: () => number;
}

function buildRig(
  gltf: { readonly scene: THREE.Object3D; readonly animations: THREE.AnimationClip[] },
  id: string,
): Rig {
  const model = cloneSkinned(gltf.scene);
  model.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    // A skinned mesh's bounds are its bind pose; the idle moves it outside them.
    mesh.frustumCulled = false;
  });
  const mixer = new THREE.AnimationMixer(model);
  const clip = idleClip(usableClips(model, gltf.animations));
  const idle = clip ? mixer.clipAction(clip) : null;
  if (idle && clip) {
    idle.play();
    // Out of step with each other, so three neighbours do not breathe as one.
    idle.time = hash(`${id}:phase`) * clip.duration;
  }
  const fidgets = fidgetClips(model, gltf.animations).map((one) => {
    const action = mixer.clipAction(one);
    action.setLoop(THREE.LoopOnce, 1);
    return action;
  });
  // Back to the idle when a small move ends.
  mixer.addEventListener("finished", (event) => {
    if (!idle || event.action === idle) return;
    idle.reset().play();
    idle.crossFadeFrom(event.action as THREE.AnimationAction, 0.3, false);
  });
  return { model, mixer, idle, fidgets, random: seeded(`${id}:fidget`) };
}

/** Seconds between a standing monster's small moves. */
const FIDGET_GAP: readonly [number, number] = [4.5, 10];

function LiveMonster({
  entry,
  gltf,
  baked,
  crown,
  alert,
  reaction,
  groupRef,
  onPick,
}: {
  readonly entry: MonsterPlacement;
  readonly gltf: { readonly scene: THREE.Object3D; readonly animations: THREE.AnimationClip[] };
  readonly baked: BakedMonster;
  readonly crown: {
    readonly geometry: THREE.BufferGeometry;
    readonly material: THREE.Material;
  } | null;
  /** The learner has just come into sight: react soon with one small move. */
  readonly alert: boolean;
  readonly reaction: MonsterReaction | null;
  readonly groupRef: (node: THREE.Group | null) => void;
  readonly onPick?: (monster: CourseMonster) => void;
}) {
  const { monster, at } = entry;
  /*
    Built in an effect, not a memo: StrictMode runs an effect's cleanup and
    then the effect again, and a mixer uncached by that cleanup cannot play a
    clip afterwards. One rig per mount, disposed with it.
  */
  const [rig, setRig] = useState<Rig | null>(null);
  useEffect(() => {
    const built = buildRig(gltf, monster.id);
    setRig(built);
    return () => {
      built.mixer.stopAllAction();
      built.mixer.uncacheRoot(built.model);
    };
  }, [gltf, monster.id]);
  const head = useMemo(() => {
    if (!crown || !rig) return null;
    let found: THREE.Object3D | null = null;
    rig.model.traverse((object) => {
      if (!found && /^head$/i.test(object.name)) found = object;
    });
    return found as THREE.Object3D | null;
  }, [crown, rig]);

  const reducedMotion = usePrefersReducedMotion();
  const crownRef = useRef<THREE.Mesh>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const world = useMemo(() => new THREE.Vector3(), []);
  const headRest = useRef<THREE.Vector3 | null>(null);
  const clock = useRef({ elapsed: 0, next: FIDGET_GAP[0] + hash(`${monster.id}:first`) * 4 });
  const wasAlert = useRef(alert);
  useEffect(() => {
    // Seeing the learner arrive is worth a move of its own, after it has turned.
    if (alert && !wasAlert.current)
      clock.current.next = Math.min(clock.current.next, clock.current.elapsed + 0.8);
    wasAlert.current = alert;
  }, [alert]);
  /*
    The reaction to a star: each phase plays the model's own clip for it where
    it has one — a head shake, a duck, a jump, a run — and otherwise keeps the
    idle; the flee also moves the monster off its stone and shrinks it away.
  */
  const phase = reaction?.phase ?? null;
  const flee = useRef<{ t: number; gone: boolean } | null>(null);
  const spin = useRef<number | null>(null);
  const gone = useRef(reaction?.onGone);
  gone.current = reaction?.onGone;
  useEffect(() => {
    if (!rig || !phase) return;
    const clips = usableClips(rig.model, gltf.animations);
    const find = (pattern: RegExp) => clips.find((clip) => pattern.test(clip.name));
    const clip =
      phase === "brace"
        ? find(/^No(_|$)/)
        : phase === "hit"
          ? find(/^(Duck|HitReact|HitRecieve|Hit)(_|$)/)
          : phase === "spin"
            ? find(/^Jump(_|$)/)
            : find(/^(Run|Fast_Flying|Gallop|Walk)(_|$)/);
    if (clip) {
      rig.mixer.stopAllAction();
      const action = rig.mixer.clipAction(clip);
      action.reset();
      action.setLoop(
        phase === "hit" || phase === "spin" ? THREE.LoopOnce : THREE.LoopRepeat,
        Infinity,
      );
      action.clampWhenFinished = true;
      action.play();
    }
    if (phase === "spin") spin.current = 0;
    if (phase === "flee") flee.current = { t: 0, gone: false };
  }, [phase, rig, gltf]);

  const fidget = () => {
    if (!rig || phase) return;
    const { fidgets, idle, random } = rig;
    if (!fidgets.length || !idle) return;
    const action = fidgets[Math.floor(random() * fidgets.length)]!;
    action.reset().play();
    action.crossFadeFrom(idle, 0.25, false);
  };
  useFrame((_, delta) => {
    if (!rig) return;
    if (!reducedMotion && !islandLookFrozen()) {
      const step = Math.min(delta, 0.1);
      const timer = clock.current;
      timer.elapsed += step;
      if (timer.elapsed >= timer.next) {
        fidget();
        timer.next = timer.elapsed + FIDGET_GAP[0] + rig.random() * (FIDGET_GAP[1] - FIDGET_GAP[0]);
      }
      rig.mixer.update(step);
    }
    const body = bodyRef.current;
    if (body) {
      if (spin.current !== null) {
        spin.current = Math.min(1, spin.current + Math.min(delta, 0.05) / 0.7);
        body.rotation.y = spin.current * Math.PI * 2;
        body.position.y = Math.sin(spin.current * Math.PI) * 0.35;
        if (spin.current >= 1) spin.current = null;
      }
      const running = flee.current;
      if (running && reaction) {
        running.t = reducedMotion ? FLEE_SECONDS : running.t + Math.min(delta, 0.05);
        const k = Math.min(1, running.t / FLEE_SECONDS);
        const along = k * k * FLEE_DISTANCE;
        body.position.set(0, body.position.y, 0);
        const group = body.parent?.parent;
        if (group) group.position.copy(at).addScaledVector(reaction.away, along);
        body.scale.setScalar(k < 0.65 ? 1 : Math.max(0, 1 - (k - 0.65) / 0.35));
        if (k >= 1 && !running.gone) {
          running.gone = true;
          gone.current?.();
        }
      }
    }
    const mesh = crownRef.current;
    if (!mesh || !head || !mesh.parent) return;
    // Ride the head bone: the crown sits on the baked head top and moves by
    // however far the head has moved since, so it bobs with the flying idle.
    head.getWorldPosition(world);
    mesh.parent.worldToLocal(world);
    headRest.current ??= world.clone();
    mesh.position
      .set(baked.top.x, baked.top.y - 0.04, baked.top.z)
      .add(world)
      .sub(headRest.current);
  });

  const height = heightOf(monster);
  return (
    <group
      ref={groupRef}
      position={at}
      name={`course-monster-live-${monster.role}`}
      onClick={(event) => {
        if (!onPick) return;
        event.stopPropagation();
        onPick(monster);
      }}
    >
      <group scale={height}>
        <group ref={bodyRef}>
          <group matrixAutoUpdate={false} matrix={baked.normalise}>
            {rig ? <primitive object={rig.model} /> : null}
          </group>
          {crown ? (
            <mesh
              ref={crownRef}
              geometry={crown.geometry}
              material={crown.material}
              position={[baked.top.x, baked.top.y - 0.04, baked.top.z]}
              scale={CROWN_SIZE}
              castShadow
              raycast={() => {}}
            />
          ) : null}
        </group>
      </group>
    </group>
  );
}
