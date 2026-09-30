import { assertLearnerSpeech } from "./learner-speech.mjs";
import { mkdtempSync, readFileSync, readdirSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import ts from "../packages/ui/node_modules/typescript/lib/typescript.js";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const requireUI = createRequire(join(root, "packages/ui/package.json"));
const kit = dirname(requireUI.resolve("@pieai/swimmer-i18n-kit/package.json"));
const temporary = mkdtempSync(join(tmpdir(), "university-i18n-"));
try {
  // Existing feature catalogs are TypeScript data modules. Transpile only these
  // modules, then give their assembled ICU JSON to the shared validator/generator.
  const modules = join(temporary, "modules");
  mkdirSync(modules);
  writeFileSync(join(modules, "package.json"), '{"type":"module"}');
  const catalogs = join(root, "packages/ui/src/i18n/catalogs");
  for (const file of readdirSync(catalogs).filter((file) => file.endsWith(".ts"))) {
    const output = ts.transpileModule(readFileSync(join(catalogs, file), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2023 },
    });
    writeFileSync(join(modules, file.replace(/\.ts$/, ".js")), output.outputText);
  }
  mkdirSync(join(temporary, "catalogs"));
  for (const locale of ["zh-CN", "en"]) {
    const { messages } = await import(pathToFileURL(join(modules, `${locale}.js`)).href);
    // Type generation may be run while copy is being edited. Ordinary checks,
    // verify and publication must refuse leaked author speech and old nouns.
    if (!process.argv.includes("--write-types")) assertLearnerSpeech(messages, locale);
    mkdirSync(join(temporary, "catalogs", locale));
    writeFileSync(join(temporary, "catalogs", locale, "messages.json"), JSON.stringify(messages));
  }
  const scan = ["packages/ui/src", "packages/world/src", "apps/university/src"].flatMap(
    (directory) =>
      readdirSync(join(root, directory), { recursive: true })
        .filter(
          (file) =>
            file.endsWith(".tsx") && !file.includes(".test.") && !file.startsWith("language/"),
        )
        .map((file) => join(root, directory, file))
        .filter((file) => {
          // World shaders and authored preview course fixtures are not interface copy.
          if (file.endsWith("/planet/preview-main.tsx")) return false;
          return (
            directory !== "packages/world/src" ||
            /<(?:Html|Text|Game[A-Z]\w*|div|span|button|p|section|nav|aside|label)\b/.test(
              readFileSync(file, "utf8"),
            )
          );
        }),
  );
  const whitelist = [
    // Fixed wordmarks, scientific notation, punctuation and bibliographic titles.
    "label scene-label",
    "U",
    "University",
    "L",
    "FSRS",
    "·",
    "· ·",
    "Earthrise · NASA / Bill Anders",
    "Anthropic · Context engineering",
    "Anthropic · Agent evaluations",
    "Microsoft · Human–AI interaction",
    "IES · Learning & instruction",
    "PhET · Implicit scaffolding",
    "Apple HIG · Game controls",
    "Designing for games",
    // Source metadata and internal invariant diagnostics, never user copy.
    "Missing #root container in index.html",
    "entry-page__float-nav entry-page__float-nav--",
    "recovery-state recovery-state--overlay",
    "title",
    "anti-patterns",
    '<div id="university-mermaid-root"></div>',
    "Unknown world style",
    "one complete Stage frame including shadows and post passes; submissionMs is CPU submission, not GPU time or FPS",
    "Missing prepared object:",
    "Missing prepared geometry:",
    "Mismatched visibility map:",
    "Source not ready:",
  ];
  const config = join(temporary, "config.json");
  writeFileSync(
    config,
    JSON.stringify({ sourceLocale: "zh-CN", catalogsDir: "catalogs", scan, whitelist }),
  );
  for (const args of [
    ["check"],
    ["scan"],
    [
      "types",
      "--out",
      join(root, "packages/ui/src/i18n/contracts.ts"),
      ...(process.argv.includes("--write-types") ? [] : ["--check"]),
    ],
  ]) {
    const result = spawnSync(
      process.execPath,
      [join(kit, "bin/swimmer-i18n-check.mjs"), ...args, "--config", config],
      { stdio: "inherit" },
    );
    if (result.status !== 0) throw new Error(`Shared interface catalog check failed: ${args[0]}`);
  }
  for (const [configFile, contracts] of [
    ["packages/core/swimmer-i18n.config.json", "packages/core/src/i18n/contracts.ts"],
    ["packages/core/swimmer-payment-i18n.config.json", null],
    ["apps/university-ai/swimmer-i18n.config.json", "apps/university-ai/src/i18n-contracts.ts"],
  ]) {
    const commands = [["check"]];
    if (contracts)
      commands.push([
        "types",
        "--out",
        join(root, contracts),
        ...(process.argv.includes("--write-types") ? [] : ["--check"]),
      ]);
    for (const args of commands) {
      const result = spawnSync(
        process.execPath,
        [join(kit, "bin/swimmer-i18n-check.mjs"), ...args, "--config", join(root, configFile)],
        { stdio: "inherit" },
      );
      if (result.status !== 0) throw new Error(`Shared catalog check failed: ${configFile}`);
    }
  }
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
