import { inflateSync } from "node:zlib";

export type Rgba = readonly [number, number, number, number];

/**
 * Decode an 8-bit RGB/RGBA PNG into a packed buffer.
 *
 * Playwright screenshots are PNG. The grey-brick HUD bug is a compositor
 * sample, so CSS computed style will lie and only the pixels tell the truth.
 */
export function decodePng(bytes: Uint8Array): {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
} {
  if (bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50) {
    throw new Error("not a PNG");
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat: Uint8Array[] = [];

  while (offset + 12 <= bytes.length) {
    const length = readU32(bytes, offset);
    const type = String.fromCharCode(
      bytes[offset + 4]!,
      bytes[offset + 5]!,
      bytes[offset + 6]!,
      bytes[offset + 7]!,
    );
    const start = offset + 8;
    const end = start + length;
    if (end + 4 > bytes.length) break;
    const chunk = bytes.subarray(start, end);
    if (type === "IHDR") {
      width = readU32(chunk, 0);
      height = readU32(chunk, 4);
      bitDepth = chunk[8]!;
      colorType = chunk[9]!;
    } else if (type === "IDAT") {
      idat.push(chunk);
    } else if (type === "IEND") {
      break;
    }
    offset = end + 4;
  }

  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`unsupported PNG (depth ${bitDepth}, type ${colorType})`);
  }

  const compressed = concat(idat);
  const inflated = inflateSync(compressed);
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const rgba = new Uint8Array(width * height * 4);
  let src = 0;
  let prev = new Uint8Array(stride);

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[src]!;
    src += 1;
    const row = inflated.subarray(src, src + stride);
    src += stride;
    const recon = new Uint8Array(stride);
    for (let i = 0; i < stride; i += 1) {
      const raw = row[i]!;
      const a = i >= channels ? recon[i - channels]! : 0;
      const b = prev[i]!;
      const c = i >= channels ? prev[i - channels]! : 0;
      recon[i] = (raw + paethPredictor(filter, a, b, c)) & 0xff;
    }
    for (let x = 0; x < width; x += 1) {
      const i = x * channels;
      const o = (y * width + x) * 4;
      rgba[o] = recon[i]!;
      rgba[o + 1] = recon[i + 1]!;
      rgba[o + 2] = recon[i + 2]!;
      rgba[o + 3] = channels === 4 ? recon[i + 3]! : 255;
    }
    prev = recon;
  }

  return { width, height, data: rgba };
}

function pixelAt(
  image: { readonly width: number; readonly height: number; readonly data: Uint8Array },
  x: number,
  y: number,
): Rgba {
  const px = Math.min(image.width - 1, Math.max(0, Math.round(x)));
  const py = Math.min(image.height - 1, Math.max(0, Math.round(y)));
  const i = (py * image.width + px) * 4;
  return [image.data[i]!, image.data[i + 1]!, image.data[i + 2]!, image.data[i + 3]!];
}

export function averagePixels(
  image: { readonly width: number; readonly height: number; readonly data: Uint8Array },
  points: readonly { readonly x: number; readonly y: number }[],
): Rgba {
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  for (const point of points) {
    const px = pixelAt(image, point.x, point.y);
    r += px[0];
    g += px[1];
    b += px[2];
    a += px[3];
  }
  const n = Math.max(1, points.length);
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n), Math.round(a / n)];
}

export function colorDistance(left: Rgba, right: Rgba): number {
  const dr = left[0] - right[0];
  const dg = left[1] - right[1];
  const db = left[2] - right[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function paethPredictor(filter: number, a: number, b: number, c: number): number {
  if (filter === 0) return 0;
  if (filter === 1) return a;
  if (filter === 2) return b;
  if (filter === 3) return (a + b) >> 1;
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset]! << 24) | (bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) | bytes[offset + 3]!) >>>
    0
  );
}

function concat(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
