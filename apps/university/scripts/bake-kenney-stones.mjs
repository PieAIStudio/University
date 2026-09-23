#!/usr/bin/env node
/**
 * Bake a reviewed set of CC0 Kenney Nature Kit rocks into CPU mesh data.
 *
 *   node apps/university/scripts/bake-kenney-stones.mjs \
 *     [--donor-root ../_donors/Kenney] [--output packages/world/src/island/kenney-stone-shapes.json]
 *
 * The course island draws every rock from these shapes (R59-06): roadside rocks,
 * outcrops, ground stones and lock stones. They are baked rather than loaded as
 * GLBs because the outcrops and ground stones merge into the landscape's one
 * synchronous geometry, and a lock stone is instanced beside every lesson.
 *
 * Kept per triangle: its role — 0 rock face, 1 grass cap (the `grass` material
 * of the `rock_*` variants), 2 underside. Colour is applied at runtime, so the
 * island's own warm grey and meadow green replace Kenney's orange and teal. The
 * originals stay untouched; no donor path ends up in the bundle.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const argv = process.argv.slice(2);
const option = (name, fallback) => {
  const at = argv.indexOf(name);
  return at >= 0 ? argv[at + 1] : fallback;
};
const donorRoot = resolve(
  option("--donor-root", process.env.KENNEY_DONOR_ROOT ?? "../_donors/Kenney"),
);
const output = resolve(option("--output", "packages/world/src/island/kenney-stone-shapes.json"));
const kit = join(donorRoot, "kenney_nature-kit");
const licenseText = readFileSync(join(kit, "License.txt"), "utf8");
if (!licenseText.includes("CC0")) throw new Error("Expected the reviewed Nature Kit CC0 license");

/** The reviewed selection: chunky boulders, slim spires and small stones. */
const SELECTION = {
  boulder: ["rock_tallA", "rock_tallB", "rock_largeD", "rock_largeF", "rock_largeB"],
  spire: ["rock_tallC", "rock_tallG", "rock_tallH", "rock_tallI", "rock_tallF"],
  small: ["rock_smallE", "rock_smallH", "rock_smallTopB", "rock_smallI", "rock_smallF"],
};

function parseGlb(buffer) {
  const jsonLength = buffer.readUInt32LE(12);
  const json = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString("utf8"));
  const bin = buffer.subarray(20 + jsonLength + 8);
  const read = (index) => {
    const accessor = json.accessors[index];
    const view = json.bufferViews[accessor.bufferView];
    const size = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[accessor.type];
    const bytes = { 5126: 4, 5125: 4, 5123: 2, 5121: 1 }[accessor.componentType];
    const stride = view.byteStride ?? size * bytes;
    const base = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
    const value = (offset) =>
      accessor.componentType === 5126
        ? bin.readFloatLE(offset)
        : accessor.componentType === 5125
          ? bin.readUInt32LE(offset)
          : accessor.componentType === 5123
            ? bin.readUInt16LE(offset)
            : bin.readUInt8(offset);
    return Array.from({ length: accessor.count }, (_, i) => {
      const row = Array.from({ length: size }, (_, c) => value(base + i * stride + c * bytes));
      return size === 1 ? row[0] : row;
    });
  };
  return { json, read };
}

/** Column-major 4x4 from a glTF node's matrix or TRS. */
function nodeMatrix(node) {
  if (node.matrix) return node.matrix;
  const [tx, ty, tz] = node.translation ?? [0, 0, 0];
  const [x, y, z, w] = node.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale ?? [1, 1, 1];
  return [
    (1 - 2 * (y * y + z * z)) * sx,
    2 * (x * y + z * w) * sx,
    2 * (x * z - y * w) * sx,
    0,
    2 * (x * y - z * w) * sy,
    (1 - 2 * (x * x + z * z)) * sy,
    2 * (y * z + x * w) * sy,
    0,
    2 * (x * z + y * w) * sz,
    2 * (y * z - x * w) * sz,
    (1 - 2 * (x * x + y * y)) * sz,
    0,
    tx,
    ty,
    tz,
    1,
  ];
}
const multiply = (a, b) => {
  const out = new Array(16).fill(0);
  for (let c = 0; c < 4; c += 1)
    for (let r = 0; r < 4; r += 1)
      for (let k = 0; k < 4; k += 1) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return out;
};
const apply = (m, [x, y, z]) => [
  m[0] * x + m[4] * y + m[8] * z + m[12],
  m[1] * x + m[5] * y + m[9] * z + m[13],
  m[2] * x + m[6] * y + m[10] * z + m[14],
];

function bake(name) {
  const file = join(kit, "Models/GLTF format", `${name}.glb`);
  const buffer = readFileSync(file);
  const { json, read } = parseGlb(buffer);
  const positions = [];
  const indices = [];
  const roles = [];
  const visit = (index, parent) => {
    const node = json.nodes[index];
    const matrix = multiply(parent, nodeMatrix(node));
    if (node.mesh !== undefined)
      for (const primitive of json.meshes[node.mesh].primitives) {
        const material = json.materials?.[primitive.material]?.name ?? "";
        const points = read(primitive.attributes.POSITION).map((p) => apply(matrix, p));
        const order =
          primitive.indices !== undefined ? read(primitive.indices) : points.map((_, i) => i);
        const start = positions.length;
        positions.push(...points);
        for (let t = 0; t < order.length; t += 3) {
          const [a, b, c] = [order[t], order[t + 1], order[t + 2]].map((i) => points[i]);
          const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
          const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
          const ny = u[2] * v[0] - u[0] * v[2];
          const length = Math.hypot(u[1] * v[2] - u[2] * v[1], ny, u[0] * v[1] - u[1] * v[0]) || 1;
          indices.push(start + order[t], start + order[t + 1], start + order[t + 2]);
          roles.push(material === "grass" ? 1 : ny / length < -0.5 ? 2 : 0);
        }
      }
    for (const child of node.children ?? []) visit(child, matrix);
  };
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (const root of json.scenes[json.scene ?? 0].nodes) visit(root, identity);
  // Base on y = 0, centred on its footprint; the donor's own scale is kept.
  const min = [0, 1, 2].map((axis) => Math.min(...positions.map((p) => p[axis])));
  const max = [0, 1, 2].map((axis) => Math.max(...positions.map((p) => p[axis])));
  const shift = [-(min[0] + max[0]) / 2, -min[1], -(min[2] + max[2]) / 2];
  const round = (value) => Math.round(value * 1000) / 1000;
  // Weld: the donor repeats a corner once per flat face; the runtime re-splits
  // every triangle for flat shading anyway, so one copy per corner is enough.
  const welded = new Map();
  const unique = [];
  const remap = positions.map((p) => {
    const q = p.map((value, axis) => round(value + shift[axis]));
    const key = q.join(",");
    if (!welded.has(key)) {
      welded.set(key, unique.length);
      unique.push(q);
    }
    return welded.get(key);
  });
  // Welding at a millimetre closes the donor's slivers to nothing; a triangle
  // with two equal corners or no area is dropped rather than kept as a crack.
  const keptIndices = [];
  const keptRoles = [];
  for (let t = 0; t < roles.length; t += 1) {
    const [a, b, c] = [0, 1, 2].map((k) => remap[indices[t * 3 + k]]);
    if (a === b || b === c || a === c) continue;
    const [p, q, r] = [a, b, c].map((i) => unique[i]);
    const u = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
    const v = [r[0] - p[0], r[1] - p[1], r[2] - p[2]];
    const area = Math.hypot(
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    );
    if (area < 1e-6) continue;
    keptIndices.push(a, b, c);
    keptRoles.push(roles[t]);
  }
  return {
    id: name,
    source: `kenney_nature-kit/Models/GLTF format/${name}.glb`,
    sha256: createHash("sha256").update(buffer).digest("hex"),
    size: max.map((value, axis) => round(value - min[axis])),
    positions: unique.flat(),
    indices: keptIndices,
    roles: keptRoles,
  };
}

const assets = Object.entries(SELECTION).flatMap(([set, names]) =>
  names.map((name) => ({ set, ...bake(name) })),
);
writeFileSync(
  output,
  `${JSON.stringify({
    schemaVersion: 1,
    license: "CC0-1.0",
    author: "Kenney (www.kenney.nl)",
    sourceUrl: "https://kenney.nl/assets/nature-kit",
    licenseSha256: createHash("sha256").update(licenseText).digest("hex"),
    roles: ["rock", "grass", "underside"],
    assets,
  })}\n`,
);
console.log(
  `baked ${assets.length} stones, ${assets.reduce((n, a) => n + a.roles.length, 0)} triangles -> ${output}`,
);
