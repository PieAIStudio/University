import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three-stdlib";
import { TOY } from "./style.js";
import { toyAsset, type ToyDonor } from "./assets.js";
import { toySlab, wordFrameGeometry } from "./geometry.js";

type Position = [number, number, number];

/** One reusable bevel, one palette. Cached geometries are module-owned. */
const cube = new RoundedBoxGeometry(1, 1, 1, 2, 0.1);
const sphere = new THREE.SphereGeometry(1, 16, 12);
const cylinder = new THREE.CylinderGeometry(1, 1, 1, 20);
const landBody = toySlab(11.1, 8.7, 1.55, 1.65);
const landGrass = toySlab(11.35, 8.95, 0.18, 1.8);
const landingBody = toySlab(3.35, 2.1, 1.1, 0.75);
const landingGrass = toySlab(3.45, 2.2, 0.18, 0.8);
const wordFrame = wordFrameGeometry();
const starShape = new THREE.Shape();
for (let i = 0; i < 10; i++) {
  const angle = Math.PI / 2 + (i * Math.PI) / 5;
  const radius = i % 2 ? 0.45 : 1;
  if (i === 0) starShape.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  else starShape.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
}
starShape.closePath();
const starGeometry = new THREE.ExtrudeGeometry(starShape, {
  depth: 0.18,
  bevelEnabled: true,
  bevelThickness: 0.08,
  bevelSize: 0.06,
  bevelSegments: 2,
  steps: 1,
});
starGeometry.center();
const materials = new Map<number, THREE.MeshPhysicalMaterial>();
const earthColors: ReadonlySet<number> = new Set([TOY.grass, TOY.grassEdge, TOY.soil, TOY.bark]);
export function wax(color: number) {
  let material = materials.get(color);
  if (!material) {
    const earthy = earthColors.has(color);
    material = new THREE.MeshPhysicalMaterial({
      color,
      roughness: earthy ? 0.7 : color === TOY.water ? 0.3 : 0.38,
      metalness: 0,
      clearcoat: earthy ? 0.08 : 0.35,
      clearcoatRoughness: 0.38,
    });
    materials.set(color, material);
  }
  return material;
}
export function Block({
  position = [0, 0, 0],
  size = [1, 1, 1],
  color = TOY.cream,
  rotation = 0,
}: {
  position?: Position;
  size?: Position;
  color?: number;
  rotation?: number;
}) {
  return (
    <mesh
      geometry={cube}
      material={wax(color)}
      position={position}
      scale={size}
      rotation-y={rotation}
      castShadow
      receiveShadow
      dispose={null}
    />
  );
}
export function Ball({
  position,
  size = [1, 1, 1],
  color,
}: {
  position: Position;
  size?: Position;
  color: number;
}) {
  return (
    <mesh
      geometry={sphere}
      material={wax(color)}
      position={position}
      scale={size}
      castShadow
      receiveShadow
      dispose={null}
    />
  );
}
export function Disc({
  position,
  radius,
  height,
  color,
}: {
  position: Position;
  radius: number;
  height: number;
  color: number;
}) {
  return (
    <mesh
      geometry={cylinder}
      material={wax(color)}
      position={position}
      scale={[radius, height, radius]}
      castShadow
      receiveShadow
      dispose={null}
    />
  );
}
export function Star({ scale = 0.18 }: { scale?: number }) {
  return (
    <mesh
      geometry={starGeometry}
      material={wax(TOY.gold)}
      scale={scale}
      castShadow
      dispose={null}
    />
  );
}

export function WordFrame({ position }: { position: Position }) {
  return (
    <mesh
      geometry={wordFrame}
      material={wax(TOY.cream)}
      position={position}
      castShadow
      receiveShadow
      dispose={null}
    />
  );
}

/** Preserve cached GLB geometry, maps and palette; own only transformed scene + material clones. */
export function Donor({
  id,
  position,
  height,
  rotation = 0,
}: {
  id: ToyDonor;
  position: Position;
  height: number;
  rotation?: number;
}) {
  const { scene } = useGLTF(toyAsset(id).src);
  const prepared = useMemo(() => {
    const object = scene.clone(true);
    const owned: THREE.Material[] = [];
    object.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const tune = (original: THREE.Material) => {
        if (!(original instanceof THREE.MeshStandardMaterial)) return original;
        const next = new THREE.MeshPhysicalMaterial({
          map: original.map,
          color: original.color,
          roughness: 0.55,
          metalness: 0,
          clearcoat: 0.22,
          clearcoatRoughness: 0.48,
          side: original.side,
          vertexColors: original.vertexColors,
        });
        // Source-local roof mask, measured from the retained stall GLB (roof
        // begins above y=.305). Only this owned material changes. The source
        // map, UVs and all other users of the model remain untouched.
        if (id === "stall") {
          next.onBeforeCompile = (shader) => {
            shader.uniforms.toyCloth = { value: new THREE.Color(TOY.cream) };
            shader.vertexShader = "varying vec3 vToyModel;\n" + shader.vertexShader;
            shader.vertexShader = shader.vertexShader.replace(
              "#include <begin_vertex>",
              "#include <begin_vertex>\nvToyModel = position;",
            );
            shader.fragmentShader =
              "varying vec3 vToyModel;\nuniform vec3 toyCloth;\n" + shader.fragmentShader;
            shader.fragmentShader = shader.fragmentShader.replace(
              "#include <map_fragment>",
              `#include <map_fragment>
              float wave = sin(vToyModel.z * 37.6991);
              float edge = max(fwidth(wave), 0.015);
              float stripe = smoothstep(-edge, edge, wave) * step(0.305, vToyModel.y);
              diffuseColor.rgb = mix(diffuseColor.rgb, toyCloth, stripe * 0.94);`,
            );
          };
          next.customProgramCacheKey = () => "toy-stall-cloth-v1";
        }
        owned.push(next);
        return next;
      };
      node.material = Array.isArray(node.material) ? node.material.map(tune) : tune(node.material);
      node.castShadow = true;
      node.receiveShadow = true;
    });
    const bounds = new THREE.Box3().setFromObject(object);
    const scale = height / Math.max(0.001, bounds.max.y - bounds.min.y);
    const center = bounds.getCenter(new THREE.Vector3());
    object.scale.multiplyScalar(scale);
    object.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    return { object, owned };
  }, [scene, height, id]);
  useEffect(() => () => prepared.owned.forEach((material) => material.dispose()), [prepared]);
  return (
    <group position={position} rotation-y={rotation}>
      <primitive object={prepared.object} dispose={null} />
    </group>
  );
}

export function Tree({ x, z, scale = 1 }: { x: number; z: number; scale?: number }) {
  return (
    <group position={[x, 0.08, z]} scale={scale}>
      <Disc position={[0, 0.72, 0]} radius={0.17} height={1.5} color={TOY.bark} />
      <Ball position={[0, 1.96, 0]} size={[0.88, 0.92, 0.84]} color={TOY.leaf} />
      <Ball position={[-0.45, 1.65, 0.2]} size={[0.55, 0.6, 0.56]} color={TOY.leafLight} />
      <Ball position={[0.5, 1.75, 0]} size={[0.52, 0.6, 0.56]} color={TOY.leaf} />
      <Ball position={[0.25, 1.64, 0.63]} size={[0.08, 0.08, 0.08]} color={TOY.gold} />
      <Ball position={[-0.51, 2.14, 0.57]} size={[0.105, 0.105, 0.105]} color={TOY.coral} />
    </group>
  );
}

export function Flower({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0.15, z]}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Ball
          key={i}
          position={[Math.sin(i * 1.256) * 0.12, 0.06, Math.cos(i * 1.256) * 0.12]}
          size={[0.12, 0.055, 0.1]}
          color={TOY.cream}
        />
      ))}
      <Ball position={[0, 0.1, 0]} size={[0.06, 0.045, 0.06]} color={TOY.gold} />
    </group>
  );
}

export function Bridge({
  x,
  z,
  length = 2.4,
  rotation = 0,
}: {
  x: number;
  z: number;
  length?: number;
  rotation?: number;
}) {
  return (
    <group position={[x, 0.02, z]} rotation-y={rotation}>
      {Array.from({ length: 8 }, (_, i) => (
        <Block
          key={i}
          position={[0, 0.04 + Math.sin((i / 7) * Math.PI) * 0.15, (i / 7 - 0.5) * length]}
          size={[1.05, 0.16, length / 8 + 0.03]}
          color={i % 2 ? TOY.bark : TOY.soil}
        />
      ))}
      {[-0.62, 0.62].map((side) => (
        <group key={side}>
          {[-length / 2, length / 2].map((end) => (
            <Block
              key={end}
              position={[side, 0.48, end]}
              size={[0.16, 0.95, 0.16]}
              color={TOY.bark}
            />
          ))}
          <Block position={[side, 0.68, 0]} size={[0.06, 0.06, length]} color={TOY.cream} />
        </group>
      ))}
    </group>
  );
}

export function Parcel({
  color = TOY.coral,
  selected = false,
}: {
  color?: number;
  selected?: boolean;
}) {
  return (
    <group>
      <Block size={[0.92, 0.68, 0.75]} color={color} />
      <Block position={[0, 0.35, 0]} size={[0.19, 0.07, 0.78]} color={TOY.cream} />
      <Block position={[0, 0, 0.385]} size={[0.19, 0.65, 0.04]} color={TOY.cream} />
      {selected ? (
        <Disc position={[0, -0.43, 0]} radius={0.72} height={0.06} color={TOY.gold} />
      ) : null}
    </group>
  );
}

export function Socket({
  color,
  active = false,
  index = 0,
}: {
  color: number;
  active?: boolean;
  index?: number;
}) {
  return (
    <group>
      <Block position={[0, 0.12, 0]} size={[1.9, 0.25, 1.75]} color={active ? TOY.gold : color} />
      <Block position={[0, 0.29, 0]} size={[1.65, 0.12, 1.48]} color={TOY.ink} />
      <Block position={[-0.81, 0.44, 0]} size={[0.15, 0.42, 1.65]} color={color} />
      <Block position={[0.81, 0.44, 0]} size={[0.15, 0.42, 1.65]} color={color} />
      <Block position={[0, 0.44, -0.76]} size={[1.6, 0.42, 0.15]} color={color} />
      {Array.from({ length: index + 1 }, (_, i) => (
        <Ball
          key={i}
          position={[(i - index / 2) * 0.24, 0.34, 0.72]}
          size={[0.055, 0.055, 0.055]}
          color={TOY.cream}
        />
      ))}
    </group>
  );
}

/** The same scenery composition for all games; never copied per component. */
export function ToyGarden() {
  return (
    <group name="toy-garden">
      <hemisphereLight args={[0xeaf7ff, 0xc59c73, 0.8]} />
      <directionalLight
        position={[-6, 12, 8]}
        intensity={2.6}
        color={0xffefcf}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-camera-near={0.5}
        shadow-camera-far={35}
        shadow-normalBias={0.04}
        shadow-bias={-0.00015}
        shadow-intensity={0.55}
        shadow-radius={3}
      />
      <directionalLight position={[6, 5, -5]} intensity={0.7} color={0xc4e9fa} />
      <mesh
        geometry={landBody}
        material={wax(TOY.soil)}
        position={[0, -0.86, 0]}
        castShadow
        receiveShadow
        dispose={null}
      />
      <mesh
        geometry={landGrass}
        material={wax(TOY.grass)}
        position={[0, -0.015, 0]}
        castShadow
        receiveShadow
        dispose={null}
      />
      <Block position={[0, -1.98, 0]} size={[250, 0.2, 250]} color={TOY.water} />
      <Block position={[0, 0.13, 1.9]} size={[9.65, 0.055, 1.4]} color={TOY.cream} />
      <Block position={[0, 0.13, -0.65]} size={[2.1, 0.055, 5.9]} color={TOY.cream} />
      <Tree x={-4.35} z={-4.0} scale={1.13} />
      <Tree x={-2.85} z={-4.2} scale={0.72} />
      <Tree x={4.6} z={-2.4} scale={0.98} />
      <Tree x={4.6} z={0.1} scale={0.58} />
      <Donor id="stall" position={[-4.8, 0.13, -1.65]} height={1.0} />
      <Donor id="cart" position={[-4.35, 0.13, -0.1]} height={0.87} rotation={0.35} />
      <Donor id="lantern" position={[4.65, 0.13, 2.9]} height={0.86} />
      <Donor id="rock_smallA" position={[-4.6, 0.13, -1.1]} height={0.35} />
      <Donor id="rock_smallA" position={[4.8, 0.13, 2.35]} height={0.28} />
      <Bridge x={0} z={4.4} length={2.1} />
      <mesh
        geometry={landingBody}
        material={wax(TOY.soil)}
        position={[0, -0.64, 5.8]}
        castShadow
        receiveShadow
        dispose={null}
      />
      <mesh
        geometry={landingGrass}
        material={wax(TOY.grass)}
        position={[0, -0.015, 5.8]}
        castShadow
        receiveShadow
        dispose={null}
      />
      {[
        [-3.8, 3.0],
        [-3.4, 3.35],
        [3.6, 1.6],
        [3.9, -1.0],
        [-1.4, -3.6],
        [1.1, 5.75],
      ].map(([x, z], i) => (
        <Flower key={i} x={x!} z={z!} />
      ))}
      {[-4.5, -3.8, 3.9, 4.6].map((x) => (
        <Block key={x} position={[x, 0.5, 3.5]} size={[0.14, 0.8, 0.14]} color={TOY.bark} />
      ))}
      <Block position={[-4.15, 0.74, 3.5]} size={[0.75, 0.07, 0.07]} color={TOY.cream} />
      <Block position={[4.25, 0.74, 3.5]} size={[0.75, 0.07, 0.07]} color={TOY.cream} />
    </group>
  );
}
