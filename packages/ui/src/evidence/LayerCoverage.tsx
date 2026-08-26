import { useEffect, useState } from "react";
import { GameButton, GameModal } from "@pieai/swimmer-ui-kit";
import type {
  SourceAccessExplanation,
  SourceAccessPort,
  SourceLayerCoverage,
  SourceCoverageLayer,
} from "@pieai/university-core";

import { CapabilityExplanation } from "../capability/CapabilityExplanation.js";
import { Tip } from "../Tip.js";
import { isUrlEvidenceView, type EvidenceView } from "../view/lesson-view.js";

/** A layer is barely entered below this; it says so without calling it wrong. */
const THIN_COVERAGE = 0.15;

type LayerCoverageProps =
  | {
      readonly studyId: string;
      readonly sourceAccess: SourceAccessPort;
      readonly variant?: "study";
      readonly evidence?: never;
    }
  | {
      readonly studyId: string;
      readonly sourceAccess: SourceAccessPort;
      readonly variant: "lesson";
      readonly evidence: readonly EvidenceView[];
    };

function percent(layer: SourceCoverageLayer): number {
  if (layer.fileCount === 0) return 0;
  return Math.round((layer.citedFileCount / layer.fileCount) * 100);
}

function noLayerCoverageExplanation(detail?: string): SourceAccessExplanation {
  return {
    kind: "explanation",
    title: "查看项目分层",
    whatItDoes: "它会按 Understand Anything 的项目分层，列出这门课已经引用和还没有走到的文件。",
    whyUnavailable: detail
      ? `当前也读不到这份项目分析：${detail}`
      : "当前没有可用的 Understand Anything 分析，所以现在没有可信的分层可以展示。",
    futureSupport: "以后会在桌面端提供已授权的分析快照；浏览器端和移动端会提供同一份分层说明。",
  };
}

/**
 * The shared project-layer surface.
 *
 * The study variant is the author workbench's full analysis. The lesson
 * variant is the learner's small "where did this file land?" line plus the
 * same entry point. Keeping both here means the fact and its action cannot
 * drift into an author-only copy again.
 */
export function LayerCoverage(props: LayerCoverageProps) {
  if (props.variant === "lesson") {
    return <LessonLayerCoverage {...props} />;
  }
  return <StudyLayerCoverage studyId={props.studyId} sourceAccess={props.sourceAccess} />;
}

function StudyLayerCoverage({
  studyId,
  sourceAccess,
}: {
  readonly studyId: string;
  readonly sourceAccess: SourceAccessPort;
}) {
  const [map, setMap] = useState<SourceLayerCoverage | null>(null);
  const [explanation, setExplanation] = useState<SourceAccessExplanation | null>(null);
  const [explanationOpen, setExplanationOpen] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "absent">("loading");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setMap(null);
    setExplanation(null);
    setExpanded(null);
    void sourceAccess
      .layerCoverage({ studyId })
      .then((access) => {
        if (cancelled) return;
        if (access.kind === "explanation") {
          setExplanation(access);
          setState("absent");
          return;
        }
        void access
          .run()
          .then((next) => {
            if (cancelled) return;
            setMap(next);
            setState("ready");
          })
          .catch((reason: unknown) => {
            if (cancelled) return;
            setExplanation(
              noLayerCoverageExplanation(reason instanceof Error ? reason.message : String(reason)),
            );
            setState("absent");
          });
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setExplanation(
          noLayerCoverageExplanation(reason instanceof Error ? reason.message : String(reason)),
        );
        setState("absent");
      });
    return () => {
      cancelled = true;
    };
  }, [sourceAccess, studyId]);

  if (state === "loading") {
    return (
      <section className="study-map" aria-label="项目文件覆盖分析">
        <p className="study-map__status">正在读取项目分层…</p>
      </section>
    );
  }

  if (explanation) {
    return (
      <section className="study-map" aria-label="项目文件覆盖分析">
        <div className="study-map__header">
          <h3>按代码分层查看文件覆盖</h3>
          <Tip term="study-map" className="rail-panel__help">
            <span aria-label="关于项目地图">?</span>
          </Tip>
        </div>
        <p className="study-map__status">当前没有可直接读取的项目分层。</p>
        <GameButton variant="secondary" onClick={() => setExplanationOpen(true)}>
          查看项目分层
        </GameButton>
        {explanationOpen ? (
          <CapabilityExplanation
            explanation={explanation}
            onClose={() => setExplanationOpen(false)}
          />
        ) : null}
      </section>
    );
  }

  if (!map) return null;
  return (
    <CoverageMap
      map={map}
      expanded={expanded}
      onToggle={(id) => setExpanded((current) => (current === id ? null : id))}
    />
  );
}

function LessonLayerCoverage({
  studyId,
  evidence,
  sourceAccess,
}: {
  readonly studyId: string;
  readonly evidence: readonly EvidenceView[];
  readonly sourceAccess: SourceAccessPort;
}) {
  const repositoryEvidence = evidence.filter(
    (item): item is Extract<EvidenceView, { readonly sourcePath: string }> =>
      !isUrlEvidenceView(item),
  );
  const [pending, setPending] = useState(false);
  const [explanation, setExplanation] = useState<SourceAccessExplanation | null>(null);
  const [map, setMap] = useState<SourceLayerCoverage | null>(null);

  if (repositoryEvidence.length === 0) return null;

  // UA's private layer names are available only to the authoring adapter. The
  // learner-facing line must still be the same in both builds; the local map
  // opened below is where its richer layer names belong.
  const label = "这节课的文件落在项目仓库里";

  async function openCoverage() {
    setPending(true);
    setExplanation(null);
    try {
      const access = await sourceAccess.layerCoverage({ studyId });
      if (access.kind === "explanation") {
        setExplanation(access);
        setMap(null);
        return;
      }
      setMap(await access.run());
    } catch (reason: unknown) {
      setExplanation({
        kind: "explanation",
        title: "查看项目分层",
        whatItDoes: "它会按 Understand Anything 的项目分层，列出这门课已经引用和还没有走到的文件。",
        whyUnavailable: reason instanceof Error ? reason.message : "当前无法读取项目分析。",
        futureSupport: "以后会在桌面端提供已授权的分析快照；浏览器端和移动端会提供同一份分层说明。",
      });
      setMap(null);
    } finally {
      setPending(false);
    }
  }

  const sourcePaths = new Set(repositoryEvidence.map((item) => item.sourcePath));
  return (
    <div className="lesson-ua-layers">
      <span>{label}</span>
      <Tip term="ua-place" className="rail-panel__help">
        <span aria-label="关于项目位置">?</span>
      </Tip>
      <GameButton
        variant="ghost"
        className="lesson-ua-layers__open"
        data-parity-control="lesson-layer-coverage"
        onClick={() => void openCoverage()}
        disabled={pending}
      >
        {pending ? "正在读取项目分层…" : "查看项目分层"}
      </GameButton>
      {explanation ? (
        <CapabilityExplanation explanation={explanation} onClose={() => setExplanation(null)} />
      ) : null}
      {map ? (
        <GameModal
          open
          title="查看项目分层"
          closeLabel="关闭项目分层"
          closeOnBackdrop
          onClose={() => setMap(null)}
        >
          <CoverageMap
            map={map}
            expanded={null}
            lessonPaths={sourcePaths}
            onToggle={() => undefined}
          />
        </GameModal>
      ) : null}
    </div>
  );
}

function CoverageMap({
  map,
  expanded,
  lessonPaths,
  onToggle,
}: {
  readonly map: SourceLayerCoverage;
  readonly expanded: string | null;
  readonly lessonPaths?: ReadonlySet<string>;
  readonly onToggle: (id: string) => void;
}) {
  const totalFiles = map.layers.reduce((sum, layer) => sum + layer.fileCount, 0);
  const totalCited = map.layers.reduce((sum, layer) => sum + layer.citedFileCount, 0);
  const thin = map.layers.filter(
    (layer) => layer.fileCount >= 10 && layer.citedFileCount / layer.fileCount < THIN_COVERAGE,
  );

  return (
    <section className="study-map" aria-label="项目文件覆盖分析">
      <div className="study-map__header">
        <h3>按代码分层查看文件覆盖</h3>
        <Tip term="study-map" className="rail-panel__help">
          <span aria-label="关于项目地图">?</span>
        </Tip>
        <p className="study-map__reach">
          已讲到 {totalCited} / {totalFiles} 个项目文件
        </p>
      </div>

      <ol className="study-map__layers">
        {map.layers.map((layer) => {
          const pct = percent(layer);
          const isThin = layer.fileCount >= 10 && pct < THIN_COVERAGE * 100;
          const open = expanded === layer.id;
          const lessonFiles = lessonPaths
            ? layer.citedFiles.filter((filePath) => lessonPaths.has(filePath))
            : layer.citedFiles;
          return (
            <li key={layer.id} className="study-map__layer" data-thin={isThin || undefined}>
              <button
                type="button"
                className="study-map__layer-head"
                aria-expanded={open}
                disabled={layer.citedFileCount === 0 || Boolean(lessonPaths)}
                onClick={() => onToggle(layer.id)}
              >
                <span className="study-map__layer-name">{layer.name}</span>
                <span className="study-map__layer-count">
                  {layer.citedFileCount} / {layer.fileCount} 个文件
                </span>
              </button>
              <div
                className="study-map__bar"
                role="img"
                aria-label={`${layer.name}：${layer.fileCount} 个文件里有 ${layer.citedFileCount} 个被课程引用`}
              >
                <span className="study-map__bar-fill" style={{ inlineSize: `${pct}%` }} />
              </div>
              {layer.description ? (
                <p className="study-map__layer-desc">{layer.description}</p>
              ) : null}
              {lessonPaths && lessonFiles.length > 0 ? (
                <ul className="study-map__files">
                  {lessonFiles.map((filePath) => (
                    <li key={filePath}>
                      <code>{filePath}</code>
                    </li>
                  ))}
                </ul>
              ) : null}
              {!lessonPaths && open ? (
                <ul className="study-map__files">
                  {layer.citedFiles.map((filePath) => (
                    <li key={filePath}>
                      <code>{filePath}</code>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ol>

      {map.uncharted.length > 0 ? (
        <p className="study-map__note">
          有 {map.uncharted.length} 个被课程引用的文件尚未出现在项目分析里。
        </p>
      ) : null}
      {thin.length > 0 ? (
        <p className="study-map__note">
          <strong>{thin.map((layer) => layer.name).join("、")}</strong>{" "}
          几乎没有课程引用。可能是有意跳过（生成产物、测试代码通常不必逐个讲），也可能是大纲根本没想到——
          这一栏分不出这两者，只能告诉你它在哪。
        </p>
      ) : null}
    </section>
  );
}
