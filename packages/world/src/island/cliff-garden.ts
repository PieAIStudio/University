/** Sparse plants grow from actual upward mineral bevels. No new terrain field,
 * floating cards or hand-authored coordinates. Root feet fit their supporting
 * triangle; overhanging leaves must additionally clear the actual host mesh.
 */
import * as THREE from "three";
import { mergeBufferGeometries } from "three-stdlib";
import type { CliffTopology } from "./cliff-panels.js";
import shapes from "./kenney-rock-shapes.json" with { type: "json" };
import { hash } from "./random.js";

export const CLIFF_GARDEN_MAX_PLANTS = 12;
export const CLIFF_GARDEN_TRIANGLE_BUDGET = CLIFF_GARDEN_MAX_PLANTS * 24;
/** Crevice plants can root on an inclined mineral face, not just a terrace.
 * The whole circular foot still fits its actual triangle. Downward/vertical
 * surfaces remain ineligible, independently of the size/visual ranking.
 */
export const CLIFF_GARDEN_MIN_UP = 0.28;

export interface CliffPlantSeat {
  readonly face: number;
  readonly center: THREE.Vector3;
  readonly normal: THREE.Vector3;
  readonly radius: number;
  readonly inradius: number;
  readonly crownRadius: number;
}

/** The donor is an intentionally open, four-leaf plant, not a closed rock.
 * Keep its real common root and broad leaf blades rather than painting cards
 * across the cliff. Both sides of these leaves are rendered by their owner.
 */
function createCliffPlant(): THREE.BufferGeometry {
  const model = shapes.assets.find((asset) => asset.id === "plant_bush")!;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      model.vertices.flatMap((v) => [v[0]! * 0.36, v[1]! * 0.3, v[2]! * 0.36]),
      3,
    ),
  );
  geometry.setIndex(model.faces.flat());
  const root = new THREE.Color(0x4b793f),
    tip = new THREE.Color(0xb2cf65);
  geometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(
      model.vertices.flatMap((v) => {
        const colour = root.clone().lerp(tip, Math.min(1, v[1]! * 0.86));
        return [colour.r, colour.g, colour.b];
      }),
      3,
    ),
  );
  geometry.computeVertexNormals();
  return geometry;
}

/** Exact triangle-edge intersections in a bounded local box. Testing both
 * sets of edges also detects a narrow cliff triangle slicing a broad leaf.
 * Only the tiny intentional root embed may meet the host. No GPU readback,
 * alternate height field or unbounded placement retries are involved.
 */
export function cliffPlantClearsHost(
  host: THREE.BufferGeometry,
  plant: THREE.BufferGeometry,
  root: THREE.Vector3,
  scale: number,
): boolean {
  plant.computeBoundingBox();
  const box = plant.boundingBox!;
  const pp = plant.getAttribute("position"),
    pi = plant.getIndex()!;
  const hp = host.getAttribute("position"),
    hi = host.getIndex()!;
  const leaves: THREE.Triangle[] = [];
  for (let i = 0; i < pi.count; i += 3)
    leaves.push(
      new THREE.Triangle(
        ...([0, 1, 2].map((j) => new THREE.Vector3().fromBufferAttribute(pp, pi.getX(i + j))) as [
          THREE.Vector3,
          THREE.Vector3,
          THREE.Vector3,
        ]),
      ),
    );
  const cliff = new THREE.Triangle(),
    cliffBox = new THREE.Box3();
  const ray = new THREE.Ray(),
    direction = new THREE.Vector3(),
    hit = new THREE.Vector3();
  const crosses = (from: THREE.Vector3, to: THREE.Vector3, triangle: THREE.Triangle) => {
    direction.subVectors(to, from);
    const length = direction.length();
    if (length < 1e-8) return false;
    ray.set(from, direction.divideScalar(length));
    return (
      ray.intersectTriangle(triangle.a, triangle.b, triangle.c, false, hit) !== null &&
      hit.distanceTo(from) <= length + 1e-6 * scale &&
      hit.distanceTo(root) > 0.04 * scale
    );
  };
  for (let i = 0; i < hi.count; i += 3) {
    cliff.a.fromBufferAttribute(hp, hi.getX(i));
    cliff.b.fromBufferAttribute(hp, hi.getX(i + 1));
    cliff.c.fromBufferAttribute(hp, hi.getX(i + 2));
    cliffBox.makeEmpty().expandByPoint(cliff.a).expandByPoint(cliff.b).expandByPoint(cliff.c);
    if (!box.intersectsBox(cliffBox)) continue;
    for (const leaf of leaves) {
      if (
        crosses(leaf.a, leaf.b, cliff) ||
        crosses(leaf.b, leaf.c, cliff) ||
        crosses(leaf.c, leaf.a, cliff) ||
        crosses(cliff.a, cliff.b, leaf) ||
        crosses(cliff.b, cliff.c, leaf) ||
        crosses(cliff.c, cliff.a, leaf)
      )
        return false;
    }
  }
  return true;
}

export function buildCliffGarden(terrain: THREE.BufferGeometry, seed: string, scale: number) {
  if (!Number.isFinite(scale) || scale <= 0) throw new RangeError("Invalid cliff garden scale");
  const topology = terrain.userData.cliffTopology as CliffTopology | undefined;
  const position = terrain.getAttribute("position"),
    index = terrain.getIndex();
  const seats: CliffPlantSeat[] = [];
  if (!topology || !index) return { geometry: null, seats };
  const candidates: (CliffPlantSeat & { rank: number })[] = [];
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3();
  const ab = new THREE.Vector3(),
    ac = new THREE.Vector3();
  for (const face of topology.gardenFaces) {
    a.fromBufferAttribute(position, index.getX(face));
    b.fromBufferAttribute(position, index.getX(face + 1));
    c.fromBufferAttribute(position, index.getX(face + 2));
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    const cross = ab.clone().cross(ac),
      area2 = cross.length();
    if (area2 < 1e-8 || cross.y / area2 < CLIFF_GARDEN_MIN_UP) continue;
    const sideA = b.distanceTo(c),
      sideB = a.distanceTo(c),
      sideC = a.distanceTo(b);
    const perimeter = sideA + sideB + sideC;
    const inradius = area2 / perimeter;
    // The incenter, not the centroid, guarantees the full circular root foot.
    const center = a
      .clone()
      .multiplyScalar(sideA)
      .addScaledVector(b, sideB)
      .addScaledVector(c, sideC)
      .divideScalar(perimeter);
    if (inradius < 0.14 * scale || center.y > -0.8 * scale) continue;
    const radius = Math.min(1.05 * scale, inradius * 0.72);
    candidates.push({
      face,
      center,
      normal: cross.divideScalar(area2),
      radius,
      inradius,
      crownRadius: Math.min(1.8 * scale, radius * 2.8),
      // Prefer a ledge that actually has room to grow. Pure random priority
      // let a nearly invisible seedling reserve a whole angular sector and
      // exclude the adjacent broad, plant-bearing shoulder.
      rank: (inradius / scale) * (0.75 + hash(`${seed}/${face}/cliff-garden`) * 0.25),
    });
  }
  const template = createCliffPlant();
  const up = new THREE.Vector3(0, 1, 0);
  const parts: THREE.BufferGeometry[] = [];
  // Bounded attempts: at most three candidates per intended plant slot.
  for (const seat of candidates
    .sort((a, b) => b.rank - a.rank)
    .slice(0, CLIFF_GARDEN_MAX_PLANTS * 3)) {
    if (seats.length >= CLIFF_GARDEN_MAX_PLANTS) break;
    const sector = (p: THREE.Vector3) =>
      Math.floor(((Math.atan2(p.z, p.x) + Math.PI) * 12) / (Math.PI * 2));
    if (seats.some((p) => sector(p.center) === sector(seat.center))) continue;
    if (
      seats.some(
        (p) => p.center.distanceTo(seat.center) < p.crownRadius + seat.crownRadius + 2 * scale,
      )
    )
      continue;
    const size = seat.crownRadius / 0.36;
    const rotation = new THREE.Quaternion().setFromUnitVectors(up, seat.normal);
    rotation.multiply(
      new THREE.Quaternion().setFromAxisAngle(up, hash(`${seed}/${seat.face}/turn`) * Math.PI * 2),
    );
    const matrix = new THREE.Matrix4().compose(
      seat.center.clone().addScaledVector(seat.normal, -0.012 * scale),
      rotation,
      new THREE.Vector3(size, size, size),
    );
    const part = template.clone().applyMatrix4(matrix);
    if (!cliffPlantClearsHost(terrain, part, seat.center, scale)) {
      part.dispose();
      continue;
    }
    seats.push(seat);
    parts.push(part);
  }
  if (parts.length === 0) {
    template.dispose();
    return { geometry: null, seats };
  }
  const geometry = mergeBufferGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  template.dispose();
  if (!geometry) throw new Error("Unable to merge cliff garden");
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();
  return { geometry, seats };
}
