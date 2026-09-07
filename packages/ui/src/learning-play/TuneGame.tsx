import { useState, type CSSProperties } from "react";
import { GameButton, GameSlider } from "@pieai/swimmer-ui-kit";
import { evaluateTuning, type TuneActivity } from "@pieai/university-core";
import { translate as t } from "../i18n/index.js";
import type { ActivityControls } from "./controls.js";
import { PlayIcon } from "./PlayIcon.js";
import { TuneVisualization } from "./TuneVisualization.js";

export function TuneGame({ activity, disabled, onAttempt }: ActivityControls<TuneActivity>) {
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(activity.controls.map((control) => [control.id, control.initial])),
  );
  const [history, setHistory] = useState<
    { values: Record<string, number>; result: ReturnType<typeof evaluateTuning> }[]
  >([]);
  const result = evaluateTuning(activity, values);
  const target = (metric: TuneActivity["metrics"][number]) =>
    metric.min !== undefined && metric.max !== undefined
      ? t("play.tune.range", { min: metric.min, max: metric.max, unit: metric.unit })
      : metric.min !== undefined
        ? t("play.tune.min", { value: metric.min, unit: metric.unit })
        : t("play.tune.max", { value: metric.max ?? 0, unit: metric.unit });
  const run = () => {
    if (disabled) return;
    const next = [...history, { values: { ...values }, result }].slice(-6);
    setHistory(next);
    const failed = result.metrics
      .filter((metric) => !metric.passed)
      .map((metric) => activity.metrics.find((item) => item.id === metric.id)!.label);
    onAttempt(
      result.passed,
      { parameters: { ...values }, metrics: result.metrics, experiments: next },
      result.passed
        ? t("play.tune.win", { count: result.metrics.length })
        : t("play.tune.try", { names: failed.join(" / ") }),
    );
  };
  return (
    <div className="play-tune">
      <div className="play-tune__workspace">
        <div className="play-tune__bench">
          <TuneVisualization activity={activity} values={values} metrics={result.metrics} />
          <fieldset className="play-tune__controls" disabled={disabled}>
            <legend>{t("play.tune.live")}</legend>
            {activity.controls.map((control) => (
              <div className="play-tune__control" key={control.id}>
                <output className="play-tune__value">
                  {values[control.id]}
                  <small>{control.unit}</small>
                </output>
                <GameSlider
                  label={control.label}
                  min={control.min}
                  max={control.max}
                  value={values[control.id]}
                  onChange={(next) => {
                    if (!disabled) setValues((previous) => ({ ...previous, [control.id]: next }));
                  }}
                />
                <div className="play-tune__bounds" aria-hidden="true">
                  <span>
                    {control.min}
                    {control.unit}
                  </span>
                  <span>
                    {control.max}
                    {control.unit}
                  </span>
                </div>
              </div>
            ))}
          </fieldset>
        </div>
        <div className="play-tune__instruments">
          {activity.metrics.map((metric, index) => {
            const reading = result.metrics[index]!;
            const fill = Math.min(100, Math.max(0, (reading.value / metric.scale) * 100));
            const limit = Math.max(
              0,
              Math.min(100, ((metric.max ?? metric.min ?? 0) / metric.scale) * 100),
            );
            const safeStart = Math.max(0, Math.min(100, ((metric.min ?? 0) / metric.scale) * 100));
            const safeEnd = Math.max(
              safeStart,
              Math.min(100, ((metric.max ?? metric.scale) / metric.scale) * 100),
            );
            return (
              <div className="play-tune__meter" key={metric.id} data-passed={reading.passed}>
                <div className="play-tune__meter-head">
                  <strong>{metric.label}</strong>
                  <span className="play-tune__met">
                    {reading.passed ? <PlayIcon name="check" /> : null}
                    {t(reading.passed ? "play.tune.met" : "play.tune.unmet")}
                  </span>
                </div>
                <output>
                  {reading.value.toFixed(metric.precision)}
                  <small>{metric.unit}</small>
                </output>
                <div
                  className="play-tune__track"
                  style={{ "--reading": fill / 100, "--limit": `${limit}%` } as CSSProperties}
                  aria-hidden="true"
                >
                  <span
                    className="play-tune__safe"
                    style={{
                      insetInlineStart: `${safeStart}%`,
                      width: `${safeEnd - safeStart}%`,
                    }}
                  />
                  <span className="play-tune__fill" />
                  <i />
                </div>
                <p className="play-tune__target">{target(metric)}</p>
                <p className="play-muted">{metric.explanation}</p>
              </div>
            );
          })}
        </div>
      </div>
      <div className="play-action-row">
        <GameButton sound={false} disabled={disabled} type="button" onClick={run}>
          {t("play.tune.run")}
        </GameButton>
        <span className="play-muted">
          {result.metrics.filter((metric) => metric.passed).length} / {activity.metrics.length}
        </span>
      </div>
      <div className="play-tune__history">
        <h3>{t("play.tune.history")}</h3>
        {history.length === 0 ? (
          <p className="play-muted">{t("play.tune.noHistory")}</p>
        ) : (
          <ol>
            {history.map((trial, index) => (
              <li key={index}>
                <strong>{t("play.tune.trial", { count: index + 1 })}</strong>
                <span>
                  {activity.controls
                    .map((control) => `${control.label} ${trial.values[control.id]}${control.unit}`)
                    .join(" / ")}
                </span>
                <span>
                  {trial.result.metrics.filter((metric) => metric.passed).length} /{" "}
                  {activity.metrics.length} {t("play.tune.met")}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
      <details className="play-model-note">
        <summary>{t("play.lab.research")}</summary>
        <p>{activity.modelNote}</p>
      </details>
    </div>
  );
}
