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
    expect(zh.t("play.usability.connect.next", { count: 2 })).toBe(
      "已经连了 2 条。继续接，或发一次信号看看。",
    );
    expect(en.t("play.usability.connect.next", { count: 2 })).toBe(
      "2 connections so far. Add another or send a signal to try them.",
    );
    expect(zh.t("ui.navigation.slots.copy.更多")).toBe("更多");
    expect(en.number(1234)).toBe("1,234");
  });
  it("keeps Node request translators independent of browser selection", async () => {
    const results = await Promise.all(
      ["zh-CN", "en"].map(async (locale) => {
        const translator = interfaceI18n.translator(locale);
        await Promise.resolve();
        return translator.t("play.usability.connect.next", { count: 1 });
      }),
    );
    expect(results).toEqual([
      "已经连了 1 条。继续接，或发一次信号看看。",
      "1 connections so far. Add another or send a signal to try them.",
    ]);
  });
  it("renders with the real catalog-bound React Provider", () => {
    function Label() {
      return createElement("span", null, useI18n().t("play.usability.connect.next", { count: 1 }));
    }
    expect(
      renderToStaticMarkup(
        createElement(InterfaceProvider, { locale: "en", children: createElement(Label) }),
      ),
    ).toContain("1 connections so far");
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
  translator.t("play.usability.connect.next", {});
}
void typeContract;
