import { describe, expect, it } from "vitest";
import { createTranslator } from "./index.js";

describe("3D play-lab learner copy", () => {
  it("interpolates real counts in both languages rather than showing template braces", () => {
    const zh = createTranslator("zh-CN");
    const en = createTranslator("en");
    expect(zh.t("toy.completedLine", { total: 12, first: 11 })).toBe(
      "本轮 12 件都已完成，其中 11 件首次判断正确。",
    );
    expect(en.t("toy.completedLine", { total: 12, first: 11 })).toBe(
      "All 12 items are complete; 11 were right on the first try.",
    );
    expect(zh.t("toy.remaining", { seconds: 24 })).toBe("本件剩余 24 秒");
    expect(en.t("toy.remaining", { seconds: 24 })).toBe("24s for this item");
  });
});
