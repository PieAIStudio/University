import { useEffect, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

import { hasWebGLContext } from "../webgl-capability.js";
import { buildBadgeEmblem, buildRankEmblem, type Emblem } from "./emblems.js";

/**
 * Rank and badge emblems as still images, for the DOM places they appear in:
 * the badge wall, the avatar panel, the chest's reward row, the completion card.
 *
 * Seventeen badges and five ranks on one screen would be twenty-two WebGL
 * contexts if each drew itself, and browsers stop at about sixteen. So one
 * renderer draws each emblem once, hands back a PNG, and is released when the
 * queue has been empty for a moment; the images are cached for the page's life.
 * Where WebGL is missing the promise resolves to null and the caller keeps its
 * text-only tile.
 */

export type EmblemKind = "rank" | "badge";

export interface EmblemImageOptions {
  readonly locked?: boolean;
  /** Square edge in CSS pixels; drawn at up to twice that for sharp screens. */
  readonly size?: number;
}

const IDLE_RELEASE_MS = 1500;
/** A slight turn, so the rim and the ink read as a solid object rather than a sticker. */
const TURN = -0.28;

export function emblemImageKey(
  kind: EmblemKind,
  id: string,
  { locked = false, size = 128 }: EmblemImageOptions = {},
) {
  return `${kind}:${id}:${locked ? "locked" : "earned"}:${Math.round(size)}`;
}

interface Stage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly environment: THREE.Texture;
}

let stage: Stage | null = null;
let releaseTimer: ReturnType<typeof setTimeout> | undefined;
let queue: Promise<unknown> = Promise.resolve();
const images = new Map<string, Promise<string | null>>();

function openStage(): Stage {
  if (stage) return stage;
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  pmrem.dispose();
  scene.environment = environment;
  scene.environmentIntensity = 0.55;
  scene.add(new THREE.HemisphereLight(0xfff6ea, 0x6d5a86, 1.15));
  const key = new THREE.DirectionalLight(0xfff1dc, 2.4);
  key.position.set(-2.2, 4.2, 3.2);
  const rim = new THREE.DirectionalLight(0xbfd8ff, 1.3);
  rim.position.set(2.5, 2, -3);
  scene.add(key, rim);
  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 100);
  stage = { renderer, scene, camera, environment };
  return stage;
}

function releaseStage() {
  if (!stage) return;
  stage.environment.dispose();
  stage.renderer.dispose();
  stage.renderer.forceContextLoss();
  stage = null;
}

function draw(emblem: Emblem, size: number): string {
  const { renderer, scene, camera } = openStage();
  const pixels = Math.round(size * Math.min(2, globalThis.devicePixelRatio || 1));
  renderer.setSize(pixels, pixels, false);
  emblem.group.rotation.y = TURN;
  scene.add(emblem.group);
  // Fit the emblem's own face, so a winged rank and a small coin both fill the frame.
  const box = new THREE.Box3().setFromObject(emblem.group);
  const centre = box.getCenter(new THREE.Vector3());
  const extent = box.getSize(new THREE.Vector3());
  const half = (Math.max(extent.x, extent.y) / 2) * 1.08;
  const distance = half / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) + extent.z / 2;
  camera.position.set(centre.x, centre.y, centre.z + distance);
  camera.lookAt(centre);
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL("image/png");
  scene.remove(emblem.group);
  emblem.dispose();
  return url;
}

/** The emblem as a PNG data URL, or null where this browser has no WebGL. */
export function emblemImage(
  kind: EmblemKind,
  id: string,
  options: EmblemImageOptions = {},
): Promise<string | null> {
  const key = emblemImageKey(kind, id, options);
  const cached = images.get(key);
  if (cached) return cached;
  if (!hasWebGLContext()) {
    const none = Promise.resolve(null);
    images.set(key, none);
    return none;
  }
  const made = queue.then(() => {
    clearTimeout(releaseTimer);
    try {
      const emblem =
        kind === "rank" ? buildRankEmblem(id) : buildBadgeEmblem(id, { locked: options.locked });
      return draw(emblem, options.size ?? 128);
    } catch {
      images.delete(key);
      return null;
    } finally {
      releaseTimer = setTimeout(releaseStage, IDLE_RELEASE_MS);
    }
  });
  queue = made;
  images.set(key, made);
  return made;
}

/** React to `emblemImage`: null until drawn, and null for good without WebGL. */
export function useEmblemImage(
  kind: EmblemKind,
  id: string,
  { locked = false, size = 128 }: EmblemImageOptions = {},
): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setUrl(null);
    void emblemImage(kind, id, { locked, size }).then((drawn) => {
      if (live) setUrl(drawn);
    });
    return () => {
      live = false;
    };
  }, [kind, id, locked, size]);
  return url;
}
