/**
 * Host page for Playwright shots. Not wired into either shell — the parent
 * agent owns that. Counts and course titles here are fixture data in the
 * same shape the real library would pass in, not slogans.
 */
import { useState } from "react";
import { createRoot } from "react-dom/client";

import "@pieai/swimmer-ui-kit/styles.css";
import { PlanetPage, type PlanetStudy } from "./PlanetPage.js";

function fixtureCourses(
  studyId: string,
  count: number,
  lessonCount: number,
  titles: readonly string[],
) {
  const base = Math.floor(lessonCount / count);
  const remainder = lessonCount % count;
  return Array.from({ length: count }, (_, index) => ({
    id: `${studyId}-course-${index + 1}`,
    title: titles[index] ?? `${studyId} · ${index + 1}`,
    lessonCount: base + (index < remainder ? 1 : 0),
    depth: index,
  }));
}

function fixtureStudy(
  id: string,
  title: string,
  courseCount: number,
  lessonCount: number,
  lessonsDone: number,
  titles: readonly string[],
): PlanetStudy {
  const courses = fixtureCourses(id, courseCount, lessonCount, titles);
  return {
    id,
    title,
    courseCount,
    lessonCount,
    lessonsDone,
    courses,
    courseTitles: courses.map((course) => course.title),
  };
}

const STUDIES: readonly PlanetStudy[] = [
  fixtureStudy("buzz", "Buzz", 5, 60, 0, ["《你屏幕上这套东西背后是什么？》"]),
  fixtureStudy("general", "通用课", 1, 19, 0, ["Web 基础"]),
  fixtureStudy("supaluv", "SupaLuv", 7, 54, 0, ["账号", "表", "权限"]),
  fixtureStudy("turing-pact", "TuringPact", 31, 362, 1, ["开场", "地图", "镜头", "灯光", "材质"]),
  fixtureStudy("university-local", "UniversityLocal 自身", 9, 84, 4, [
    "仓库",
    "课",
    "证据",
    "复习",
  ]),
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
