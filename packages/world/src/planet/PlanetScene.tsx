/**
 * The first layer of the world is the same sky, seen from higher up.
 *
 * This scene deliberately has no globe, spherical terrain or planet-only
 * light rig. Each study is one real `projection: "world"` grid from Maps;
 * this file only composes those shared landmasses into one catalogue field and
 * chooses the camera distance that keeps their measured envelopes on screen.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";

import { buildWorldStudyGrid, COURSE_SKY_STOPS, Weather } from "../Maps.js";
import { Stage } from "../Stage.js";
import { renderTier } from "../sky/tier.js";
import { WorldHexField, type WorldGridIsland } from "../grid/WorldHexField.js";
import { studyMarkerColor, type PlanetStudy } from "./planet-copy.js";
import {
  PLANET_CAMERA_POLAR,
  placePlanetClusters,
  planetCameraDistance,
  type PlanetClusterLayout,
} from "./placement.js";

export const PLANET_ATMOSPHERE = {
  /** The selected study rises as a readable layer in the same air. */
  selectedLift: 1.08,
  /** A small scale change makes the selected landmass own the eye. */
  selectedScale: 1.045,
  /** Stronger than the world catalogue so distance becomes the separator. */
  fogNearRatio: 0.22,
  fogFarRatio: 1.65,
  cloudLevel: -10.2,
} as const;

interface PlanetStudyRecord {
  readonly key: string;
  readonly map: ReturnType<typeof buildWorldStudyGrid>;
}

interface PlanetProjection {
  readonly layout: PlanetClusterLayout;
  readonly records: ReadonlyMap<string, PlanetStudyRecord>;
}

/**
 * Build one actual shared world map per study, then feed the measured bounds
 * to the pure cluster solver. `useMemo` keeps this expensive generation stable
 * while selection only changes the visual transform below.
 */
function buildPlanetProjection(studies: readonly PlanetStudy[]): PlanetProjection {
  const records = new Map<string, PlanetStudyRecord>();
  const layoutInputs = studies.map((study) => {
    const map = buildWorldStudyGrid({
      studyId: study.id,
      studyTitle: study.title,
      courseCount: study.courseCount,
      lessonCount: study.lessonCount,
    });
    // The planet is the first-screen projection. The shared remote grid keeps
    // its terrain, underside and palette, while optional GLB props stay on the
    // catalogue projection because this standalone evidence host does not ship
    // the app's public asset root. This is the explicit prop-count divergence
    // allowed by the brief, not a second terrain path.
    records.set(study.id, { key: study.id, map: { ...map, props: [] } });
    return {
      studyId: study.id,
      courseCount: study.courseCount,
      lessonCount: study.lessonCount,
      cellCount: map.cells.length,
      halfX: map.bounds.halfX,
      halfZ: map.bounds.halfZ,
      centerX: (map.bounds.minX + map.bounds.maxX) * 0.5,
      centerZ: (map.bounds.minZ + map.bounds.maxZ) * 0.5,
    };
  });
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
  const radius = Math.max(1.35, cluster.radius + 0.62);
  const ringWidth = Math.min(0.46, Math.max(0.24, cluster.radius * 0.035));
  const marker = studyMarkerColor(studyId);

  useFrame(({ clock }) => {
    if (!ring.current || prefersReducedMotion()) return;
    const pulse = 1 + Math.sin(clock.getElapsedTime() * 2.2) * 0.055;
    ring.current.scale.setScalar(pulse);
  });

  return (
    <mesh
      ref={ring}
      name={`planet-study-focus-${studyId}`}
      position={[cluster.centerX, y + 0.12, cluster.centerZ]}
      rotation={[-Math.PI / 2, 0, 0]}
      renderOrder={10}
      userData={{ planetSelectedStudy: studyId, planetFocusRadius: radius }}
    >
      <ringGeometry args={[radius, radius + ringWidth, 48]} />
      <meshBasicMaterial
        color={marker.hex}
        transparent
        opacity={0.98}
        depthTest={false}
        depthWrite={false}
        fog={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
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
    return projection.layout.clusters.map((cluster) => {
      const record = projection.records.get(cluster.studyId);
      if (!record) throw new Error(`Missing planet study map ${cluster.studyId}`);
      const selected = cluster.studyId === selectedId;
      return {
        id: `study/${record.key}`,
        map: record.map,
        position: new THREE.Vector3(
          cluster.x,
          selected ? PLANET_ATMOSPHERE.selectedLift : 0,
          cluster.z,
        ),
        scale: selected ? PLANET_ATMOSPHERE.selectedScale : 1,
        dimmed: selectedId !== null && !selected,
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
          const cluster = projection.layout.clusters[islandIndex];
          if (cluster) onSelect?.(cluster.studyId);
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
  const aspect = size.height > 0 ? size.width / size.height : 1;
  const fov = camera instanceof THREE.PerspectiveCamera ? camera.fov : 34;
  const cameraDistance = planetCameraDistance(projection.layout.bounds, aspect, fov);
  // Weather's extent sizes the shared sky/ground assets. Keep its clouds near
  // the fitted field so their existing sculpted silhouettes remain readable
  // from this higher camera instead of shrinking into a row of specks.
  const weatherExtent = Math.max(projection.layout.bounds.maxHalf + 18, cameraDistance * 0.52);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const bag = globalThis as unknown as {
      __planetProjection?: () => unknown;
    };
    const describe = () => ({
      clusterCount: projection.layout.clusters.length,
      courseCount: projection.layout.clusters.reduce(
        (sum, cluster) => sum + cluster.courseCount,
        0,
      ),
      clusters: projection.layout.clusters,
      cells: projection.layout.clusters.reduce((sum, cluster) => sum + cluster.cellCount, 0),
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
        fogColor={COURSE_SKY_STOPS.nadir}
        sky={COURSE_SKY_STOPS}
        cloudLevel={PLANET_ATMOSPHERE.cloudLevel}
        includeSea={false}
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
