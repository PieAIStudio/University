/**
 * The shared floor every greybox stands on.
 *
 * Two rules hold this file together.
 *
 * Grey, plus one accent. A greybox that acquires a palette stops being a
 * question about composition and becomes an art board, and then the reviewing
 * turns into colour argument with no end condition. Materials here are three
 * greys and one teal, and nothing may add a fourth.
 *
 * Positions come from stable ids, never from content. Seeding a layout with a
 * package hash would be deterministic — same input, same output — and still
 * wrong, because fixing one typo changes the hash and rearranges a learner's
 * entire world overnight. Determinism and stability are different properties
 * and a map needs both, so `hash()` is fed `courseId` and `studyId`, which do
 * not move when prose does.
 *
 * The renderer setup follows Web3D baseline rules 1 to 5 even though a page
 * under docs/ is not bound by them: one renderer owner, one sRGB encode, a
 * clamped DPR, a named tone map. Not obligation — this is where the product's
 * first `<Canvas>` gets to copy something that has already been seen to work.
 */
import * as THREE from "three";
import { MapControls } from "three/addons/controls/MapControls.js";

export const GREY = {
  /** Ground and anything the eye should slide off. */
  base: 0x171c26,
  /** A node that exists but is not yours yet. */
  idle: 0x3d4757,
  /** Done. Lighter, not coloured — completion is not an accent. */
  done: 0x6d788a,
  /** The single accent. Reserved for "this is where you are or where you go". */
  live: 0x5ec8c0,
  /** Locked: darker than idle so it reads as unavailable without a colour. */
  locked: 0x232a36,
  edge: 0x5a6675,
};

/** FNV-1a. Small, stable across machines, and adequate for scattering nodes. */
export function hash(text) {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193);
  }
  return (value >>> 0) / 0xffffffff;
}

/** Deterministic value in [-1, 1] for one id and one purpose. */
export function jitter(id, salt) {
  return hash(`${id}:${salt}`) * 2 - 1;
}

/**
 * A lesson count turned into a radius.
 *
 * Courses run from 1 lesson to 41. Scaling radius linearly would make the
 * largest island forty times the smallest and unusable; scaling by area — so
 * radius follows the square root — keeps a 41 visibly bigger than a 12 while
 * both stay clickable. The map has to tolerate content this uneven, because
 * the content is not going to be regularised before the map ships.
 */
export function radiusForLessons(lessons) {
  return 0.55 + Math.sqrt(lessons) * 0.42;
}

/**
 * Where every course in one study stands, relative to that study's centre.
 *
 * A radial tree: prerequisites point outward and upward from the middle, so a
 * course's distance from the centre is how much has to happen before it, and
 * its height is the same thing said twice for a reader who is looking from the
 * side rather than from above.
 *
 * This is the second layout on this page and the first one is why the page is
 * runnable. Laying courses out by depth ring put islands 2 units wide on rings
 * 1.95 apart, so half the library overlapped itself — invisible in a drawing,
 * obvious in the first second of a real render.
 *
 * The tree also happens to be the honest shape of this library. turing-pact is
 * a trunk nine links long — the foundations spine — and then nine branches
 * open at once and taper away. Drawn as rings that reads as noise; drawn as a
 * tree it reads as what it is: a long climb, a plateau, and a choice.
 *
 * Sibling spread is clamped to a fixed gap rather than filling the wedge a
 * subtree inherits. Without the clamp, nine branches at radius 56 fan across
 * 200 units and stop being one place you have arrived at.
 */
export function layoutStudy(courses, options = {}) {
  const step = options.step ?? 6.4;
  const rise = options.rise ?? 0.9;
  const siblingGap = options.siblingGap ?? 7.4;

  const byId = new Map(courses.map((course) => [course.id, course]));
  const children = new Map(courses.map((course) => [course.id, []]));
  const roots = [];
  for (const course of [...courses].sort((a, b) => a.id.localeCompare(b.id))) {
    // The first prerequisite that exists here is the parent. A course with two
    // is still drawn on one branch; the other prerequisite stays visible as a
    // road, which is honest about the graph without turning the map into one.
    const parentId = course.prerequisiteCourseIds.find((id) => byId.has(id));
    if (parentId === undefined) roots.push(course);
    else children.get(parentId).push(course);
  }

  const leaves = new Map();
  const countLeaves = (course) => {
    if (leaves.has(course.id)) return leaves.get(course.id);
    const own = children.get(course.id);
    const total = own.length === 0 ? 1 : own.reduce((sum, kid) => sum + countLeaves(kid), 0);
    leaves.set(course.id, total);
    return total;
  };
  for (const root of roots) countLeaves(root);

  const placed = new Map();
  const place = (course, angle, depth) => {
    const radius = depth * step;
    placed.set(course.id, {
      x: Math.cos(angle) * radius,
      y: depth * rise,
      z: Math.sin(angle) * radius,
      angle,
      depth,
    });
    const own = children.get(course.id);
    if (own.length === 0) return;
    const childRadius = (depth + 1) * step;
    const spread = own.length === 1 ? 0 : Math.min((own.length - 1) * siblingGap, childRadius * 1.5) / childRadius;
    own.forEach((kid, slot) => {
      const offset = own.length === 1 ? 0 : (slot / (own.length - 1) - 0.5) * spread;
      place(kid, angle + offset + jitter(kid.id, "angle") * 0.02, depth + 1);
    });
  };

  // Roots share the circle by how much grows behind each of them, so a lone
  // preface does not get the same quarter of the world as a nine-course spine.
  const totalLeaves = roots.reduce((sum, root) => sum + countLeaves(root), 0);
  let cursor = 0;
  for (const root of roots) {
    const share = countLeaves(root) / totalLeaves;
    place(root, cursor + share * Math.PI, roots.length === 1 ? 0 : 1);
    cursor += share * Math.PI * 2;
  }
  // A study with no prerequisites anywhere — five courses and no order — comes
  // out of the same code as a plain ring with no roads. That is the truth
  // about it, and inventing a sequence to make the picture tidier would be
  // telling a learner something the author never said.
  return placed;
}

export function createStage(host, options = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1019);
  // Far enough out that a neighbouring world reads as "elsewhere" rather than
  // as part of the one you are standing in, and near enough in that nothing
  // you can actually click is ever hazy.
  scene.fog = new THREE.Fog(0x0d1019, options.fog?.[0] ?? 120, options.fog?.[1] ?? 520);

  const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 1200);
  camera.position.set(...(options.cameraFrom ?? [0, 34, 46]));

  // Rule 1: exactly one renderer owner, and one loop, for this canvas.
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  // Rule 2: sRGB is encoded once, here, and nowhere else in the chain.
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = false;
  host.appendChild(renderer.domElement);

  const controls = new MapControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.46;
  controls.minDistance = 6;
  controls.maxDistance = options.maxDistance ?? 460;
  controls.target.set(...(options.lookAt ?? [0, 0, 0]));

  scene.add(new THREE.HemisphereLight(0x9fb4d6, 0x1a1f2b, 1.5));
  const key = new THREE.DirectionalLight(0xfff2dd, 1.35);
  key.position.set(18, 30, 14);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x8fb6ff, 0.45);
  fill.position.set(-16, 12, -18);
  scene.add(fill);

  // Rule 4: DPR is clamped. Two is already generous for a design surface, and
  // an unclamped retina canvas is the cheapest way to make a laptop fan spin.
  function resize() {
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (width === 0 || height === 0) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host);
  resize();

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  /** Screen point to the first pickable object under it. */
  function pick(event, pickables) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(pickables, false)[0]?.object ?? null;
  }

  // One camera move, eased, with no library and no surprise: a design page
  // that needs a tween engine to answer "does the drill-down read" has already
  // answered a different question.
  let flight = null;
  function flyTo(position, target, seconds = 0.9) {
    flight = {
      fromPosition: camera.position.clone(),
      fromTarget: controls.target.clone(),
      toPosition: new THREE.Vector3(...position),
      toTarget: new THREE.Vector3(...target),
      elapsed: 0,
      seconds,
    };
  }

  const perFrame = [];
  /*
   * Anything that projects a world point to a screen pixel belongs here, after
   * the draw, not before it.
   *
   * `Vector3.project` reads `camera.matrixWorldInverse`, and that matrix is
   * only refreshed inside `render`. A DOM label positioned before the draw is
   * therefore positioned with the previous frame's camera, which on this page
   * put every course name far enough off-screen to be culled — a bug that
   * looked exactly like "the label code never ran".
   */
  const afterRender = [];
  const timer = new THREE.Timer();
  renderer.setAnimationLoop(() => {
    timer.update();
    const delta = Math.min(timer.getDelta(), 0.05);
    if (flight) {
      flight.elapsed += delta;
      const raw = Math.min(flight.elapsed / flight.seconds, 1);
      const eased = raw < 0.5 ? 4 * raw ** 3 : 1 - (-2 * raw + 2) ** 3 / 2;
      camera.position.lerpVectors(flight.fromPosition, flight.toPosition, eased);
      controls.target.lerpVectors(flight.fromTarget, flight.toTarget, eased);
      if (raw === 1) flight = null;
    }
    for (const step of perFrame) step(delta);
    controls.update();
    renderer.render(scene, camera);
    for (const step of afterRender) step(delta);
  });

  return {
    scene,
    camera,
    renderer,
    controls,
    pick,
    flyTo,
    onFrame: (step) => perFrame.push(step),
    onAfterRender: (step) => afterRender.push(step),
    isFlying: () => flight !== null,
  };
}

/** A flat disc used for every course island, unit pad and marker base. */
export function disc(radius, height, colour) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius * 0.94, height, 28),
    new THREE.MeshStandardMaterial({ color: colour, roughness: 0.82, metalness: 0.05 }),
  );
}

/**
 * The learner. A small circle, as asked for, and deliberately kept that way.
 *
 * A rigged character needs a controller, a controller needs physics, physics
 * needs tuning and a mobile input story — and the donor catalogue's line for
 * this product still reads "not yet, wait for playtest evidence". None of that
 * is required to answer the question this page asks, which is whether a person
 * can see where they are.
 */
export function learnerMarker() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.32, 0.5, 4, 12),
    new THREE.MeshStandardMaterial({ color: 0xf2f6ff, roughness: 0.5 }),
  );
  body.position.y = 0.62;
  group.add(body);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.78, 32),
    new THREE.MeshBasicMaterial({ color: GREY.live, transparent: true, opacity: 0.75 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  group.add(ring);
  group.userData.ring = ring;
  return group;
}

/** A road between two points, drawn as a thin flat ribbon rather than a line. */
export function road(from, to, colour = GREY.edge) {
  const direction = new THREE.Vector3().subVectors(to, from);
  const length = direction.length();
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.06, length),
    new THREE.MeshStandardMaterial({ color: colour, roughness: 0.9 }),
  );
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.lookAt(to);
  return mesh;
}

/** Load the taxonomy digest, with an explanation instead of a blank canvas. */
export async function loadTaxonomy() {
  const response = await fetch("../data/taxonomy.json");
  if (!response.ok) throw new Error(`taxonomy.json: ${response.status}`);
  return response.json();
}
