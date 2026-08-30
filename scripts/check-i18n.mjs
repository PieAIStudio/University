import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

import ts from "../packages/ui/node_modules/typescript/lib/typescript.js";

const CJK = /[\u4e00-\u9fff]/;
const SOURCE_CATALOG = "packages/ui/src/i18n/catalogs/zh-CN.ts";
const ENGLISH_CATALOG = "packages/ui/src/i18n/catalogs/en.ts";

const ROOT = process.cwd();

function sourceFiles() {
  return execFileSync("rg", ["--files", "packages/ui/src", "apps/university/src"], {
    cwd: ROOT,
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter(Boolean)
    .filter(
      (file) =>
        /\.(ts|tsx)$/.test(file) &&
        !/\.test\./.test(file) &&
        !file.includes("/language/") &&
        !file.includes("/i18n/") &&
        !file.endsWith("/markdown/lesson-sections.ts") &&
        !file.endsWith("/review/ExerciseBlock.tsx") &&
        !file.endsWith("/ports/local/grading.ts") &&
        !file.endsWith("/ports/online/grading.ts"),
    );
}

function sourceFileFor(file, source) {
  return ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function lineNumber(sourceFile, node) {
  return ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile)).line + 1;
}

function isTranslateKey(node) {
  const parent = node.parent;
  const callee = ts.isCallExpression(parent) && parent.expression.getText(parent.getSourceFile());
  return (
    ts.isCallExpression(parent) &&
    (callee === "translate" || callee === "t") &&
    parent.arguments[0] === node
  );
}

function isPropertyName(node) {
  const parent = node.parent;
  return (
    (ts.isPropertyAssignment(parent) && parent.name === node) ||
    (ts.isMethodDeclaration(parent) && parent.name === node) ||
    (ts.isPropertyDeclaration(parent) && parent.name === node) ||
    (ts.isEnumMember(parent) && parent.name === node)
  );
}

function staticTemplateText(node) {
  return [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join("");
}

export function scanUnextractedChinese(files = sourceFiles()) {
  const hits = [];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const sourceFile = sourceFileFor(file, source);
    function visit(node) {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        if (CJK.test(node.text) && !isTranslateKey(node) && !isPropertyName(node)) {
          hits.push(`${file}:${lineNumber(sourceFile, node)}: ${JSON.stringify(node.text)}`);
        }
      } else if (ts.isTemplateExpression(node)) {
        if (CJK.test(staticTemplateText(node))) {
          hits.push(
            `${file}:${lineNumber(sourceFile, node)}: template expression contains Chinese UI copy`,
          );
        }
      } else if (ts.isJsxText(node)) {
        const value = node.text.replace(/\s+/g, " ").trim();
        if (CJK.test(value))
          hits.push(`${file}:${lineNumber(sourceFile, node)}: ${JSON.stringify(value)}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(sourceFile);
  }
  return hits;
}

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

function catalogKeys(file) {
  const source = readFileSync(file, "utf8");
  const sourceFile = sourceFileFor(file, source);
  const keys = [];
  function visit(node) {
    if (ts.isPropertyAssignment(node) && node.parent && ts.isObjectLiteralExpression(node.parent)) {
      const name = node.name;
      if (ts.isStringLiteral(name) || ts.isIdentifier(name)) keys.push(name.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return keys;
}

function assertUnique(label, values) {
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
  if (duplicates.length > 0)
    throw new Error(`${label} contains duplicate keys: ${duplicates.join(", ")}`);
}

const sourceKeys = catalogKeys(SOURCE_CATALOG);
const englishKeys = catalogKeys(ENGLISH_CATALOG);
assertUnique(SOURCE_CATALOG, sourceKeys);
assertUnique(ENGLISH_CATALOG, englishKeys);
const rawChinese = scanUnextractedChinese();
const physicalCss = scanPhysicalCss();

if (rawChinese.length > 0 || physicalCss.length > 0) {
  if (rawChinese.length > 0) {
    console.error("Unextracted Chinese implementation copy:");
    rawChinese.forEach((hit) => console.error(`  ${hit}`));
  }
  if (physicalCss.length > 0) {
    console.error("Physical directional CSS declarations outside the protected language feature:");
    physicalCss.forEach((hit) => console.error(`  ${hit}`));
  }
  process.exitCode = 1;
} else {
  console.log(
    JSON.stringify(
      {
        sourceCatalogKeys: sourceKeys.length,
        englishCatalogKeys: englishKeys.length,
        unextractedChinese: rawChinese.length,
        physicalCssDeclarations: physicalCss.length,
      },
      null,
      2,
    ),
  );
}
