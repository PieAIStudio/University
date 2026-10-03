import { describe, expect, it } from "vitest";
import { createCatalog, filterCatalog } from "./registry.js";
import { messages as zh } from "../i18n/catalogs/zh-CN.js";
import { messages as en } from "../i18n/catalogs/en.js";

describe("the play lab's one inventory", () => {
  it("offers the lesson actions, the sample lessons and the island games, each named in both locales", () => {
    const entries = createCatalog();
    expect(entries.filter((entry) => entry.group === "native")).toHaveLength(13);
    expect(entries.filter((entry) => entry.group === "paths").map((entry) => entry.id)).toEqual([
      "path:ask-about-a-picture",
      "path:sound-words-and-meaning",
      "path:name-the-result",
    ]);
    expect(entries.filter((entry) => entry.group === "three").map((entry) => entry.id)).toEqual([
      "three:courtyard",
      "three:links",
      "three:snake",
      "three:moles",
      "three:runner",
      "three:blocks",
    ]);
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
    expect(entries.find((entry) => entry.id === "path:name-the-result")?.href).toContain(
      "first-useful-step/name-the-result",
    );
    for (const entry of entries)
      for (const key of [entry.name, entry.action, entry.controls]) {
        expect(zh[key as keyof typeof zh], key).toBeTruthy();
        expect(en[key as keyof typeof en], key).toBeTruthy();
      }
  });
  it("searches within a group", () => {
    const entries = createCatalog();
    const translate = (key: string) => zh[key as keyof typeof zh] ?? key;
    expect(filterCatalog(entries, "three", "积木版", translate)).toHaveLength(6);
    expect(filterCatalog(entries, "native", "积木版", translate)).toEqual([]);
    expect(filterCatalog(entries, "all", "does-not-exist", translate)).toEqual([]);
  });
});
