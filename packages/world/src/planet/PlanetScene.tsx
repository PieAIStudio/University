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
const SKY_ZENITH = 0x2e7fd4;
const SKY_MID = 0x8ec8ea;
const SKY_HORIZON = 0xf2d4b0;
const ACCENT = 0xffb347;

/**
 * Camera sits on +Z looking at the origin — the front `rotationFor` aims at.
 *
 * Distance is a function of the panel, not of the globe. Stage's FOV is
 * vertical and pinned (34° desktop, 42° phone). The desktop pane is a tall
 * 34% column (~0.64 aspect), so 3.2 units of distance only showed a crop
 * of facets; 6.8 fits the whole sphere. The phone pane is wide and short,
 * and the wider FOV already frames it at 3.4.
 */
function planetCamera(): readonly [number, number, number] {
  return renderTier() === "mobile" ? [0, 0.12, 3.4] : [0, 0.18, 6.8];
}

const TURN_RATE = 5.5;
const MARKER_R = 0.028;
const MARKER_R_SELECTED = 0.062;

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
    if (y > 0.2) colour.copy(colourLerp(SKY_MID, SKY_ZENITH, (y - 0.2) / 0.8));
    else colour.copy(colourLerp(SKY_HORIZON, SKY_MID, (y + 1) / 1.2));
    colours[index * 3] = colour.r;
    colours[index * 3 + 1] = colour.g;
    colours[index * 3 + 2] = colour.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  return geometry;
}

function buildPlanetGeometry(): THREE.BufferGeometry {
  const geometry = asFaces(new THREE.IcosahedronGeometry(1, 2));
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
    const band = Math.sin(nx * 4.2) * Math.cos(nz * 3.6);
    const elev = (n - 0.44) * 0.2 + band * 0.055;
    const radius = 1 + Math.max(-0.035, elev * 0.2);
    position.setXYZ(index, nx * radius, ny * radius, nz * radius);

    if (elev > 0.045) colour.copy(n > 0.72 ? grassDry : grass);
    else if (elev > 0.008) colour.copy(rock);
    else colour.copy(ny < -0.38 ? seaDeep : sea);

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
      <hemisphereLight args={[SKY_MID, 0x786e5f, 1.2]} />
      <ambientLight color={SKY_HORIZON} intensity={0.22} />
      {/*
        Shadow frustum is the globe, not the archipelago. The map's 2048 map
        stretched across a whole sea is what turned every tree into six
        texels; a 2-unit subject does not have that problem.
      */}
      <directionalLight
        position={[2.4, 3.2, 2]}
        intensity={1.9}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-2.2}
        shadow-camera-right={2.2}
        shadow-camera-top={2.2}
        shadow-camera-bottom={-2.2}
        shadow-camera-far={12}
        shadow-bias={-0.0002}
        shadow-normalBias={0.04}
      />
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
      <mesh geometry={sky} frustumCulled={false}>
        <meshBasicMaterial vertexColors side={THREE.BackSide} depthWrite={false} fog={false} />
      </mesh>
      <group ref={yawGroup}>
        <group ref={pitchGroup}>
          <mesh geometry={planet} castShadow receiveShadow>
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
                  color={selected ? ACCENT : ISLAND_PALETTE.rock}
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
 * Stage's camera prop is the initial pose, not a live binding. The desktop
 * pane needs 6.8 units of distance and the phone pane 3.4; without this
 * rig a rotate-to-portrait keeps the desktop eye and the globe shrinks
 * into a marble. Lives on PlanetStage, not PlanetScene, so dropping the
 * globe into the map's canvas cannot steal that camera.
 */
function CameraRig() {
  const { camera } = useThree();
  useLayoutEffect(() => {
    const apply = () => {
      const [x, y, z] = planetCamera();
      camera.position.set(x, y, z);
      camera.lookAt(0, 0, 0);
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, [camera]);
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
    <Stage cameraFrom={planetCamera()} lookAt={[0, 0, 0]}>
      <CameraRig />
      <PlanetScene {...props} />
    </Stage>
  );
}
