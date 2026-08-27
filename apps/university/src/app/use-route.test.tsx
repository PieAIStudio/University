// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useRoute } from "./use-route.js";

function RouteProbe() {
  const { view } = useRoute();
  return <output>{view.kind}</output>;
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  history.replaceState(null, "", "/");
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  history.replaceState(null, "", "/");
});

describe("the shared browser route", () => {
  it("reads a direct lesson path on the first render", async () => {
    history.replaceState(
      null,
      "",
      "/turing-pact/foundations-before-zero/what-is-an-app/you-already-know-apps",
    );

    await act(async () => root.render(<RouteProbe />));

    expect(container.textContent).toBe("lesson");
    expect(location.pathname).toBe(
      "/turing-pact/foundations-before-zero/what-is-an-app/you-already-know-apps",
    );
    expect(location.hash).toBe("");
  });

  it("replaces a saved hash bookmark with the canonical path", async () => {
    history.replaceState(
      null,
      "",
      "/#/turing-pact/foundations-before-zero/what-is-an-app/you-already-know-apps",
    );

    await act(async () => root.render(<RouteProbe />));

    expect(container.textContent).toBe("lesson");
    expect(location.pathname).toBe(
      "/turing-pact/foundations-before-zero/what-is-an-app/you-already-know-apps",
    );
    expect(location.hash).toBe("");
  });
});
