import { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  answerUsed,
  chooseMarkStyle,
  courseKeepsakes,
  placeItem,
  type HouseState,
  type KeepsakeCourse,
} from "@pieai/university-core";
import { HouseRoom, type HouseKeepsake } from "@pieai/university-ui";
import { InterfaceLanguageProvider } from "@pieai/university-ui/i18n.js";
import { AvatarChip, guestAvatarRecipe } from "@pieai/university-world/avatar.js";
import "@pieai/swimmer-ui-kit/styles.css";

// Synthetic house for browser acceptance: fixed keepsakes and answers, state in
// memory only. Absent from the production entry graph; no network or account writes.
const course: KeepsakeCourse = {
  studyId: "ai-literacy",
  id: "understanding-ai",
  units: [
    {
      id: "first-useful-step",
      title: "先让它帮上一点忙",
      lessons: ["l1", "l2", "l3", "l4", "l5", "l6"].map((id) => ({ id })),
    },
    { id: "read-the-answer", title: "看懂回答", lessons: ["r1", "r2", "r3"].map((id) => ({ id })) },
  ],
};
const params = new URLSearchParams(location.search);
const held: HouseKeepsake[] = params.has("empty")
  ? []
  : courseKeepsakes(course).map((keepsake) => ({
      keepsake,
      unitTitle: course.units.find((unit) => unit.id === keepsake.unitId)!.title,
      courseTitle: "认识 AI，从这里开始",
    }));
let start: HouseState | undefined = answerUsed(
  undefined,
  "a",
  "used",
  "2026-10-03",
  "2026-10-03T08:00:00Z",
);
start = answerUsed(start, "b", "used", "2026-10-08", "2026-10-08T08:00:00Z");
start = answerUsed(start, "c", "not-yet", "2026-10-09", "2026-10-09T08:00:00Z");

function Fixture() {
  const [house, setHouse] = useState<HouseState | undefined>(start);
  const [opened, setOpened] = useState<string>("");
  const now = () => new Date().toISOString();
  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: 16 }} data-fixture-opened={opened}>
      <HouseRoom
        keepsakes={held}
        house={house}
        today="2026-10-15"
        highlight={params.get("highlight")}
        avatar={<AvatarChip recipe={guestAvatarRecipe()} signedIn={false} size={120} />}
        onPlace={(id, x, y) => setHouse((h) => placeItem(h, id, x, y, now()))}
        onMarkStyle={(style) => setHouse((h) => chooseMarkStyle(h, style, now()))}
        onOpenWardrobe={(focus) => setOpened(`wardrobe:${focus}`)}
        onOpenSegment={(k) => setOpened(`segment:${k.id}`)}
      />
      <output data-fixture-house>{JSON.stringify(house?.placements ?? {})}</output>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <InterfaceLanguageProvider locale="zh-CN">
    <Fixture />
  </InterfaceLanguageProvider>,
);
