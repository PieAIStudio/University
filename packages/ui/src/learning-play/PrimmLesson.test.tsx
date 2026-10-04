import { withInterfaceLocale } from "../../test-support/interface-locale.js";
// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { primmStepsFixture } from "../../../core/src/learning-play/fixtures/primm-steps.js";
import { PrimmLesson } from "./PrimmLesson.js";
import type { PrimmLessonProps } from "./primm-types.js";

let root: Root;
let container: HTMLDivElement;
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

async function render(extra: Partial<PrimmLessonProps> = {}) {
  await act(async () =>
    root.render(withInterfaceLocale(<PrimmLesson activity={primmStepsFixture} {...extra} />)),
  );
}

describe("the PRIMM lesson entry point", () => {
  it("renders the V3 lesson opening through the shared steps renderer", async () => {
    await render();
    expect(container.querySelector("[data-primm-stage]")).not.toBeNull();
    expect(container.textContent).toContain(primmStepsFixture.intro.situation);
  });

  it("passes the authored stage cue to the host without drawing a second stage", async () => {
    const cues: unknown[] = [];
    await render({ renderStage: (cue: unknown) => (cues.push(cue), null) });
    expect(cues.length).toBeGreaterThan(0);
    expect(container.querySelector("[data-primm-stage]")).not.toBeNull();
  });

  it("keeps the wrapper usable with a lesson-owned content revision", async () => {
    await render({
      contentRevision: 7,
      lessonRef: { studyId: "s", courseId: "c", unitId: "u", lessonId: "l" },
    });
    expect(container.querySelector(".primm-steps")).not.toBeNull();
  });
});
