// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { UniversityShell } from "@pieai/university-ui/navigation/UniversityShell.js";

import { activeIdForView, isBareView, type View } from "@pieai/university-core";

const LESSON: View = {
  kind: "lesson",
  studyId: "turing-pact",
  courseId: "foundations-before-zero",
  unitId: "what-is-an-app",
  lessonId: "you-already-know-apps",
};

function Frame({ view, children }: { readonly view: View; readonly children: React.ReactNode }) {
  if (isBareView(view)) return <div className="app">{children}</div>;
  // Not the avatar under test here, and `null` says so out loud.
  return (
    <UniversityShell activeId={activeIdForView(view)} identity={null}>
      {children}
    </UniversityShell>
  );
}

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

describe("shell vs bare routes", () => {
  it("does not render UniversityShell navigation while a lesson is open", async () => {
    await act(async () => {
      root.render(
        <Frame view={LESSON}>
          <article>课文</article>
        </Frame>,
      );
    });
    expect(document.querySelector("nav")).toBeNull();
    expect(document.querySelector(".app-shell")).toBeNull();
    expect(document.querySelectorAll(".counter-row")).toHaveLength(0);
  });

  it("renders the shell on the learn route", async () => {
    await act(async () => {
      root.render(
        <Frame view={{ kind: "world" }}>
          <p>地图</p>
        </Frame>,
      );
    });
    expect(document.querySelectorAll("nav")).toHaveLength(2);
    expect(isBareView({ kind: "world" })).toBe(false);
    expect(activeIdForView({ kind: "world" })).toBe("learn");
    expect(activeIdForView({ kind: "me" })).toBe("profile");
    expect(activeIdForView({ kind: "favourites" })).toBe("favourites");
  });
});
