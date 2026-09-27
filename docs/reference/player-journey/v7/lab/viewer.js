// A small live chest for the journey page: pick a chest, tap to open.
import * as THREE from "three";
import { makeChest, makeRenderer, makeStage, makeGlowRing, makeOpening, CHEST_TIERS } from "./rewards3d.js";

export function mountChestViewer(canvas, { onBurst = () => {}, onSettled = () => {} } = {}) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = makeRenderer(canvas);
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  const scene = makeStage(renderer, { floor: "shadow" });
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0.6, 1.85, 4.5);
  camera.lookAt(0, 0.5, 0);
  scene.userData.camera = camera;

  let chest = null;
  let ring = null;
  let opening = null;
  function build(tier) {
    if (opening) opening.dispose();
    if (chest) scene.remove(chest);
    if (ring) scene.remove(ring);
    chest = makeChest(tier);
    chest.rotation.y = -0.42;
    ring = makeGlowRing(CHEST_TIERS[tier].glow, 1.0);
    scene.add(chest, ring);
    opening = makeOpening(scene, chest, {
      reduced,
      onEvent: (e) => (e.at === "burst" ? onBurst(tier) : onSettled(tier)),
    });
  }
  build("wood");

  function size() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  size();
  const ro = new ResizeObserver(size);
  ro.observe(canvas);

  let visible = true;
  const io = new IntersectionObserver((entries) => (visible = entries[0].isIntersecting));
  io.observe(canvas);
  let last = performance.now();
  let raf = 0;
  const tick = (now) => {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!visible || document.hidden) return;
    opening.update(dt);
    const sh = reduced ? 0 : opening.shake;
    camera.position.set(0.6 + (Math.random() - 0.5) * sh, 1.85 + (Math.random() - 0.5) * sh, 4.5);
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(tick);

  return {
    setTier(t) {
      build(t);
    },
    open() {
      opening.open();
    },
    reset() {
      opening.reset();
    },
    get phase() {
      return opening.phase;
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      renderer.dispose();
    },
  };
}
