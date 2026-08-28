/**
 * The globe that lives on the study-picker page.
 *
 * Atmospheric semantic correction & visual overhaul:
 * - Studies are floating island clusters hovering in the planetary atmosphere (R ≈ 1.22).
 * - Visual proof of floating: Vertical atmospheric light tether + ground surface projection ring.
 * - Planet body: Low-poly oceans, muted meadow bands, warm stone plateaus, polar ice,
 *   and organic procedural cloud swirls.
 * - Atmosphere: A soft Fresnel rim and aerial perspective that let the edge recede without
 *   hiding the planet's readable land shapes.
 * - Performance: Deterministic (no Math.random), lightweight, fast first-screen and 60+ FPS.
 */
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { hash } from "../island/random.js";
import { Stage } from "../Stage.js";
import { renderTier } from "../sky/tier.js";
import { studyClusterStyle, studyMarkerColor, type StudyClusterStyle } from "./planet-copy.js";
import {
  ATMOSPHERE_RADIUS,
  placeStudies,
  rotationFor,
  stepRotation,
  type SpherePoint,
  type YawPitch,
} from "./placement.js";

// Space background palette
const SPACE_TOP = 0x070a14;
const SPACE_MID = 0x121424;
const SPACE_LOW = 0x221a28;

// Muted sRGB surface tones: the light/value ladder does the separating, not neon saturation.
const PLANET_PALETTE = {
  deepOcean: 0x254b63,
  ocean: 0x3f7180,
  shallowOcean: 0x67999a,
  lagoon: 0x98bbae,
  beach: 0xd8c8ad,
  grassLow: 0x81945f,
  grassHigh: 0xa8b178,
  earth: 0xa58b6e,
  mountain: 0x82766a,
  polarIce: 0xd9ddd6,
} as const;

/**
 * Deterministic spherical fractal Brownian motion for organic continents and oceans.
 */
function sphericalFbm(x: number, y: number, z: number): number {
  let value = 0;
  // Octave 1: Major continent masses
  value += Math.sin(x * 1.5 + 0.4) * Math.cos(y * 1.3 - 0.2) * Math.sin(z * 1.6 + 0.8) * 0.58;
  value += Math.cos(x * 1.2 + z * 1.4) * Math.sin(y * 1.7 + 0.5) * 0.46;
  // Octave 2: Regional bays and archipelagos
  value += Math.sin(x * 3.0 - z * 2.4 + 1.2) * Math.cos(y * 3.2 + x * 1.8) * 0.26;
  // Octave 3: Coastline variations
  value += Math.sin(x * 6.5 + y * 5.8) * Math.cos(z * 7.0 - x * 4.4) * 0.12;
  // Octave 4: Micro details
  value += Math.sin(x * 13.0 + z * 12.0 + y * 9.5) * 0.04;
  return value;
}

interface TerrainSample {
  readonly color: THREE.Color;
  readonly elevation: number;
}

function evaluatePlanetTerrain(x: number, y: number, z: number): TerrainSample {
  // Polar ice caps
  const absY = Math.abs(y);
  if (absY > 0.78) {
    const iceEdge = (absY - 0.78) / 0.22;
    const iceNoise = sphericalFbm(x * 2.5, y * 2.5, z * 2.5) * 0.08;
    if (iceEdge + iceNoise > 0.28) {
      return {
        color: new THREE.Color(PLANET_PALETTE.polarIce),
        elevation: 0.016,
      };
    }
  }

  const fbm = sphericalFbm(x, y, z);

  // Deep Ocean (~35% of planet)
  if (fbm < -0.15) {
    const depth = THREE.MathUtils.clamp((-0.15 - fbm) / 0.6, 0, 1);
    const oceanCol = new THREE.Color(PLANET_PALETTE.ocean).lerp(
      new THREE.Color(PLANET_PALETTE.deepOcean),
      depth,
    );
    return {
      color: oceanCol,
      elevation: -0.014 - depth * 0.008,
    };
  }

  // Mid Ocean (~15% of planet)
  if (fbm < 0.0) {
    const t = (fbm - -0.15) / 0.15;
    const oceanCol = new THREE.Color(PLANET_PALETTE.ocean).lerp(
      new THREE.Color(PLANET_PALETTE.shallowOcean),
      t * 0.8,
    );
    return {
      color: oceanCol,
      elevation: -0.01 + t * 0.004,
    };
  }

  // Shallow Turquoise Lagoon Shelf (~10% of planet)
  if (fbm < 0.08) {
    const t = fbm / 0.08;
    const lagoonCol = new THREE.Color(PLANET_PALETTE.shallowOcean).lerp(
      new THREE.Color(PLANET_PALETTE.lagoon),
      t,
    );
    return {
      color: lagoonCol,
      elevation: -0.006 + t * 0.008,
    };
  }

  // Golden Sand Coastlines (~8% of planet)
  if (fbm < 0.15) {
    const t = (fbm - 0.08) / 0.07;
    const beachCol = new THREE.Color(PLANET_PALETTE.beach).lerp(
      new THREE.Color(PLANET_PALETTE.grassLow),
      t * 0.35,
    );
    return {
      color: beachCol,
      elevation: 0.004 + t * 0.014,
    };
  }

  // Lush Emerald Plains (~18% of planet)
  if (fbm < 0.42) {
    const t = (fbm - 0.15) / 0.27;
    const grassCol = new THREE.Color(PLANET_PALETTE.grassLow).lerp(
      new THREE.Color(PLANET_PALETTE.grassHigh),
      t,
    );
    return {
      color: grassCol,
      elevation: 0.018 + t * 0.02,
    };
  }

  // Warm Plateaus & Hills (~10% of planet)
  if (fbm < 0.68) {
    const t = (fbm - 0.42) / 0.26;
    const hillCol = new THREE.Color(PLANET_PALETTE.grassHigh).lerp(
      new THREE.Color(PLANET_PALETTE.earth),
      t,
    );
    return {
      color: hillCol,
      elevation: 0.038 + t * 0.018,
    };
  }

  // Snowy Peaks / Mountains (~4% of planet)
  const t = THREE.MathUtils.clamp((fbm - 0.68) / 0.35, 0, 1);
  const mountainCol = new THREE.Color(PLANET_PALETTE.earth).lerp(
    new THREE.Color(PLANET_PALETTE.polarIce),
    t * 0.85,
  );
  return {
    color: mountainCol,
    elevation: 0.056 + t * 0.022,
  };
}

/**
 * Procedural planet geometry with smooth normals and rich vertex colors.
 */
export function buildPlanetGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.IcosahedronGeometry(1, 4);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const count = position.count;
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const len = Math.hypot(x, y, z) || 1;
    const nx = x / len;
    const ny = y / len;
    const nz = z / len;

    const terrain = evaluatePlanetTerrain(nx, ny, nz);
    const radius = 1 + terrain.elevation;

    position.setXYZ(i, nx * radius, ny * radius, nz * radius);
    colors[i * 3] = terrain.color.r;
    colors[i * 3 + 1] = terrain.color.g;
    colors[i * 3 + 2] = terrain.color.b;
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Atmospheric Fresnel glow shader:
 * A restrained blue-green rim on the sun-facing limb and a slate-blue night side.
 * It keeps the planet readable while giving the outer edge a little distance.
 */
const ATMOSPHERE_VERTEX_SHADER = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const ATMOSPHERE_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uSunDirection;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    vec3 normal = normalize(vWorldNormal);
    float facing = max(dot(normal, viewDirection), 0.0);
    // Sharp rim falloff so the center of the planet stays clear.
    float rim = pow(1.0 - facing, 4.2);

    float sunDot = dot(normal, normalize(uSunDirection));
    float sunFacing = smoothstep(-0.3, 0.6, sunDot);

    vec3 dayColor = vec3(0.28, 0.62, 0.68);    // Soft atmospheric sea-glass
    vec3 nightColor = vec3(0.10, 0.24, 0.33);  // Slate-blue twilight

    vec3 atmColor = mix(nightColor, dayColor, sunFacing);
    float alpha = rim * (0.16 + 0.48 * sunFacing);
    gl_FragColor = vec4(atmColor, alpha);
  }
`;

export function AtmosphereFresnel() {
  const uniforms = useMemo(
    () => ({
      uSunDirection: { value: new THREE.Vector3(-4.0, 5.0, 4.5).normalize() },
    }),
    [],
  );

  return (
    <mesh scale={1.072} renderOrder={2}>
      <sphereGeometry args={[1, 36, 24]} />
      <shaderMaterial
        vertexShader={ATMOSPHERE_VERTEX_SHADER}
        fragmentShader={ATMOSPHERE_FRAGMENT_SHADER}
        uniforms={uniforms}
        transparent
        depthTest
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

/**
 * Organic procedural cloud swirls orbiting the planet at R = 1.042.
 */
const CLOUD_VERTEX_SHADER = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const CLOUD_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uSunDirection;
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  float cloudShape(vec3 p) {
    float n1 = sin(p.x * 2.8 + p.z * 2.2 + 0.5) * cos(p.y * 3.1 - p.x * 1.5);
    float n2 = sin(p.z * 5.2 + p.y * 4.1) * cos(p.x * 4.8);
    float n3 = sin(p.x * 10.5 + p.z * 9.2) * 0.5;
    return n1 * 0.55 + n2 * 0.32 + n3 * 0.13;
  }

  void main() {
    vec3 normal = normalize(vWorldNormal);
    float c = cloudShape(normal * 2.6);
    float density = smoothstep(0.22, 0.58, c);

    if (density <= 0.02) discard;

    float sunDot = max(dot(normal, normalize(uSunDirection)), 0.0);
    // Warm grey-ivory clouds keep the bright sky-facing lobes from becoming white stickers.
    vec3 cloudShadow = vec3(0.64, 0.65, 0.61);
    vec3 cloudLight = vec3(0.86, 0.84, 0.77);
    vec3 cloudColor = mix(cloudShadow, cloudLight, 0.32 + sunDot * 0.68);

    gl_FragColor = vec4(cloudColor, density * (0.54 + sunDot * 0.14));
  }
`;

export function PlanetClouds() {
  const cloudGroup = useRef<THREE.Group>(null);
  const uniforms = useMemo(
    () => ({
      uSunDirection: { value: new THREE.Vector3(-4.0, 5.0, 4.5).normalize() },
    }),
    [],
  );

  useFrame((_, delta) => {
    if (cloudGroup.current) {
      cloudGroup.current.rotation.y += delta * 0.018;
    }
  });

  return (
    <group ref={cloudGroup}>
      <mesh scale={1.042} renderOrder={2}>
        <sphereGeometry args={[1, 36, 24]} />
        <shaderMaterial
          vertexShader={CLOUD_VERTEX_SHADER}
          fragmentShader={CLOUD_FRAGMENT_SHADER}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

/**
 * Deep space background dome and starfield.
 */
function buildSkyGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.IcosahedronGeometry(40, 1);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const count = position.count;
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    const y = position.getY(i) / 40;
    const t = Math.min(1, Math.max(0, (y + 1) / 2));
    if (t > 0.5) {
      color.setHex(SPACE_MID).lerp(new THREE.Color(SPACE_TOP), (t - 0.5) * 2);
    } else {
      color.setHex(SPACE_LOW).lerp(new THREE.Color(SPACE_MID), t * 2);
    }
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}

const STAR_COUNT = 180;

function buildStarGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(STAR_COUNT * 4 * 3);
  const colors = new Float32Array(STAR_COUNT * 4 * 3);
  const indices = new Uint16Array(STAR_COUNT * 6);

  const starColors = [
    new THREE.Color(0xfff8ee),
    new THREE.Color(0xaae8ff),
    new THREE.Color(0xffd89e),
  ];

  for (let i = 0; i < STAR_COUNT; i += 1) {
    const step = i + 1;
    const x = (hash(String(step * 2654435761)) - 0.5) * 26;
    const y = (hash(String(step * 2246822519)) - 0.5) * 18;
    const z = -(22 + hash(String(step * 3266489917)) * 12);
    const size = 0.016 + hash(String(step * 668265263)) * 0.024;
    const color = starColors[i % starColors.length]!;

    const vertex = i * 4;
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

    for (let v = 0; v < 4; v += 1) {
      const cOffset = (vertex + v) * 3;
      colors[cOffset] = color.r;
      colors[cOffset + 1] = color.g;
      colors[cOffset + 2] = color.b;
    }

    const triangle = i * 6;
    indices[triangle] = vertex;
    indices[triangle + 1] = vertex + 1;
    indices[triangle + 2] = vertex + 2;
    indices[triangle + 3] = vertex;
    indices[triangle + 4] = vertex + 2;
    indices[triangle + 5] = vertex + 3;
  }

  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  return geometry;
}

function Starfield() {
  const geometry = useMemo(() => buildStarGeometry(), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} frustumCulled={false} renderOrder={1}>
      <meshBasicMaterial
        vertexColors
        transparent
        opacity={0.88}
        depthTest
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

/**
 * Lighting setup for bright, legible, commercial-grade presentation.
 */
function PlanetLights() {
  return (
    <>
      <hemisphereLight args={[0xd8f2fc, 0x1d2e44, 1.4]} />
      <ambientLight color={0xffefe0} intensity={0.95} />
      {/* Sun key light */}
      <directionalLight position={[-4.0, 5.0, 4.5]} intensity={1.6} color={0xfff8ee} />
      {/* Frontal camera fill to keep front faces crisp & readable */}
      <directionalLight position={[0, 2.0, 6.0]} intensity={0.65} color={0xe8f2fa} />
      {/* Night-side rim fill */}
      <directionalLight position={[3.5, -2.0, -4.0]} intensity={0.45} color={0x529eb0} />
    </>
  );
}

interface FloatingIslandShapeParameters {
  readonly mainSides: number;
  readonly scaleX: number;
  readonly scaleZ: number;
  readonly lobeCount: number;
  readonly lobeAmount: number;
  readonly lobePhase: number;
  readonly heightScale: number;
  readonly depthScale: number;
  readonly satelliteAngle: number;
  readonly satelliteOrbit: number;
  readonly satelliteScale: number;
}

/**
 * Five restrained silhouettes are enough for a learner to keep a study in
 * mind without turning the picker into five unrelated art styles. The profile
 * is selected by study identity in `planet-copy.ts`; these are generator
 * parameters, not coordinates saved for an individual island.
 */
const FLOATING_ISLAND_SHAPE_PARAMETERS: readonly FloatingIslandShapeParameters[] = [
  {
    mainSides: 8,
    scaleX: 1.1,
    scaleZ: 0.9,
    lobeCount: 3,
    lobeAmount: 0.08,
    lobePhase: 0.35,
    heightScale: 0.98,
    depthScale: 1.02,
    satelliteAngle: 0.35,
    satelliteOrbit: 0.14,
    satelliteScale: 1.02,
  },
  {
    mainSides: 6,
    scaleX: 0.95,
    scaleZ: 1.06,
    lobeCount: 4,
    lobeAmount: 0.07,
    lobePhase: 0.8,
    heightScale: 1.08,
    depthScale: 0.92,
    satelliteAngle: 1.05,
    satelliteOrbit: 0.125,
    satelliteScale: 0.9,
  },
  {
    mainSides: 8,
    scaleX: 1.16,
    scaleZ: 0.82,
    lobeCount: 5,
    lobeAmount: 0.06,
    lobePhase: 0.15,
    heightScale: 1.0,
    depthScale: 0.98,
    satelliteAngle: 2.05,
    satelliteOrbit: 0.145,
    satelliteScale: 1.06,
  },
  {
    mainSides: 7,
    scaleX: 1.0,
    scaleZ: 1.0,
    lobeCount: 2,
    lobeAmount: 0.11,
    lobePhase: 0.55,
    heightScale: 1.12,
    depthScale: 1.06,
    satelliteAngle: 2.8,
    satelliteOrbit: 0.135,
    satelliteScale: 1.0,
  },
  {
    mainSides: 9,
    scaleX: 0.88,
    scaleZ: 1.12,
    lobeCount: 3,
    lobeAmount: 0.09,
    lobePhase: 1.1,
    heightScale: 1.02,
    depthScale: 1.1,
    satelliteAngle: 3.55,
    satelliteOrbit: 0.15,
    satelliteScale: 0.96,
  },
];

/**
 * Procedural low-poly floating island cluster geometry:
 * a study-coloured top, two tinted rock satellites, and one tapered keel.
 */
export function buildFloatingIslandGeometry(
  style: StudyClusterStyle = studyClusterStyle("default"),
): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const normals: number[] = [];

  const shape =
    FLOATING_ISLAND_SHAPE_PARAMETERS[style.profile % FLOATING_ISLAND_SHAPE_PARAMETERS.length]!;
  const identityColor = new THREE.Color(style.accentHex);
  const identityOutline = new THREE.Color(style.outlineHex);
  // The old cluster used one saturated lime top and one biscuit wall for every
  // study. Keep the existing study marker hue as the source, then soften it
  // with the same warm stone family used by the low-poly map.
  const GRASS_COLOR = identityColor.clone().lerp(new THREE.Color(0xd8d0b7), 0.14);
  const ROCK_MID = new THREE.Color(0xb49d84).lerp(identityColor, 0.22);
  const ROCK_BOTTOM = new THREE.Color(0x64594f).lerp(identityOutline, 0.28);

  function addFacet(
    p1: [number, number, number],
    p2: [number, number, number],
    p3: [number, number, number],
    col: THREE.Color,
  ) {
    const v1 = new THREE.Vector3(...p1);
    const v2 = new THREE.Vector3(...p2);
    const v3 = new THREE.Vector3(...p3);
    const normal = new THREE.Vector3()
      .crossVectors(v2.clone().sub(v1), v3.clone().sub(v1))
      .normalize();

    for (const p of [p1, p2, p3]) {
      positions.push(...p);
      colors.push(col.r, col.g, col.b);
      normals.push(normal.x, normal.y, normal.z);
    }
  }

  function buildIslandBody(
    cx: number,
    cy: number,
    cz: number,
    radius: number,
    height: number,
    depth: number,
    sides: number,
    scaleX: number,
    scaleZ: number,
    lobeCount: number,
    lobeAmount: number,
    lobePhase: number,
  ) {
    const topVertices: [number, number, number][] = [];
    const midVertices: [number, number, number][] = [];
    const centerTop: [number, number, number] = [cx, cy + height, cz];
    const bottomPoint: [number, number, number] = [cx, cy - depth, cz];

    for (let i = 0; i < sides; i += 1) {
      const angle = (i / sides) * Math.PI * 2;
      const r = radius * (0.9 + Math.sin(angle * lobeCount + lobePhase) * lobeAmount);
      const x = cx + Math.cos(angle) * r * scaleX;
      const z = cz + Math.sin(angle) * r * scaleZ;
      topVertices.push([x, cy + height, z]);
      // Scale around each body's own centre. Scaling the absolute x/z values
      // pulled the satellites toward the origin and made every cluster share
      // the same accidental silhouette.
      midVertices.push([cx + (x - cx) * 0.94, cy, cz + (z - cz) * 0.94]);
    }

    // Top grass fan
    for (let i = 0; i < sides; i += 1) {
      const next = (i + 1) % sides;
      addFacet(centerTop, topVertices[i]!, topVertices[next]!, GRASS_COLOR);
    }

    // Rock cliff walls
    for (let i = 0; i < sides; i += 1) {
      const next = (i + 1) % sides;
      addFacet(topVertices[i]!, midVertices[i]!, topVertices[next]!, ROCK_MID);
      addFacet(topVertices[next]!, midVertices[i]!, midVertices[next]!, ROCK_MID);
    }

    // Tapered rock bottom
    for (let i = 0; i < sides; i += 1) {
      const next = (i + 1) % sides;
      addFacet(midVertices[i]!, bottomPoint, midVertices[next]!, ROCK_BOTTOM);
    }
  }

  // 1. Main island. The top remains at the established atmospheric scale;
  // only its silhouette gets a small identity cue.
  buildIslandBody(
    0,
    0,
    0,
    0.145,
    0.024 * shape.heightScale,
    0.065 * shape.depthScale,
    shape.mainSides,
    shape.scaleX,
    shape.scaleZ,
    shape.lobeCount,
    shape.lobeAmount,
    shape.lobePhase,
  );

  const firstSatelliteAngle = shape.satelliteAngle;
  const secondSatelliteAngle = shape.satelliteAngle + 2.45;
  const satelliteSides = Math.max(5, shape.mainSides - 2);
  const firstX = Math.cos(firstSatelliteAngle) * shape.satelliteOrbit * shape.scaleX;
  const firstZ = Math.sin(firstSatelliteAngle) * shape.satelliteOrbit * shape.scaleZ;
  const secondX = Math.cos(secondSatelliteAngle) * shape.satelliteOrbit * 0.88 * shape.scaleX;
  const secondZ = Math.sin(secondSatelliteAngle) * shape.satelliteOrbit * 0.88 * shape.scaleZ;

  // 2. Satellite micro-islets. They share the same identity colour but not
  // the same placement, so the cluster has a silhouette instead of a stamp.
  buildIslandBody(
    firstX,
    0.025,
    firstZ,
    0.06 * shape.satelliteScale,
    0.014,
    0.035,
    satelliteSides,
    shape.scaleX * 0.98,
    shape.scaleZ * 0.98,
    Math.max(3, shape.lobeCount - 1),
    shape.lobeAmount * 0.8,
    shape.lobePhase + 0.5,
  );

  // 3. Satellite micro-islet two.
  buildIslandBody(
    secondX,
    -0.018,
    secondZ,
    0.048 * shape.satelliteScale,
    0.012,
    0.028,
    satelliteSides,
    shape.scaleX * 0.94,
    shape.scaleZ * 0.94,
    Math.max(3, shape.lobeCount - 1),
    shape.lobeAmount * 0.72,
    shape.lobePhase + 1.15,
  );

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  return geometry;
}

export interface FloatingStudyClusterProps {
  readonly id: string;
  readonly point: SpherePoint;
  readonly selected: boolean;
  readonly onSelect?: (studyId: string) => void;
  readonly islandGeometry: THREE.BufferGeometry;
  readonly beaconGemGeometry: THREE.BufferGeometry;
  readonly tetherGeometry: THREE.BufferGeometry;
  readonly groundRingGeometry: THREE.BufferGeometry;
  readonly hitGeometry: THREE.BufferGeometry;
}

/**
 * A floating study island cluster hovering in the atmosphere above the planet.
 */
export function FloatingStudyCluster({
  id,
  point,
  selected,
  onSelect,
  islandGeometry,
  beaconGemGeometry,
  tetherGeometry,
  groundRingGeometry,
  hitGeometry,
}: FloatingStudyClusterProps) {
  const markerColor = useMemo(() => studyMarkerColor(id), [id]);
  const normal = useMemo(
    () => new THREE.Vector3(point.x, point.y, point.z).normalize(),
    [point.x, point.y, point.z],
  );

  // Surface anchor and atmospheric island positions
  const surfacePos = useMemo(() => normal.clone().multiplyScalar(1.008), [normal]);
  const islandPos = useMemo(() => normal.clone().multiplyScalar(ATMOSPHERE_RADIUS), [normal]);
  const tetherMid = useMemo(
    () => normal.clone().multiplyScalar((1.008 + ATMOSPHERE_RADIUS - 0.04) / 2),
    [normal],
  );
  const tetherLength = useMemo(() => ATMOSPHERE_RADIUS - 0.04 - 1.008, []);

  const clusterQuat = useMemo(() => {
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  }, [normal]);

  const gemRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!gemRef.current) return;
    const time = clock.getElapsedTime();
    gemRef.current.position.y = (selected ? 0.07 : 0.056) + Math.sin(time * 2.5) * 0.006;
    gemRef.current.rotation.y = time * 0.9;
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
      {/* 1. Ground Surface Anchor & Projection Ring */}
      <mesh
        position={surfacePos}
        quaternion={clusterQuat}
        geometry={groundRingGeometry}
        renderOrder={3}
        {...interactive}
      >
        <meshBasicMaterial
          color={markerColor.hex}
          transparent
          opacity={selected ? 0.95 : 0.7}
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* 2. Atmospheric Gravity / Light Tether Pillar */}
      <mesh
        position={tetherMid}
        quaternion={clusterQuat}
        geometry={tetherGeometry}
        scale={[selected ? 1.4 : 1.0, tetherLength / 0.18, selected ? 1.4 : 1.0]}
        renderOrder={4}
        {...interactive}
      >
        <meshBasicMaterial
          color={markerColor.hex}
          transparent
          opacity={selected ? 0.88 : 0.52}
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* 3. Floating Island Cluster in the Atmosphere */}
      <group position={islandPos} quaternion={clusterQuat}>
        {/* The 3D Islands (Main + Satellites) */}
        <mesh geometry={islandGeometry} renderOrder={5} {...interactive}>
          <meshStandardMaterial
            vertexColors
            roughness={0.42}
            metalness={0.04}
            emissive={0x42542a}
            emissiveIntensity={0.38}
            flatShading
          />
        </mesh>

        {/* Floating Crystal Beacon Monument */}
        <group ref={gemRef}>
          <mesh geometry={beaconGemGeometry} renderOrder={6} {...interactive}>
            <meshStandardMaterial
              color={markerColor.hex}
              emissive={markerColor.hex}
              emissiveIntensity={selected ? 2.4 : 1.25}
              roughness={0.1}
              metalness={0.15}
            />
          </mesh>

          {/* Selected Beacon Glow Halo Ring */}
          {selected ? (
            <mesh scale={2.6} renderOrder={7}>
              <ringGeometry args={[0.022, 0.044, 16]} />
              <meshBasicMaterial
                color={0xfff6e8}
                transparent
                opacity={0.95}
                side={THREE.DoubleSide}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
              />
            </mesh>
          ) : null}
        </group>

        {/* Click Hit Target Mesh for Raycasting */}
        {onSelect ? (
          <mesh
            name={`planet-beacon-${id}-hit`}
            geometry={hitGeometry}
            renderOrder={8}
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

/**
 * Camera Distance Solver for Desktop and Mobile Viewports.
 */
const GLOBE_SYSTEM_RADIUS = 1.32;
const GLOBE_PADDING = 1.25;

export function planetDistance(aspect: number, fovDegrees: number): number {
  const vertical = (fovDegrees * Math.PI) / 180 / 2;
  const horizontal = Math.atan(Math.tan(vertical) * Math.max(aspect, 0.05));
  return (GLOBE_SYSTEM_RADIUS * GLOBE_PADDING) / Math.sin(Math.min(vertical, horizontal));
}

function planetCamera(): readonly [number, number, number] {
  return renderTier() === "mobile" ? [0, 0.12, 3.8] : [0, 0.18, 7.2];
}

const TURN_RATE = 5.5;
const REST: YawPitch = { yaw: 0.35, pitch: 0.18 };

export interface PlanetSceneProps {
  readonly studies: readonly { readonly id: string }[];
  readonly selectedId: string | null;
  readonly onSelect?: (studyId: string) => void;
}

function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * A small material-level aerial perspective pass for the globe itself.
 *
 * The planet is not put into the app's world fog: at this scale that would
 * fog the whole sphere uniformly. Instead, this patch only eases the grazing
 * edge toward a desaturated sea-glass haze. It runs before Stage's sole grade
 * and sRGB encode, so it remains part of the planet material rather than a
 * second post-processing pipeline.
 */
const PLANET_AERIAL_PERSPECTIVE_MARKER = "/* university planet aerial perspective v1 */";

function PlanetBodyMaterial() {
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  useLayoutEffect(() => {
    const material = materialRef.current;
    if (!material) return;

    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        `${PLANET_AERIAL_PERSPECTIVE_MARKER}
        float planetFacing = clamp(
          dot(normalize(normal), normalize(vViewPosition)),
          0.0,
          1.0
        );
        float planetEdge = pow(1.0 - planetFacing, 1.8);
        vec3 planetAerialHaze = vec3(0.36, 0.45, 0.44);
        outgoingLight = mix(outgoingLight, planetAerialHaze, planetEdge * 0.16);
        #include <opaque_fragment>`,
      );
    };
    material.customProgramCacheKey = () => PLANET_AERIAL_PERSPECTIVE_MARKER;
    material.needsUpdate = true;
  }, []);

  return (
    <meshStandardMaterial
      ref={materialRef}
      vertexColors
      roughness={0.62}
      metalness={0.02}
      emissive={0x294447}
      emissiveIntensity={0.12}
    />
  );
}

function Globe({ studies, selectedId, onSelect }: PlanetSceneProps) {
  const yawGroup = useRef<THREE.Group>(null);
  const pitchGroup = useRef<THREE.Group>(null);
  const current = useRef<YawPitch>({ ...REST });

  // Geometries memoized once and cleaned up properly
  const planet = useMemo(() => buildPlanetGeometry(), []);
  const sky = useMemo(() => buildSkyGeometry(), []);
  const islandGeometries = useMemo(() => {
    const geometries = new Map<string, THREE.BufferGeometry>();
    for (const study of studies) {
      geometries.set(study.id, buildFloatingIslandGeometry(studyClusterStyle(study.id)));
    }
    return geometries;
  }, [studies]);
  const beaconGemGeometry = useMemo(() => new THREE.OctahedronGeometry(0.046, 0), []);
  const tetherGeometry = useMemo(
    () => new THREE.CylinderGeometry(0.024, 0.058, 0.18, 12, 1, true),
    [],
  );
  const groundRingGeometry = useMemo(() => new THREE.RingGeometry(0.052, 0.095, 20), []);
  const hitGeometry = useMemo(() => new THREE.SphereGeometry(0.25, 12, 8), []);

  const placed = useMemo(() => placeStudies(studies.map((study) => study.id)), [studies]);

  useEffect(() => () => planet.dispose(), [planet]);
  useEffect(() => () => sky.dispose(), [sky]);
  useEffect(
    () => () => islandGeometries.forEach((geometry) => geometry.dispose()),
    [islandGeometries],
  );
  useEffect(
    () => () => {
      beaconGemGeometry.dispose();
      tetherGeometry.dispose();
      groundRingGeometry.dispose();
      hitGeometry.dispose();
    },
    [beaconGemGeometry, tetherGeometry, groundRingGeometry, hitGeometry],
  );

  useFrame((_, delta) => {
    const yawNode = yawGroup.current;
    const pitchNode = pitchGroup.current;
    if (!yawNode || !pitchNode) return;
    const selected = selectedId ? placed.get(selectedId) : undefined;
    const target = selected ? rotationFor(selected) : REST;
    const next = stepRotation(current.current, target, delta, prefersReducedMotion(), TURN_RATE);
    current.current = next;

    yawNode.rotation.y = next.yaw;
    pitchNode.rotation.x = next.pitch;
  });

  return (
    <>
      <mesh geometry={sky} frustumCulled={false}>
        <meshBasicMaterial vertexColors side={THREE.BackSide} depthWrite={false} fog={false} />
      </mesh>
      <Starfield />
      <group ref={yawGroup}>
        <group ref={pitchGroup}>
          {/* Planet Body */}
          <mesh geometry={planet}>
            <PlanetBodyMaterial />
          </mesh>

          {/* Cloud Layer */}
          <PlanetClouds />

          {/* Atmospheric Fresnel Halo */}
          <AtmosphereFresnel />

          {/* Floating Study Island Clusters in Atmosphere */}
          {[...placed.entries()].map(([id, point]) => {
            const islandGeometry = islandGeometries.get(id);
            if (!islandGeometry) return null;
            return (
              <FloatingStudyCluster
                key={id}
                id={id}
                point={point}
                selected={id === selectedId}
                onSelect={onSelect}
                islandGeometry={islandGeometry}
                beaconGemGeometry={beaconGemGeometry}
                tetherGeometry={tetherGeometry}
                groundRingGeometry={groundRingGeometry}
                hitGeometry={hitGeometry}
              />
            );
          })}
        </group>
      </group>
    </>
  );
}

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

export function PlanetStage(props: PlanetSceneProps) {
  return (
    <Stage cameraFrom={planetCamera()} lookAt={[0, 0, 0]} ambientOcclusion={false}>
      <CameraRig />
      <PlanetScene {...props} />
    </Stage>
  );
}
