import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot = resolve(import.meta.dirname, "..");
const compiledCli = resolve(projectRoot, ".university-local-build/server/cli.js");

if (!existsSync(compiledCli)) {
  console.error(
    "UniversityLocal CLI has not been compiled. Run `pnpm build` first, then retry the command.",
  );
  process.exitCode = 2;
} else {
  const { main } = await import(pathToFileURL(compiledCli).href);
  const forwarded = process.argv.slice(2);
  process.exitCode = await main(forwarded[0] === "--" ? forwarded.slice(1) : forwarded, {
    projectRoot,
  });
}
