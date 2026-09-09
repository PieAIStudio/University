/** Browser acceptance only. Not imported by the app or a delivery build entry. */
import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { GameButton } from "@pieai/swimmer-ui-kit";
import "@pieai/swimmer-ui-kit/styles.css";
import {
  PlanetPage,
  type PlanetStudy,
  type PlanetStudyDomain,
} from "@pieai/university-world/planet.js";
import { I18nProvider } from "@pieai/university-ui/i18n.js";
import "./planet.css";

const query = new URLSearchParams(location.search);
const domainCount = query.get("domains") === "1" ? 1 : 4;
const seriesCount = query.get("series") === "1" ? 1 : query.get("series") === "20" ? 20 : 30;
const emptyLast = query.get("empty") === "1";
const longNames = query.get("long") === "1";
const names = ["编程", "图像与视频创作", "互动游戏", "叙事写作"];
const domains: readonly PlanetStudyDomain[] = names.slice(0, domainCount).map((name, i) => ({
  id: `fixture-domain-${i}`,
  title: longNames ? `${name}·用于测试长名称与窄屏换行的明确合成领域` : `${name}（测试领域）`,
}));
const baseStudies: readonly PlanetStudy[] = domains.flatMap((domain, d) =>
  Array.from({ length: emptyLast && d === domains.length - 1 ? 0 : seriesCount }, (_, i) => {
    const courses = Array.from({ length: 5 }, (_, c) => ({
      id: `fixture-course-${d}-${i}-${c}`,
      title: `合成课程 ${c + 1}`,
      lessonCount: 6 + ((i + c) % 3) * 6,
      depth: c,
    }));
    return {
      id: `fixture-series-${d}-${i}`,
      title: longNames
        ? `系列 ${i + 1}：这是用于验证超长标题不会压住状态与点击目标的合成测试名称`
        : `合成系列 ${i + 1}`,
      domain,
      courses,
      courseTitles: courses.map((course) => course.title),
      courseCount: courses.length,
      lessonCount: courses.reduce((sum, course) => sum + course.lessonCount, 0),
      lessonsDone: 0,
    };
  }),
);

function Fixture() {
  const [selected, setSelected] = useState<string | null>(baseStudies[0]?.id ?? null);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(domains[0]?.id ?? null);
  const [revision, setRevision] = useState(0);
  const [mounted, setMounted] = useState(true);
  const [entered, setEntered] = useState<string | null>(null);
  const studies = useMemo(
    () => baseStudies.map((study) => ({ ...study, lessonsDone: revision })),
    [revision],
  );
  return (
    <main className="domain-fixture">
      <header className="domain-fixture__controls">
        <strong>合成验收夹具 · 非课程目录</strong>
        <span>
          {domainCount} 领域 · 每个非空领域 {seriesCount} 系列
        </span>
        <GameButton data-fixture-progress onClick={() => setRevision((n) => n + 1)}>
          更新进度
        </GameButton>
        <GameButton data-fixture-mount onClick={() => setMounted((value) => !value)}>
          {mounted ? "卸载地图" : "重新挂载地图"}
        </GameButton>
        <output data-fixture-revision>{revision}</output>
        <output data-fixture-entered>{entered ?? "尚未进入系列"}</output>
      </header>
      <div className="domain-fixture__viewport">
        {mounted ? (
          <PlanetPage
            studies={studies}
            domainCatalog={domains}
            selectedId={selected}
            selectedDomainId={selectedDomain}
            onSelect={setSelected}
            onSelectDomain={setSelectedDomain}
            onEnter={setEntered}
            onClose={() => setMounted(false)}
          />
        ) : null}
      </div>
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing domain fixture root");
createRoot(root).render(
  <I18nProvider>
    <Fixture />
  </I18nProvider>,
);
