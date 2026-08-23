// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { UniversityShell } from "@pieai/university-ui/navigation/UniversityShell.js";

function Frame({
  lessonOpen,
  children,
}: {
  readonly lessonOpen: boolean;
  readonly children: React.ReactNode;
}) {
  if (lessonOpen) return <div className="campus">{children}</div>;
  // Not the avatar under test here, and `null` says so out loud.
  return (
    <UniversityShell activeId="learn" identity={null}>
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

describe("local shell vs lesson", () => {
  it("leaves zero UniversityShell nav in the DOM while a lesson is open", async () => {
    await act(async () => {
      root.render(
        <Frame lessonOpen>
          <article>课文</article>
        </Frame>,
      );
    });
    expect(document.querySelector("nav")).toBeNull();
    expect(document.querySelector(".app-shell")).toBeNull();
  });

  it("mounts the shared shell on ordinary campus routes", async () => {
    await act(async () => {
      root.render(
        <Frame lessonOpen={false}>
          <p>书架</p>
        </Frame>,
      );
    });
    expect(document.querySelectorAll("nav")).toHaveLength(2);
    expect(document.querySelectorAll(".counter-row")).toHaveLength(1);
  });
});
