import { describe, expect, it } from "vitest";

import {
  availableLocales,
  createTranslator,
  localeCompleteness,
  LOCALE_REGISTRY,
  SOURCE_LOCALE,
} from "./index.js";
import { messages as sourceMessages } from "./catalogs/zh-CN.js";

describe("message catalogs", () => {
  it("lists only complete locales", () => {
    expect(availableLocales()).toEqual([SOURCE_LOCALE]);
    expect(localeCompleteness(sourceMessages).complete).toBe(true);
  });

  it("keeps an intentionally incomplete fake locale out of the choices", () => {
    const fakeLocale = {
      ...LOCALE_REGISTRY,
      fake: {
        direction: "ltr" as const,
        displayNameKey: "locale.zhCN.name" as const,
        messages: { "locale.zhCN.name": "Fake" },
      },
    };
    expect(availableLocales(fakeLocale)).not.toContain("fake");
    expect(localeCompleteness(fakeLocale.fake.messages).missingKeys.length).toBeGreaterThan(0);
  });

  it("uses Intl helpers and never returns an empty string for a missing target key", () => {
    const translator = createTranslator("en");
    expect(translator.locale).toBe(SOURCE_LOCALE);
    expect(translator.t("locale.zhCN.name")).toBe("中文");
    expect(translator.number(1234)).toBe("1,234");
    expect(translator.plural(2, { one: "locale.zhCN.name", other: "locale.en.name" })).toBe(
      "English",
    );
  });
});
