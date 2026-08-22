#!/usr/bin/env node
/**
 * Token pairs that cannot be read, across every surface this product ships.
 *
 * The check itself lives in SwimmerUIKit (`swimmer-ui-check`, 1.5.0+) because
 * the token values are the kit's and the trap is the kit's to warn about. This
 * wrapper exists for one reason: to run it over every directory that styles
 * something, in the gate, so the answer stays zero.
 *
 * It was added the day the app's primary button was found at 1.48:1 — light
 * orange on orange, on the one control every learner has to find, shipped past
 * a full suite and a browser pass because nothing about it was wrong except
 * the value behind a token name.
 *
 * Usage: node scripts/check-contrast.mjs
 */
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const require = createRequire(join(ROOT, "packages", "ui", "package.json"));

const TARGETS = [
  "packages/ui/src",
  "apps/online/src",
  "apps/local/src",
];

let kitBin;
try {
  kitBin = join(dirname(require.resolve("@pieai/swimmer-ui-kit/package.json")), "bin", "swimmer-ui-check.mjs");
} catch {
  console.error("check-contrast: @pieai/swimmer-ui-kit is not installed; nothing checked.");
  process.exit(1);
}

let failed = 0;
for (const target of TARGETS) {
  let output = "";
  try {
    output = execFileSync("node", [kitBin, join(ROOT, target)], {
      encoding: "utf8",
      // Capture the child's stderr too. Its raw-colour rule is not adopted
      // here — this repository has hundreds of literals predating the kit —
      // and letting that summary through would bury the finding that matters.
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
  }
  // The raw-colour half of that CLI is not adopted here yet — this repository
  // has hundreds of literals predating the kit — so only the contrast findings
  // are treated as failures.
  const pairs = output.split("\n").filter((line) => line.includes("below AA"));
  for (const line of pairs) console.error(line.replace(`${ROOT}/`, ""));
  failed += pairs.length;
}

if (failed > 0) {
  console.error(
    `\ncheck-contrast: ${failed} unreadable token pair(s).\n` +
      "--game-ui-accent-contrast is the ink for the accent fill; --game-ui-accent-ink\n" +
      "is accent-coloured ink for a surface. They are not interchangeable.",
  );
  process.exit(1);
}
console.log(`check-contrast: ok (${TARGETS.length} trees)`);
