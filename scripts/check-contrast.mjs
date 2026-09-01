#!/usr/bin/env node
/**
 * Token pairs that cannot be read, and token names that do not exist, across
 * every surface this product ships.
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
import { fileURLToPath } from "node:url";

const TARGETS = ["packages/ui/src", "apps/university/src"];
const CONTRAST_FINDING = /below AA|is not a token/;
const NOT_CHECKED = /contrast was NOT checked/i;
const RAW_COLOUR_DIAGNOSTIC =
  /raw color literal|raw colors are expected inside|use var\(--game-ui-\*\)/i;

/** The same WCAG sRGB contrast calculation used by SwimmerUIKit's checker. */
export function relativeLuminance([r, g, b]) {
  const channel = (value) => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Shared by the repository checker and the runtime DOM-label judge. */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function asText(value) {
  if (value == null) return "";
  return Buffer.isBuffer(value) ? value.toString("utf8") : String(value);
}

function outputLines(output) {
  return asText(output)
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");
}

function childOutput(error) {
  return `${asText(error?.stdout)}${asText(error?.stderr)}`;
}

function childFailureDescription(error) {
  if (Number.isInteger(error?.status)) return `exited with status ${error.status}`;
  if (error?.signal) return `was terminated by ${error.signal}`;
  if (error?.code) return `could not start (${error.code})`;
  return "failed without an exit status";
}

function isKnownFindingExit(error, findings) {
  return Number.isInteger(error?.status) && error.status === 1 && findings.length > 0;
}

function displayLine(line, root) {
  return line.replace(`${root}/`, "");
}

function diagnosticsFor(error, lines, findings, unchecked) {
  const diagnostics = lines.filter(
    (line) =>
      !findings.includes(line) && !unchecked.includes(line) && !RAW_COLOUR_DIAGNOSTIC.test(line),
  );

  if (error?.message && diagnostics.length === 0 && !RAW_COLOUR_DIAGNOSTIC.test(error.message)) {
    diagnostics.push(error.message);
  }

  return diagnostics;
}

/**
 * Run the adopted portions of SwimmerUIKit's checker over every styling tree.
 *
 * The child process is injected so this wrapper can be tested without the kit
 * or a network connection. A thrown child error is deliberately retained as a
 * failed check: captured output is evidence, not a replacement for exit status.
 */
export function runContrastCheck({
  root,
  kitBin,
  targets = TARGETS,
  runChild = execFileSync,
  logError = console.error,
}) {
  if (!root || !kitBin) {
    throw new TypeError("runContrastCheck requires root and kitBin");
  }

  const trees = [];
  for (const target of targets) {
    let output = "";
    let childError = null;

    try {
      output = asText(
        runChild("node", [kitBin, join(root, target)], {
          encoding: "utf8",
          // Capture the child's stderr too. Its broad raw-colour rule is not
          // adopted here — this repository has hundreds of literals predating the
          // kit; the scoped R5 ratchet lives in check-raw-colours.mjs — and letting
          // that summary through would bury the finding that matters.
          stdio: ["ignore", "pipe", "pipe"],
        }),
      );
    } catch (error) {
      childError = error;
      output = childOutput(error);
    }

    // Two of that CLI's three rules are adopted here. Its broad raw-colour rule
    // remains separate: the R5 nine-file ratchet is explicit about every fixed
    // material occurrence and every pending migration.
    const lines = outputLines(output);
    const findings = lines.filter((line) => CONTRAST_FINDING.test(line));
    const unchecked = lines.filter((line) => NOT_CHECKED.test(line));
    const rawColourOnly =
      lines.length > 0 && lines.every((line) => RAW_COLOUR_DIAGNOSTIC.test(line));
    const incomplete =
      unchecked.length > 0 || (childError !== null && !isKnownFindingExit(childError, findings));

    for (const line of findings) logError(displayLine(line, root));
    for (const line of unchecked) {
      logError(`  checker: ${displayLine(line, root)}`);
    }

    if (incomplete) {
      const reasons = [];
      if (childError) reasons.push(`the child checker ${childFailureDescription(childError)}`);
      if (unchecked.length > 0) reasons.push("reported that contrast was NOT checked");
      if (childError && rawColourOnly && findings.length === 0 && unchecked.length === 0) {
        reasons.push("reported only the separate raw-colour rule");
      }
      logError(
        `check-contrast: ${target}: contrast check did not complete (${reasons.join("; ")}). ` +
          "The result is not trusted.",
      );

      for (const line of diagnosticsFor(childError, lines, findings, unchecked)) {
        logError(`  checker diagnostic: ${displayLine(line, root)}`);
      }
    }

    trees.push({ target, findings, unchecked, rawColourOnly, childError, incomplete });
  }

  const findings = trees.flatMap((tree) => tree.findings);
  const contrastProblems = findings.filter((line) => line.includes("below AA")).length;
  const undefinedTokens = findings.filter((line) => line.includes("is not a token")).length;

  if (contrastProblems > 0 || undefinedTokens > 0) {
    const categories = [];
    if (contrastProblems > 0) categories.push(`${contrastProblems} contrast problem(s)`);
    if (undefinedTokens > 0) categories.push(`${undefinedTokens} undefined token reference(s)`);
    logError(`\ncheck-contrast: found ${categories.join(" and ")}.`);
    logError(
      "--game-ui-accent-contrast is the ink for the accent fill; --game-ui-accent-ink\n" +
        "is accent-coloured ink for a surface. They are not interchangeable.\n" +
        "A token this kit does not define never fails at runtime — var() falls back —\n" +
        "which is exactly why six borders here were a cold blue-grey in a warm app.",
    );
  }

  return {
    ok: trees.every((tree) => tree.findings.length === 0 && !tree.incomplete),
    trees,
    findings,
    incompleteTrees: trees.filter((tree) => tree.incomplete),
    contrastProblems,
    undefinedTokens,
  };
}

function resolveKitBin(root) {
  const require = createRequire(join(root, "packages", "ui", "package.json"));
  return join(
    dirname(require.resolve("@pieai/swimmer-ui-kit/package.json")),
    "bin",
    "swimmer-ui-check.mjs",
  );
}

function main() {
  const root = resolve(import.meta.dirname, "..");

  let kitBin;
  try {
    kitBin = resolveKitBin(root);
  } catch {
    console.error(
      "check-contrast: @pieai/swimmer-ui-kit is not installed; contrast was not checked.",
    );
    process.exitCode = 1;
    return;
  }

  const result = runContrastCheck({ root, kitBin });
  if (!result.ok) {
    process.exitCode = 1;
    return;
  }
  console.log(`check-contrast: ok (${TARGETS.length} trees)`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
