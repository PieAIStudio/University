#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildRenderBlueprints } from "./blueprints.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const output = resolve(root, "tools/swiminai-islands/render-dist/render-blueprints.json");
const blueprints = buildRenderBlueprints();
const contents = `${JSON.stringify(blueprints, null, 2)}\n`;
await mkdir(dirname(output), { recursive: true });
await writeFile(output, contents, "utf8");
const bytes = await readFile(output);
const sha256 = createHash("sha256").update(bytes).digest("hex");
console.log(`Wrote ${output} (${bytes.byteLength} bytes, sha256=${sha256})`);
