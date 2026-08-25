/**
 * The globe that lives on the study-picker page.
 *
 * Rejected off-the-shelf globes, with reasons that still hold:
 *   - `cobe` (~5 KB) spins up its own WebGL context. Baseline rule 1 is
 *     one canvas, one renderer owner; a second context also cannot share
 *     the grade pipeline in Stage.tsx. Its look is a tech-dot sphere, not
 *     our flat-shaded islands.
 *   - `three-globe` / `react-globe.gl` are geographic data viz. They pull
 *     a second scene graph and a realistic Earth texture we would then
 *     have to undo.
 *   - Non-Heroes' "spinning globe" is a 2D SVG map
 *     (`RoomPrepMissionStep.tsx`). We borrowed the layout (map + list +
 *     detail, selection syncs), not the art.
 *
 * So this is one icosahedron, the same sea/grass/rock numbers the
 * archipelago already measured, and a handful of markers. Text stays out
 * of the canvas — a name on a point would be geometry, and a Chinese IME
 * dies in here. The list on PlanetPage is the control; clicking a marker
 * is a shortcut the pointer can take.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { hash } from "../random.js";
import { Stage } from "../Stage.js";
import { renderTier } from "../tier.js";
import { studyMarkerColor } from "./planet-copy.js";
import {
  placeStudies,
  rotationFor,
  stepRotation,
  type SpherePoint,
  type YawPitch,
} from "./placement.js";

/**
 * Copied hexes, not imported from Maps.tsx. A value import of Maps pulls
 * the aerial plate, the kit GLBs and the whole archipelago into this page,
 * which is a second copy of the world the parent is explicitly not wiring
 * yet. The numbers are the ones Maps already measured (sea for exposure,
 * sky stops, accent for the one lit thing).
 */
/**
 * The ground this globe hangs on. Not sky and not black: the panel's own family
 * two steps darker, so the pane reads as part of the page. `--game-ui-panel` is
 * roughly `#3a2a1e`; these are that hue with the light taken out.
 */
const SPACE_LOW = 0x5a4433;
const SPACE_HIGH = 0x241a13;

const PLANET_PALETTE = {
  ocean: 0x1e5f63,
  deepOcean: 0x174f53,
  olive: 0x5f7a38,
  moss: 0x4a7a3f,
  sand: 0xa97b4a,
} as const;

interface ContinentSeed {
  readonly center: THREE.Vector3;
  readonly colour: number;
}

const CONTINENT_SEEDS: readonly ContinentSeed[] = [
  { center: new THREE.Vector3(-0.42, -0.05, 0.9).normalize(), colour: PLANET_PALETTE.olive },
  { center: new THREE.Vector3(0.75, 0.18, 0.64).normalize(), colour: PLANET_PALETTE.moss },
  { center: new THREE.Vector3(-0.25, -0.78, -0.58).normalize(), colour: PLANET_PALETTE.olive },
  { center: new THREE.Vector3(0.7, -0.55, -0.45).normalize(), colour: PLANET_PALETTE.moss },
  { center: new THREE.Vector3(-0.55, 0.65, -0.52).normalize(), colour: PLANET_PALETTE.moss },
];

const SAND_REGION_SEEDS: readonly THREE.Vector3[] = [
  new THREE.Vector3(-0.42, -0.05, 0.9).normalize(),
  new THREE.Vector3(0.7, -0.55, -0.45).normalize(),
];

const LAND_LEVEL = 0.76;
const COAST_WIDTH = 0.055;
const SAND_REGION_LEVEL = 0.9;

const FRESNEL_VERTEX_SHADER = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const FRESNEL_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float facing = max(dot(normalize(vWorldNormal), viewDirection), 0.0);
    float rim = pow(1.0 - facing, 3.1);
    float alpha = smoothstep(0.28, 0.9, rim) * 0.42;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

const HORIZON_VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const HORIZON_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uColor;
  varying vec2 vUv;

  void main() {
    vec2 point = vUv - vec2(0.5);
    point.x *= 1.25;
    float halo = 1.0 - smoothstep(0.08, 0.68, length(point));
    float alpha = pow(max(halo, 0.0), 1.8) * 0.34;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

const STAR_COUNT = 150;

/**
 * How far back the eye has to stand to hold the whole globe.
 *
 * This was two hand-measured constants, one per tier, and both were measured
 * against a pane shape that only exists in the preview harness. Dropped into
 * the real shell the desktop column is far narrower than it is tall, and the
 * binding constraint stops being the vertical field of view — the sphere ran
 * off both sides while there was empty sky above and below it.
 *
 * So: fit whichever half-angle is smaller. Stage pins the *vertical* FOV, and
 * the horizontal one falls out of the aspect, which means a tall narrow column
 * is always horizontally constrained and a wide short one is not. Solving it
 * rather than measuring it also means the phone, the desktop and whatever pane
 * shape somebody builds next all get a globe that fits.
 */
const GLOBE_RADIUS = 1.06;
// Keep the globe a world-sized object in the frame: the 1.10 pass filled about
// 86% of the desktop globe pane, while the intended picker composition is
// closer to 70%, with space for sky and marker silhouettes around it.
const GLOBE_PADDING = 1.35;

export function planetDistance(aspect: number, fovDegrees: number): number {
  const vertical = (fovDegrees * Math.PI) / 180 / 2;
  const horizontal = Math.atan(Math.tan(vertical) * Math.max(aspect, 0.05));
  return (GLOBE_RADIUS * GLOBE_PADDING) / Math.sin(Math.min(vertical, horizontal));
}

function planetCamera(): readonly [number, number, number] {
  return renderTier() === "mobile" ? [0, 0.12, 3.4] : [0, 0.18, 6.8];
}

const TURN_RATE = 5.5;
const MARKER_SURFACE = 1.026;
const DISC_HEIGHT = 0.026;
const PIN_SCALE = 0.34;
const PIN_TIP_Y = -0.18;
const PIN_TIP_OFFSET = -PIN_TIP_Y * PIN_SCALE;
const PIN_RADIAL_LIFT = 0.002;
const PIN_BEAM_LENGTH = 0.065;
const PIN_BEAM_RADIUS = 0.014;
const BEACON_GLOW = 0xfff1d6;

const REST: YawPitch = { yaw: 0.35, pitch: 0.18 };

export interface PlanetSceneProps {
  readonly studies: readonly { readonly id: string }[];
  readonly selectedId: string | null;
  readonly onSelect?: (studyId: string) => void;
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function markerQuaternion(point: Pick<SpherePoint, "x" | "y" | "z">): THREE.Quaternion {
  const normal = new THREE.Vector3(point.x, point.y, point.z).normalize();
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
}

function buildPinGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, PIN_TIP_Y);
  shape.bezierCurveTo(-0.03, -0.12, -0.115, -0.04, -0.115, 0.065);
  shape.bezierCurveTo(-0.115, 0.17, -0.06, 0.25, 0, 0.3);
  shape.bezierCurveTo(0.06, 0.25, 0.115, 0.17, 0.115, 0.065);
  shape.bezierCurveTo(0.115, -0.04, 0.03, -0.12, 0, PIN_TIP_Y);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.008,
    bevelThickness: 0.008,
    curveSegments: 3,
    depth: 0.045,
    steps: 1,
  });
}

interface BeaconPlacement {
  readonly contact: THREE.Vector3;
  readonly pin: THREE.Vector3;
  readonly beamMid: THREE.Vector3;
  readonly beamLength: number;
  readonly surfaceQuaternion: THREE.Quaternion;
  readonly beamQuaternion: THREE.Quaternion;
}

function beaconPlacement(point: Pick<SpherePoint, "x" | "y" | "z">): BeaconPlacement {
  const normal = new THREE.Vector3(point.x, point.y, point.z).normalize();
  // The disc sits on the surface: its lower face meets the globe, and its top
  // face is the one place the pin is allowed to touch.
  const contact = normal.clone().multiplyScalar(MARKER_SURFACE + DISC_HEIGHT / 2);
  const pinContact = contact.clone().addScaledVector(normal, DISC_HEIGHT / 2 + PIN_RADIAL_LIFT);
  const screenUp = new THREE.Vector3(0, 1, 0).addScaledVector(normal, -normal.y);
  if (screenUp.lengthSq() < 0.0001) screenUp.set(1, 0, 0);
  screenUp.normalize();
  // The geometry's local bottom tip is y=-0.18. Offset the screen-facing pin by
  // scaled tip height so that its tip, rather than its centre, lands on the
  // disc. The beam is a short normal-aligned glow at that contact, not a rod
  // carrying the pin up from the surface.
  const pin = pinContact.clone().addScaledVector(screenUp, PIN_TIP_OFFSET);
  const beamStart = contact.clone().addScaledVector(normal, DISC_HEIGHT / 2);
  const beam = beamStart.clone().addScaledVector(normal, PIN_BEAM_LENGTH).sub(beamStart);
  const beamLength = beam.length();
  return {
    contact,
    pin,
    beamMid: beamStart.clone().addScaledVector(beam, 0.5),
    beamLength,
    surfaceQuaternion: markerQuaternion(point),
    beamQuaternion: new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      beam.normalize(),
    ),
  };
}

function colourLerp(from: number, to: number, t: number): THREE.Color {
  return new THREE.Color(from).lerp(new THREE.Color(to), t);
}

/**
 * One smooth field for the whole globe. It deliberately has no face hash:
 * the old per-face salt changed colour every time a triangle crossed a
 * threshold, so a coastline became a checkerboard. These long waves only
 * bend a region boundary; they cannot turn neighbouring land into unrelated
 * biomes.
 */
function smoothPlanetNoise(x: number, y: number, z: number): number {
  return (
    Math.sin(x * 1.55 + z * 1.1 + 0.35) * 0.5 +
    Math.cos(y * 1.85 - x * 0.7) * 0.3 +
    Math.sin(z * 2.35 - y * 1.15) * 0.2
  );
}

interface PlanetTerrain {
  readonly colour: number;
  readonly elevation: number;
}

function planetTerrainAt(x: number, y: number, z: number): PlanetTerrain {
  let strongestContinent = CONTINENT_SEEDS[0]!;
  let strongestScore = -Infinity;
  for (const continent of CONTINENT_SEEDS) {
    const score = x * continent.center.x + y * continent.center.y + z * continent.center.z;
    if (score > strongestScore) {
      strongestScore = score;
      strongestContinent = continent;
    }
  }

  const coastlineWobble = smoothPlanetNoise(x, y, z) * 0.075;
  const landScore = strongestScore + coastlineWobble;
  if (landScore < LAND_LEVEL) {
    const oceanColour =
      smoothPlanetNoise(x * 0.8, y * 0.8, z * 0.8) > 0.08
        ? PLANET_PALETTE.ocean
        : PLANET_PALETTE.deepOcean;
    return { colour: oceanColour, elevation: -0.018 };
  }

  const sandScore = Math.max(
    ...SAND_REGION_SEEDS.map((seed) => x * seed.x + y * seed.y + z * seed.z),
  );
  // Sand follows the coastline and fills two seeded interior regions. It never
  // crosses into the ocean, and it cannot become a separate continent.
  const coast = landScore < LAND_LEVEL + COAST_WIDTH;
  const interiorSand = !coast && sandScore > SAND_REGION_LEVEL;
  return {
    colour: coast || interiorSand ? PLANET_PALETTE.sand : strongestContinent.colour,
    elevation: coast ? 0.008 : 0.035,
  };
}

/**
 * Low-poly sky shell. drei's Preetham `<Sky>` is a real atmosphere for a
 * real landscape; this page is a miniature of the same board as the map,
 * so the dome is three hex stops on an icosahedron, not a second lighting
 * model.
 */
function asFaces(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  // three 0.185 already emits a non-indexed icosahedron; calling
  // toNonIndexed() again warns and no-ops. Only unroll when there is an
  // index, so each face can carry its own colour under flatShading.
  return geometry.index ? geometry.toNonIndexed() : geometry;
}

function buildSkyGeometry(): THREE.BufferGeometry {
  const geometry = asFaces(new THREE.IcosahedronGeometry(40, 1));
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const colours = new Float32Array(position.count * 3);
  const colour = new THREE.Color();
  for (let index = 0; index < position.count; index += 1) {
    const y = position.getY(index) / 40;
    colour.copy(colourLerp(SPACE_LOW, SPACE_HIGH, Math.min(1, Math.max(0, (y + 1) / 2))));
    colours[index * 3] = colour.r;
    colours[index * 3 + 1] = colour.g;
    colours[index * 3 + 2] = colour.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  return geometry;
}

function buildStarGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(STAR_COUNT * 4 * 3);
  const indices = new Uint16Array(STAR_COUNT * 6);
  for (let index = 0; index < STAR_COUNT; index += 1) {
    // Lay the stars in the camera's deep-space view instead of using a naive
    // lat/long hash: that hash clustered the visible hemisphere below the
    // horizon, which made a valid star buffer look empty in this narrow pane.
    const step = index + 1;
    const x = (hash(String(step * 2654435761)) - 0.5) * 24;
    const y = (hash(String(step * 2246822519)) - 0.5) * 17;
    const z = -(24 + hash(String(step * 3266489917)) * 10);
    const size = 0.02 + hash(String(step * 668265263)) * 0.018;
    const vertex = index * 4;
    const offset = vertex * 3;
    positions[offset] = x - size;
    positions[offset + 1] = y - size;
    positions[offset + 2] = z;
    positions[offset + 3] = x + size;
    positions[offset + 4] = y - size;
    positions[offset + 5] = z;
    positions[offset + 6] = x + size;
    positions[offset + 7] = y + size;
    positions[offset + 8] = z;
    positions[offset + 9] = x - size;
    positions[offset + 10] = y + size;
    positions[offset + 11] = z;
    const triangle = index * 6;
    indices[triangle] = vertex;
    indices[triangle + 1] = vertex + 1;
    indices[triangle + 2] = vertex + 2;
    indices[triangle + 3] = vertex;
    indices[triangle + 4] = vertex + 2;
    indices[triangle + 5] = vertex + 3;
  }
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  return geometry;
}

function Starfield() {
  const geometry = useMemo(() => buildStarGeometry(), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} frustumCulled={false} renderOrder={1}>
      <meshBasicMaterial
        color={0xffe4bd}
        transparent
        opacity={0.82}
        depthTest
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

function buildPlanetGeometry(): THREE.BufferGeometry {
  /*
    Detail 3, not 4 or 2.

    Detail 2 made the silhouette too close to a die. Detail 4 made the
    triangles too fine after the framing pass, so the surface read as a smooth
    colour field again. Detail 3 leaves a visible low-poly rhythm at the
    distance the picker actually uses: 1,280 faces around the whole world,
    with the visible hemisphere carrying the map's facets rather than a noise
    texture.
  */
  const geometry = asFaces(new THREE.IcosahedronGeometry(1, 3));
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const colours = new Float32Array(position.count * 3);
  const colour = new THREE.Color();

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const length = Math.hypot(x, y, z) || 1;
    const nx = x / length;
    const ny = y / length;
    const nz = z / length;
    const terrain = planetTerrainAt(nx, ny, nz);
    const radius = 1 + terrain.elevation * 0.16;
    position.setXYZ(index, nx * radius, ny * radius, nz * radius);
  }

  /*
    Vertex colours interpolate even when the material's normals are flat. Pick
    one palette entry per triangle and write it to all three vertices, so a
    neighbouring face can actually be a neighbouring colour block instead of a
    hidden gradient. The region choice comes from the face's low-frequency
    spherical terrain field, not from the face index or a high-frequency hash.
    The grade still owns tone mapping and the single sRGB encode; this is scene
    albedo, not a second colour pipeline.
  */
  for (let index = 0; index < position.count; index += 3) {
    const center = new THREE.Vector3(
      (position.getX(index) + position.getX(index + 1) + position.getX(index + 2)) / 3,
      (position.getY(index) + position.getY(index + 1) + position.getY(index + 2)) / 3,
      (position.getZ(index) + position.getZ(index + 1) + position.getZ(index + 2)) / 3,
    ).normalize();
    colour.setHex(planetTerrainAt(center.x, center.y, center.z).colour);

    for (let vertex = 0; vertex < 3; vertex += 1) {
      const offset = (index + vertex) * 3;
      colours[offset] = colour.r;
      colours[offset + 1] = colour.g;
      colours[offset + 2] = colour.b;
    }
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function PlanetLights() {
  return (
    <>
      {/*
        The lower-right side should be shaded, not erased. The warm key creates
        that direction; the hemisphere and ambient fill keep the palette legible
        inside the shadow instead of turning the globe into a half-eaten ball.
      */}
      <hemisphereLight args={[0xa5ced6, 0x56775e, 1.3]} />
      <ambientLight color={0xf6d1ae} intensity={0.72} />
      {/* The warm key is upper-left in screen space; the fill keeps the terminator soft. */}
      <directionalLight position={[-3.8, 4.6, 4.2]} intensity={1.05} color={0xffd1a4} />
      {/* A cool far-side lift keeps dark land blue-green instead of black. */}
      <directionalLight position={[3.2, -1.6, -4]} intensity={0.48} color={0x67a8a2} />
    </>
  );
}

function FresnelRim() {
  // Linear additive edge light; Stage's SwimmerRenderKit grade still owns the
  // single tone map and sRGB encode after this scene pass.
  return (
    <mesh scale={1.018} renderOrder={2}>
      <sphereGeometry args={[1, 48, 32]} />
      <shaderMaterial
        vertexShader={FRESNEL_VERTEX_SHADER}
        fragmentShader={FRESNEL_FRAGMENT_SHADER}
        uniforms={{ uColor: { value: new THREE.Color(0xffc47a) } }}
        transparent
        depthTest={false}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

function HorizonGlow() {
  return (
    <mesh position={[0, -1.04, -0.32]} scale={[1.42, 0.58, 1]} renderOrder={-1}>
      <planeGeometry args={[2, 1]} />
      <shaderMaterial
        vertexShader={HORIZON_VERTEX_SHADER}
        fragmentShader={HORIZON_FRAGMENT_SHADER}
        uniforms={{ uColor: { value: new THREE.Color(0xffa24d) } }}
        transparent
        depthTest
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

interface MarkerBeaconProps {
  readonly id: string;
  readonly point: SpherePoint;
  readonly selected: boolean;
  readonly onSelect?: (studyId: string) => void;
  readonly pinGeometry: THREE.ExtrudeGeometry;
  readonly pinOutline: THREE.EdgesGeometry;
  readonly hitGeometry: THREE.SphereGeometry;
}

function MarkerBeacon({
  id,
  point,
  selected,
  onSelect,
  pinGeometry,
  pinOutline,
  hitGeometry,
}: MarkerBeaconProps) {
  const placement = useMemo(() => beaconPlacement(point), [point]);
  const markerColor = useMemo(() => studyMarkerColor(id), [id]);
  const pinVisual = useRef<THREE.Group>(null);
  const { camera } = useThree();

  useFrame(() => {
    const node = pinVisual.current;
    if (!node) return;
    // Keep the flat droplet readable as the globe turns. This is geometry, not
    // text: it may face the learner without stealing the DOM's text contract.
    node.lookAt(camera.position);
    node.rotateY(Math.PI);
  });

  const handleSelect = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    onSelect?.(id);
  };
  const handlePointerOver = (event: { stopPropagation: () => void; nativeEvent: Event }) => {
    event.stopPropagation();
    const target = event.nativeEvent.target;
    if (target instanceof HTMLElement) target.style.cursor = "pointer";
  };
  const handlePointerOut = (event: { stopPropagation: () => void; nativeEvent: Event }) => {
    event.stopPropagation();
    const target = event.nativeEvent.target;
    if (target instanceof HTMLElement) target.style.cursor = "";
  };
  const interactive = onSelect ? { onClick: handleSelect } : {};

  return (
    <>
      <mesh
        position={placement.contact}
        quaternion={placement.surfaceQuaternion}
        renderOrder={3}
        {...interactive}
      >
        <cylinderGeometry
          args={[selected ? 0.09 : 0.075, selected ? 0.078 : 0.066, DISC_HEIGHT, 20]}
        />
        <meshStandardMaterial
          color={markerColor.hex}
          emissive={markerColor.hex}
          emissiveIntensity={selected ? 0.92 : 0.42}
          roughness={0.34}
          metalness={0.04}
        />
      </mesh>
      <mesh
        position={placement.beamMid}
        quaternion={placement.beamQuaternion}
        renderOrder={2}
        {...interactive}
      >
        <cylinderGeometry
          args={[
            selected ? PIN_BEAM_RADIUS * 1.45 : PIN_BEAM_RADIUS,
            selected ? PIN_BEAM_RADIUS * 1.45 : PIN_BEAM_RADIUS,
            placement.beamLength,
            8,
            1,
            true,
          ]}
        />
        <meshBasicMaterial
          color={markerColor.hex}
          transparent
          opacity={selected ? 0.62 : 0.35}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <group ref={pinVisual} position={placement.pin}>
        <group scale={PIN_SCALE}>
          {/* The halo is a separate render layer; the pin scale and contact stay untouched. */}
          <mesh geometry={pinGeometry} scale={1.1} renderOrder={4}>
            <meshBasicMaterial
              color={BEACON_GLOW}
              transparent
              opacity={selected ? 0.5 : 0.3}
              depthTest={false}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
            />
          </mesh>
          <lineSegments geometry={pinOutline} renderOrder={5}>
            <lineBasicMaterial color={markerColor.outlineHex} transparent opacity={0.95} />
          </lineSegments>
          <mesh geometry={pinGeometry} renderOrder={6} {...interactive}>
            <meshStandardMaterial
              color={markerColor.hex}
              emissive={markerColor.hex}
              emissiveIntensity={selected ? 0.74 : 0.26}
              roughness={0.42}
              metalness={0}
              flatShading
            />
          </mesh>
        </group>
        {onSelect ? (
          <mesh
            name={`planet-beacon-${id}-hit`}
            geometry={hitGeometry}
            renderOrder={7}
            onClick={handleSelect}
            onPointerOver={handlePointerOver}
            onPointerOut={handlePointerOut}
          >
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        ) : null}
      </group>
    </>
  );
}

function Globe({ studies, selectedId, onSelect }: PlanetSceneProps) {
  const yawGroup = useRef<THREE.Group>(null);
  const pitchGroup = useRef<THREE.Group>(null);
  const current = useRef<YawPitch>({ ...REST });
  const planet = useMemo(() => buildPlanetGeometry(), []);
  const sky = useMemo(() => buildSkyGeometry(), []);
  const pinGeometry = useMemo(() => buildPinGeometry(), []);
  const pinOutline = useMemo(() => new THREE.EdgesGeometry(pinGeometry, 15), [pinGeometry]);
  const pinHitGeometry = useMemo(() => new THREE.SphereGeometry(0.18, 12, 8), []);
  const placed = useMemo(() => placeStudies(studies.map((study) => study.id)), [studies]);

  useEffect(() => () => planet.dispose(), [planet]);
  useEffect(() => () => sky.dispose(), [sky]);
  useEffect(
    () => () => {
      pinGeometry.dispose();
      pinOutline.dispose();
      pinHitGeometry.dispose();
    },
    [pinGeometry, pinOutline, pinHitGeometry],
  );

  useFrame((_, delta) => {
    const yawNode = yawGroup.current;
    const pitchNode = pitchGroup.current;
    if (!yawNode || !pitchNode) return;
    const selected = selectedId ? placed.get(selectedId) : undefined;
    const target = selected ? rotationFor(selected) : REST;
    const next = stepRotation(current.current, target, delta, prefersReducedMotion(), TURN_RATE);
    current.current = next;
    // Nested groups, not one Euler: placement.test.ts proved a single XYZ
    // Euler missed +Z by a couple of degrees, which on this scale is an
    // island sitting beside the camera.
    yawNode.rotation.y = next.yaw;
    pitchNode.rotation.x = next.pitch;
  });

  return (
    <>
      {/*
        A planet is looked at from outside it. The first pass wrapped this globe
        in the same painted dome the archipelago stands under, which put a
        daytime sky behind the thing that is supposed to *contain* the daytime —
        and a pale wash beside a brown panel was the largest, palest area on the
        page.

        The dome stays, recoloured: near-black at the top going warm at the
        bottom, in the panel's own family. Deleting it outright left a hard
        cold-black rectangle butted against warm brown, which reads as a hole
        cut in the page rather than as a window onto space.
      */}
      <mesh geometry={sky} frustumCulled={false}>
        <meshBasicMaterial vertexColors side={THREE.BackSide} depthWrite={false} fog={false} />
      </mesh>
      <Starfield />
      <HorizonGlow />
      <group ref={yawGroup}>
        <group ref={pitchGroup}>
          {/*
            No shadows on the globe. It is the only body in the scene, so the
            only thing its shadow map could fall on is itself — and it did: a
            hard terminator with a black lower hemisphere, which is a ball with
            a bite out of it, not a world. The lights carry the form.
          */}
          <mesh geometry={planet}>
            <meshStandardMaterial
              vertexColors
              flatShading
              roughness={0.92}
              metalness={0}
              emissive={0x1d3a35}
              emissiveIntensity={0.32}
            />
          </mesh>
          <FresnelRim />
          {[...placed.entries()].map(([id, point]) => {
            return (
              <MarkerBeacon
                key={id}
                id={id}
                point={point}
                selected={id === selectedId}
                onSelect={onSelect}
                pinGeometry={pinGeometry}
                pinOutline={pinOutline}
                hitGeometry={pinHitGeometry}
              />
            );
          })}
        </group>
      </group>
    </>
  );
}

/**
 * Stage's camera prop is the initial pose, not a live binding, so a pane that
 * changes shape — a rotate to portrait, a rail collapsing, a window drag —
 * would keep the eye it was born with. This rig re-solves the distance from
 * the pane R3F actually measured. Lives on PlanetStage, not PlanetScene, so
 * dropping the globe into the map's canvas cannot steal that camera.
 */
function CameraRig() {
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    const aspect = size.height > 0 ? size.width / size.height : 1;
    camera.position.set(0, 0.16, planetDistance(aspect, camera.fov));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  return null;
}

export function PlanetScene(props: PlanetSceneProps) {
  return (
    <>
      <PlanetLights />
      <Globe {...props} />
    </>
  );
}

/**
 * Own canvas, for a standalone route. Wraps `Stage` rather than a second
 * `<Canvas>` so the grade, the DPR clamp and the one-renderer-owner rule
 * stay the answers already written down in Stage.tsx.
 */
export function PlanetStage(props: PlanetSceneProps) {
  return (
    /*
      No screen-space AO here. The pass creases a field of small islands
      convincingly and turns one marker in front of one sphere into a ring of
      black petals — see the note on `ambientOcclusion` in Stage.
    */
    <Stage cameraFrom={planetCamera()} lookAt={[0, 0, 0]} ambientOcclusion={false}>
      <CameraRig />
      <PlanetScene {...props} />
    </Stage>
  );
}
