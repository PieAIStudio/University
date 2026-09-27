import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import "./check-interface-catalogs.mjs";
const ROOT = process.cwd();
const PHYSICAL_DECLARATION =
  /^\s*(?:left|right|padding-left|padding-right|margin-left|margin-right|border-left(?:-(?:color|style|width))?|border-right(?:-(?:color|style|width))?|border-(?:top|bottom)-(?:left|right)-radius)\s*:/;
const PHYSICAL_TEXT_ALIGN = /^\s*text-align\s*:\s*(?:left|right)\s*;/;

export function scanPhysicalCss(
  files = execFileSync("rg", ["--files", "packages/ui/src", "apps/university/src"], {
    cwd: ROOT,
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter((file) => file.endsWith(".css") && !file.includes("/language/")),
) {
  const hits = [];
  for (const file of files) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, index) => {
        if (PHYSICAL_DECLARATION.test(line) || PHYSICAL_TEXT_ALIGN.test(line)) {
          hits.push(`${file}:${index + 1}: ${line.trim()}`);
        }
      });
  }
  return hits;
}

const hits = scanPhysicalCss();
if (hits.length) {
  console.error("Physical directional CSS declarations outside the protected language feature:");
  for (const hit of hits) console.error(hit);
  process.exitCode = 1;
} else console.log("Logical CSS direction check passed.");
