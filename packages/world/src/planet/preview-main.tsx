/**
 * Host page for Playwright shots. Not wired into either shell — the parent
 * agent owns that. Counts and course titles here are fixture data in the
 * same shape the real library would pass in, not slogans.
 */
import { useState } from "react";
import { createRoot } from "react-dom/client";

import "@pieai/swimmer-ui-kit/styles.css";
import { PlanetPage, type PlanetStudy } from "./PlanetPage.js";

const STUDIES: readonly PlanetStudy[] = [
  {
    id: "turing-pact",
    title: "TuringPact",
    courseCount: 31,
    lessonCount: 41,
    lessonsDone: 1,
    courseTitles: ["开场", "地图", "镜头", "灯光", "材质", "后期"],
  },
  {
    id: "buzz",
    title: "Buzz",
    courseCount: 5,
    lessonCount: 12,
    lessonsDone: 0,
    courseTitles: ["入门", "场景", "音效"],
  },
  {
    id: "supaluv",
    title: "SupaLuv",
    courseCount: 7,
    lessonCount: 20,
    lessonsDone: 0,
    courseTitles: ["账号", "表", "权限"],
  },
  {
    id: "university-local",
    title: "UniversityLocal",
    courseCount: 9,
    lessonCount: 30,
    lessonsDone: 4,
    courseTitles: ["仓库", "课", "证据", "复习"],
  },
];

function Preview() {
  const [selectedId, setSelectedId] = useState<string | null>("turing-pact");
  const [closed, setClosed] = useState(false);
  if (closed) {
    return (
      <p data-planet-closed="true" style={{ padding: 24 }}>
        已关闭
      </p>
    );
  }
  return (
    <PlanetPage
      studies={STUDIES}
      selectedId={selectedId}
      onSelect={setSelectedId}
      onEnter={() => undefined}
      onClose={() => setClosed(true)}
    />
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");
createRoot(root).render(<Preview />);
