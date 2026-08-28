/** React Three Fiber presentation for an IslandBlueprint. */
import { useFrame } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { buildIslandGeometry, type IslandGeometryDetail } from "./island-geometry.js";
import { IslandGrass, type IslandGrassStyle } from "./island-grass-render.js";
import { islandDressingSafetyZones, planIslandDressing } from "./island-dressing.js";
import {
  createIslandSurfaceMaterialAdapter,
  DEFAULT_ISLAND_SURFACE_STYLE,
  islandLookFrozen,
  resolveIslandSurfaceStyle,
  type IslandSurfaceTimeUniform,
  type IslandSurfaceRole,
  type IslandSurfaceStyleId,
} from "./island-surface-style.js";
import type { IslandBlueprint, IslandUnitSigil } from "./island-blueprint.js";

const TECH = 0x5a6572;
const TECH_DARK = 0x303a46;
const CYAN = 0x55d9ff;
const HERO_GOLD = 0xffc75a;

const GRASS_LOOKS: Readonly<
  Record<
    IslandSurfaceStyleId,
    { readonly style: IslandGrassStyle; readonly options: { readonly density: number } }
  >
> = {
  diorama: {
    style: { bottom: 0x2d6e32, top: 0x5daa3c },
    options: { density: 4.95 },
  },
  elemental: {
    style: {
      bottom: 0x5b9163,
      top: 0xb9df91,
      windStrength: 0.085,
      windSpeed: 1.3,
    },
    options: { density: 3.8 },
  },
  mossy: {
    style: { bottom: 0x527e46, top: 0x8fb65c, windSpeed: 0.92 },
    options: { density: 4.2 },
  },
  desert: {
    style: { bottom: 0x8a754b, top: 0xc6ad6c, windStrength: 0.05 },
    options: { density: 0.9 },
  },
};

export interface IslandRenderProps {
  readonly blueprint: IslandBlueprint;
  readonly detail: IslandGeometryDetail;
  readonly targetRadius?: number;
  readonly onClick?: () => void;
  readonly onPointerOver?: () => void;
  readonly onPointerOut?: () => void;
  readonly dimmed?: boolean;
}

function IslandSurfaceMaterial({
  role,
  style,
  vertexColors,
  roughness,
  metalness,
  polygonOffset = false,
  polygonOffsetFactor,
  timeUniform,
}: {
  readonly role: IslandSurfaceRole;
  readonly style: IslandSurfaceStyleId;
  readonly vertexColors: boolean;
  readonly roughness: number;
  readonly metalness: number;
  readonly polygonOffset?: boolean;
  readonly polygonOffsetFactor?: number;
  readonly timeUniform: IslandSurfaceTimeUniform;
}) {
  const adapter = useMemo(
    () => createIslandSurfaceMaterialAdapter(role, style, import.meta.env.DEV, timeUniform),
    [role, timeUniform],
  );
  useLayoutEffect(() => {
    adapter.setStyle(style);
  }, [adapter, style]);
  return (
    <meshStandardMaterial
      vertexColors={vertexColors}
      roughness={roughness}
      metalness={metalness}
      polygonOffset={polygonOffset}
      polygonOffsetFactor={polygonOffsetFactor}
      onBeforeCompile={adapter.enabled ? adapter.onBeforeCompile : undefined}
      customProgramCacheKey={adapter.enabled ? adapter.customProgramCacheKey : undefined}
    />
  );
}

function colourWithDimmed(colour: number, dimmed: boolean): THREE.Color {
  return new THREE.Color(colour).multiplyScalar(dimmed ? 0.64 : 1);
}

/** Low-poly tech rim and thrusters; one instanced batch, not one mesh per pod. */
function TechUnderside({
  blueprint,
  scale,
  depth,
  detail,
  dimmed,
}: {
  readonly blueprint: IslandBlueprint;
  readonly scale: number;
  readonly depth: number;
  readonly detail: IslandGeometryDetail;
  readonly dimmed: boolean;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const podsRef = useRef<THREE.InstancedMesh>(null);
  const glowsRef = useRef<THREE.InstancedMesh>(null);
  const podCount =
    detail === "world" ? 4 : Math.min(8, Math.max(4, blueprint.underside.ringCount * 2));
  const ringRatio = detail === "world" ? 0.84 : 0.7;
  const ringRadiusX = blueprint.bounds.halfX * scale * ringRatio;
  const ringRadiusZ = blueprint.bounds.halfZ * scale * ringRatio;
  const ringThickness = Math.max(0.05, Math.min(ringRadiusX, ringRadiusZ) * 0.035);
  const podTransforms = useMemo(() => {
    const bodies: THREE.Matrix4[] = [];
    const glows: THREE.Matrix4[] = [];
    // The overview camera mainly sees the island's front lip. Put the world
    // pods on the exposed lower collar instead of burying them halfway inside
    // the rock taper; the course projection keeps the subtler inset version.
    const y = -depth * (detail === "world" ? 0.68 : 0.52);
    const podRadius = Math.max(0.1, Math.min(ringRadiusX, ringRadiusZ) * 0.075);
    const podHeight = Math.max(0.32, depth * (detail === "world" ? 0.2 : 0.14));
    for (let index = 0; index < podCount; index += 1) {
      const angle = (index / podCount) * Math.PI * 2 + 0.2;
      const x = Math.cos(angle) * ringRadiusX;
      const z = Math.sin(angle) * ringRadiusZ;
      bodies.push(
        new THREE.Matrix4().compose(
          new THREE.Vector3(x, y, z),
          new THREE.Quaternion(),
          new THREE.Vector3(podRadius, podHeight, podRadius),
        ),
      );
      glows.push(
        new THREE.Matrix4().compose(
          new THREE.Vector3(x, y - podHeight * 0.78, z),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI, 0, 0)),
          new THREE.Vector3(podRadius * 0.68, podHeight * 0.92, podRadius * 0.68),
        ),
      );
    }
    return { bodies, glows };
  }, [depth, podCount, ringRadiusX, ringRadiusZ]);
  useLayoutEffect(() => {
    const bodies = podsRef.current;
    const glows = glowsRef.current;
    if (!bodies || !glows) return;
    podTransforms.bodies.forEach((matrix, index) => bodies.setMatrixAt(index, matrix));
    podTransforms.glows.forEach((matrix, index) => glows.setMatrixAt(index, matrix));
    bodies.instanceMatrix.needsUpdate = true;
    glows.instanceMatrix.needsUpdate = true;
    bodies.computeBoundingSphere();
    glows.computeBoundingSphere();
  }, [podTransforms]);
  useFrame(({ clock }) => {
    if (import.meta.env.DEV && islandLookFrozen()) return;
    const ring = ringRef.current;
    if (!ring) return;
    const material = ring.material;
    if (!(material instanceof THREE.MeshBasicMaterial)) return;
    material.opacity = 0.56 + Math.sin(clock.elapsedTime * 1.4) * 0.1;
  });

  const y = -depth * (detail === "world" ? 0.6 : 0.33);
  return (
    <group>
      <mesh
        position={[0, y, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[ringRadiusX, ringRadiusZ, ringThickness / 0.06]}
      >
        <torusGeometry args={[1, 0.06, 6, detail === "world" ? 20 : 32]} />
        <meshStandardMaterial
          color={colourWithDimmed(TECH, dimmed)}
          roughness={0.42}
          metalness={0.78}
        />
      </mesh>
      <mesh
        ref={ringRef}
        position={[0, y + scale * 0.03, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[ringRadiusX, ringRadiusZ, (ringThickness * 0.45) / 0.018]}
      >
        <torusGeometry args={[1, 0.018, 5, detail === "world" ? 20 : 32]} />
        <meshBasicMaterial
          color={dimmed ? TECH : CYAN}
          transparent
          opacity={0.72}
          depthWrite={false}
        />
      </mesh>
      <instancedMesh ref={podsRef} args={[undefined, undefined, podCount]}>
        <cylinderGeometry args={[0.72, 1, 1, detail === "world" ? 6 : 8]} />
        <meshStandardMaterial
          color={colourWithDimmed(TECH_DARK, dimmed)}
          roughness={0.38}
          metalness={0.84}
        />
      </instancedMesh>
      <instancedMesh ref={glowsRef} args={[undefined, undefined, podCount]}>
        <coneGeometry args={[1, 1, detail === "world" ? 5 : 7]} />
        <meshBasicMaterial
          color={dimmed ? TECH : CYAN}
          transparent
          opacity={0.65}
          depthWrite={false}
        />
      </instancedMesh>
      {/*
        What actually survives the archipelago's scale.

        A whole tech chassis — hull plate, radial ribs, a core — was built for
        this view and thrown away, because measuring the shot settled the
        argument: on the world map an island is about 120 px across and its
        underside about 20, and the `world-design` capture puts a whole island
        inside 40 px. Structure does not exist at 8 px. Three things do:
        silhouette, a value break, and one bright pixel.

        So the far LOD gets a pale collar tucked under the lip — the value
        break that says "this is not rock all the way down" — and one emissive
        bead at the root, which is the bright pixel that says "machine". Two
        draws, no instancing, no per-island geometry.
      */}
      <mesh
        position={[0, -depth * 0.26, 0]}
        scale={[ringRadiusX / ringRatio, depth * 0.2, ringRadiusZ / ringRatio]}
      >
        <cylinderGeometry args={[0.88, 0.7, 1, detail === "world" ? 16 : 26, 1, true]} />
        <meshStandardMaterial
          color={colourWithDimmed(TECH, dimmed)}
          roughness={0.44}
          metalness={0.72}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, -depth * 0.86, 0]}>
        <sphereGeometry args={[Math.max(0.18, Math.min(ringRadiusX, ringRadiusZ) * 0.1), 8, 6]} />
        <meshBasicMaterial
          color={dimmed ? TECH : CYAN}
          transparent
          opacity={dimmed ? 0.35 : 0.95}
        />
      </mesh>
    </group>
  );
}

/**
 * A small repeatable navigation beacon for the world projection.
 *
 * The course projection gets its identity from the selected accent recipe. A
 * generic cyan gate beside a Fantasy Town academy read as a third surface
 * theme and competed with the real landmark, so this fallback belongs only to
 * the far LOD while the remaining recipe packs are still being imported.
 */
function HeroLandmark({
  blueprint,
  scale,
  detail,
  dimmed,
}: {
  readonly blueprint: IslandBlueprint;
  readonly scale: number;
  readonly detail: IslandGeometryDetail;
  readonly dimmed: boolean;
}) {
  const crystal = useRef<THREE.Mesh>(null);
  const position = useMemo(
    () =>
      new THREE.Vector3(
        blueprint.hero.x * scale,
        blueprint.hero.y * scale,
        blueprint.hero.z * scale,
      ),
    [blueprint, scale],
  );
  useFrame(({ clock }) => {
    if (import.meta.env.DEV && islandLookFrozen()) return;
    const mesh = crystal.current;
    if (!mesh) return;
    mesh.rotation.y = clock.elapsedTime * 0.55;
    const pulse = 1 + Math.sin(clock.elapsedTime * 1.7) * 0.06;
    mesh.scale.setScalar(pulse);
  });
  const factor = scale * (detail === "world" ? 4.2 : 1);
  return (
    <group position={position} rotation={[0, -blueprint.hero.heading, 0]} scale={factor}>
      <mesh position={[-0.78, 1.05, 0]} castShadow>
        <boxGeometry args={[0.28, 2.1, 0.36]} />
        <meshStandardMaterial
          color={colourWithDimmed(TECH_DARK, dimmed)}
          roughness={0.5}
          metalness={0.55}
        />
      </mesh>
      <mesh position={[0.78, 1.05, 0]} castShadow>
        <boxGeometry args={[0.28, 2.1, 0.36]} />
        <meshStandardMaterial
          color={colourWithDimmed(TECH_DARK, dimmed)}
          roughness={0.5}
          metalness={0.55}
        />
      </mesh>
      <mesh position={[0, 2.02, 0]} castShadow>
        <boxGeometry args={[1.84, 0.28, 0.36]} />
        <meshStandardMaterial
          color={colourWithDimmed(TECH, dimmed)}
          roughness={0.4}
          metalness={0.64}
        />
      </mesh>
      <mesh ref={crystal} position={[0, 1.35, 0.02]}>
        <octahedronGeometry args={[0.45, 0]} />
        <meshStandardMaterial
          color={dimmed ? TECH : CYAN}
          emissive={dimmed ? 0x000000 : CYAN}
          emissiveIntensity={dimmed ? 0 : 1.3}
          roughness={0.18}
          metalness={0.18}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
        <cylinderGeometry args={[1.18, 1.35, 0.16, detail === "world" ? 12 : 20]} />
        <meshStandardMaterial
          color={colourWithDimmed(HERO_GOLD, dimmed)}
          roughness={0.42}
          metalness={0.38}
        />
      </mesh>
    </group>
  );
}

/** One terrain projection; callers decide whether it is clickable. */
export function IslandRender({
  blueprint,
  detail,
  targetRadius,
  onClick,
  onPointerOver,
  onPointerOut,
  dimmed = false,
}: IslandRenderProps) {
  const surfaceStyle = import.meta.env.DEV
    ? resolveIslandSurfaceStyle()
    : DEFAULT_ISLAND_SURFACE_STYLE;
  const grassLook = GRASS_LOOKS[surfaceStyle];
  const surfaceTime = useRef<IslandSurfaceTimeUniform>({ value: 0 });
  // Grass and dressing are rendered by sibling components in Maps.tsx. Build
  // the pure dressing plan once here as well so the grass planner can reserve
  // the exact authored landmark/prop aprons instead of guessing positions.
  const dressingPlan = useMemo(
    () =>
      detail === "course" && blueprint.themeSelection.recipeId
        ? planIslandDressing(blueprint, "course")
        : null,
    [blueprint, detail],
  );
  const grassSafetyZones = useMemo(
    () => (dressingPlan ? islandDressingSafetyZones(dressingPlan) : undefined),
    [dressingPlan],
  );
  useFrame(({ clock }) => {
    // The optional Elemental look is DEV-only. One shared uniform per island
    // keeps the terrain's procedural colour in phase without another loop.
    if (import.meta.env.DEV && !islandLookFrozen() && surfaceStyle === "elemental") {
      surfaceTime.current.value = clock.elapsedTime;
    }
  });
  const shape = useMemo(
    () => buildIslandGeometry(blueprint, detail, targetRadius),
    [blueprint, detail, targetRadius],
  );
  useEffect(
    () => () => {
      shape.terrain.dispose();
    },
    [shape],
  );
  return (
    <group
      onClick={
        onClick
          ? (event) => {
              event.stopPropagation();
              onClick();
            }
          : undefined
      }
      onPointerOver={
        onPointerOver
          ? (event) => {
              event.stopPropagation();
              onPointerOver();
            }
          : undefined
      }
      onPointerOut={
        onPointerOut
          ? (event) => {
              event.stopPropagation();
              onPointerOut();
            }
          : undefined
      }
    >
      <mesh geometry={shape.terrain} castShadow receiveShadow>
        <IslandSurfaceMaterial
          role="terrain"
          style={surfaceStyle}
          vertexColors
          roughness={0.68}
          metalness={0}
          timeUniform={surfaceTime.current}
        />
      </mesh>
      {detail === "course" ? (
        <>
          <IslandGrass
            blueprint={blueprint}
            detail="course"
            targetRadius={targetRadius}
            style={grassLook.style}
            options={{ ...grassLook.options, safetyZones: grassSafetyZones }}
          />
        </>
      ) : null}
      <TechUnderside
        blueprint={blueprint}
        scale={shape.scale}
        depth={shape.bounds.depth}
        detail={detail}
        dimmed={dimmed}
      />
      {detail === "world" ? (
        <HeroLandmark blueprint={blueprint} scale={shape.scale} detail={detail} dimmed={dimmed} />
      ) : null}
    </group>
  );
}

const SIGIL_COLOURS = [0x80bd62, 0x5cc6c8, 0xf0b45c, 0xc18fe4, 0x8ea7d8, 0xff9b69] as const;

/**
 * How many arcs the unit ring is broken into, per sigil.
 *
 * The count is the cue, not the colour: three arcs and six arcs are different
 * at a glance in greyscale, which is what v5 決定 D asks of a unit's visual
 * family ("即使把颜色去掉…也能靠符号、环纹、状态和 DOM 标签认出").
 */
const SIGIL_ARCS: Readonly<Record<IslandUnitSigil, number>> = {
  mountain: 2,
  leaf: 3,
  wave: 4,
  star: 5,
  shell: 6,
  sun: 8,
};

const UNIT_RING_INNER = 0.66;
const UNIT_RING_OUTER = 0.86;
/** Fraction of each arc's slot left empty, so the arcs read as separate marks. */
const UNIT_RING_GAP = 0.3;

const unitRingCache = new Map<number, THREE.BufferGeometry>();

/**
 * A flat notched ring, lying in the XZ plane, built without a merge helper.
 *
 * The marker this replaces floated a solid octahedron/cone/sphere above the
 * disc and drew a full ring under it. At the course camera that reads, in the
 * product owner's words, as "一个圆圈中间一个莫名其妙的小东西" — and the art
 * reference the product is aimed at (docs/reference/island-art-reference) has
 * clean pale discs with nothing standing on them. Engraving the unit cue into
 * the disc's own face keeps the reference's silhouette, keeps the non-colour
 * cue v5 requires, and costs one mesh per marker instead of two.
 */
function unitRingGeometry(arcs: number): THREE.BufferGeometry {
  const cached = unitRingCache.get(arcs);
  if (cached) return cached;
  const positions: number[] = [];
  const indices: number[] = [];
  const stepsPerArc = Math.max(3, Math.round(24 / arcs));
  const slot = (Math.PI * 2) / arcs;
  const span = slot * (1 - UNIT_RING_GAP);
  for (let arc = 0; arc < arcs; arc += 1) {
    const start = arc * slot + (slot - span) / 2;
    const base = positions.length / 3;
    for (let step = 0; step <= stepsPerArc; step += 1) {
      const angle = start + (step / stepsPerArc) * span;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      positions.push(cos * UNIT_RING_INNER, 0, sin * UNIT_RING_INNER);
      positions.push(cos * UNIT_RING_OUTER, 0, sin * UNIT_RING_OUTER);
    }
    for (let step = 0; step < stepsPerArc; step += 1) {
      const a = base + step * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  unitRingCache.set(arcs, geometry);
  return geometry;
}

/** Non-colour unit cue; the geometry survives colour-blind / low-contrast views. */
export function UnitSigil({
  sigil,
  unitIndex,
  radius,
  active = false,
}: {
  readonly sigil: IslandUnitSigil;
  readonly unitIndex: number;
  readonly radius: number;
  readonly active?: boolean;
}) {
  const colour = SIGIL_COLOURS[unitIndex % SIGIL_COLOURS.length]!;
  const geometry = unitRingGeometry(SIGIL_ARCS[sigil]);
  // The disc is a cylinder of height radius*0.2 centred at radius*0.1, so its
  // top face is at radius*0.2. Sit one thousandth of a radius above that: any
  // less z-fights, any more and the ring floats off its own disc.
  return (
    <mesh
      geometry={geometry}
      position={[0, radius * 0.202, 0]}
      scale={[radius, 1, radius]}
      renderOrder={1}
    >
      <meshBasicMaterial
        color={colour}
        transparent
        opacity={active ? 0.98 : 0.72}
        depthWrite={false}
      />
    </mesh>
  );
}
