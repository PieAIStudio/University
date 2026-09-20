import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createCatalog, filterCatalog, type PrototypeSources } from "./registry.js";
import { buildPrototypeDocument } from "./prototype-document.js";
import { messages as zh } from "../i18n/catalogs/zh-CN.js";
import { messages as en } from "../i18n/catalogs/en.js";

const sources = Object.fromEntries(
  ["blocks", "arcade", "index", "remade", "compare"].map((id) => [
    id,
    readFileSync(
      new URL(`../../../../docs/reference/interaction-prototype/${id}.html`, import.meta.url),
      "utf8",
    ),
  ]),
) as unknown as PrototypeSources;

describe("one inventory without pretending prototypes are course engines", () => {
  it("derives every research entry from its retained source and keeps the earlier course sample", () => {
    const entries = createCatalog(sources);
    expect(entries).toHaveLength(59);
    expect(entries.filter((entry) => entry.group !== "three")).toHaveLength(50);
    const three = entries.filter((entry) => entry.group === "three");
    expect(three).toHaveLength(9);
    expect(three.filter((e) => e.retained).map((e) => e.id)).toEqual([
      "three:invaders",
      "three:stack",
      "three:cloze-tetris",
    ]);
    for (const entry of three)
      expect(
        entries.some(
          (original) =>
            original.id === entry.inspiredBy && ["arcade", "blocks"].includes(original.group),
        ),
      ).toBe(true);
    expect(new Set(entries.map((entry) => entry.id)).size).toBe(entries.length);
    expect(entries.filter((entry) => entry.group === "native")).toHaveLength(13);
    expect(entries.filter((entry) => entry.group === "paths")).toHaveLength(6);
    expect(entries.filter((entry) => entry.group === "blocks")).toHaveLength(20);
    expect(entries.filter((entry) => entry.group === "arcade")).toHaveLength(8);
    expect(entries.find((entry) => entry.id === "path:follow-a-claim")?.href).toContain(
      "check-what-matters/follow-a-claim",
    );
    for (const entry of entries)
      for (const key of [entry.name, entry.action, entry.controls]) {
        expect(zh[key as keyof typeof zh], key).toBeTruthy();
        expect(en[key as keyof typeof en], key).toBeTruthy();
      }
  });
  it("searches within a group and fails on ambiguous source registration", () => {
    const entries = createCatalog(sources);
    const translate = (key: string) => zh[key as keyof typeof zh] ?? key;
    expect(filterCatalog(entries, "arcade", "值班", translate).map((entry) => entry.id)).toEqual([
      "arcade:shift",
    ]);
    expect(filterCatalog(entries, "native", "值班", translate)).toEqual([]);
    expect(filterCatalog(entries, "three", "花园", translate)).toHaveLength(3);
    expect(filterCatalog(entries, "three", "新场景", translate)).toHaveLength(6);
    expect(filterCatalog(entries, "all", "does-not-exist", translate)).toEqual([]);
    expect(() => createCatalog({ ...sources, arcade: sources.arcade + sources.arcade })).toThrow();
  });
});

describe("research document boundary", () => {
  it("supplies encoding, viewport and a closed network boundary without importing remote styles", () => {
    const result = buildPrototypeDocument(
      '<link rel="stylesheet" href="https://example.invalid/font.css"><main>试验</main>',
      ":root { color: CanvasText; }",
      "shift",
    );
    expect(result).toContain('<!doctype html><html lang="zh-CN" data-single-prototype="true">');
    expect(result).toContain("width=device-width, initial-scale=1");
    expect(result).toContain("connect-src 'none'");
    expect(result).toContain("font-src 'none'");
    expect(result).not.toContain("example.invalid");
    expect(result).toContain('window.__PLAY_CATALOG_ENTRY__="shift"');
    expect(() => buildPrototypeDocument("", "", "<script>")).toThrow("Invalid prototype ID");
  });
});
