import { describe, expect, it } from "vitest";

import {
  availableLocales,
  createTranslator,
  localeCompleteness,
  LOCALE_REGISTRY,
  ENGLISH_LOCALE,
  localeNavigationUrl,
  resolveLocale,
  SOURCE_LOCALE,
} from "./index.js";
import { messages as sourceMessages } from "./catalogs/zh-CN.js";

describe("message catalogs", () => {
  it("lists only complete locales", () => {
    expect(availableLocales()).toEqual([ENGLISH_LOCALE, SOURCE_LOCALE]);
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

  it("uses the complete English catalog and Intl helpers", () => {
    const translator = createTranslator("en");
    expect(translator.locale).toBe(ENGLISH_LOCALE);
    expect(translator.t("locale.zhCN.name")).toBeTruthy();
    expect(translator.number(1234)).toBe("1,234");
    expect(translator.plural(2, { one: "locale.zhCN.name", other: "locale.en.name" })).toBe(
      "English",
    );
  });

  it("matches Chinese/English variants and uses English for unsupported languages", () => {
    expect(resolveLocale("zh-TW")).toBe(SOURCE_LOCALE);
    expect(resolveLocale("en-GB")).toBe(ENGLISH_LOCALE);
    expect(resolveLocale("ja-JP")).toBe(ENGLISH_LOCALE);
  });

  it("changes only the language query while retaining the learner route", () => {
    expect(localeNavigationUrl("https://example.test/course?view=lesson#/settings", "en")).toBe(
      "https://example.test/course?view=lesson&lang=en#/settings",
    );
    expect(() => localeNavigationUrl("https://example.test/", "javascript:evil")).toThrow();
  });
});

describe("shared i18n compatibility", () => {
  it("preserves every existing Chinese message and omitted placeholder", () => {
    const translator = createTranslator("zh-Hans");
    for (const [key, original] of Object.entries(sourceMessages)) {
      expect(translator.t(key as keyof typeof sourceMessages), key).toBe(original);
    }
  });

  it("keeps missing values literal and formats legacy numbers through Intl", () => {
    const key = Object.keys(sourceMessages).find((key) =>
      /\{\{\s*[A-Za-z0-9_]+\s*\}\}/.test(sourceMessages[key as keyof typeof sourceMessages]),
    ) as keyof typeof sourceMessages;
    const message = sourceMessages[key];
    const values = Object.fromEntries(
      [...message.matchAll(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g)].map((match) => [match[1]!, 1234]),
    );
    expect(createTranslator("zh-CN").t(key, values)).toBe(
      message.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, "1,234"),
    );
  });
});
