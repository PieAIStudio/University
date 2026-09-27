import { describe, expect, it } from "vitest";
import { createI18n } from "@pieai/swimmer-i18n-kit";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { interfaceI18n, INTERFACE_LOCALES } from "./core.js";
import { localeNavigationUrl } from "./browser.js";
import { InterfaceProvider, useI18n } from "./react.js";
import { messages as source } from "./catalogs/zh-CN.js";

describe("native University ICU catalogs", () => {
  it("offers only complete product catalogs", () => {
    expect(INTERFACE_LOCALES).toEqual(["zh-CN", "en"]);
    expect(interfaceI18n.completeness("en").complete).toBe(true);
    const independent = createI18n({
      sourceLocale: "zh-CN",
      source,
      catalogs: { ja: { "locale.zhCN.name": "Fake" } },
    });
    expect(independent.completeness("ja").complete).toBe(false);
    expect(independent.resolve("ja")).toBe("zh-CN");
  });
  it("matches language variants and falls back to complete English", () => {
    expect(interfaceI18n.resolve("zh-TW")).toBe("zh-CN");
    expect(interfaceI18n.resolve("en-GB")).toBe("en");
    expect(interfaceI18n.resolve("ja-JP")).toBe("en");
  });
  it("formats ICU arguments directly and accepts existing Chinese keys", () => {
    const zh = interfaceI18n.translator("zh-CN"),
      en = interfaceI18n.translator("en");
    expect(zh.t("path.progress", { current: 2, total: 5 })).toBe("互动 2 / 5");
    expect(en.t("path.progress", { current: 2, total: 5 })).toBe("Practice 2 / 5");
    expect(zh.t("ui.navigation.slots.copy.更多")).toBe("更多");
    expect(en.number(1234)).toBe("1,234");
  });
  it("keeps Node request translators independent of browser selection", async () => {
    const results = await Promise.all(
      ["zh-CN", "en"].map(async (locale) => {
        const translator = interfaceI18n.translator(locale);
        await Promise.resolve();
        return translator.t("path.progress", { current: 1, total: 2 });
      }),
    );
    expect(results).toEqual(["互动 1 / 2", "Practice 1 / 2"]);
  });
  it("renders with the real catalog-bound React Provider", () => {
    function Label() {
      return createElement("span", null, useI18n().t("path.progress", { current: 1, total: 2 }));
    }
    expect(
      renderToStaticMarkup(
        createElement(InterfaceProvider, { locale: "en", children: createElement(Label) }),
      ),
    ).toContain("Practice 1 / 2");
  });
  it("retains route and other query fields when changing language", () => {
    expect(localeNavigationUrl("https://example.test/course?view=lesson#/settings", "en")).toBe(
      "https://example.test/course?view=lesson&lang=en#/settings",
    );
    expect(() => localeNavigationUrl("https://example.test/", "javascript:evil")).toThrow();
  });
});
// This function participates in the real tsc gate without executing invalid calls.
function typeContract() {
  const translator = interfaceI18n.translator("en");
  // @ts-expect-error A product key must exist in the source catalog.
  translator.t("unknown.product.key");
  // @ts-expect-error ICU placeholders are mandatory and inferred from the catalog.
  translator.t("path.progress", { current: 1 });
}
void typeContract;
