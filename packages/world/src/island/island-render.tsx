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
    style: { bottom: 0x4e8038, top: 0xeef9b8 },
    options: { density: 3.6 },
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
  const icon = (() => {
    switch (sigil) {
      case "star":
      case "sun":
        return <octahedronGeometry args={[radius * 0.34, 0]} />;
      case "mountain":
        return <coneGeometry args={[radius * 0.34, radius * 0.5, 3]} />;
      case "wave":
        return <torusGeometry args={[radius * 0.22, radius * 0.09, 5, 12, Math.PI * 1.25]} />;
      case "shell":
        return <sphereGeometry args={[radius * 0.28, 8, 5]} />;
      case "leaf":
      default:
        return <sphereGeometry args={[radius * 0.26, 7, 5]} />;
    }
  })();
  return (
    <group position={[0, radius * 0.18, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.75, radius * 0.88, 18]} />
        <meshBasicMaterial color={colour} transparent opacity={active ? 0.95 : 0.68} />
      </mesh>
      <mesh>
        {icon}
        <meshStandardMaterial
          color={colour}
          emissive={active ? colour : 0x000000}
          emissiveIntensity={active ? 0.4 : 0}
          roughness={0.5}
          metalness={0.05}
        />
      </mesh>
    </group>
  );
}
