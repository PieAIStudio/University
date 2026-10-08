#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const world = resolve(root, "packages/world");
const output = resolve(root, "tools/swiminai-islands/render-dist");
const external = [
  "three",
  "react",
  "react/*",
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
  "react-dom",
  "react-dom/*",
  "react-dom/client",
  "react-dom/test-utils",
  "@react-three/fiber",
  "@react-three/drei",
  "@pieai/swimmer-render-kit",
];

execFileSync("pnpm", ["exec", "vite", "build", "--config", "vite.swiminai-island.config.ts"], {
  cwd: world,
  stdio: "inherit",
});

execFileSync(
  process.execPath,
  [
    "--experimental-strip-types",
    "--experimental-loader",
    join(root, "tools/swiminai-islands/ts-loader.mjs"),
    join(root, "tools/swiminai-islands/write-render-blueprints.mjs"),
  ],
  { cwd: root, stdio: "inherit" },
);

const declarationSource = join(root, "tools/swiminai-islands/render-entry.d.ts");
const declarationOutput = join(output, "swiminai-island-render.d.ts");
await copyFile(declarationSource, declarationOutput);
console.log(`Copied ${declarationOutput}`);

const backgroundResources = ["aerial-world-plate-2k.webp", "aerial-world-plate-4k.webp"];
const backgroundOutput = join(output, "sky-assets");
await mkdir(backgroundOutput, { recursive: true });
for (const asset of backgroundResources) {
  await copyFile(
    join(root, "packages/world/src/assets/generated", asset),
    join(backgroundOutput, asset),
  );
}

async function filesUnder(directory, prefix = "") {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = join(prefix, entry.name);
    if (entry.isDirectory())
      files.push(...(await filesUnder(join(directory, entry.name), relative)));
    else if (entry.isFile()) files.push(relative);
  }
  return files;
}

const files = await filesUnder(output);
const assets = [];
for (const file of files.sort()) {
  const bytes = await readFile(join(output, file));
  assets.push({
    path: file,
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}
const manifest = {
  schemaVersion: 1,
  package: "@pieai/university-world",
  entry: "swiminai-island-render.js",
  source: "packages/world/src/island/swiminai-island-render.tsx",
  external,
  alignment: {
    three: "0.185.1",
    react: "19.2.8",
    reactDom: "19.2.8",
    fiber: "9.6.1",
    drei: "10.7.8",
    swimmerRenderKit: "0.5.0",
  },
  api: "SwimInAIIslandRender({ blueprint, detail, targetRadius?, display?, showDressing?, showGrass? })",
  blueprintArtifact: "render-blueprints.json",
  declaration: "swiminai-island-render.d.ts",
  referenceFixture: {
    html: "tools/swiminai-islands/reference.html",
    source: "tools/swiminai-islands/main.tsx",
    defaultDetail: "world",
    courseQuery: "?detail=course",
    camera: { position: [10, 9, 16], target: [0, 0, 0], fov: 34 },
    viewport: { width: 1440, height: 900, dpr: 1 },
  },
  assets,
};
await writeFile(join(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${assets.length} renderer assets to ${output}`);
for (const asset of assets) console.log(`${asset.path} sha256=${asset.sha256}`);
