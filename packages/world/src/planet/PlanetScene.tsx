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

import { ISLAND_PALETTE } from "../island.js";
import { hash } from "../random.js";
import { Stage } from "../Stage.js";
import { renderTier } from "../tier.js";
import { placeStudies, rotationFor, stepRotation, type YawPitch } from "./placement.js";

/**
 * Copied hexes, not imported from Maps.tsx. A value import of Maps pulls
 * the aerial plate, the kit GLBs and the whole archipelago into this page,
 * which is a second copy of the world the parent is explicitly not wiring
 * yet. The numbers are the ones Maps already measured (sea for exposure,
 * sky stops, accent for the one lit thing).
 */
const SEA = 0x2f89a0;
const SEA_DEEP = 0x1c5c72;
const SKY_MID = 0x8ec8ea;
const SKY_HORIZON = 0xf2d4b0;
/**
 * The ground this globe hangs on. Not sky and not black: the panel's own family
 * two steps darker, so the pane reads as part of the page. `--game-ui-panel` is
 * roughly `#3a2a1e`; these are that hue with the light taken out.
 */
const SPACE_LOW = 0x5a4433;
const SPACE_HIGH = 0x241a13;
const ACCENT = 0xffb347;

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
/*
  A marker is a place on a map, so it has to survive being drawn at the size the
  pane actually gives it. At 0.028 of a unit sphere in a 300px column it landed
  at roughly three pixels — present in the render, absent to a reader.
*/
/*
  Unselected markers used to be `ISLAND_PALETTE.rock`, which is the colour of a
  rock on a green island — against a globe that is mostly green and blue it is
  camouflage. A pin has to be lighter than everything under it.
*/
const MARKER_QUIET = 0xf2e6d2;
const MARKER_R = 0.055;
const MARKER_R_SELECTED = 0.095;

const REST: YawPitch = { yaw: 0.35, pitch: 0.18 };

export interface PlanetSceneProps {
  readonly studies: readonly { readonly id: string }[];
  readonly selectedId: string | null;
  readonly onSelect?: (studyId: string) => void;
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function colourLerp(from: number, to: number, t: number): THREE.Color {
  return new THREE.Color(from).lerp(new THREE.Color(to), t);
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

function buildPlanetGeometry(): THREE.BufferGeometry {
  /*
    Detail 4, not 2.

    At 2 an icosahedron is 320 faces, and flat-shaded that reads as a die
    rather than a planet — the coastline the elevation function draws is
    coarser than the facets it is drawn on, so a continent is four triangles
    and every one of them is visible. The islands get away with detail 1
    because they are small and stylised; a whole world at arm's length does
    not. 5120 faces on one sphere on a picker page is not a budget question.
  */
  const geometry = asFaces(new THREE.IcosahedronGeometry(1, 4));
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const colours = new Float32Array(position.count * 3);
  const colour = new THREE.Color();
  const grass = new THREE.Color(ISLAND_PALETTE.grass);
  const grassDry = new THREE.Color(ISLAND_PALETTE.grassDry);
  const rock = new THREE.Color(ISLAND_PALETTE.rock);
  const sea = new THREE.Color(SEA);
  const seaDeep = new THREE.Color(SEA_DEEP);

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const length = Math.hypot(x, y, z) || 1;
    const nx = x / length;
    const ny = y / length;
    const nz = z / length;
    // Elevation is a function of the point, not of the vertex index, so a
    // future subdivision cannot redraw the coastline.
    const n = hash(`${nx.toFixed(4)},${ny.toFixed(4)},${nz.toFixed(4)}`);
    /*
      Continents, not static. The first pass weighted per-face noise about four
      times as heavily as the low-frequency term, so every face decided its own
      biome and the globe came out mottled — green and blue speckle that reads
      as a tennis ball going off rather than as land and sea. Three long waves
      carry the shape now and the noise only breaks up their coastlines, which
      is the same ordering the island profiles use.
    */
    const band =
      Math.sin(nx * 2.05 + 1.1) * Math.cos(nz * 1.75) +
      0.62 * Math.sin(ny * 2.6 + 0.4) +
      0.34 * Math.cos(nx * 3.4 - nz * 2.9);
    // +0.035 is sea level, and it is a design number rather than a physical
    // one: at zero this globe came out about nine-tenths ocean, which is the
    // honest output of a symmetric noise field and a poor picture of a world
    // that is supposed to be made of islands you can visit.
    const elev = band * 0.075 + (n - 0.5) * 0.045 + 0.035;
    const radius = 1 + Math.max(-0.02, elev * 0.16);
    position.setXYZ(index, nx * radius, ny * radius, nz * radius);

    if (elev > 0.052) colour.copy(n > 0.7 ? grassDry : grass);
    else if (elev > 0.028) colour.copy(rock);
    else colour.copy(elev < -0.02 ? seaDeep : sea);

    colours[index * 3] = colour.r;
    colours[index * 3 + 1] = colour.g;
    colours[index * 3 + 2] = colour.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function PlanetLights() {
  return (
    <>
      {/*
        The dark side of a planet is still a planet. A single key light on a
        sphere makes a hard terminator and a black hemisphere, which reads as a
        ball half-eaten rather than as a world turning — and the points on that
        half stop existing. Fill carries the shadow side; the key is only there
        to say which way is up.
      */}
      <hemisphereLight args={[SKY_MID, 0x9a8b74, 1.35]} />
      <ambientLight color={SKY_HORIZON} intensity={0.55} />
      {/*
        Shadow frustum is the globe, not the archipelago. The map's 2048 map
        stretched across a whole sea is what turned every tree into six
        texels; a 2-unit subject does not have that problem.
      */}
      <directionalLight position={[2.4, 3.2, 2]} intensity={1.35} />
      {/* A cool rim from behind, so the far edge stays a sphere against a dark ground. */}
      <directionalLight position={[-3, -1.2, -2.6]} intensity={0.5} color={SKY_MID} />
    </>
  );
}

function Globe({ studies, selectedId, onSelect }: PlanetSceneProps) {
  const yawGroup = useRef<THREE.Group>(null);
  const pitchGroup = useRef<THREE.Group>(null);
  const current = useRef<YawPitch>({ ...REST });
  const planet = useMemo(() => buildPlanetGeometry(), []);
  const sky = useMemo(() => buildSkyGeometry(), []);
  const placed = useMemo(() => placeStudies(studies.map((study) => study.id)), [studies]);

  useEffect(() => () => planet.dispose(), [planet]);
  useEffect(() => () => sky.dispose(), [sky]);

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
      <group ref={yawGroup}>
        <group ref={pitchGroup}>
          {/*
            No shadows on the globe. It is the only body in the scene, so the
            only thing its shadow map could fall on is itself — and it did: a
            hard terminator with a black lower hemisphere, which is a ball with
            a bite out of it, not a world. The lights carry the form.
          */}
          <mesh geometry={planet}>
            <meshStandardMaterial vertexColors flatShading roughness={0.92} metalness={0} />
          </mesh>
          {[...placed.entries()].map(([id, point]) => {
            const selected = id === selectedId;
            return (
              <mesh
                key={id}
                position={[point.x * 1.04, point.y * 1.04, point.z * 1.04]}
                onClick={
                  onSelect
                    ? (event) => {
                        event.stopPropagation();
                        onSelect(id);
                      }
                    : undefined
                }
                onPointerOver={
                  onSelect
                    ? (event) => {
                        event.stopPropagation();
                        const target = event.nativeEvent.target;
                        if (target instanceof HTMLElement) target.style.cursor = "pointer";
                      }
                    : undefined
                }
                onPointerOut={
                  onSelect
                    ? (event) => {
                        const target = event.nativeEvent.target;
                        if (target instanceof HTMLElement) target.style.cursor = "";
                      }
                    : undefined
                }
              >
                <octahedronGeometry args={[selected ? MARKER_R_SELECTED : MARKER_R, 0]} />
                <meshStandardMaterial
                  color={selected ? ACCENT : MARKER_QUIET}
                  emissive={selected ? ACCENT : 0x000000}
                  emissiveIntensity={selected ? 0.55 : 0}
                  roughness={0.55}
                  flatShading
                />
              </mesh>
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
