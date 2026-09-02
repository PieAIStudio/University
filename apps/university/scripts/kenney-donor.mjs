/**
 * Shared reader for the authorised local Kenney donor.
 *
 * Two payloads are imported out of the same donor and they must not grow two
 * copies of "how do I read a GLB, verify a licence and copy bytes safely":
 *
 * - `import-kenney-r01.mjs` copies the small island *recipe* slice, whose size
 *   is deliberately bounded by `rawGlbBudget`.
 * - `import-kenney-grid.mjs` copies the hex grid's *biome* library, which is
 *   much larger because one unit of a course gets one biome.
 *
 * Everything donor-shaped lives here; everything payload-shaped stays in the
 * two scripts, so neither one can quietly redefine what "verified" means.
 */
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, "..");

export const PROVENANCE_SOURCE_ROOT = "local-donor:Kenney";
export const LICENSE_SPDX = "CC0-1.0";
const LICENSE_MATCH = /Creative Commons Zero,?\s*CC0/i;
const COMMERCIAL_MATCH = /commercial/i;

const DEFAULT_DONOR_ROOTS = [
  // Normal checkout: PieAI/University/apps/university → PieAI/_donors.
  resolve(appRoot, "../../../_donors/Kenney"),
  // In-repository worktree: University/.worktrees/<name>/apps/university.
  resolve(appRoot, "../../../../../_donors/Kenney"),
];

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function resolveDonorRoot(requestedRoot) {
  const candidates = requestedRoot ? [resolve(requestedRoot)] : DEFAULT_DONOR_ROOTS;
  for (const candidate of candidates) {
    if (existsSync(candidate)) return realpathSync(candidate);
  }
  throw new Error(
    `Kenney donor not found at ${candidates.join(" or ")}. ` +
      "Set KENNEY_DONOR_ROOT to the local donor directory.",
  );
}

export function readGlbJson(bytes, label) {
  if (bytes.length < 20 || bytes.readUInt32LE(0) !== 0x46546c67) {
    throw new Error(`${label}: expected a glTF 2.0 GLB header`);
  }
  const declaredLength = bytes.readUInt32LE(8);
  if (declaredLength !== bytes.length) {
    throw new Error(`${label}: GLB length header does not match file length`);
  }

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkLength = bytes.readUInt32LE(offset);
    const chunkType = bytes.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;
    if (chunkEnd > bytes.length) throw new Error(`${label}: GLB chunk exceeds file length`);

    // JSON chunk type is ASCII "JSON" in little-endian byte order.
    if (chunkType === 0x4e4f534a) {
      const jsonText = bytes
        .subarray(chunkStart, chunkEnd)
        .toString("utf8")
        .replace(/\0+$/, "")
        .trim();
      try {
        return JSON.parse(jsonText);
      } catch (error) {
        throw new Error(`${label}: invalid GLB JSON: ${error.message}`);
      }
    }
    offset = chunkEnd;
  }
  throw new Error(`${label}: GLB has no JSON chunk`);
}

export function verifyLicense(donorRoot, pack) {
  const licenseRelative = join(pack.folder, "License.txt");
  const bytes = readFileSync(join(donorRoot, licenseRelative));
  const text = bytes.toString("utf8");
  const actualSha256 = sha256(bytes);

  if (actualSha256 !== pack.licenseSha256) {
    throw new Error(
      `${licenseRelative}: SHA-256 changed; expected ${pack.licenseSha256}, got ${actualSha256}`,
    );
  }
  if (!LICENSE_MATCH.test(text) || !COMMERCIAL_MATCH.test(text)) {
    throw new Error(`${licenseRelative}: CC0/commercial-use text was not verified`);
  }

  return {
    spdx: LICENSE_SPDX,
    file: licenseRelative,
    sha256: actualSha256,
    textCheck: "Creative Commons Zero, CC0 + commercial use",
    commercialUse: true,
  };
}

export function copyVerified(sourcePath, targetPath, label) {
  mkdirSync(dirname(targetPath), { recursive: true });
  cpSync(sourcePath, targetPath);
  const sourceBytes = readFileSync(sourcePath);
  const targetBytes = readFileSync(targetPath);
  if (sourceBytes.length !== targetBytes.length || sha256(sourceBytes) !== sha256(targetBytes)) {
    throw new Error(`${label}: copied bytes do not match the donor`);
  }
  return { bytes: targetBytes.length, sha256: sha256(targetBytes) };
}

export function writeIfChanged(path, text) {
  let current = null;
  try {
    current = readFileSync(path, "utf8");
  } catch {
    // The manifest is created on the first import.
  }
  if (current !== text) writeFileSync(path, text);
  return current !== text;
}

/* ------------------------------------------------------------------ *
 * Geometry measurement
 *
 * The grid planner is a pure module: it decides how tall a prop is without
 * ever loading a mesh. That only stays honest if the *natural* proportions of
 * each donor mesh are recorded here, at import time, so a size assertion can
 * be written against real world units instead of against a guess.
 * ------------------------------------------------------------------ */

function multiplyMatrices(a, b) {
  const out = new Array(16).fill(0);
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) sum += a[k * 4 + row] * b[column * 4 + k];
      out[column * 4 + row] = sum;
    }
  }
  return out;
}

function nodeMatrix(node) {
  if (Array.isArray(node.matrix) && node.matrix.length === 16) return node.matrix.slice();
  const [tx, ty, tz] = node.translation ?? [0, 0, 0];
  const [qx, qy, qz, qw] = node.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale ?? [1, 1, 1];
  const x2 = qx + qx;
  const y2 = qy + qy;
  const z2 = qz + qz;
  const xx = qx * x2;
  const xy = qx * y2;
  const xz = qx * z2;
  const yy = qy * y2;
  const yz = qy * z2;
  const zz = qz * z2;
  const wx = qw * x2;
  const wy = qw * y2;
  const wz = qw * z2;
  // Column-major, matching glTF's own layout.
  return [
    (1 - (yy + zz)) * sx,
    (xy + wz) * sx,
    (xz - wy) * sx,
    0,
    (xy - wz) * sy,
    (1 - (xx + zz)) * sy,
    (yz + wx) * sy,
    0,
    (xz + wy) * sz,
    (yz - wx) * sz,
    (1 - (xx + yy)) * sz,
    0,
    tx,
    ty,
    tz,
    1,
  ];
}

function transformPoint(matrix, point) {
  const [x, y, z] = point;
  return [
    matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12],
    matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13],
    matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14],
  ];
}

/**
 * Triangle count and world-space bounding box of a GLB, read from the JSON
 * chunk alone. Accessor `min`/`max` are required by the glTF spec for
 * POSITION, so the eight corners of each primitive's box are enough: no
 * binary chunk is decoded and no renderer is needed.
 */
export function measureGlb(json, label) {
  let triangles = 0;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  const visit = (nodeIndex, parentMatrix) => {
    const node = json.nodes?.[nodeIndex];
    if (!node) return;
    const matrix = multiplyMatrices(parentMatrix, nodeMatrix(node));
    const mesh = node.mesh == null ? null : json.meshes?.[node.mesh];
    for (const primitive of mesh?.primitives ?? []) {
      // Only triangle mode contributes to a triangle budget.
      if ((primitive.mode ?? 4) !== 4) continue;
      const positionAccessor = json.accessors?.[primitive.attributes?.POSITION];
      if (!positionAccessor) continue;
      const indexAccessor =
        primitive.indices == null ? positionAccessor : json.accessors[primitive.indices];
      triangles += Math.floor((indexAccessor?.count ?? 0) / 3);
      const low = positionAccessor.min;
      const high = positionAccessor.max;
      if (!Array.isArray(low) || !Array.isArray(high)) {
        throw new Error(`${label}: POSITION accessor is missing the required min/max`);
      }
      for (let corner = 0; corner < 8; corner += 1) {
        const point = transformPoint(matrix, [
          corner & 1 ? high[0] : low[0],
          corner & 2 ? high[1] : low[1],
          corner & 4 ? high[2] : low[2],
        ]);
        for (let axis = 0; axis < 3; axis += 1) {
          if (point[axis] < min[axis]) min[axis] = point[axis];
          if (point[axis] > max[axis]) max[axis] = point[axis];
        }
      }
    }
    for (const child of node.children ?? []) visit(child, matrix);
  };

  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const sceneNodes = json.scenes?.[json.scene ?? 0]?.nodes ?? [];
  for (const nodeIndex of sceneNodes) visit(nodeIndex, identity);

  if (!Number.isFinite(min[0])) throw new Error(`${label}: GLB has no drawable triangle geometry`);

  const width = max[0] - min[0];
  const height = max[1] - min[1];
  const depth = max[2] - min[2];
  if (height <= 0) throw new Error(`${label}: GLB has zero height`);

  return {
    triangles,
    /*
     * The runtime normalises every donor mesh to height 1 before applying a
     * placement's height, so these ratios — not the raw metres — are what a
     * pure planner needs to turn "this prop is 1.8 tall" into "this prop
     * covers 1.1 world units of ground".
     */
    aspect: {
      width: Number((width / height).toFixed(4)),
      depth: Number((depth / height).toFixed(4)),
    },
  };
}

export const APP_ROOT = appRoot;
