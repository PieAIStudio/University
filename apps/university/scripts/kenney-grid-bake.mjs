import { inflateSync } from "node:zlib";

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const TRIANGLES = 4;
const ARRAY_BUFFER = 34962;
const COLORMAP_TILE_WIDTH = 64;
const COLORMAP_TILE_HEIGHT = 128;

const COMPONENT_BYTES = Object.freeze({
  5120: 1,
  5121: 1,
  5122: 2,
  5123: 2,
  5125: 4,
  5126: 4,
});

const TYPE_COMPONENTS = Object.freeze({
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16,
});

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/** An error that a caller can distinguish from a broken GLB or PNG. */
export class GridBakeError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = "GridBakeError";
    this.code = code;
    Object.assign(this, details);
  }
}

function fail(message, code = "INVALID_INPUT", details = {}) {
  throw new GridBakeError(message, code, details);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

/** Read the JSON and BIN chunks of a GLB without involving a renderer. */
export function readGlb(bytes, label = "GLB") {
  if (!Buffer.isBuffer(bytes)) bytes = Buffer.from(bytes);
  if (bytes.length < 20 || bytes.readUInt32LE(0) !== GLB_MAGIC) {
    fail(`${label}: expected a glTF 2.0 GLB header`);
  }
  const declaredLength = bytes.readUInt32LE(8);
  if (declaredLength !== bytes.length) {
    fail(`${label}: GLB length header does not match file length`);
  }

  let offset = 12;
  let json = null;
  let bin = null;
  while (offset + 8 <= bytes.length) {
    const chunkLength = bytes.readUInt32LE(offset);
    const chunkType = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = start + chunkLength;
    if (end > bytes.length) fail(`${label}: GLB chunk exceeds file length`);
    if (chunkType === JSON_CHUNK) {
      const jsonText = bytes.subarray(start, end).toString("utf8").replace(/\0+$/, "").trim();
      try {
        json = JSON.parse(jsonText);
      } catch (error) {
        fail(`${label}: invalid GLB JSON: ${error.message}`);
      }
    } else if (chunkType === BIN_CHUNK && bin === null) {
      bin = bytes.subarray(start, end);
    }
    offset = end;
  }

  if (!json) fail(`${label}: GLB has no JSON chunk`);
  if (!bin) fail(`${label}: GLB has no BIN chunk`);
  if (json.buffers?.[0]?.byteLength > bin.length) {
    fail(`${label}: BIN chunk is shorter than buffers[0].byteLength`);
  }
  return { json, bin };
}

/** Write a standards-compliant GLB with one JSON and one BIN chunk. */
export function writeGlb(json, bin) {
  const jsonBytes = Buffer.from(JSON.stringify(json), "utf8");
  const jsonPadding = (4 - (jsonBytes.length % 4)) % 4;
  const binPadding = (4 - (bin.length % 4)) % 4;
  const paddedJson = Buffer.concat([jsonBytes, Buffer.alloc(jsonPadding, 0x20)]);
  const paddedBin = Buffer.concat([bin, Buffer.alloc(binPadding)]);
  const totalLength = 12 + 8 + paddedJson.length + 8 + paddedBin.length;
  const output = Buffer.alloc(totalLength);

  output.writeUInt32LE(GLB_MAGIC, 0);
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(totalLength, 8);
  let offset = 12;
  output.writeUInt32LE(paddedJson.length, offset);
  output.writeUInt32LE(JSON_CHUNK, offset + 4);
  paddedJson.copy(output, offset + 8);
  offset += 8 + paddedJson.length;
  output.writeUInt32LE(paddedBin.length, offset);
  output.writeUInt32LE(BIN_CHUNK, offset + 4);
  paddedBin.copy(output, offset + 8);
  return output;
}

function pngPaeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/**
 * Decode the small, uncompressed-by-format Kenney PNGs without adding an image
 * dependency to the application. Palette, RGB and RGBA 8-bit PNGs are enough
 * for the four checked-in kit snapshots; the scanline filters are still fully
 * decoded rather than assuming the donor happened to use filter 0.
 */
export function decodePng(bytes, label = "PNG") {
  if (!Buffer.isBuffer(bytes)) bytes = Buffer.from(bytes);
  if (!bytes.subarray(0, 8).equals(PNG_SIGNATURE)) fail(`${label}: invalid PNG signature`);

  let offset = 8;
  let header = null;
  let palette = null;
  let transparency = null;
  const idat = [];
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const start = offset + 8;
    const end = start + length;
    if (end + 4 > bytes.length) fail(`${label}: PNG chunk exceeds file length`);
    const data = bytes.subarray(start, end);
    if (type === "IHDR") {
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        compression: data[10],
        filter: data[11],
        interlace: data[12],
      };
    } else if (type === "PLTE") {
      palette = data;
    } else if (type === "tRNS") {
      transparency = data;
    } else if (type === "IDAT") {
      idat.push(data);
    }
    offset = end + 4;
    if (type === "IEND") break;
  }

  if (!header) fail(`${label}: PNG has no IHDR chunk`);
  if (header.bitDepth !== 8 || header.interlace !== 0) {
    fail(`${label}: only non-interlaced 8-bit PNGs are supported`);
  }
  if (header.compression !== 0 || header.filter !== 0) {
    fail(`${label}: unsupported PNG compression or filter method`);
  }
  const channelsByType = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
  const channels = channelsByType[header.colorType];
  if (!channels) fail(`${label}: unsupported PNG colour type ${header.colorType}`);
  if (header.colorType === 3 && (!palette || palette.length % 3 !== 0)) {
    fail(`${label}: indexed PNG has no valid PLTE chunk`);
  }

  const rowBytes = header.width * channels;
  const expectedRawLength = (rowBytes + 1) * header.height;
  let raw;
  try {
    raw = inflateSync(Buffer.concat(idat));
  } catch (error) {
    fail(`${label}: IDAT inflate failed: ${error.message}`);
  }
  if (raw.length !== expectedRawLength) {
    fail(`${label}: inflated scanlines have ${raw.length} bytes, expected ${expectedRawLength}`);
  }

  const scanlines = new Uint8Array(rowBytes * header.height);
  let rawOffset = 0;
  for (let y = 0; y < header.height; y += 1) {
    const filter = raw[rawOffset++];
    const rowStart = y * rowBytes;
    const previousStart = rowStart - rowBytes;
    for (let x = 0; x < rowBytes; x += 1) {
      const left = x >= channels ? scanlines[rowStart + x - channels] : 0;
      const up = y > 0 ? scanlines[previousStart + x] : 0;
      const upLeft = y > 0 && x >= channels ? scanlines[previousStart + x - channels] : 0;
      const value = raw[rawOffset++];
      let restored;
      if (filter === 0) restored = value;
      else if (filter === 1) restored = value + left;
      else if (filter === 2) restored = value + up;
      else if (filter === 3) restored = value + Math.floor((left + up) / 2);
      else if (filter === 4) restored = value + pngPaeth(left, up, upLeft);
      else fail(`${label}: unsupported PNG scanline filter ${filter}`);
      scanlines[rowStart + x] = restored & 0xff;
    }
  }

  const rgba = new Uint8Array(header.width * header.height * 4);
  for (let y = 0; y < header.height; y += 1) {
    for (let x = 0; x < header.width; x += 1) {
      const source = y * rowBytes + x * channels;
      const target = (y * header.width + x) * 4;
      if (header.colorType === 3) {
        const paletteIndex = scanlines[source];
        const paletteOffset = paletteIndex * 3;
        if (paletteOffset + 2 >= palette.length) {
          fail(`${label}: palette index ${paletteIndex} is out of range`);
        }
        rgba[target] = palette[paletteOffset];
        rgba[target + 1] = palette[paletteOffset + 1];
        rgba[target + 2] = palette[paletteOffset + 2];
        rgba[target + 3] = transparency?.[paletteIndex] ?? 255;
      } else if (header.colorType === 0) {
        rgba[target] = scanlines[source];
        rgba[target + 1] = scanlines[source];
        rgba[target + 2] = scanlines[source];
        rgba[target + 3] = 255;
      } else if (header.colorType === 2) {
        rgba[target] = scanlines[source];
        rgba[target + 1] = scanlines[source + 1];
        rgba[target + 2] = scanlines[source + 2];
        rgba[target + 3] = 255;
      } else if (header.colorType === 4) {
        rgba[target] = scanlines[source];
        rgba[target + 1] = scanlines[source];
        rgba[target + 2] = scanlines[source];
        rgba[target + 3] = scanlines[source + 1];
      } else {
        rgba[target] = scanlines[source];
        rgba[target + 1] = scanlines[source + 1];
        rgba[target + 2] = scanlines[source + 2];
        rgba[target + 3] = scanlines[source + 3];
      }
    }
  }
  return { width: header.width, height: header.height, data: rgba };
}

function accessorInfo(json, accessorIndex, label) {
  const accessor = json.accessors?.[accessorIndex];
  if (!accessor) fail(`${label}: accessor ${accessorIndex} is missing`);
  const view = json.bufferViews?.[accessor.bufferView];
  if (!view) fail(`${label}: accessor ${accessorIndex} has no bufferView`);
  const componentBytes = COMPONENT_BYTES[accessor.componentType];
  const componentCount = TYPE_COMPONENTS[accessor.type];
  if (!componentBytes || !componentCount) {
    fail(`${label}: accessor ${accessorIndex} has unsupported format`);
  }
  const elementBytes = componentBytes * componentCount;
  const stride = view.byteStride ?? elementBytes;
  if (stride < elementBytes) fail(`${label}: accessor ${accessorIndex} has a short byteStride`);
  return { accessor, view, componentBytes, componentCount, elementBytes, stride };
}

function readComponent(data, offset, componentType) {
  if (componentType === 5120) return data.readInt8(offset);
  if (componentType === 5121) return data.readUInt8(offset);
  if (componentType === 5122) return data.readInt16LE(offset);
  if (componentType === 5123) return data.readUInt16LE(offset);
  if (componentType === 5125) return data.readUInt32LE(offset);
  if (componentType === 5126) return data.readFloatLE(offset);
  fail(`unsupported glTF component type ${componentType}`);
}

function decodeAccessor(json, bin, accessorIndex, label) {
  const info = accessorInfo(json, accessorIndex, label);
  const { accessor, view, componentBytes, componentCount, stride } = info;
  if (accessor.sparse) fail(`${label}: sparse accessors are not supported`);
  const base = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const values = new Array(accessor.count);
  for (let index = 0; index < accessor.count; index += 1) {
    const start = base + index * stride;
    const element = new Array(componentCount);
    for (let component = 0; component < componentCount; component += 1) {
      const at = start + component * componentBytes;
      if (at + componentBytes > bin.length) {
        fail(`${label}: accessor ${accessorIndex} reads past the BIN chunk`);
      }
      element[component] = readComponent(bin, at, accessor.componentType);
    }
    values[index] = element;
  }
  return { ...info, values };
}

function materialTextureInfo(json, primitive, label) {
  const materialIndex = primitive.material ?? 0;
  const material = json.materials?.[materialIndex];
  if (!material) fail(`${label}: material ${materialIndex} is missing`);
  const textureInfo = material.pbrMetallicRoughness?.baseColorTexture;
  if (!textureInfo) {
    fail(`${label}: material ${materialIndex} has no baseColorTexture to bake`);
  }
  const texture = json.textures?.[textureInfo.index];
  const image = texture && json.images?.[texture.source];
  if (!image) fail(`${label}: baseColorTexture does not resolve to an image`);
  if (typeof image.uri !== "string" || !/colormap\.png$/i.test(image.uri)) {
    fail(`${label}: baseColorTexture must resolve to an external colormap.png`, "WRONG_TEXTURE");
  }
  return { material, materialIndex, textureInfo, image };
}

function transformedUv(uv, textureInfo) {
  const transform = textureInfo.extensions?.KHR_texture_transform;
  if (!transform) return uv;
  const offset = transform.offset ?? [0, 0];
  const scale = transform.scale ?? [1, 1];
  const rotation = transform.rotation ?? 0;
  let x = uv[0] * scale[0];
  let y = uv[1] * scale[1];
  if (rotation !== 0) {
    const cosine = Math.cos(rotation);
    const sine = Math.sin(rotation);
    [x, y] = [cosine * x - sine * y, sine * x + cosine * y];
  }
  return [x + offset[0], y + offset[1]];
}

/**
 * Sample the source image in glTF's UV convention.
 *
 * glTF UV v=0 is the first (top) image row. PNG decoding also exposes its
 * first row at y=0, and GLTFLoader keeps that convention with flipY=false.
 * The donor sweep's `(1 - v)` probe is useful for counting colour changes, but
 * using it for the bake mirrors every atlas vertically and turns valid upper
 * atlas samples into the black padding row. The real screenshot is the guard
 * against that otherwise plausible arithmetic mistake.
 */
export function sampleColormapNearest(image, u, v) {
  const x = Math.min(image.width - 1, Math.max(0, Math.round(u * image.width)));
  const y = Math.min(image.height - 1, Math.max(0, Math.round(v * image.height)));
  const offset = (y * image.width + x) * 4;
  return [image.data[offset], image.data[offset + 1], image.data[offset + 2]];
}

/** Kenney's 512px colormap atlas is eight 64px columns by four 128px rows. */
export function colormapBlockId(image, u, v) {
  const x = Math.min(image.width - 1, Math.max(0, Math.round(u * image.width)));
  const y = Math.min(image.height - 1, Math.max(0, Math.round(v * image.height)));
  return `${Math.floor(x / COLORMAP_TILE_WIDTH)}:${Math.floor(y / COLORMAP_TILE_HEIGHT)}`;
}

function sameColour(first, second) {
  return first[0] === second[0] && first[1] === second[1] && first[2] === second[2];
}

/** Audit all triangle vertices before making any irreversible output. */
export function auditGlbColormap({ sourceBytes, colormapBytes, label = "GLB" }) {
  const { json, bin } = readGlb(sourceBytes, label);
  const image = decodePng(colormapBytes, `${label} colormap`);
  if (image.width !== 512 || image.height !== 512) {
    fail(`${label}: Kenney colormap must be 512x512 for atlas block auditing`);
  }
  let totalTriangles = 0;
  let exactColourVariationTriangles = 0;
  const crossColourTriangles = [];

  for (const [meshIndex, mesh] of (json.meshes ?? []).entries()) {
    for (const [primitiveIndex, primitive] of (mesh.primitives ?? []).entries()) {
      const primitiveLabel = `${label} mesh ${meshIndex} primitive ${primitiveIndex}`;
      if ((primitive.mode ?? TRIANGLES) !== TRIANGLES) {
        fail(`${primitiveLabel}: only triangle primitives can enter the batched grid library`);
      }
      const uvAttribute = primitive.attributes?.TEXCOORD_0;
      if (uvAttribute == null) fail(`${primitiveLabel}: missing TEXCOORD_0 for colormap bake`);
      const texture = materialTextureInfo(json, primitive, primitiveLabel);
      const uvSet = texture.textureInfo.extensions?.KHR_texture_transform?.texCoord ?? 0;
      if (uvSet !== 0) {
        fail(`${primitiveLabel}: KHR_texture_transform selects unsupported TEXCOORD_${uvSet}`);
      }
      const uv = decodeAccessor(json, bin, uvAttribute, primitiveLabel);
      const indices =
        primitive.indices == null
          ? Array.from({ length: uv.accessor.count }, (_, index) => index)
          : decodeAccessor(json, bin, primitive.indices, primitiveLabel).values.map(
              (value) => value[0],
            );
      if (indices.length % 3 !== 0) {
        fail(`${primitiveLabel}: index count ${indices.length} is not divisible by three`);
      }
      for (let index = 0; index < indices.length; index += 3) {
        const triangle = index / 3;
        const vertices = [indices[index], indices[index + 1], indices[index + 2]];
        const colours = vertices.map((vertex) => {
          const point = uv.values[vertex];
          if (!point) fail(`${primitiveLabel}: index ${vertex} is outside TEXCOORD_0`);
          return sampleColormapNearest(image, ...transformedUv(point, texture.textureInfo));
        });
        const blocks = vertices.map((vertex) => {
          const point = uv.values[vertex];
          return colormapBlockId(image, ...transformedUv(point, texture.textureInfo));
        });
        totalTriangles += 1;
        if (!sameColour(colours[0], colours[1]) || !sameColour(colours[0], colours[2])) {
          exactColourVariationTriangles += 1;
        }
        if (new Set(blocks).size > 1) {
          crossColourTriangles.push({
            meshIndex,
            primitiveIndex,
            triangle,
            vertices,
            colours,
            blocks,
          });
        }
      }
    }
  }

  return {
    json,
    bin,
    image,
    totalTriangles,
    exactColourVariationTriangles,
    crossColourTriangles,
    crossColourRatio: totalTriangles === 0 ? 0 : crossColourTriangles.length / totalTriangles,
  };
}

function appendAligned(parts, currentLength, bytes) {
  const padding = (4 - (currentLength % 4)) % 4;
  if (padding > 0) parts.push(Buffer.alloc(padding));
  parts.push(bytes);
  return currentLength + padding + bytes.length;
}

function stripTextures(json) {
  for (const material of json.materials ?? []) {
    const pbr = material.pbrMetallicRoughness;
    if (pbr?.baseColorTexture) delete pbr.baseColorTexture;
    for (const key of ["normalTexture", "occlusionTexture", "emissiveTexture"]) {
      if (material[key]) {
        fail(`baked material still references ${key}`, "UNSUPPORTED_TEXTURE_USAGE");
      }
    }
    material.name = "baked-vertex-color";
  }
  json.images = [];
  json.textures = [];
  json.samplers = [];
  for (const key of ["extensionsUsed", "extensionsRequired"]) {
    if (Array.isArray(json[key])) {
      json[key] = json[key].filter((extension) => extension !== "KHR_texture_transform");
      if (json[key].length === 0) delete json[key];
    }
  }
}

/** Remove now-unreachable UV/tangent bytes as well as their JSON attributes. */
function compactBuffers(json, bin) {
  const usedAccessors = new Set();
  const keepAccessor = (accessorIndex) => {
    if (accessorIndex != null) usedAccessors.add(accessorIndex);
  };
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      keepAccessor(primitive.indices);
      for (const accessorIndex of Object.values(primitive.attributes ?? {})) {
        keepAccessor(accessorIndex);
      }
      for (const target of primitive.targets ?? []) {
        for (const accessorIndex of Object.values(target)) keepAccessor(accessorIndex);
      }
    }
  }
  for (const skin of json.skins ?? []) keepAccessor(skin.inverseBindMatrices);
  for (const animation of json.animations ?? []) {
    for (const sampler of animation.samplers ?? []) {
      keepAccessor(sampler.input);
      keepAccessor(sampler.output);
    }
  }

  const usedBufferViews = new Set();
  for (const accessorIndex of usedAccessors) {
    const accessor = json.accessors?.[accessorIndex];
    if (!accessor) fail(`referenced accessor ${accessorIndex} is missing`, "INVALID_OUTPUT");
    if (accessor.bufferView == null) {
      fail(`referenced accessor ${accessorIndex} has no bufferView`, "INVALID_OUTPUT");
    }
    usedBufferViews.add(accessor.bufferView);
  }

  const bufferParts = [];
  const remappedBufferViews = new Map();
  let bufferLength = 0;
  for (const [oldIndex, view] of (json.bufferViews ?? []).entries()) {
    if (!usedBufferViews.has(oldIndex)) continue;
    const oldOffset = view.byteOffset ?? 0;
    const oldEnd = oldOffset + view.byteLength;
    if (oldEnd > bin.length) fail(`bufferView ${oldIndex} exceeds the BIN chunk`, "INVALID_OUTPUT");
    const alignedOffset = bufferLength + ((4 - (bufferLength % 4)) % 4);
    if (alignedOffset > bufferLength) bufferParts.push(Buffer.alloc(alignedOffset - bufferLength));
    const nextView = {
      ...view,
      byteOffset: alignedOffset,
    };
    delete nextView.name;
    remappedBufferViews.set(oldIndex, { index: remappedBufferViews.size, view: nextView });
    bufferParts.push(bin.subarray(oldOffset, oldEnd));
    bufferLength = alignedOffset + view.byteLength;
  }

  const accessorIndexMap = new Map();
  const accessors = [];
  for (const [oldIndex, accessor] of (json.accessors ?? []).entries()) {
    if (!usedAccessors.has(oldIndex)) continue;
    accessorIndexMap.set(oldIndex, accessors.length);
    accessors.push(accessor);
  }
  for (const accessor of accessors) {
    const remapped = remappedBufferViews.get(accessor.bufferView);
    if (!remapped)
      fail(`accessor references removed bufferView ${accessor.bufferView}`, "INVALID_OUTPUT");
    accessor.bufferView = remapped.index;
  }

  const remapAccessor = (accessorIndex) =>
    accessorIndex == null ? accessorIndex : accessorIndexMap.get(accessorIndex);
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      primitive.indices = remapAccessor(primitive.indices);
      if (primitive.indices == null) delete primitive.indices;
      for (const [name, accessorIndex] of Object.entries(primitive.attributes ?? {})) {
        primitive.attributes[name] = remapAccessor(accessorIndex);
      }
      for (const target of primitive.targets ?? []) {
        for (const [name, accessorIndex] of Object.entries(target)) {
          target[name] = remapAccessor(accessorIndex);
        }
      }
    }
  }
  for (const skin of json.skins ?? []) {
    if (skin.inverseBindMatrices != null) {
      skin.inverseBindMatrices = remapAccessor(skin.inverseBindMatrices);
    }
  }
  for (const animation of json.animations ?? []) {
    for (const sampler of animation.samplers ?? []) {
      sampler.input = remapAccessor(sampler.input);
      sampler.output = remapAccessor(sampler.output);
    }
  }

  json.accessors = accessors;
  json.bufferViews = [...remappedBufferViews.values()].map(({ view }) => view);
  const compactedBin = Buffer.concat(bufferParts);
  if (json.buffers?.[0]) json.buffers[0].byteLength = compactedBin.length;
  return compactedBin;
}

/**
 * Bake one verified zero-cross-colour GLB. The output keeps the source BIN
 * plus one tightly packed RGB byte attribute per primitive, so no geometry is
 * re-tessellated and the triangle count is unchanged.
 */
export function bakeColormapToVertexColors({ sourceBytes, colormapBytes, label = "GLB" }) {
  const audit = auditGlbColormap({ sourceBytes, colormapBytes, label });
  if (audit.crossColourTriangles.length > 0) {
    const first = audit.crossColourTriangles[0];
    fail(
      `${label}: rejected: ${audit.crossColourTriangles.length}/${audit.totalTriangles} triangles ` +
        `(${(audit.crossColourRatio * 100).toFixed(2)}%) cross colormap blocks; ` +
        `first at mesh ${first.meshIndex}, primitive ${first.primitiveIndex}, triangle ${first.triangle}`,
      "CROSS_COLOUR_TRIANGLE",
      {
        totalTriangles: audit.totalTriangles,
        exactColourVariationTriangles: audit.exactColourVariationTriangles,
        crossColourTriangles: audit.crossColourTriangles.length,
        crossColourRatio: audit.crossColourRatio,
        firstCrossColourTriangle: first,
      },
    );
  }

  const json = cloneJson(audit.json);
  const binParts = [Buffer.from(audit.bin)];
  let binLength = audit.bin.length;
  let bakedVertexCount = 0;
  for (const [meshIndex, mesh] of (json.meshes ?? []).entries()) {
    for (const [primitiveIndex, primitive] of (mesh.primitives ?? []).entries()) {
      const sourcePrimitive = audit.json.meshes[meshIndex].primitives[primitiveIndex];
      const uvAccessorIndex = sourcePrimitive.attributes?.TEXCOORD_0;
      if (uvAccessorIndex == null) {
        fail(`${label} mesh ${meshIndex} primitive ${primitiveIndex}: missing TEXCOORD_0`);
      }
      const texture = materialTextureInfo(
        audit.json,
        sourcePrimitive,
        `${label} mesh ${meshIndex}`,
      );
      const uv = decodeAccessor(audit.json, audit.bin, uvAccessorIndex, label);
      const colours = Buffer.alloc(uv.accessor.count * 3);
      for (let vertex = 0; vertex < uv.accessor.count; vertex += 1) {
        const colour = sampleColormapNearest(
          audit.image,
          ...transformedUv(uv.values[vertex], texture.textureInfo),
        );
        colours[vertex * 3] = colour[0];
        colours[vertex * 3 + 1] = colour[1];
        colours[vertex * 3 + 2] = colour[2];
      }
      const byteOffset = binLength + ((4 - (binLength % 4)) % 4);
      binLength = appendAligned(binParts, binLength, colours);
      const bufferView =
        json.bufferViews.push({
          buffer: 0,
          byteOffset,
          byteLength: colours.length,
          target: ARRAY_BUFFER,
        }) - 1;
      const accessor =
        json.accessors.push({
          bufferView,
          componentType: 5121,
          normalized: true,
          count: uv.accessor.count,
          type: "VEC3",
          min: [0, 0, 0],
          max: [1, 1, 1],
        }) - 1;
      const attributes = { ...primitive.attributes };
      for (const key of Object.keys(attributes)) {
        if (key.startsWith("TEXCOORD_") || key === "TANGENT") delete attributes[key];
      }
      attributes.COLOR_0 = accessor;
      primitive.attributes = attributes;
      bakedVertexCount += uv.accessor.count;
    }
  }

  const bin = Buffer.concat(binParts);
  if (json.buffers?.[0]) json.buffers[0].byteLength = bin.length;
  stripTextures(json);
  json.asset = {
    ...json.asset,
    extras: {
      ...(json.asset?.extras ?? {}),
      universityGridBake: {
        method: "colormap-rgb-nearest-to-COLOR_0",
        removed: ["UV attributes", "TANGENT", "baseColorTexture", "images", "textures"],
      },
    },
  };

  const compactedBin = compactBuffers(json, bin);

  return {
    bytes: writeGlb(json, compactedBin),
    audit: {
      totalTriangles: audit.totalTriangles,
      exactColourVariationTriangles: audit.exactColourVariationTriangles,
      crossColourTriangles: 0,
      crossColourRatio: 0,
      bakedVertexCount,
      colormap: { width: audit.image.width, height: audit.image.height },
    },
  };
}

/**
 * Re-read the output and compare every COLOR_0 byte against the source UV
 * sample. This is intentionally separate from the writer: an in-memory array
 * comparison would only prove that the writer agrees with itself.
 */
export function assertBakedGlbLossless({ sourceBytes, bakedBytes, colormapBytes, label = "GLB" }) {
  const sourceAudit = auditGlbColormap({ sourceBytes, colormapBytes, label });
  if (sourceAudit.crossColourTriangles.length > 0) {
    fail(
      `${label}: lossless assertion requires a zero-cross-colour source`,
      "CROSS_COLOUR_TRIANGLE",
    );
  }
  const baked = readGlb(bakedBytes, `${label} baked output`);
  const bakedImage = decodePng(colormapBytes, `${label} colormap`);
  let comparedVertices = 0;
  for (const [meshIndex, mesh] of (sourceAudit.json.meshes ?? []).entries()) {
    const bakedMesh = baked.json.meshes?.[meshIndex];
    if (!bakedMesh) fail(`${label}: baked mesh ${meshIndex} is missing`);
    for (const [primitiveIndex, primitive] of (mesh.primitives ?? []).entries()) {
      const bakedPrimitive = bakedMesh.primitives?.[primitiveIndex];
      if (!bakedPrimitive) fail(`${label}: baked primitive ${primitiveIndex} is missing`);
      if (Object.keys(bakedPrimitive.attributes ?? {}).some((key) => key.startsWith("TEXCOORD_"))) {
        fail(`${label}: baked output still contains a UV attribute`, "UV_NOT_REMOVED");
      }
      const colourAccessorIndex = bakedPrimitive.attributes?.COLOR_0;
      if (colourAccessorIndex == null) fail(`${label}: baked output has no COLOR_0`);
      const colours = decodeAccessor(
        baked.json,
        baked.bin,
        colourAccessorIndex,
        `${label} baked COLOR_0`,
      );
      const uvAccessorIndex = primitive.attributes?.TEXCOORD_0;
      if (uvAccessorIndex == null) fail(`${label}: source primitive has no TEXCOORD_0`);
      const uv = decodeAccessor(sourceAudit.json, sourceAudit.bin, uvAccessorIndex, label);
      if (
        colours.accessor.count !== uv.accessor.count ||
        colours.accessor.type !== "VEC3" ||
        colours.accessor.componentType !== 5121 ||
        colours.accessor.normalized !== true
      ) {
        fail(`${label}: baked COLOR_0 does not match the source vertex count`);
      }
      const sourceTexture = materialTextureInfo(sourceAudit.json, primitive, label);
      for (let vertex = 0; vertex < uv.accessor.count; vertex += 1) {
        const expected = sampleColormapNearest(
          bakedImage,
          ...transformedUv(uv.values[vertex], sourceTexture.textureInfo),
        );
        const actual = colours.values[vertex];
        const actualBytes = actual.map((value) => Math.round(value));
        if (!sameColour(expected, actualBytes)) {
          fail(
            `${label}: COLOR_0 vertex ${vertex} differs from its source colormap sample ` +
              `(expected ${expected.join(",")}, got ${actualBytes.join(",")})`,
            "BAKE_MISMATCH",
            { meshIndex, primitiveIndex, vertex, expected, actual: actualBytes },
          );
        }
        comparedVertices += 1;
      }
    }
  }
  const hasUv = (baked.json.meshes ?? []).some((mesh) =>
    (mesh.primitives ?? []).some((primitive) =>
      Object.keys(primitive.attributes ?? {}).some((key) => key.startsWith("TEXCOORD_")),
    ),
  );
  if (
    baked.json.images?.length ||
    baked.json.textures?.length ||
    baked.json.samplers?.length ||
    hasUv
  ) {
    fail(`${label}: baked output still references textures or UVs`, "TEXTURE_OR_UV_REMAINS");
  }
  return { comparedVertices, triangles: sourceAudit.totalTriangles };
}
