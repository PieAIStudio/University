import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

/**
 * The studio an emblem is shown in: a soft room reflection for the clear coat,
 * a warm key from the upper left, a cool rim from behind. The V7 lab's stage,
 * shared by the still images and the promotion ceremony so both read as the
 * same object.
 */
export const EMBLEM_TONE_MAPPING = THREE.NeutralToneMapping;
export const EMBLEM_EXPOSURE = 1.05;

/** Lights `scene` for emblems; the returned function takes it all back. */
export function lightEmblemStage(scene: THREE.Scene, renderer: THREE.WebGLRenderer): () => void {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04).texture;
  room.dispose();
  pmrem.dispose();
  scene.environment = environment;
  scene.environmentIntensity = 0.55;
  const key = new THREE.DirectionalLight(0xfff1dc, 2.4);
  key.position.set(-2.2, 4.2, 3.2);
  const rim = new THREE.DirectionalLight(0xbfd8ff, 1.3);
  rim.position.set(2.5, 2, -3);
  const lights = [new THREE.HemisphereLight(0xfff6ea, 0x6d5a86, 1.15), key, rim];
  scene.add(...lights);
  return () => {
    scene.remove(...lights);
    if (scene.environment === environment) scene.environment = null;
    environment.dispose();
  };
}

/** Puts `camera` square in front of `object`, close enough that its face fills the frame. */
export function frameEmblem(camera: THREE.PerspectiveCamera, object: THREE.Object3D): void {
  const box = new THREE.Box3().setFromObject(object);
  const centre = box.getCenter(new THREE.Vector3());
  const extent = box.getSize(new THREE.Vector3());
  const half = (Math.max(extent.x, extent.y) / 2) * 1.08;
  const distance = half / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) + extent.z / 2;
  camera.position.set(centre.x, centre.y, centre.z + distance);
  camera.lookAt(centre);
  camera.updateProjectionMatrix();
}
