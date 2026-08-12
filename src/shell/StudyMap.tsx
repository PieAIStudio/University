import { useEffect, useState } from "react";

import { readJson } from "../api/client.js";
import { Tip } from "../Tip.js";

export interface StudyMapLayer {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly fileCount: number;
  readonly citedFileCount: number;
  readonly citedFiles: readonly string[];
}

export interface StudyMapView {
  readonly analysisId: string;
  readonly sourceCommit: string;
  readonly nodeCount: number;
  readonly layers: readonly StudyMapLayer[];
  readonly uncharted: readonly string[];
}

/**
 * A layer is "barely entered" below this, and says so.
 *
 * Not a quality bar — some layers should be thin. Generated assets and a test
 * suite do not need a lesson each, and a curriculum that covered them evenly
 * would be worse, not better. The threshold exists to make a *deliberate*
 * omission distinguishable from one nobody noticed, which is the only thing
 * this view can honestly claim to do.
 */
const THIN_COVERAGE = 0.15;

function percent(layer: StudyMapLayer): number {
  if (layer.fileCount === 0) return 0;
  return Math.round((layer.citedFileCount / layer.fileCount) * 100);
}

/**
 * How much of the studied project the courses have actually taken you into.
 *
 * The layers and file counts are Understand Anything's; which files are cited
 * is this app's. Neither half is interesting alone — UA can describe a codebase
 * without knowing what was taught, and a course list can describe a curriculum
 * without knowing what it left out. Crossed, they answer the question a
 * curriculum can never ask itself: *what did we not go near?*
 *
 * Deliberately not a graph. UA ships an explorer for the graph and it is better
 * than anything worth rebuilding here; what it cannot show is this, because it
 * has never heard of a lesson.
 */
export function StudyMap({ studyId }: { readonly studyId: string }) {
  const [map, setMap] = useState<StudyMapView | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "absent">("loading");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setMap(null);
    setExpanded(null);
    void (async () => {
      try {
        const body = await readJson<{ readonly map: StudyMapView | null }>(
          await fetch(`/api/studies/${encodeURIComponent(studyId)}/map`),
        );
        if (cancelled) return;
        setMap(body.map);
        setState(body.map ? "ready" : "absent");
      } catch {
        // The map is context on top of a study page that reads fine without it.
        if (!cancelled) setState("absent");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [studyId]);

  // Nothing at all while loading or absent: a study nobody has analysed should
  // not carry an empty box explaining what it does not have.
  if (state !== "ready" || !map || map.layers.length === 0) return null;

  const totalFiles = map.layers.reduce((sum, layer) => sum + layer.fileCount, 0);
  const totalCited = map.layers.reduce((sum, layer) => sum + layer.citedFileCount, 0);
  const thin = map.layers.filter(
    (layer) => layer.fileCount >= 10 && layer.citedFileCount / layer.fileCount < THIN_COVERAGE,
  );

  return (
    <section className="study-map" aria-label="项目地图">
      <div className="study-map__header">
        <h3>课程走到了项目的哪些地方</h3>
        <Tip term="study-map" className="rail-panel__help">
          <span aria-label="关于项目地图">?</span>
        </Tip>
        <p className="study-map__reach">
          {totalCited} / {totalFiles} 个文件
        </p>
      </div>

      <ol className="study-map__layers">
        {map.layers.map((layer) => {
          const pct = percent(layer);
          const isThin = layer.fileCount >= 10 && pct < THIN_COVERAGE * 100;
          const open = expanded === layer.id;
          return (
            <li key={layer.id} className="study-map__layer" data-thin={isThin || undefined}>
              <button
                type="button"
                className="study-map__layer-head"
                aria-expanded={open}
                disabled={layer.citedFileCount === 0}
                onClick={() => setExpanded(open ? null : layer.id)}
              >
                <span className="study-map__layer-name">{layer.name}</span>
                <span className="study-map__layer-count">
                  {layer.citedFileCount} / {layer.fileCount}
                </span>
              </button>
              {/*
                A bar rather than a number alone: nine percentages in a column
                are read one at a time, while nine bars are read at once, and
                "which of these is short" is the entire question here.
              */}
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
              {open ? (
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

      {thin.length > 0 ? (
        <p className="study-map__note">
          <strong>{thin.map((layer) => layer.name).join("、")}</strong>{" "}
          几乎没有课程引用。可能是有意跳过（生成产物、测试代码通常不必逐个讲），
          也可能是大纲根本没想到——这一栏分不出这两者，只能告诉你它在哪。
        </p>
      ) : null}
    </section>
  );
}
