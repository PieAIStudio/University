import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const ordinary = [
  ["apps/university/src/lesson/Settlement.tsx", 1],
  ["packages/ui/src/favourites/FavouritesEmpty.tsx", 1],
  ["packages/ui/src/lesson/LessonNextStep.tsx", 2],
  ["packages/ui/src/navigation/empty/AccountPanel.tsx", 1],
  ["packages/ui/src/navigation/empty/LeagueEmpty.tsx", 1],
  ["packages/ui/src/navigation/empty/NextStepEmpty.tsx", 1],
  ["packages/ui/src/navigation/empty/QuestsEmpty.tsx", 1],
  ["packages/ui/src/navigation/screens/PlansScreen.tsx", 1],
  ["packages/ui/src/path/CoursePickCard.tsx", 1],
  ["packages/ui/src/path/NodeCard.tsx", 1],
  ["packages/ui/src/path/UnitCard.tsx", 1],
  ["packages/ui/src/practice/PracticeStream.tsx", 2],
  ["packages/ui/src/review/ChoiceBlock.tsx", 1],
  ["packages/ui/src/review/ReviewCard.tsx", 1],
] as const;

describe("approved CTA appearance ownership", () => {
  for (const [path, count] of ordinary) {
    it(`${path} uses ${count} direct primary liquid kit controls`, () => {
      const source = readFileSync(`${root}${path}`, "utf8");
      const ast = ts.createSourceFile(
        path,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      const liquid: ts.JsxAttributes[] = [];
      let wrappers = 0;
      const attr = (attributes: ts.JsxAttributes, name: string) =>
        attributes.properties.find(
          (node) => ts.isJsxAttribute(node) && node.name.getText(ast) === name,
        );
      const stringAttr = (attributes: ts.JsxAttributes, name: string) => {
        const node = attr(attributes, name);
        return node &&
          ts.isJsxAttribute(node) &&
          node.initializer &&
          ts.isStringLiteral(node.initializer)
          ? node.initializer.text
          : undefined;
      };
      const visit = (node: ts.Node) => {
        if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
          if (node.tagName.getText(ast) === "LiquidCtaButton") wrappers++;
          if (
            node.tagName.getText(ast) === "GameButton" &&
            stringAttr(node.attributes, "surface") === "liquid"
          )
            liquid.push(node.attributes);
        }
        ts.forEachChild(node, visit);
      };
      visit(ast);
      expect(source).toMatch(
        /import\s*\{[^}]*\bGameButton\b[^}]*\}\s*from\s*["']@pieai\/swimmer-ui-kit["']/s,
      );
      expect(wrappers, "ordinary CTA must not retain the product destination wrapper").toBe(0);
      expect(liquid, "all migrated call sites must use the kit liquid surface").toHaveLength(count);
      for (const attributes of liquid) {
        expect(stringAttr(attributes, "variant")).toBe("primary");
        expect(stringAttr(attributes, "liquidFinish")).toBe("glossy");
        expect(stringAttr(attributes, "className")).toContain("university-cta");
      }
      if (/PlansScreen|ChoiceBlock|CoursePickCard|NodeCard|UnitCard/.test(path)) {
        for (const attributes of liquid)
          expect(
            attr(attributes, "fullWidth"),
            "existing row-filling layout uses kit fullWidth",
          ).toBeDefined();
      }
    });
  }

  it("keeps one destination call site without a second liquid skin or press controller", () => {
    const reader = readFileSync(`${root}packages/ui/src/lesson/LessonReader.tsx`, "utf8");
    const wrapper = readFileSync(`${root}packages/ui/src/cta/LiquidCtaButton.tsx`, "utf8");
    expect(reader.match(/<LiquidCtaButton\b/g)).toHaveLength(1);
    expect(wrapper).not.toMatch(/\bLiquidGroup\b|\buseState\b|\buseEffect\b/);
    expect(readFileSync(`${root}packages/ui/src/cta/liquid-cta.css`, "utf8")).not.toMatch(
      /\.liquid-cta__button|\.liquid-cta__surface|\.liquid-cta__shape/,
    );
  });
});
