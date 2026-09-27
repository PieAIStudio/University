import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { GameButton, GameField, GameInput, GameSlider } from "@pieai/swimmer-ui-kit";
import {
  assessHuntEvidence,
  evaluateHunt,
  type HuntActivity,
  type HuntObservation,
} from "@pieai/university-core";

import { interfaceTranslator, useI18n } from "../i18n/index.js";
import { playSound } from "../sound/sound.js";
import { PlayGuide } from "./PlayGuide.js";
import type { ActivityControls } from "./controls.js";

function numberWithUnit(value: number, unit: string): string {
  return [interfaceTranslator.number(value, { maximumSignificantDigits: 21 }), unit]
    .filter(Boolean)
    .join(" ");
}

function outputText(value: number | boolean, unit: string): string {
  return typeof value === "boolean"
    ? interfaceTranslator.t(value ? "play.extra.hunt.yes" : "play.extra.hunt.no")
    : numberWithUnit(value, unit);
}

export function HuntGame({
  activity,
  disabled,
  onAttempt,
  guided = false,
}: ActivityControls<HuntActivity>) {
  const interfaceTranslator = useI18n();
  const [input, setInput] = useState(String(activity.input.initial));
  const [history, setHistory] = useState<readonly HuntObservation[]>([]);
  const [error, setError] = useState("");
  const passed = useRef(false);
  const implementationViewed = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultId = useId();
  const latest = history.at(-1);
  const locked = disabled || passed.current;
  const numericInput = input.trim() === "" ? Number.NaN : Number(input);
  const sliderValue = Number.isFinite(numericInput)
    ? Math.min(activity.input.max, Math.max(activity.input.min, numericInput))
    : activity.input.initial;
  const hasUntestedChange = latest !== undefined && numericInput !== latest.input;
  const rangeValues = {
    min: activity.input.min,
    max: activity.input.max,
    unit: activity.input.unit,
  };

  useEffect(() => {
    if (!guided || !latest) return;
    const result = document.getElementById(resultId);
    const box = result?.getBoundingClientRect();
    if (box && (box.top < 0 || box.bottom > window.innerHeight - 80))
      result?.scrollIntoView?.({ block: "center", behavior: "instant" });
  }, [guided, latest, resultId]);

  function run(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (disabled || passed.current) return;
    playSound("ui.press");
    // Submit the visible field value, including native autofill and an emptied number input.
    const submittedInput = inputRef.current?.value ?? input;
    if (submittedInput !== input) setInput(submittedInput);
    const result = evaluateHunt(activity, submittedInput);
    if (!result.valid) {
      const keys = {
        empty: "play.extra.hunt.empty",
        "not-finite": "play.extra.hunt.notFinite",
        "out-of-range": "play.extra.hunt.outOfRange",
        "invalid-activity": "play.extra.hunt.invalidActivity",
      } as const;
      setError(interfaceTranslator.t(keys[result.reason], rangeValues));
      inputRef.current?.focus();
      return;
    }
    setError("");
    const next = [...history, result];
    setHistory(next);
    const assessment = assessHuntEvidence(activity, next);
    passed.current = assessment.passed;
    const message =
      activity.verifyBoundarySides && assessment.found
        ? interfaceTranslator.t(
            assessment.passed ? "play.difficulty.hunt.complete" : "play.difficulty.hunt.more",
          )
        : result.counterexample
          ? interfaceTranslator.t("play.extra.hunt.found", {
              input: numberWithUnit(result.input, activity.input.unit),
              expected: outputText(result.expected, activity.input.unit),
              actual: outputText(result.actual, activity.input.unit),
            })
          : interfaceTranslator.t("play.extra.hunt.same", {
              output: outputText(result.actual, activity.input.unit),
            });
    onAttempt(
      assessment.passed,
      {
        model: activity.model,
        boundary: activity.boundary,
        counterexample: result.counterexample,
        input: result.input,
        expected: result.expected,
        actual: result.actual,
        experiments: next,
        implementationViewed: implementationViewed.current,
      },
      message,
    );
  }

  return (
    <div className="play-hunt">
      {guided ? (
        <PlayGuide
          title={interfaceTranslator.t(
            history.length ? "play.usability.hunt.next" : "play.usability.hunt.first",
          )}
          action={!history.length ? interfaceTranslator.t("play.usability.hunt.try") : undefined}
          onAction={() => run()}
          disabled={locked}
        >
          {activity.verifyBoundarySides ? activity.goal : undefined}
        </PlayGuide>
      ) : null}
      <section className="play-hunt__contract">
        <h4>{interfaceTranslator.t("play.extra.hunt.rule")}</h4>
        <p>{activity.rule}</p>
      </section>

      <section className="play-hunt__bench">
        <div className="play-hunt__bench-heading">
          <span className="play-hunt__blackbox" aria-hidden="true">
            ?
          </span>
          <div>
            <h4>{interfaceTranslator.t("play.extra.hunt.blackbox")}</h4>
            <p>{interfaceTranslator.t("play.extra.hunt.blackboxBrief")}</p>
          </div>
        </div>
        <form className="play-hunt__form" onSubmit={run} noValidate>
          <fieldset className="play-hunt__probe" disabled={locked}>
            <GameSlider
              label={interfaceTranslator.t("play.extra.hunt.selectInput")}
              min={Math.ceil(activity.input.min)}
              max={Math.floor(activity.input.max)}
              value={sliderValue}
              onChange={(value) => {
                if (locked) return;
                setInput(String(value));
                setError("");
              }}
            />
            <div className="play-hunt__axis" aria-hidden="true">
              {history.map((observation, index) => (
                <span
                  key={index}
                  className="play-hunt__test-point"
                  data-counterexample={observation.counterexample}
                  data-latest={index === history.length - 1}
                  style={{
                    insetInlineStart:
                      100 *
                        ((observation.input - activity.input.min) /
                          Math.max(Number.EPSILON, activity.input.max - activity.input.min)) +
                      "%",
                  }}
                />
              ))}
            </div>
            <div className="play-hunt__axis-labels" aria-hidden="true">
              <span>{numberWithUnit(activity.input.min, activity.input.unit)}</span>
              <span className="play-hunt__axis-caption">
                {history.length === 0
                  ? interfaceTranslator.t("play.extra.hunt.exploredEmpty")
                  : interfaceTranslator.t("play.extra.hunt.testCount", { count: history.length })}
              </span>
              <span>{numberWithUnit(activity.input.max, activity.input.unit)}</span>
            </div>
          </fieldset>
          <div className="play-hunt__input-row">
            <GameField
              label={activity.input.label}
              error={error || undefined}
              className="play-hunt__field"
            >
              <GameInput
                ref={inputRef}
                type="number"
                inputMode="decimal"
                step="any"
                min={activity.input.min}
                max={activity.input.max}
                value={input}
                onChange={(event) => {
                  setInput(event.target.value);
                  setError("");
                }}
                disabled={locked}
                invalid={Boolean(error)}
                aria-describedby={resultId}
                autoComplete="off"
              />
            </GameField>
            <GameButton type="submit" variant="primary" sound={false} disabled={locked}>
              {interfaceTranslator.t("play.extra.hunt.run")}
            </GameButton>
          </div>
          <p className="play-hunt__precision-note">
            {interfaceTranslator.t("play.extra.hunt.precisionNote")}
          </p>
        </form>
      </section>

      <div id={resultId} className="play-hunt__result" aria-live="polite" aria-atomic="true">
        <p className="play-hunt__result-caption" data-pending={hasUntestedChange}>
          {latest
            ? interfaceTranslator.t(
                hasUntestedChange ? "play.extra.hunt.previousInput" : "play.extra.hunt.testedInput",
                { input: numberWithUnit(latest.input, activity.input.unit) },
              )
            : interfaceTranslator.t("play.extra.hunt.ready")}
        </p>
        <div
          className="play-hunt__comparison"
          data-result={latest ? (latest.counterexample ? "different" : "equal") : "waiting"}
        >
          <div className="play-hunt__reading">
            <span>{interfaceTranslator.t("play.extra.hunt.expected")}</span>
            <strong>
              {latest
                ? outputText(latest.expected, activity.input.unit)
                : interfaceTranslator.t("play.extra.hunt.waiting")}
            </strong>
            <span className="play-hunt__reading-label">{activity.outputLabel}</span>
          </div>
          <div className="play-hunt__verdict">
            <span className="play-hunt__verdict-symbol" aria-hidden="true">
              {latest ? (latest.counterexample ? "≠" : "=") : "·"}
            </span>
            {latest ? (
              <span>
                {interfaceTranslator.t(
                  latest.counterexample ? "play.extra.hunt.different" : "play.extra.hunt.equal",
                )}
              </span>
            ) : null}
          </div>
          <div className="play-hunt__reading play-hunt__reading--actual">
            <span>{interfaceTranslator.t("play.extra.hunt.actual")}</span>
            <strong>
              {latest
                ? outputText(latest.actual, activity.input.unit)
                : interfaceTranslator.t("play.extra.hunt.waiting")}
            </strong>
            <span className="play-hunt__reading-label">{activity.outputLabel}</span>
          </div>
        </div>
        {guided && latest && !locked ? (
          <GameButton
            variant="secondary"
            onClick={() => {
              inputRef.current?.scrollIntoView?.({ block: "center", behavior: "instant" });
              inputRef.current?.focus({ preventScroll: true });
            }}
          >
            {interfaceTranslator.t("play.usability.hunt.change")}
          </GameButton>
        ) : null}
      </div>

      <details
        className="play-hunt__implementation"
        onToggle={(event) => {
          if (event.currentTarget.open) implementationViewed.current = true;
        }}
      >
        <summary>{interfaceTranslator.t("play.extra.hunt.openImplementation")}</summary>
        <p>{interfaceTranslator.t("play.extra.hunt.implementationNote")}</p>
        <code>{activity.program}</code>
      </details>

      {history.length > 0 ? (
        <section
          className="play-hunt__history"
          aria-label={interfaceTranslator.t("play.extra.hunt.history")}
        >
          <h4>{interfaceTranslator.t("play.extra.hunt.history")}</h4>
          <ol reversed>
            {history.toReversed().map((observation, index) => (
              <li key={history.length - index} data-counterexample={observation.counterexample}>
                <span className="play-hunt__history-number">
                  {interfaceTranslator.t("play.extra.hunt.testNumber", {
                    number: history.length - index,
                  })}
                </span>
                <span>
                  {interfaceTranslator.t("play.extra.hunt.testSummary", {
                    input: numberWithUnit(observation.input, activity.input.unit),
                    expected: outputText(observation.expected, activity.input.unit),
                    actual: outputText(observation.actual, activity.input.unit),
                  })}
                </span>
                <strong>
                  {interfaceTranslator.t(
                    observation.counterexample
                      ? "play.extra.hunt.different"
                      : "play.extra.hunt.equal",
                  )}
                </strong>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
