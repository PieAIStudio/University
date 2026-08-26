#!/usr/bin/env node
/** Validate a sealed delivery artifact without rebuilding it. */
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import {
  PROJECT_ROOT,
  validateDeliveryArtifact,
  validateReleaseVersion,
} from "./delivery-artifact.mjs";

const VALUE_FLAGS = new Set(["artifact", "version", "recovery-root", "lexicon"]);

function parseArgs(argv) {
  const args = {};
  const options = argv[0] === "--" ? argv.slice(1) : argv;
  for (let index = 0; index < options.length; index += 1) {
    const flag = options[index];
    if (flag === "--help" || flag === "-h") {
      console.log(
        "Usage: pnpm delivery:check -- --artifact <path> " +
          "[--version <version>] [--recovery-root <path>] [--lexicon <path>]",
      );
      process.exit(0);
    }
    if (!flag.startsWith("--") || !VALUE_FLAGS.has(flag.slice(2))) {
      throw new Error(`unknown option ${flag}`);
    }
    const name = flag.slice(2);
    const value = options[index + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`${flag} needs a value`);
    args[name] = value;
    index += 1;
  }
  if (args.artifact === undefined) throw new Error("missing --artifact");
  return args;
}

try {
  const args = parseArgs(process.argv.slice(2));
  const artifact = resolve(PROJECT_ROOT, args.artifact);
  if (!existsSync(artifact)) throw new Error(`artifact is missing: ${artifact}`);
  const result = validateDeliveryArtifact(artifact, {
    version: args.version === undefined ? undefined : validateReleaseVersion(args.version),
    recoveryRoot:
      args["recovery-root"] === undefined
        ? undefined
        : resolve(PROJECT_ROOT, args["recovery-root"]),
    lexiconPath: args.lexicon === undefined ? undefined : resolve(PROJECT_ROOT, args.lexicon),
  });
  console.log(
    `delivery check: ${result.version} ok; ${result.studies} studies, ` +
      `${result.courses} courses, ${result.lessons} lessons, ${result.payloadBytes} payload bytes.`,
  );
} catch (error) {
  console.error(`delivery check: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
