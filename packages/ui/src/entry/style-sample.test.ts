import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { STYLE_SKIN_IDS } from "@pieai/university-core";

const STYLE_SAMPLE_CSS = readFileSync(new URL("./style-sample.css", import.meta.url), "utf8");

function escaped(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
});
