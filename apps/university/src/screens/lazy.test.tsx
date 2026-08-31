// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { RouteFallback } from "./lazy";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("RouteFallback", () => {
  it("does not park a catalogue card on a DOM route", async () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "lazy.tsx"), "utf8");
    expect(src).not.toMatch(/<LoadingTrivia/);
    expect(src).not.toMatch(/from "@pieai\/university-ui\/loading\/LoadingTrivia/);

    await act(async () => {
      root.render(<RouteFallback />);
    });
    expect(container.textContent).toContain("正在打开");
    expect(container.textContent).not.toContain("地图铺开时，看一条概念");
    expect(container.textContent).not.toContain("点一座岛，开始学");
    expect(container.querySelector(".loading-trivia")).toBeNull();
  });

  it("can say the destination's first true sentence while a settlement chunk loads", async () => {
    await act(async () => {
      root.render(<RouteFallback copy="读完了。" />);
    });
    expect(container.textContent).toContain("读完了。");
    expect(container.querySelector(".loading-trivia")).toBeNull();
  });
});
