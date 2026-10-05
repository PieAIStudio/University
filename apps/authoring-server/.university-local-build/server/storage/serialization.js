import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
/**
 * Produce the canonical JSON bytes used for content identity and comparison.
 * A value without a JSON representation is an error: these bytes participate
 * in hashes, so inventing an identity for such a value would defeat hash-based
 * deduplication.
 */
export function canonicalJson(value) {
    if (Array.isArray(value)) {
        return `[${value.map((child) => (child === undefined ? "null" : canonicalJson(child))).join(",")}]`;
    }
    if (value !== null && typeof value === "object") {
        return `{${Object.entries(value)
            .filter(([, child]) => child !== undefined)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
            .join(",")}}`;
    }
    const serialized = JSON.stringify(value);
    if (serialized === undefined) {
        throw new TypeError("canonicalJson cannot represent value as JSON");
    }
    return serialized;
}
export function readJson(path) {
    return JSON.parse(readFileSync(path, "utf8"));
}
export function sha256(value) {
    return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
//# sourceMappingURL=serialization.js.map