/** Domain planets carry real study regions in their atmosphere (V5 decision M). */
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as THREE from "three";
import { Stage } from "../Stage.js";
import type { AvatarRecipe } from "../avatar/index.js";
import { HOP_DURATION_MS } from "../avatar/hop.js";
import { MapLighting } from "../sky/lighting.js";
import { SkyDome } from "../sky/skydome.js";
import { renderTier } from "../sky/tier.js";
import { CLOUD_RENDER_ORDER, createCloudMaterial } from "../sky/cloud-material.js";
import { islandLookFrozen } from "../island/island-surface-style.js";
import { usePrefersReducedMotion } from "../reduced-motion.js";
import { studyMarkerColor, type PlanetStudy, type PlanetStudyDomain } from "./planet-copy.js";
import { buildDomainPlan, type DomainPlanGroup } from "./domain-plan.js";
import { PlanetDomainLabels, PlanetResourceStatus } from "./PlanetDomainLabels.js";
import { useDomainResources, type DomainResourceStatus } from "./use-domain-resources.js";
import { domainPreparation } from "./domain-preparation-client.js";
import {
  domainCameraDistance,
  domainLabelWidth,
  DOMAIN_OUTER_RADIUS,
  DOMAIN_VIEW_FRONT as FRONT,
  DOMAIN_VIEW_UP,
  layoutDomainPlan,
  type DomainPlacement,
} from "./domain-layout.js";
import { createDomainGlobeGeometry, createDomainCloudGeometry } from "./globe-geometry.js";
import {
  planAtmosphericRegions,
  planetRepresentativeLimit,
  DOMAIN_RADIUS,
  REGION_HIT_RADIUS,
  atmosphericGeometryKey,
  isAtmosphericRegionFacingCamera,
} from "./atmospheric-regions.js";

/** Physical dimensions, rather than selection-dependent island exaggeration. */
export const PLANET_ATMOSPHERE = { radius: DOMAIN_RADIUS, regionAltitude: 1.12 } as const;
const ORBIT_SKY = { zenith: 0x192e4e, mid: 0x425d79, horizon: 0x889eae, nadir: 0x233c58 };
function DomainPlanet({
  domain,
  active,
  position,
  selectedId,
  onSelect,
  onSelectDomain,
  labelNodes,
  retry = 0,
  onResourceStatus,
  motionReduced,
}: {
  readonly domain: DomainPlanGroup;
  readonly active: boolean;
  readonly position: readonly [number, number, number];
  readonly selectedId: string | null;
  readonly onSelect?: (id: string) => void;
  readonly onSelectDomain?: (id: string) => void;
  readonly labelNodes?: ReadonlyMap<string, HTMLElement>;
  readonly retry?: number;
  readonly onResourceStatus?: (status: DomainResourceStatus) => void;
  readonly motionReduced: boolean;
}) {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const hits = useRef<THREE.InstancedMesh>(null);
  const turn = useRef({ from: new THREE.Quaternion(), startedAt: 0 });
  const initialized = useRef(false);
  const lastSelected = useRef<string | undefined>(undefined);
  const target = useRef(new THREE.Quaternion());
  const cameraPoint = useRef(new THREE.Vector3());
  const labelPoint = useRef(new THREE.Vector3());
  const labelEdge = useRef(new THREE.Vector3());
  const labelAnchor = useRef<{ x: number; y: number; node: HTMLElement | null }>({
    x: NaN,
    y: NaN,
    node: null,
  });
  const viewportWidth = useThree((state) => state.size.width);
  const representativeLimit = planetRepresentativeLimit(viewportWidth, renderTier());
  const geometryKey = atmosphericGeometryKey(domain.studies, representativeLimit);
  // Intentionally keyed by shape inputs, not learning-progress object identity.
  const regions = useMemo(
    () => planAtmosphericRegions(domain.studies, representativeLimit),
    [geometryKey],
  );
  const globe = useMemo(
    () => createDomainGlobeGeometry(domain.id, domain.surfaceStyle),
    [domain.id, domain.surfaceStyle],
  );
  const cloud = useMemo(
    () =>
      createDomainCloudGeometry(
        domain.id,
        regions.map((region) => region.normal),
      ),
    [domain.id, geometryKey],
  );
  const cloudMaterial = useMemo(() => createCloudMaterial(), []);
  const { resources, preparationMs } = useDomainResources(
    domain.id,
    domain.studies,
    retry,
    onResourceStatus,
    representativeLimit,
    domain.surfaceStyle,
  );
  // Catalog refreshes rebuild only the islands. Each resource owns its cleanup
  // so that change cannot dispose a globe/texture still used by this planet.
  useEffect(() => () => globe.dispose(), [globe]);
  useEffect(() => () => cloud.dispose(), [cloud]);
  useEffect(() => () => cloudMaterial.dispose(), [cloudMaterial]);
  const selected = regions.find((region) => region.studyId === selectedId);
  const oriented =
    selected ?? regions.find((region) => region.studyId === lastSelected.current) ?? regions[0];
  useLayoutEffect(() => {
    if (selected) lastSelected.current = selected.studyId;
    if (body.current) turn.current.from.copy(body.current.quaternion);
    turn.current.startedAt = performance.now();
  }, [oriented?.studyId]);
  useLayoutEffect(() => {
    if (!hits.current) return;
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < regions.length; i++) {
      matrix.makeTranslation(regions[i]!.position);
      hits.current.setMatrixAt(i, matrix);
    }
    hits.current.instanceMatrix.needsUpdate = true;
    hits.current.computeBoundingSphere();
  }, [regions, resources]);
  useFrame(({ camera, size }) => {
    if (!root.current || !body.current) return;
    // Each peer faces the actual camera from its own centre. A fixed global
    // normal is wrong for off-centre planets and fails after a narrow resize.
    camera.getWorldPosition(cameraPoint.current);
    root.current.worldToLocal(cameraPoint.current).normalize();
    target.current.setFromUnitVectors(oriented?.normal ?? FRONT, cameraPoint.current);
    if (!initialized.current) {
      body.current.quaternion.copy(target.current);
      turn.current.from.copy(target.current);
      initialized.current = true;
    }
    // Selection travel follows elapsed time even when a frame is late.
    // Capping delta here would stretch a 420ms turn on a slower device.
    const elapsedMs = Math.max(0, performance.now() - turn.current.startedAt);
    const frozen = motionReduced || islandLookFrozen();
    const progress = frozen ? 1 : Math.min(1, elapsedMs / HOP_DURATION_MS);
    body.current.quaternion.slerpQuaternions(
      turn.current.from,
      target.current,
      1 - (1 - progress) ** 3,
    );
    const label = labelNodes?.get(domain.id);
    if (label) {
      labelPoint.current.copy(DOMAIN_VIEW_UP).multiplyScalar(DOMAIN_RADIUS * 1.24);
      root.current.localToWorld(labelPoint.current);
      labelEdge.current.copy(labelPoint.current);
      labelEdge.current.x += DOMAIN_OUTER_RADIUS;
      labelEdge.current.project(camera);
      labelPoint.current.project(camera);
      const x = (labelPoint.current.x * 0.5 + 0.5) * size.width;
      const y = (-labelPoint.current.y * 0.5 + 0.5) * size.height;
      const pixelsPerUnit =
        (Math.abs(labelEdge.current.x - labelPoint.current.x) * size.width) /
        (2 * DOMAIN_OUTER_RADIUS);
      const maxWidth = `${domainLabelWidth(pixelsPerUnit).toFixed(2)}px`;
      if (label.style.maxWidth !== maxWidth) label.style.maxWidth = maxWidth;
      const previous = labelAnchor.current;
      if (
        previous.node !== label ||
        Math.abs(previous.x - x) > 0.01 ||
        Math.abs(previous.y - y) > 0.01
      ) {
        label.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) translate(-50%, -100%)`;
        previous.x = x;
        previous.y = y;
        previous.node = label;
      }
    }
  });
  const pickRegion = (event: ThreeEvent<MouseEvent>) => {
    const region = event.instanceId === undefined ? undefined : regions[event.instanceId];
    if (!region || !body.current) return;
    if (
      !isAtmosphericRegionFacingCamera(
        region,
        body.current.matrixWorld,
        event.camera.getWorldPosition(new THREE.Vector3()),
      )
    )
      return;
    event.stopPropagation();
    onSelectDomain?.(domain.id);
    onSelect?.(region.studyId);
  };
  const focusOrientation = selected
    ? new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), selected.normal)
    : undefined;
  return (
    <group
      ref={root}
      position={position}
      name={`domain-planet-${domain.id}`}
      userData={{
        domainId: domain.id,
        studyIds: domain.studies.map((study) => study.id),
        planetAssetsReady: resources !== null,
        preparationMs,
        representativeLimit,
      }}
    >
      <group ref={body}>
        <mesh
          geometry={globe}
          scale={DOMAIN_RADIUS}
          name={`domain-globe-${domain.id}`}
          onClick={(event) => {
            event.stopPropagation();
            onSelectDomain?.(domain.id);
            if (!onSelectDomain && !active && domain.studies[0]) onSelect?.(domain.studies[0].id);
          }}
        >
          <meshStandardMaterial
            key={resources?.texture.uuid ?? "preview"}
            map={resources?.texture ?? null}
            vertexColors={!resources}
            roughness={0.95}
          />
        </mesh>
        {/* Back faces provide a thin atmospheric limb; the opaque sphere hides its interior. */}
        <mesh
          geometry={globe}
          scale={DOMAIN_RADIUS * 1.028}
          name={`domain-atmosphere-${domain.id}`}
        >
          <meshBasicMaterial
            color={0xa8d8ef}
            transparent
            opacity={0.24}
            side={THREE.BackSide}
            depthWrite={false}
          />
        </mesh>
        {cloud.index?.count ? (
          <mesh
            geometry={cloud}
            material={cloudMaterial}
            scale={DOMAIN_RADIUS}
            name={`domain-clouds-${domain.id}`}
            renderOrder={CLOUD_RENDER_ORDER.upper}
          />
        ) : null}
        {resources?.islands.getAttribute("position") ? (
          <mesh
            geometry={resources.islands}
            name={`domain-course-islands-${domain.id}`}
            userData={{ atmosphericCourseIds: regions.flatMap((region) => region.courseIds) }}
          >
            <meshStandardMaterial vertexColors roughness={1} />
          </mesh>
        ) : null}
        {resources && regions.length > 0 ? (
          <instancedMesh
            ref={hits}
            args={[undefined, undefined, regions.length]}
            name={`domain-region-targets-${domain.id}`}
            onClick={pickRegion}
          >
            <sphereGeometry args={[REGION_HIT_RADIUS, 8, 6]} />
            <meshBasicMaterial transparent opacity={0} colorWrite={false} depthWrite={false} />
          </instancedMesh>
        ) : null}
        {selected && active ? (
          <mesh
            position={selected.position}
            quaternion={focusOrientation}
            name={`planet-study-focus-${selected.studyId}`}
            userData={{ planetSelectedStudy: selected.studyId }}
          >
            <ringGeometry args={[0.73, 0.76, 48]} />
            <meshBasicMaterial
              color={studyMarkerColor(selected.studyId).hex}
              side={THREE.DoubleSide}
              transparent
              opacity={0.85}
              depthWrite={false}
            />
          </mesh>
        ) : null}
      </group>
    </group>
  );
}

function PlanetCameraRig({ placements }: { readonly placements: readonly DomainPlacement[] }) {
  const { camera, size, gl } = useThree();
  useLayoutEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    const shell = gl.domElement.closest(".app-shell");
    const configure = () => {
      const rect = gl.domElement.getBoundingClientRect();
      const rail = shell?.querySelector("#app-shell-rail")?.getBoundingClientRect();
      const aside = shell?.querySelector("#app-shell-aside")?.getBoundingClientRect();
      const desktop = size.width >= 768;
      const left = desktop && rail && rail.width > 0 ? Math.max(0, rail.right - rect.left + 12) : 0;
      const right =
        desktop && aside && aside.width > 0 ? Math.max(0, rect.right - aside.left + 12) : 0;
      const distance = domainCameraDistance(placements, {
        height: size.height,
        usableWidth: size.width - left - right - 36,
        // Projected domain-name pills extend above their 3D anchor. Reserve
        // their real one-line height plus breathing room on both edges;
        // fitting spheres alone clipped the top row on a 375px viewport.
        usableHeight: size.height - (placements.length > 1 ? 72 : 36),
        fovDegrees: camera.fov,
      });
      camera.position.copy(FRONT).multiplyScalar(distance);
      camera.lookAt(0, 0, 0);
      camera.setViewOffset(size.width, size.height, (right - left) / 2, 0, size.width, size.height);
      camera.updateProjectionMatrix();
    };
    configure();
    const observer = new ResizeObserver(configure);
    for (const id of ["#app-shell-rail", "#app-shell-aside"]) {
      const element = shell?.querySelector(id);
      if (element) observer.observe(element);
    }
    return () => {
      observer.disconnect();
      camera.clearViewOffset();
    };
  }, [camera, gl, size.width, size.height, placements]);
  return null;
}

export interface PlanetSceneProps {
  readonly studies: readonly PlanetStudy[];
  readonly domainCatalog?: readonly PlanetStudyDomain[];
  readonly selectedId: string | null;
  readonly selectedDomainId?: string | null;
  readonly onSelectDomain?: (domainId: string) => void;
  readonly onSelect?: (studyId: string) => void;
  readonly avatarRecipe?: AvatarRecipe | null;
  readonly avatarSignedIn?: boolean;
}
export function PlanetScene({
  studies,
  domainCatalog,
  selectedId,
  selectedDomainId,
  onSelect,
  onSelectDomain,
  labelNodes,
  retry,
  onResourceStatus,
}: PlanetSceneProps & {
  readonly labelNodes?: ReadonlyMap<string, HTMLElement>;
  readonly retry?: number;
  readonly onResourceStatus?: (status: DomainResourceStatus) => void;
}) {
  const domains = useMemo(() => buildDomainPlan(studies, domainCatalog), [studies, domainCatalog]);
  const motionReduced = usePrefersReducedMotion();
  const viewportWidth = useThree((state) => state.size.width);
  const representativeLimit = planetRepresentativeLimit(viewportWidth, renderTier());
  const layout = useMemo(() => layoutDomainPlan(domains.map((domain) => domain.id)), [domains]);
  const activeId =
    domains.find((domain) => domain.id === selectedDomainId)?.id ??
    domains.find((domain) => domain.studies.some((study) => study.id === selectedId))?.id ??
    domains[0]?.id;
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const bag = globalThis as unknown as { __planetProjection?: () => unknown };
    const describe = () => ({
      domainCount: domains.length,
      domains: domains.map((domain) => ({
        id: domain.id,
        studyIds: domain.studies.map((study) => study.id),
        position: layout.find((entry) => entry.domainId === domain.id)?.position,
        regions: planAtmosphericRegions(domain.studies, representativeLimit).map((region) => ({
          studyId: region.studyId,
          courseIds: region.courseIds,
          position: region.position.toArray(),
        })),
      })),
      selectedId,
      activeDomainId: activeId,
      courseCount: studies.reduce((sum, study) => sum + study.courseCount, 0),
      preparation: domainPreparation.describe(),
      representativeLimit,
    });
    bag.__planetProjection = describe;
    return () => {
      if (bag.__planetProjection === describe) delete bag.__planetProjection;
    };
  }, [domains, selectedId, studies, activeId, layout, representativeLimit]);
  return (
    <>
      <PlanetCameraRig placements={layout} />
      <color attach="background" args={[ORBIT_SKY.zenith]} />
      <SkyDome stops={ORBIT_SKY} />
      <MapLighting groundRadius={DOMAIN_RADIUS} skyMid={ORBIT_SKY.mid} shadows={false} />
      {domains.map((domain) => {
        const position = layout.find((entry) => entry.domainId === domain.id)!.position;
        return (
          <DomainPlanet
            key={domain.id}
            domain={domain}
            active={domain.id === activeId}
            position={position}
            selectedId={selectedId}
            onSelect={onSelect}
            onSelectDomain={onSelectDomain}
            labelNodes={labelNodes}
            retry={retry}
            onResourceStatus={onResourceStatus}
            motionReduced={motionReduced}
          />
        );
      })}
    </>
  );
}
export function PlanetStage({
  children,
  ...props
}: PlanetSceneProps & { readonly children?: ReactNode }) {
  const labelNodes = useRef(new Map<string, HTMLElement>());
  const [resourceStates, setResourceStates] = useState<
    Record<string, DomainResourceStatus["state"]>
  >({});
  const [retry, setRetry] = useState(0);
  const domainIds = useMemo(
    () => buildDomainPlan(props.studies, props.domainCatalog).map((domain) => domain.id),
    [props.studies, props.domainCatalog],
  );
  const onResourceStatus = useCallback(({ domainId, state }: DomainResourceStatus) => {
    setResourceStates((previous) =>
      previous[domainId] === state ? previous : { ...previous, [domainId]: state },
    );
  }, []);
  return (
    <div className="planet-stage">
      <Stage cameraFrom={[0, 0, 44]} lookAt={[0, 0, 0]} ambientOcclusion={false}>
        <PlanetScene
          {...props}
          labelNodes={labelNodes.current}
          retry={retry}
          onResourceStatus={onResourceStatus}
        />
        {children}
      </Stage>
      <PlanetDomainLabels
        studies={props.studies}
        domainCatalog={props.domainCatalog}
        selectedId={props.selectedId}
        selectedDomainId={props.selectedDomainId}
        nodes={labelNodes.current}
      />
      <PlanetResourceStatus
        domainIds={domainIds}
        states={resourceStates}
        onRetry={() => setRetry((n) => n + 1)}
      />
    </div>
  );
}
