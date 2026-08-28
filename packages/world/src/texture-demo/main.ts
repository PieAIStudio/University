import * as THREE from "three";

import {
  configureIslandTextureSet,
  createIslandTriplanarMaterial,
  setIslandTriplanarMaterialState,
  type IslandTriplanarMaterialMode,
  type IslandTriplanarProjection,
  type IslandTriplanarTextures,
} from "../materials/triplanar-island.js";
import "./demo.css";

const TEXTURE_BASE_PATH = "/island-textures";
const TERRAIN_WIDTH = 28;
const TERRAIN_DEPTH = 20;
const TERRAIN_BOTTOM = -2.6;
const GRID_COLUMNS = 128;
const GRID_ROWS = 96;

type ViewMode = "near" | "far";

interface DemoState {
  useTextures: boolean;
  materialMode: IslandTriplanarMaterialMode;
  projection: IslandTriplanarProjection;
  view: ViewMode;
  seed: number;
  frozen: boolean;
}

interface DemoMetrics {
  readonly ready: boolean;
  readonly seed: number;
  readonly useTextures: boolean;
  readonly materialMode: IslandTriplanarMaterialMode;
  readonly projection: IslandTriplanarProjection;
  readonly view: ViewMode;
  readonly drawCalls: number;
  readonly triangles: number;
  readonly frameTimeMs: number;
  readonly anisotropy: number;
  readonly canvasHash: string;
}

interface TimerQueryExtension {
  readonly TIME_ELAPSED_EXT: number;
  readonly GPU_DISJOINT_EXT: number;
}

declare global {
  interface Window {
    __islandTextureDemoReady?: boolean;
    __islandTextureDemoMetrics?: () => DemoMetrics;
    __islandTextureDemoSetState?: (state: Partial<DemoState>) => void;
    __islandTextureDemoBenchmark?: () => Promise<{
      readonly medianFrameTimeMs: number;
      readonly frameTimeSource: "gpu-timer" | "cpu-submit";
      readonly drawCalls: number;
      readonly triangles: number;
    }>;
  }
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function hashNoise(x: number, z: number, seed: number): number {
  const value = Math.sin(x * 12.9898 + z * 78.233 + seed * 37.719) * 43758.5453;
  return value - Math.floor(value);
}

function valueNoise(x: number, z: number, seed: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = x - x0;
  const tz = z - z0;
  const sx = smoothstep(0, 1, tx);
  const sz = smoothstep(0, 1, tz);
  const a = hashNoise(x0, z0, seed);
  const b = hashNoise(x0 + 1, z0, seed);
  const c = hashNoise(x0, z0 + 1, seed);
  const d = hashNoise(x0 + 1, z0 + 1, seed);
  return (a * (1 - sx) + b * sx) * (1 - sz) + (c * (1 - sx) + d * sx) * sz;
}

function terrainHeight(x: number, z: number, seed: number): number {
  const radialDistance = Math.sqrt((x / 14) ** 2 + (z / 10) ** 2);
  const islandEdge = 1 - smoothstep(0.64, 1.0, radialDistance);
  const broadNoise = valueNoise(x * 0.17, z * 0.17, seed) - 0.5;
  const fineNoise = valueNoise(x * 0.52, z * 0.52, seed + 31) - 0.5;
  const centralHill = Math.exp(-((x * x) / 70 + (z * z) / 45));
  const secondaryHill = Math.exp(-((x - 5) ** 2 / 36 + (z + 3) ** 2 / 24));
  const ridge = Math.sin(x * 0.43 + seed * 0.07) * Math.sin(z * 0.31 - seed * 0.05);
  return (
    0.18 +
    islandEdge * (0.82 + broadNoise * 1.75 + fineNoise * 0.26 + ridge * 0.32) +
    centralHill * 1.65 +
    secondaryHill * 0.68
  );
}

function addPosition(positions: number[], x: number, y: number, z: number): number {
  const index = positions.length / 3;
  positions.push(x, y, z);
  return index;
}

function perimeterIndices(): number[] {
  const indices: number[] = [];
  for (let column = 0; column <= GRID_COLUMNS; column += 1) {
    indices.push(column);
  }
  for (let row = 1; row <= GRID_ROWS; row += 1) {
    indices.push(row * (GRID_COLUMNS + 1) + GRID_COLUMNS);
  }
  for (let column = GRID_COLUMNS - 1; column >= 0; column -= 1) {
    indices.push(GRID_ROWS * (GRID_COLUMNS + 1) + column);
  }
  for (let row = GRID_ROWS - 1; row >= 1; row -= 1) {
    indices.push(row * (GRID_COLUMNS + 1));
  }
  return indices;
}

function createTerrainGeometry(seed: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  const columns = GRID_COLUMNS + 1;

  for (let row = 0; row <= GRID_ROWS; row += 1) {
    const z = (row / GRID_ROWS - 0.5) * TERRAIN_DEPTH;
    for (let column = 0; column <= GRID_COLUMNS; column += 1) {
      const x = (column / GRID_COLUMNS - 0.5) * TERRAIN_WIDTH;
      addPosition(positions, x, terrainHeight(x, z, seed), z);
    }
  }

  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let column = 0; column < GRID_COLUMNS; column += 1) {
      const topLeft = row * columns + column;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + columns;
      const bottomRight = bottomLeft + 1;
      indices.push(topLeft, bottomLeft, topRight, topRight, bottomLeft, bottomRight);
    }
  }

  const perimeter = perimeterIndices();
  for (let edge = 0; edge < perimeter.length; edge += 1) {
    const topA = perimeter[edge];
    const topB = perimeter[(edge + 1) % perimeter.length];
    const topAX = positions[topA * 3];
    const topAY = positions[topA * 3 + 1];
    const topAZ = positions[topA * 3 + 2];
    const topBX = positions[topB * 3];
    const topBY = positions[topB * 3 + 1];
    const topBZ = positions[topB * 3 + 2];
    const sideTopA = addPosition(positions, topAX, topAY, topAZ);
    const sideTopB = addPosition(positions, topBX, topBY, topBZ);
    const sideBottomA = addPosition(positions, topAX, TERRAIN_BOTTOM, topAZ);
    const sideBottomB = addPosition(positions, topBX, TERRAIN_BOTTOM, topBZ);
    indices.push(sideTopA, sideTopB, sideBottomA, sideTopB, sideBottomB, sideBottomA);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.name = "DeterministicIslandTextureTerrain";
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.userData.hasUv = false;
  geometry.userData.seed = seed;
  return geometry;
}

function parseSeed(value: string | null): number {
  const seed = Number(value);
  return Number.isFinite(seed) ? Math.trunc(seed) : 17;
}

function parseState(): DemoState {
  const params = new URLSearchParams(window.location.search);
  const materials = params.get("materials");
  const projection = params.get("projection");
  const view = params.get("view");
  return {
    useTextures: params.get("textures") !== "off",
    materialMode: materials === "single" ? "single" : "multi",
    projection: projection === "full" ? "full" : "hybrid",
    view: view === "far" ? "far" : "near",
    seed: parseSeed(params.get("seed")),
    frozen: params.get("freeze") === "1",
  };
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function fnv1a(text: string): string {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193);
  }
  return (value >>> 0).toString(16).padStart(8, "0");
}

function loadTexture(loader: THREE.TextureLoader, fileName: string): Promise<THREE.Texture> {
  return loader.loadAsync(TEXTURE_BASE_PATH + "/" + fileName);
}

function setButtonState(state: DemoState): void {
  const buttons = document.querySelectorAll<HTMLButtonElement>("[data-control][data-value]");
  for (const button of buttons) {
    const control = button.dataset.control;
    const value = button.dataset.value;
    const active =
      (control === "textures" && value === (state.useTextures ? "on" : "off")) ||
      (control === "materials" && value === state.materialMode) ||
      (control === "projection" && value === state.projection) ||
      (control === "view" && value === state.view);
    button.dataset.active = String(active);
  }
}

function updateUrl(state: DemoState): void {
  const params = new URLSearchParams(window.location.search);
  params.set("textures", state.useTextures ? "on" : "off");
  params.set("materials", state.materialMode);
  params.set("projection", state.projection);
  params.set("view", state.view);
  params.set("seed", String(state.seed));
  if (state.frozen) params.set("freeze", "1");
  else params.delete("freeze");
  window.history.replaceState(null, "", window.location.pathname + "?" + params.toString());
}

function configureCamera(camera: THREE.PerspectiveCamera, view: ViewMode): void {
  if (view === "near") {
    camera.position.set(24, 9.25, 22);
  } else {
    camera.position.set(37, 25, 36);
  }
  camera.lookAt(0, 0.9, 0);
  camera.updateProjectionMatrix();
}

async function main(): Promise<void> {
  const viewport = document.getElementById("texture-demo-viewport");
  if (!viewport) {
    throw new Error("Texture demo viewport is missing");
  }

  const state = parseState();
  setButtonState(state);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "low-power",
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(viewport.clientWidth, viewport.clientHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.setClearColor(new THREE.Color(0.22, 0.39, 0.48), 1);
  viewport.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
  configureCamera(camera, state.view);

  const geometry = createTerrainGeometry(state.seed);
  const loader = new THREE.TextureLoader();
  const [grass, route, rock, detail] = await Promise.all([
    loadTexture(loader, "grass-albedo.webp"),
    loadTexture(loader, "route-albedo.webp"),
    loadTexture(loader, "rock-albedo.webp"),
    loadTexture(loader, "surface-detail.webp"),
  ]);
  const textures: IslandTriplanarTextures = { grass, route, rock, detail };
  configureIslandTextureSet(textures, renderer);

  const material = createIslandTriplanarMaterial({
    textures,
    useTextures: state.useTextures,
    materialMode: state.materialMode,
    projection: state.projection,
    textureScale: 0.17,
    hybridTopNormal: 0.78,
  });
  const terrain = new THREE.Mesh(geometry, material);
  terrain.name = "DeterministicIslandTextureTerrainMesh";
  scene.add(terrain);

  const frameSamples: number[] = [];
  let lastFrameTime = 0;
  let ready = false;

  function renderFrame(): void {
    const start = performance.now();
    renderer.render(scene, camera);
    lastFrameTime = performance.now() - start;
    frameSamples.push(lastFrameTime);
    if (frameSamples.length > 90) frameSamples.shift();
    document.getElementById("metric-calls")!.textContent = String(renderer.info.render.calls);
    document.getElementById("metric-triangles")!.textContent =
      renderer.info.render.triangles.toLocaleString();
    document.getElementById("metric-frame")!.textContent = median(frameSamples).toFixed(2) + " ms";
    document.getElementById("metric-anisotropy")!.textContent =
      String(textures.grass.anisotropy) + "×";
  }

  function setState(next: Partial<DemoState>): void {
    Object.assign(state, next);
    setIslandTriplanarMaterialState(material, {
      useTextures: state.useTextures,
      materialMode: state.materialMode,
      projection: state.projection,
    });
    configureCamera(camera, state.view);
    setButtonState(state);
    updateUrl(state);
    renderFrame();
  }

  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-control][data-value]")) {
    button.addEventListener("click", () => {
      const control = button.dataset.control;
      const value = button.dataset.value;
      if (control === "textures") setState({ useTextures: value === "on" });
      if (control === "materials" && (value === "single" || value === "multi")) {
        setState({ materialMode: value });
      }
      if (control === "projection" && (value === "full" || value === "hybrid")) {
        setState({ projection: value });
      }
      if (control === "view" && (value === "near" || value === "far")) {
        setState({ view: value });
      }
    });
  }

  function resize(): void {
    const viewportElement = document.getElementById("texture-demo-viewport");
    if (!viewportElement) return;
    const width = Math.max(1, viewportElement.clientWidth);
    const height = Math.max(1, viewportElement.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderFrame();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(viewport);
  renderer.compile(scene, camera);
  for (let index = 0; index < 4; index += 1) {
    renderer.render(scene, camera);
  }
  renderFrame();
  ready = true;
  window.__islandTextureDemoReady = true;

  window.__islandTextureDemoMetrics = () => ({
    ready,
    seed: state.seed,
    useTextures: state.useTextures,
    materialMode: state.materialMode,
    projection: state.projection,
    view: state.view,
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    frameTimeMs: Number(median(frameSamples).toFixed(3)),
    anisotropy: textures.grass.anisotropy,
    canvasHash: fnv1a(renderer.domElement.toDataURL()),
  });
  window.__islandTextureDemoSetState = setState;
  window.__islandTextureDemoBenchmark = async () => {
    renderer.compile(scene, camera);
    const gl = renderer.getContext() as WebGL2RenderingContext;
    const timerExtension = gl.getExtension(
      "EXT_disjoint_timer_query_webgl2",
    ) as TimerQueryExtension | null;
    if (timerExtension) {
      const gpuSamples: number[] = [];
      for (let index = 0; index < 30; index += 1) {
        const query = gl.createQuery();
        if (!query) break;
        gl.beginQuery(timerExtension.TIME_ELAPSED_EXT, query);
        renderer.render(scene, camera);
        gl.endQuery(timerExtension.TIME_ELAPSED_EXT);
        let sample: number | null = null;
        for (let attempt = 0; attempt < 120; attempt += 1) {
          if (gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) {
            const disjoint = gl.getParameter(timerExtension.GPU_DISJOINT_EXT);
            const nanoseconds = Number(gl.getQueryParameter(query, gl.QUERY_RESULT));
            sample = disjoint ? null : nanoseconds / 1_000_000;
            break;
          }
          await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
        }
        gl.deleteQuery(query);
        if (sample !== null) gpuSamples.push(sample);
      }
      if (gpuSamples.length > 0) {
        return {
          medianFrameTimeMs: Number(median(gpuSamples).toFixed(3)),
          frameTimeSource: "gpu-timer" as const,
          drawCalls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
        };
      }
    }

    const samples: number[] = [];
    const batchSize = 8;
    for (let index = 0; index < 60; index += 1) {
      const start = performance.now();
      for (let batch = 0; batch < batchSize; batch += 1) {
        renderer.render(scene, camera);
      }
      samples.push((performance.now() - start) / batchSize);
    }
    return {
      medianFrameTimeMs: Number(median(samples).toFixed(3)),
      frameTimeSource: "cpu-submit" as const,
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
    };
  };

  if (!state.frozen) {
    const tick = (): void => {
      renderFrame();
      window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  }
}

void main();
