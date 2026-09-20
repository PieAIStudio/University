import * as THREE from "three";
type Edge = { a: number; b: number; opposite: Set<number> };
type Vertex = { p: THREE.Vector3; a: number; b?: number };
const edgeKey = (a: number, b: number) => (a < b ? `${a}/${b}` : `${b}/${a}`);

/** One upper-shoulder rounding step. Bottoms, plant seats, water and ruins stay pinned. */
export function roundStoneUpper(source: THREE.BufferGeometry): THREE.BufferGeometry | null {
  const position = source.getAttribute("position"),
    index = source.index;
  if (
    !index ||
    index.count > 30_000 ||
    source.drawRange.start !== 0 ||
    (Number.isFinite(source.drawRange.count) && source.drawRange.count < index.count)
  )
    return null;
  const allowed = new Uint8Array(index.count / 3);
  const ranges = source.userData.clayStoneRanges as
    | readonly { start: number; count: number }[]
    | undefined;
  if (ranges === undefined) allowed.fill(1);
  else {
    if (!Array.isArray(ranges) || ranges.length > index.count / 3) return null;
    for (const range of ranges) {
      if (
        !Number.isInteger(range.start) ||
        !Number.isInteger(range.count) ||
        range.start < 0 ||
        range.count < 0 ||
        range.start % 3 ||
        range.count % 3 ||
        range.start + range.count > index.count
      )
        return null;
      allowed.fill(1, range.start / 3, (range.start + range.count) / 3);
    }
    if (!allowed.some(Boolean)) return null;
  }
  const contacts = source.userData.clayStoneContacts as
    | readonly { x: number; z: number; radius: number }[]
    | undefined;
  if (contacts !== undefined) {
    if (
      !Array.isArray(contacts) ||
      contacts.length > 256 ||
      contacts.some((p) => ![p.x, p.z, p.radius].every(Number.isFinite) || p.radius < 0)
    )
      return null;
    for (let i = 0; i < index.count; i += 3) {
      if (!allowed[i / 3]) continue;
      const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
      const xs = ids.map((id) => position.getX(id)),
        zs = ids.map((id) => position.getZ(id));
      // Conservative projected footprint: protect the entire intersecting
      // triangle and its boundary, not only the vertex nearest a root.
      if (
        contacts.some(
          (p) =>
            Math.min(...xs) <= p.x + p.radius &&
            Math.max(...xs) >= p.x - p.radius &&
            Math.min(...zs) <= p.z + p.radius &&
            Math.max(...zs) >= p.z - p.radius,
        )
      )
        allowed[i / 3] = 0;
    }
  }
  const points: THREE.Vector3[] = [],
    weld: number[] = [],
    keys = new Map<string, number>();
  for (let i = 0; i < position.count; i++) {
    const p = new THREE.Vector3().fromBufferAttribute(position, i);
    const key = p
      .toArray()
      .map((v) => Math.round(v * 100_000))
      .join("/");
    let id = keys.get(key);
    if (id === undefined) {
      id = points.length;
      points.push(p);
      keys.set(key, id);
    }
    weld.push(id);
  }
  const adjacent = points.map(() => new Set<number>()),
    edges = new Map<string, Edge>();
  const pinned = new Set<number>();
  for (let i = 0; i < index.count; i += 3) {
    const v = [weld[index.getX(i)]!, weld[index.getX(i + 1)]!, weld[index.getX(i + 2)]!];
    if (!allowed[i / 3]) for (const id of v) pinned.add(id);
    for (let j = 0; j < 3; j++) {
      const a = v[j]!,
        b = v[(j + 1) % 3]!,
        c = v[(j + 2) % 3]!;
      adjacent[a]!.add(b);
      adjacent[b]!.add(a);
      const key = edgeKey(a, b),
        edge = edges.get(key) ?? { a, b, opposite: new Set<number>() };
      edge.opposite.add(c);
      edges.set(key, edge);
    }
  }
  // Open seams and non-manifold junctions are anchors, not clay to shrink.
  for (const edge of edges.values())
    if (edge.opposite.size !== 2) {
      pinned.add(edge.a);
      pinned.add(edge.b);
    }
  const bounds: Array<{ low: number; height: number }> = [],
    seen = new Set<number>();
  for (let root = 0; root < points.length; root++) {
    if (seen.has(root)) continue;
    const pending = [root],
      members: number[] = [];
    let low = Infinity,
      high = -Infinity;
    seen.add(root);
    while (pending.length) {
      const id = pending.pop()!;
      members.push(id);
      low = Math.min(low, points[id]!.y);
      high = Math.max(high, points[id]!.y);
      for (const next of adjacent[id]!)
        if (!seen.has(next)) {
          seen.add(next);
          pending.push(next);
        }
    }
    for (const id of members) bounds[id] = { low, height: high - low };
  }
  const fade = (p: THREE.Vector3, id: number) => {
    if (pinned.has(id)) return 0;
    const box = bounds[id]!;
    const t = THREE.MathUtils.clamp(
      (p.y - box.low - box.height * 0.34) / Math.max(0.001, box.height * 0.36),
      0,
      1,
    );
    return t * t * (3 - 2 * t);
  };
  const corners = points.map((p, i) => {
    const neighbours = adjacent[i]!;
    if (neighbours.size < 3) return p.clone();
    const average = new THREE.Vector3();
    for (const j of neighbours) average.add(points[j]!);
    return p.clone().lerp(average.multiplyScalar(1 / neighbours.size), 0.24 * fade(p, i));
  });
  const roundedEdges = new Map<string, THREE.Vector3>();
  for (const [key, edge] of edges) {
    const midpoint = points[edge.a]!.clone().add(points[edge.b]!).multiplyScalar(0.5),
      p = midpoint.clone();
    if (edge.opposite.size === 2 && !pinned.has(edge.a) && !pinned.has(edge.b)) {
      const opposite = new THREE.Vector3();
      for (const id of edge.opposite) opposite.add(points[id]!);
      p.lerp(opposite.multiplyScalar(0.5), 0.18 * fade(midpoint, edge.a));
    }
    roundedEdges.set(key, p);
  }
  return writeRounded(source, index, weld, corners, roundedEdges, allowed);
}

function writeRounded(
  source: THREE.BufferGeometry,
  index: THREE.BufferAttribute,
  weld: readonly number[],
  corners: readonly THREE.Vector3[],
  roundedEdges: ReadonlyMap<string, THREE.Vector3>,
  allowed: Uint8Array,
): THREE.BufferGeometry {
  const out: Vertex[] = [],
    starts: number[] = [];
  for (let i = 0; i < index.count; i += 3) {
    starts.push(out.length);
    const a = index.getX(i),
      b = index.getX(i + 1),
      c = index.getX(i + 2);
    const wa = weld[a]!,
      wb = weld[b]!,
      wc = weld[c]!;
    const A = { p: corners[wa]!, a },
      B = { p: corners[wb]!, a: b },
      C = { p: corners[wc]!, a: c };
    if (!allowed[i / 3]) {
      out.push(A, B, C);
      continue;
    }
    const AB = { p: roundedEdges.get(edgeKey(wa, wb))!, a, b };
    const BC = { p: roundedEdges.get(edgeKey(wb, wc))!, a: b, b: c };
    const CA = { p: roundedEdges.get(edgeKey(wc, wa))!, a: c, b: a };
    out.push(A, AB, CA, AB, B, BC, CA, BC, C, AB, BC, CA);
  }
  const result = new THREE.BufferGeometry();
  result.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      out.flatMap((v) => v.p.toArray()),
      3,
    ),
  );
  result.setIndex(out.map((_, i) => i));
  for (const [name, attribute] of Object.entries(source.attributes)) {
    if (name === "position" || name === "normal") continue;
    const values = new Float32Array(out.length * attribute.itemSize);
    for (let i = 0; i < out.length; i++)
      for (let axis = 0; axis < attribute.itemSize; axis++) {
        const v = out[i]!,
          a = attribute.getComponent(v.a, axis);
        values[i * attribute.itemSize + axis] =
          v.b === undefined ? a : (a + attribute.getComponent(v.b, axis)) * 0.5;
      }
    result.setAttribute(name, new THREE.BufferAttribute(values, attribute.itemSize));
  }
  starts.push(out.length);
  for (const group of source.groups) {
    const start = starts[group.start / 3],
      end = starts[(group.start + group.count) / 3];
    if (start === undefined || end === undefined) {
      result.dispose();
      throw new RangeError("Clay requires triangle-aligned material groups");
    }
    result.addGroup(start, end - start, group.materialIndex);
  }
  result.setDrawRange(0, out.length);
  return result;
}
