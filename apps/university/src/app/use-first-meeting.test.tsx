// @vitest-environment jsdom
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import type { ShelfStudy } from "@pieai/university-ui/content/port.js";
import type { View } from "@pieai/university-core";
import shelf from "../../content/shelf.json";
import { useFirstMeeting } from "./use-first-meeting.js";
import type { useWelcome } from "./use-welcome.js";

const host = document.createElement("div");
let root = createRoot(host);
let latest: ReturnType<typeof useFirstMeeting>;
const setView = vi.fn();
const focus = vi.fn();
const dismissed = vi.fn();
function Probe({ studies }: { studies: readonly ShelfStudy[] }) {
  const [visible, setVisible] = useState(true);
  const [view, updateView] = useState<View>({ kind: "world" });
  latest = useFirstMeeting({
    guideUser: "guest",
    view,
    studies,
    welcome: {
      visible,
      dismiss: (destination: string) => {
        dismissed(destination);
        setVisible(false);
      },
    } as ReturnType<typeof useWelcome>,
    sceneAttempt: 0,
    setNavigationFocus: focus,
    setView: (next) => {
      setView(next);
      updateView(next);
    },
    setPathOverlay: vi.fn(),
    openAccount: vi.fn(),
  });
  return null;
}
afterEach(async () => {
  await act(async () => root.unmount());
  root = createRoot(host);
  vi.clearAllMocks();
});
it("takes the only real path once without rendering a one-option invitation or recording progress", async () => {
  await act(async () => root.render(<Probe studies={shelf.studies as readonly ShelfStudy[]} />));
  expect(latest.invitation).toBeNull();
  expect(setView).toHaveBeenCalledTimes(1);
  expect(setView).toHaveBeenCalledWith({
    kind: "course",
    studyId: "ai-literacy",
    courseId: "understanding-ai",
  });
  expect(dismissed).toHaveBeenCalledWith("lesson");
  expect(focus).toHaveBeenCalledWith("ai-literacy");
  expect(latest.firstStone?.lessonId).toBe("ask-about-a-picture");
});
it("restores selection when a second real path is present", async () => {
  const first = shelf.studies[0]! as ShelfStudy;
  await act(async () =>
    root.render(
      <Probe studies={[first, { ...first, id: "second-fixture", title: "Second real path" }]} />,
    ),
  );
  expect(latest.invitation?.choices).toHaveLength(2);
  expect(setView).not.toHaveBeenCalled();
});
it("waits for the catalogue instead of choosing an empty or invented path", async () => {
  await act(async () => root.render(<Probe studies={[]} />));
  expect(latest.invitation).toBeNull();
  expect(setView).not.toHaveBeenCalled();
  expect(dismissed).not.toHaveBeenCalled();
});
