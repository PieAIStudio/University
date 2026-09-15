// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useRoute } from "./use-route.js";

function RouteProbe() {
  const { view, setView } = useRoute();
  return (
    <>
      <output>{view.kind}</output>
      <button onClick={() => setView({ kind: "world" })}>Navigate</button>
    </>
  );
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

    expect(container.querySelector("output")?.textContent).toBe("lesson");
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

    expect(container.querySelector("output")?.textContent).toBe("lesson");
    expect(location.pathname).toBe(
      "/turing-pact/foundations-before-zero/what-is-an-app/you-already-know-apps",
    );
    expect(location.hash).toBe("");
  });

  it.each([
    "#access_token=test-only&refresh_token=test-only&type=magiclink",
    "#error=access_denied&error_code=otp_expired",
    "#reading-notes",
  ])("does not consume a fragment owned by auth or the document: %s", async (fragment) => {
    history.replaceState(null, "", `/me${fragment}`);
    await act(async () => root.render(<RouteProbe />));
    expect(container.querySelector("output")?.textContent).toBe("me");
    expect(location.pathname).toBe("/me");
    expect(location.hash).toBe(fragment);
  });

  it("leaves auth callback values to the SDK even during a learning navigation", async () => {
    const fragment = "#access_token=test-only&type=magiclink";
    history.replaceState(null, "", `/me${fragment}`);
    await act(async () => root.render(<RouteProbe />));
    await act(async () => container.querySelector("button")!.click());
    expect(location.pathname).toBe("/");
    expect(location.hash).toBe(fragment);
  });
});
