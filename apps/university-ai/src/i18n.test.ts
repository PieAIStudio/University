import { describe, expect, it } from "vitest";
import { serviceI18n, serviceLocaleContext, serviceTranslator } from "./i18n.js";

describe("request-scoped native i18n", () => {
  it("only resolves complete service catalogs independently from the browser", () => {
    expect(serviceI18n.completeness("zh-CN").complete).toBe(true);
    expect(serviceI18n.completeness("en").complete).toBe(false);
    expect(serviceI18n.resolve("en-US")).toBe("zh-CN");
  });
  it("isolates interleaved Node requests and releases context afterward", async () => {
    const first = serviceI18n.translator("zh-CN");
    const second = serviceI18n.translator("zh-CN");
    expect(first).not.toBe(second);
    await Promise.all(
      [first, second].map((translator) =>
        serviceLocaleContext.run(translator, async () => {
          await new Promise((resolve) => setTimeout(resolve, 1));
          expect(serviceTranslator()).toBe(translator);
        }),
      ),
    );
    expect(serviceLocaleContext.getStore()).toBeUndefined();
  });
});
