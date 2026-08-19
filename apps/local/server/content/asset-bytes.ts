/**
 * Whether a file's leading bytes are what its declared MIME type claims.
 *
 * This lived only on the serving path, which meant the writer and the reader
 * disagreed about what `"mime": "image/png"` had to be true of. Ingest checked
 * size and SHA-256 — both computed *from the file being stored*, so a JPEG
 * saved under a `.png` name satisfied them perfectly — while the HTTP handler
 * checked the magic bytes and returned 422. A screenshot could therefore pass
 * every gate on the way in and be unservable forever after, and the only person
 * who could notice was a learner looking at a broken image.
 *
 * One function, called on both sides, is the fix: a declaration that survives
 * ingest is now a declaration the reader will honour.
 */
export function matchesAssetMime(bytes: Buffer, mime: string): boolean {
  if (mime === "image/png")
    return bytes
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mime === "image/jpeg") return bytes.subarray(0, 2).equals(Buffer.from([0xff, 0xd8]));
  if (mime === "image/webp")
    return (
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP"
    );
  if (mime === "image/svg+xml")
    return /^\s*(?:<\?xml[^>]*>\s*)?<svg(?:\s|>)/i.test(bytes.toString("utf8", 0, 2048));
  if (mime === "video/mp4") return bytes.subarray(4, 8).toString("ascii") === "ftyp";
  if (mime === "video/webm")
    return bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  return false;
}

/**
 * What the bytes actually are, for an error message that names the fix.
 *
 * "MIME does not match its bytes" tells an author something is wrong; "declared
 * image/png but the bytes are image/jpeg" tells them which of the two to change.
 */
export function sniffAssetMime(bytes: Buffer): string {
  for (const mime of [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/svg+xml",
    "video/mp4",
    "video/webm",
  ]) {
    if (matchesAssetMime(bytes, mime)) return mime;
  }
  return "unrecognised bytes";
}
