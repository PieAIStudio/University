import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STYLE_SKIN_IDS } from "@pieai/university-core";

const STYLE_SAMPLE_CSS = readFileSync(new URL("./style-sample.css", import.meta.url), "utf8");

type StyleRuleBlock = {
  declarations: string;
  selector: string;
};

function escaped(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function styleRuleBlocks(): StyleRuleBlock[] {
  const cssWithoutComments = STYLE_SAMPLE_CSS.replace(/\/\*[\s\S]*?\*\//g, "");

  return [...cssWithoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selector: match[1].trim(),
    declarations: match[2],
  }));
}

function targetsSkinFrame(selector: string, skinId: string): boolean {
  const skinSelector = `.stylesample--${skinId}`;

  return selector.split(",").some((candidate) => {
    const normalized = candidate.trim();

    // StyleSample puts these two classes on the same element, so a skin root
    // rule also styles the frame even when `.stylesample__frame` is not typed
    // into the selector.
    return (
      normalized === skinSelector ||
      (normalized.includes(skinSelector) && normalized.includes(".stylesample__frame"))
    );
  });
}

describe("style sample skins", () => {
  it("gives every registered skin a closed background and text colour", () => {
    for (const skinId of STYLE_SKIN_IDS) {
      const selector = escaped(`.stylesample--${skinId}`);
      const rule = STYLE_SAMPLE_CSS.match(new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\}`));
      expect(rule, `missing root rule for ${skinId}`).not.toBeNull();

      const declarations = rule?.[1] ?? "";
      expect(declarations).toMatch(/(^|[;\n])\s*background-color\s*:/);
      expect(declarations).toMatch(/(^|[;\n])\s*color\s*:/);
    }
  });

  it("keeps every skin frame's border radius rectangular and bounded", () => {
    for (const skinId of STYLE_SKIN_IDS) {
      const frameRules = styleRuleBlocks().filter((rule) =>
        targetsSkinFrame(rule.selector, skinId),
      );

      for (const rule of frameRules) {
        for (const match of rule.declarations.matchAll(/border-radius\s*:\s*([^;]+)/g)) {
          const value = match[1];
          expect(value, `${skinId} frame radius cannot use percentages`).not.toMatch(/%/);

          for (const pxMatch of value.matchAll(/(-?(?:\d+(?:\.\d*)?|\.\d+))px/g)) {
            expect(
              Number(pxMatch[1]),
              `${skinId} frame radius has to stay at or below 32px`,
            ).toBeLessThanOrEqual(32);
          }
        }
      }
    }
  });
});
