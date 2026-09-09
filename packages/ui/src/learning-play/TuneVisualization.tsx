import { useState, type CSSProperties } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import type { TuneActivity } from "@pieai/university-core";
import { translate as t } from "../i18n/index.js";

/** A deliberately synthetic specimen: no real JPEG encoder or hardware benchmark. */
function GardenSpecimen() {
  return (
    <svg viewBox="0 0 320 190" fill="none" aria-hidden="true">
      <path className="play-tune__sky" d="M0 0h320v190H0z" />
      <circle className="play-tune__sun" cx="248" cy="42" r="19" />
      <path className="play-tune__hill-back" d="M0 139 68 62l76 75 54-66 122 65v54H0Z" />
      <path className="play-tune__hill-front" d="M0 144 100 95l108 66 112-42v71H0Z" />
      <path className="play-tune__paper" d="M91 90h113v71H91z" />
      <path className="play-tune__roof" d="m74 91 75-51 73 51Z" />
      <path
        className="play-tune__ink"
        d="M133 115h29v46h-29zM102 104h17v18h-17zM176 104h17v18h-17z"
      />
      <g className="play-tune__fine-lines" strokeWidth="1.3">
        <path d="M110 104v18m-8-9h17m65-9v18m-8-9h17M78 91h139M91 128h113M91 137h38m39 0h36M91 146h38m39 0h36" />
        <path d="m104 77 45-30 42 30M118 77l31-21 29 21m-45 0 16-11 15 11" />
        <path d="M21 169h53m-45-10v23m13-27v27m14-30v30m13-22v22M232 167h61m-52-10v26m15-31v31m14-31v31m14-25v25" />
        {Array.from({ length: 7 }, (_, i) => (
          <path key={i} d={`M${130 + i * 7} 169l-7 17`} />
        ))}
      </g>
      <g className="play-tune__plant">
        <path d="M42 145V99m0 24c-21 0-20-19-20-19 18-3 20 19 20 19m0-4c0-21 21-23 21-23 4 21-21 23-21 23" />
        <path d="M272 143V92m0 27c-23 0-24-22-24-22 20-1 24 22 24 22m0-10c0-22 22-25 22-25 5 22-22 25-22 25" />
      </g>
    </svg>
  );
}

export function TuneVisualization({
  activity,
  values,
  metrics,
}: {
  readonly activity: TuneActivity;
  readonly values: Readonly<Record<string, number>>;
  readonly metrics: readonly { readonly id: string; readonly value: number }[];
}) {
  const [original, setOriginal] = useState(false);
  const visual = activity.visualization;
  if (!visual) return null;
  if (visual.kind === "image-detail") {
    const detail = Math.max(
      0,
      Math.min(100, metrics.find((metric) => metric.id === visual.detailMetric)?.value ?? 0),
    );
    return (
      <figure className="play-tune__specimen">
        <div className="play-tune__specimen-label">
          <strong>{t(original ? "play.tune.original" : "play.tune.preview")}</strong>
          <span>{t("play.tune.modelBadge")}</span>
        </div>
        <div
          className="play-tune__image"
          style={{ "--detail-blur": `${original ? 0 : (100 - detail) / 22}px` } as CSSProperties}
        >
          <GardenSpecimen />
        </div>
        <GameButton
          sound={false}
          static
          variant="ghost"
          type="button"
          aria-pressed={original}
          onClick={() => setOriginal(!original)}
        >
          {t(original ? "play.tune.backPreview" : "play.tune.compareOriginal")}
        </GameButton>
        <figcaption>{t("play.tune.previewNote")}</figcaption>
      </figure>
    );
  }
  const batch = Math.max(1, Math.min(10, Math.round(values[visual.batchControl] ?? 1)));
  const workers = Math.max(1, Math.min(8, Math.round(values[visual.workersControl] ?? 1)));
  return (
    <figure className="play-tune__specimen">
      <div className="play-tune__specimen-label">
        <strong>{t("play.tune.queuePreview")}</strong>
        <span>{t("play.tune.modelBadge")}</span>
      </div>
      <div className="play-tune__queue" aria-hidden="true">
        {Array.from({ length: workers }, (_, worker) => (
          <div className="play-tune__worker" key={worker}>
            <span className="play-tune__worker-id">{worker + 1}</span>
            <div style={{ gridTemplateColumns: `repeat(${batch}, minmax(0, 1fr))` }}>
              {Array.from({ length: batch }, (_, task) => (
                <i key={task} />
              ))}
            </div>
            <span className="play-tune__worker-output">→</span>
          </div>
        ))}
      </div>
      <figcaption>
        {t("play.tune.queueNote", { workers, batch, total: workers * batch })}
      </figcaption>
    </figure>
  );
}
