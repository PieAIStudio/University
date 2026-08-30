/**
 * The first layer of the world is the same sky, seen from higher up.
 *
 * This scene deliberately has no globe, spherical terrain or planet-only
 * light rig. Each course is the real `projection: "world"` grid from Maps;
 * this file only composes those shared remote islands into study clusters and
 * chooses the camera distance that keeps their measured envelopes on screen.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";

import { buildWorldCourseGrid, skyStopsForStudy, Weather, WORLD_SKY_CONTRACT } from "../Maps.js";
import type { CourseNode } from "../course/course.js";
import { Stage } from "../Stage.js";
import { renderTier } from "../sky/tier.js";
import { WorldHexField, type WorldGridIsland } from "../grid/WorldHexField.js";
import { studyMarkerColor, type PlanetStudy } from "./planet-copy.js";
import {
  PLANET_CAMERA_POLAR,
  PLANET_CLUSTER_LAYOUT_CONTRACT,
  placePlanetClusters,
  planetCameraDistance,
  type PlanetClusterLayout,
} from "./placement.js";

export const PLANET_ATMOSPHERE = {
  /** The selected study rises as a readable layer in the same air. */
  selectedLift: 0.48,
  /** Stronger than the world catalogue so distance becomes the separator. */
  fogNearRatio: 0.34,
  fogFarRatio: 2.8,
  cloudLevel: -5.2,
} as const;

interface PlanetCourseRecord {
  readonly key: string;
  readonly node: CourseNode;
  readonly map: ReturnType<typeof buildWorldCourseGrid>;
}

interface PlanetProjection {
  readonly layout: PlanetClusterLayout;
  readonly records: ReadonlyMap<string, PlanetCourseRecord>;
}

function courseKey(studyId: string, courseId: string): string {
  return `${studyId}/${courseId}`;
}

function nodeForCourse(study: PlanetStudy, course: PlanetStudy["courses"][number]): CourseNode {
  return {
    courseId: course.id,
    title: course.title,
    lessons: Math.max(1, Math.floor(course.lessonCount)),
    studyId: study.id,
    studyTitle: study.title,
    depth: course.depth,
    prerequisiteCourseIds: [],
    trackId: null,
  };
}

/**
 * Build the planet from actual world maps, then feed their measured bounds to
 * the pure cluster solver. `useMemo` keeps this expensive shared generation
 * stable while selection only changes the visual transform below.
 */
function buildPlanetProjection(studies: readonly PlanetStudy[]): PlanetProjection {
  const records = new Map<string, PlanetCourseRecord>();
  const layoutInputs = studies.map((study) => ({
    studyId: study.id,
    courses: study.courses.map((course) => {
      const node = nodeForCourse(study, course);
      const map = buildWorldCourseGrid(node);
      const key = courseKey(study.id, course.id);
      // The planet is the first-screen projection. The shared remote grid
      // keeps its terrain, underside and palette, while optional GLB props
      // stay on the catalogue projection because this standalone evidence
      // host does not ship the app's public asset root. This is the explicit
      // prop-count divergence allowed by the brief, not a second terrain path.
      records.set(key, { key, node, map: { ...map, props: [] } });
      return {
        studyId: study.id,
        courseId: course.id,
        halfX: map.bounds.halfX,
        halfZ: map.bounds.halfZ,
        centerX: (map.bounds.minX + map.bounds.maxX) * 0.5,
        centerZ: (map.bounds.minZ + map.bounds.maxZ) * 0.5,
      };
    }),
  }));
  return { layout: placePlanetClusters(layoutInputs), records };
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function PlanetClusterFocus({
  cluster,
  studyId,
  y,
}: {
  readonly cluster: PlanetClusterLayout["clusters"][number];
  readonly studyId: string;
  readonly y: number;
}) {
  const ring = useRef<THREE.Mesh>(null);
  const radius = Math.min(4.6, Math.max(1.35, cluster.radius * 0.2));
  const marker = studyMarkerColor(studyId);

  useFrame(({ clock }) => {
    if (!ring.current || prefersReducedMotion()) return;
    const pulse = 1 + Math.sin(clock.getElapsedTime() * 2.2) * 0.055;
    ring.current.scale.setScalar(pulse);
  });

  return (
    <>
      <mesh
        name={`planet-study-focus-halo-${studyId}`}
        position={[cluster.centerX, y + 0.04, cluster.centerZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={-1}
      >
        <circleGeometry args={[radius * 1.1, 32]} />
        <meshBasicMaterial
          color={marker.hex}
          transparent
          opacity={0.1}
          depthTest={false}
          depthWrite={false}
          fog={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh
        ref={ring}
        name={`planet-study-focus-${studyId}`}
        position={[cluster.centerX, y + 0.08, cluster.centerZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={10}
        userData={{ planetSelectedStudy: studyId, planetFocusRadius: radius }}
      >
        <ringGeometry args={[radius, radius + 0.105, 32]} />
        <meshBasicMaterial
          color={marker.hex}
          transparent
          opacity={0.92}
          depthTest={false}
          depthWrite={false}
          fog={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </>
  );
}

function PlanetField({
  projection,
  selectedId,
  onSelect,
}: {
  readonly projection: PlanetProjection;
  readonly selectedId: string | null;
  readonly onSelect?: (studyId: string) => void;
}) {
  const islands = useMemo<readonly WorldGridIsland[]>(() => {
    return projection.layout.courses.map((course) => {
      const record = projection.records.get(courseKey(course.studyId, course.courseId));
      if (!record) throw new Error(`Missing planet world map ${course.studyId}/${course.courseId}`);
      return {
        id: record.key,
        map: record.map,
        position: new THREE.Vector3(
          course.x,
          course.studyId === selectedId ? PLANET_ATMOSPHERE.selectedLift : 0,
          course.z,
        ),
        scale: PLANET_CLUSTER_LAYOUT_CONTRACT.courseScale,
        dimmed: selectedId !== null && course.studyId !== selectedId,
      };
    });
  }, [projection, selectedId]);

  const selectedCluster =
    selectedId === null
      ? null
      : (projection.layout.clusters.find((cluster) => cluster.studyId === selectedId) ?? null);

  return (
    <>
      <WorldHexField
        islands={islands}
        onPick={(islandIndex) => {
          const course = projection.layout.courses[islandIndex];
          if (course) onSelect?.(course.studyId);
        }}
        onHover={() => undefined}
      />
      {selectedCluster ? (
        <PlanetClusterFocus
          cluster={selectedCluster}
          studyId={selectedCluster.studyId}
          y={PLANET_ATMOSPHERE.selectedLift}
        />
      ) : null}
    </>
  );
}

function PlanetCameraRig({ bounds }: { readonly bounds: PlanetClusterLayout["bounds"] }) {
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    const aspect = size.height > 0 ? size.width / size.height : 1;
    const distance = planetCameraDistance(bounds, aspect, camera.fov);
    const offset = new THREE.Vector3().setFromSpherical(
      new THREE.Spherical(distance, PLANET_CAMERA_POLAR, 0.16),
    );
    camera.position.copy(offset);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, bounds, size.height, size.width]);
  return null;
}

export interface PlanetSceneProps {
  readonly studies: readonly PlanetStudy[];
  readonly selectedId: string | null;
  readonly onSelect?: (studyId: string) => void;
}

export function PlanetScene({ studies, selectedId, onSelect }: PlanetSceneProps) {
  const projection = useMemo(() => buildPlanetProjection(studies), [studies]);
  const { camera, size } = useThree();
  const sky = useMemo(
    () => ({
      ...skyStopsForStudy(null),
      horizon: WORLD_SKY_CONTRACT.horizon,
      nadir: WORLD_SKY_CONTRACT.nadir,
    }),
    [],
  );
  const aspect = size.height > 0 ? size.width / size.height : 1;
  const fov = camera instanceof THREE.PerspectiveCamera ? camera.fov : 34;
  const cameraDistance = planetCameraDistance(projection.layout.bounds, aspect, fov);
  // Weather's extent sizes the shared sky/ground assets; fog is tied to the
  // fitted camera distance so the mobile portrait shot does not turn the
  // whole catalogue into one cyan wall merely because its horizontal FOV is
  // narrower.
  const weatherExtent = Math.max(projection.layout.bounds.maxHalf + 8, cameraDistance * 0.94);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const bag = globalThis as unknown as {
      __planetProjection?: () => unknown;
    };
    const describe = () => ({
      clusterCount: projection.layout.clusters.length,
      courseCount: projection.layout.courses.length,
      clusters: projection.layout.clusters,
      cells: [...projection.records.values()].reduce(
        (sum, record) => sum + record.map.cells.length,
        0,
      ),
      bounds: projection.layout.bounds,
      selectedId,
      selectedLift: PLANET_ATMOSPHERE.selectedLift,
    });
    bag.__planetProjection = describe;
    return () => {
      if (bag.__planetProjection === describe) delete bag.__planetProjection;
    };
  }, [projection, selectedId]);

  return (
    <>
      <PlanetCameraRig bounds={projection.layout.bounds} />
      <Weather
        extent={weatherExtent}
        groundRadius={weatherExtent * 0.9}
        fog={[
          cameraDistance * PLANET_ATMOSPHERE.fogNearRatio,
          cameraDistance * PLANET_ATMOSPHERE.fogFarRatio,
        ]}
        fogColor={WORLD_SKY_CONTRACT.fogColor}
        sky={sky}
        cloudLevel={PLANET_ATMOSPHERE.cloudLevel}
        includeSea={WORLD_SKY_CONTRACT.visibleSea}
        includeDistantGround
        shadows={false}
      />
      <PlanetField projection={projection} selectedId={selectedId} onSelect={onSelect} />
    </>
  );
}

function planetCamera(): readonly [number, number, number] {
  return renderTier() === "mobile" ? [0, 22, 40] : [0, 34, 58];
}

export function PlanetStage({
  children,
  ...props
}: PlanetSceneProps & { readonly children?: ReactNode }) {
  return (
    <Stage cameraFrom={planetCamera()} lookAt={[0, 0, 0]} ambientOcclusion={false}>
      <PlanetScene {...props} />
      {children}
    </Stage>
  );
}
