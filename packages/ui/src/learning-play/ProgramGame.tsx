import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { GameButton, GameCallout, GameInput } from "@pieai/swimmer-ui-kit";
import {
  isValidProgramActivity,
  simulateProgram,
  type Cell,
  type Direction,
  type ProgramActivity,
  type ProgramCommand,
  type ProgramFrame,
  type ProgramResult,
} from "@pieai/university-core";

import { translate } from "../i18n/index.js";
import { playSound } from "../sound/index.js";
import type { ActivityControls } from "./controls.js";

const COMMAND_LABELS = {
  forward: "play.program.forward",
  left: "play.program.left",
  right: "play.program.right",
} as const;
const DIRECTION_LABELS = {
  north: "play.program.north",
  east: "play.program.east",
  south: "play.program.south",
  west: "play.program.west",
} as const;
const DIRECTION_ANGLES: Readonly<Record<Direction, number>> = {
  north: 0,
  east: 90,
  south: 180,
  west: 270,
};
const OPERATIONS: readonly ProgramCommand["op"][] = ["forward", "left", "right"];

interface EditableCommand extends ProgramCommand {
  readonly id: number;
}
interface ActiveRun {
  readonly id: number;
  readonly result: ProgramResult;
  readonly commands: readonly ProgramCommand[];
  reported: boolean;
}

function cellName(cell: Cell): string {
  return `${String.fromCharCode(65 + cell.x)}${cell.y + 1}`;
}

function sameCell(left: Cell, right: Cell): boolean {
  return left.x === right.x && left.y === right.y;
}

function ProgramIcon({
  name,
}: {
  readonly name: ProgramCommand["op"] | "up" | "down" | "remove" | "play" | "flag" | "start";
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {name === "forward" && <path d="M12 20V4m-6 6 6-6 6 6" />}
      {name === "left" && <path d="M19 20v-7a5 5 0 0 0-5-5H5m5-5L5 8l5 5" />}
      {name === "right" && <path d="M5 20v-7a5 5 0 0 1 5-5h9m-5-5 5 5-5 5" />}
      {name === "up" && <path d="m6 14 6-6 6 6" />}
      {name === "down" && <path d="m6 10 6 6 6-6" />}
      {name === "remove" && (
        <>
          <path d="M5 7h14M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5" />
        </>
      )}
      {name === "play" && <path d="m8 5 11 7-11 7Z" />}
      {name === "flag" && <path d="M5 21V4m0 0c5-5 9 5 14 0v10c-5 5-9-5-14 0" />}
      {name === "start" && (
        <>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="2" />
        </>
      )}
    </svg>
  );
}

function Robot({ angle }: { readonly angle: number }) {
  return (
    <svg
      className="play-program__robot-face"
      style={{ transform: `rotate(${angle}deg)` }}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path
        className="play-program__robot-body"
        d="M13 12h22a6 6 0 0 1 6 6v18a6 6 0 0 1-6 6H13a6 6 0 0 1-6-6V18a6 6 0 0 1 6-6Z"
      />
      <path className="play-program__robot-heading" d="m18 8 6-6 6 6" />
      <path d="M15 32h18" />
      <path className="play-program__robot-heading" d="M4 23v9m40-9v9" />
      <circle cx="17" cy="23" r="2" fill="currentColor" />
      <circle cx="31" cy="23" r="2" fill="currentColor" />
    </svg>
  );
}

function resultMessage(activity: ProgramActivity, result: ProgramResult): string {
  const final = result.finalState;
  const position = final ? cellName(final.position) : "";
  const command = (result.problem?.commandIndex ?? 0) + 1;
  switch (result.outcome) {
    case "success":
      return translate("play.program.success", {
        checkpoints: activity.checkpoints.length,
        commands: result.commandCount,
        steps: result.executedSteps,
      });
    case "empty":
      return translate("play.program.empty");
    case "invalid-activity":
      return translate("play.program.invalidActivity");
    case "invalid-command":
      return translate("play.program.invalidCommand", { command, maximum: activity.maxRepeat });
    case "command-budget":
      return translate("play.program.overBudget", {
        count: result.commandCount,
        maximum: activity.maxCommands,
      });
    case "wall":
      return translate("play.program.hitWall", {
        command,
        repeat: result.problem?.repetition ?? 1,
        cell: result.problem?.attemptedCell ? cellName(result.problem.attemptedCell) : "",
        position,
      });
    case "bounds":
      return translate("play.program.outOfBounds", {
        command,
        repeat: result.problem?.repetition ?? 1,
        position,
      });
    case "missing-checkpoints":
      return translate("play.program.missingCheckpoints", {
        visited: final?.visitedCheckpoints.length ?? 0,
        total: activity.checkpoints.length,
        missing: activity.checkpoints
          .filter((_, index) => !final?.visitedCheckpoints.includes(index))
          .map(cellName)
          .join(" · "),
        goal: cellName(activity.goalCell),
      });
    case "not-at-goal":
      return translate("play.program.notAtGoal", { position, goal: cellName(activity.goalCell) });
  }
}

function traceText(frame: ProgramFrame, index: number): string {
  return (
    translate(frame.collision ? "play.program.traceBlocked" : "play.program.traceStep", {
      step: index + 1,
      command: frame.commandIndex + 1,
      repeat: frame.repetition,
      operation: translate(COMMAND_LABELS[frame.op]),
      cell: cellName(frame.position),
      direction: translate(DIRECTION_LABELS[frame.direction]),
    }) + translate("play.program.traceCheckpoint", { count: frame.visitedCheckpoints.length })
  );
}

/** The session key also clears animation timers when the scenario changes. */
export function ProgramGame(props: ActivityControls<ProgramActivity>) {
  if (!isValidProgramActivity(props.activity)) {
    return <GameCallout tone="danger">{translate("play.program.invalidActivity")}</GameCallout>;
  }
  return <ProgramSession key={props.activity.id} {...props} />;
}

function ProgramSession({ activity, disabled, onAttempt }: ActivityControls<ProgramActivity>) {
  const id = useId();
  const [commands, setCommands] = useState<readonly EditableCommand[]>([]);
  const [execution, setExecution] = useState<ProgramResult | null>(null);
  const [shownFrames, setShownFrames] = useState(0);
  const [running, setRunning] = useState(false);
  const [instant, setInstant] = useState(false);
  const [notice, setNotice] = useState<"ready" | "edited" | "stopped">("ready");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);
  const nextCommandId = useRef(0);
  const activeRun = useRef<ActiveRun | null>(null);
  const onAttemptRef = useRef(onAttempt);
  const focusTarget = useRef<number | "heading" | null>(null);
  const commandInputs = useRef(new Map<number, HTMLInputElement>());
  const editorHeading = useRef<HTMLHeadingElement>(null);
  const mapHeading = useRef<HTMLHeadingElement>(null);
  const mapFeedback = useRef<HTMLDivElement>(null);
  const pendingView = useRef<
    { readonly kind: "map" } | { readonly kind: "editor"; readonly commandIndex?: number } | null
  >(null);

  useEffect(() => {
    onAttemptRef.current = onAttempt;
  }, [onAttempt]);
  useEffect(
    () => () => {
      generation.current += 1;
      if (timer.current !== null) clearTimeout(timer.current);
      activeRun.current = null;
    },
    [],
  );
  useEffect(() => {
    if (focusTarget.current === "heading") editorHeading.current?.focus();
    else if (focusTarget.current !== null) commandInputs.current.get(focusTarget.current)?.focus();
    focusTarget.current = null;
  }, [commands]);
  useEffect(() => {
    const destination = pendingView.current;
    pendingView.current = null;
    if (destination?.kind === "editor") {
      showEditor(destination.commandIndex);
    } else if (destination?.kind === "map") {
      const heading = mapHeading.current;
      if (!heading) return;
      const top = heading.getBoundingClientRect().top;
      const bottom = mapFeedback.current?.getBoundingClientRect().bottom ?? top;
      const narrow = window.matchMedia("(max-width: 760px)").matches;
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      // Reserve room for the phone shell's bottom navigation. Do not move a
      // desktop viewport that already contains the board and its feedback.
      if (top < 16 || bottom > viewportHeight - (narrow ? 84 : 16)) {
        heading.scrollIntoView({ block: "start", behavior: "instant" });
      }
      heading.focus({ preventScroll: true });
    }
  }, [execution, running]);

  function showEditor(commandIndex?: number) {
    const command = commandIndex === undefined ? undefined : commands[commandIndex];
    const target = command ? commandInputs.current.get(command.id) : editorHeading.current;
    if (!target) return;
    target.scrollIntoView({ block: command ? "center" : "start", behavior: "instant" });
    target.focus({ preventScroll: true });
  }

  function clearExecution() {
    generation.current += 1;
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    activeRun.current = null;
    setRunning(false);
    setExecution(null);
    setShownFrames(0);
  }

  function edit(next: readonly EditableCommand[]) {
    if (disabled || (activeRun.current && !activeRun.current.reported)) return;
    clearExecution();
    setCommands(next);
    setNotice("edited");
    playSound("ui.press");
  }

  function add(op: ProgramCommand["op"]) {
    if (commands.length >= activity.maxCommands) return;
    edit([...commands, { id: nextCommandId.current++, op, repeat: 1 }]);
  }

  function move(index: number, offset: number) {
    const next = [...commands];
    const destination = index + offset;
    if (destination < 0 || destination >= next.length) return;
    [next[index], next[destination]] = [next[destination]!, next[index]!];
    edit(next);
  }

  function remove(index: number) {
    focusTarget.current = commands[index + 1]?.id ?? commands[index - 1]?.id ?? "heading";
    edit(commands.filter((_, itemIndex) => itemIndex !== index));
  }

  function report(run: ActiveRun, immediately = false) {
    if (run.id !== generation.current || run.reported) return;
    run.reported = true;
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    pendingView.current = { kind: "map" };
    setInstant(immediately);
    setShownFrames(run.result.frames.length);
    setRunning(false);
    onAttemptRef.current(
      run.result.passed,
      {
        commands: run.commands,
        outcome: run.result.outcome,
        executedSteps: run.result.executedSteps,
        finalState: run.result.finalState,
        frames: run.result.frames,
      },
      resultMessage(activity, run.result),
    );
  }

  function runProgram() {
    if (disabled || (activeRun.current && !activeRun.current.reported) || commands.length === 0)
      return;
    clearExecution();
    pendingView.current = { kind: "map" };
    const program = commands.map(({ op, repeat }) => ({ op, repeat }));
    const result = simulateProgram(activity, program);
    const run = { id: generation.current, result, commands: program, reported: false };
    activeRun.current = run;
    setExecution(result);
    setInstant(false);
    playSound("ui.press");
    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || result.frames.length === 0) {
      report(run, true);
      return;
    }
    setRunning(true);
    let shown = 0;
    const stepDuration = Math.max(100, Math.min(420, 8_000 / result.frames.length));
    const advance = () => {
      if (run.id !== generation.current || run.reported) return;
      shown += 1;
      setShownFrames(shown);
      if (shown === result.frames.length)
        timer.current = setTimeout(() => report(run), stepDuration);
      else timer.current = setTimeout(advance, stepDuration);
    };
    timer.current = setTimeout(advance, stepDuration);
  }

  const locked = disabled || running;
  const initial = {
    position: { x: activity.start.x, y: activity.start.y },
    direction: activity.start.direction,
    visitedCheckpoints: activity.checkpoints.flatMap((cell, index) =>
      sameCell(cell, activity.start) ? [index] : [],
    ),
  };
  const visible = execution?.frames.slice(0, shownFrames) ?? [];
  const currentFrame = visible.at(-1);
  const pose = currentFrame ?? execution?.initialState ?? initial;
  const angle = visible.reduce(
    (value, frame) => value + (frame.op === "left" ? -90 : frame.op === "right" ? 90 : 0),
    DIRECTION_ANGLES[activity.start.direction],
  );
  const visitedCells = new Set([
    cellName(activity.start),
    ...visible.filter((frame) => !frame.collision).map((frame) => cellName(frame.position)),
  ]);
  const outcome = execution && !running ? resultMessage(activity, execution) : null;
  const statusText =
    outcome ??
    (running
      ? currentFrame
        ? translate("play.program.currentCommand", {
            command: currentFrame.commandIndex + 1,
            operation: translate(COMMAND_LABELS[currentFrame.op]),
            repeat: currentFrame.repetition,
          })
        : translate("play.program.starting")
      : translate(`play.program.${notice}`));
  const mapDescription = translate("play.program.mapDescription", {
    width: activity.width,
    height: activity.height,
    start: cellName(activity.start),
    direction: translate(DIRECTION_LABELS[activity.start.direction]),
    goal: cellName(activity.goalCell),
    checkpoints: activity.checkpoints.map(cellName).join(" · ") || translate("play.program.none"),
    walls: activity.walls.map(cellName).join(" · ") || translate("play.program.none"),
  });

  return (
    <div
      className="play-program"
      data-running={running || undefined}
      data-instant={instant || undefined}
    >
      <section className="play-program__map-section" aria-labelledby={`${id}-map-title`}>
        <div className="play-program__section-heading">
          <h3 id={`${id}-map-title`} ref={mapHeading} tabIndex={-1}>
            {translate("play.program.boardTitle")}
          </h3>
          <span className="play-program__checkpoints">
            {translate("play.program.checkpointCount", {
              visited: pose.visitedCheckpoints.length,
              total: activity.checkpoints.length,
            })}
          </span>
        </div>
        <div className="play-program__map-with-axes" dir="ltr">
          <div
            className="play-program__column-labels"
            style={{ gridTemplateColumns: `repeat(${activity.width}, minmax(0, 1fr))` }}
            aria-hidden="true"
          >
            {Array.from({ length: activity.width }, (_, x) => (
              <span key={x}>{String.fromCharCode(65 + x)}</span>
            ))}
          </div>
          <div
            className="play-program__row-labels"
            style={{ gridTemplateRows: `repeat(${activity.height}, minmax(0, 1fr))` }}
            aria-hidden="true"
          >
            {Array.from({ length: activity.height }, (_, y) => (
              <span key={y}>{y + 1}</span>
            ))}
          </div>
          <div
            className="play-program__board"
            role="img"
            aria-label={mapDescription}
            style={{
              gridTemplateColumns: `repeat(${activity.width}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${activity.height}, minmax(0, 1fr))`,
              aspectRatio: `${activity.width} / ${activity.height}`,
            }}
          >
            {Array.from({ length: activity.width * activity.height }, (_, index) => {
              const cell = { x: index % activity.width, y: Math.floor(index / activity.width) };
              const isStart = sameCell(cell, activity.start);
              const isGoal = sameCell(cell, activity.goalCell);
              const checkpoint = activity.checkpoints.findIndex((candidate) =>
                sameCell(cell, candidate),
              );
              const wall = activity.walls.some((candidate) => sameCell(cell, candidate));
              const visited = pose.visitedCheckpoints.includes(checkpoint);
              const collision = Boolean(
                currentFrame?.attemptedCell && sameCell(cell, currentFrame.attemptedCell),
              );
              return (
                <div
                  key={index}
                  className="play-program__cell"
                  data-wall={wall || undefined}
                  data-trail={visitedCells.has(cellName(cell)) || undefined}
                  data-collision={collision || undefined}
                  aria-hidden="true"
                >
                  {isStart && (
                    <span className="play-program__cell-label play-program__cell-label--start">
                      {translate("play.program.start")}
                    </span>
                  )}
                  {isGoal && (
                    <span className="play-program__goal">
                      <ProgramIcon name="flag" />
                      <span>{translate("play.program.goal")}</span>
                    </span>
                  )}
                  {checkpoint >= 0 && (
                    <span className="play-program__checkpoint" data-visited={visited || undefined}>
                      {visited ? (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          aria-hidden="true"
                        >
                          <path d="m5 12 4 4L19 6" />
                        </svg>
                      ) : (
                        checkpoint + 1
                      )}
                    </span>
                  )}
                  {wall && <span className="play-program__wall-block" />}
                </div>
              );
            })}
            <div
              key={generation.current}
              className="play-program__robot"
              data-collision={Boolean(currentFrame?.collision) || undefined}
              style={
                {
                  inlineSize: `${100 / activity.width}%`,
                  blockSize: `${100 / activity.height}%`,
                  transform: `translate(${pose.position.x * 100}%, ${pose.position.y * 100}%)`,
                } as CSSProperties
              }
              aria-hidden="true"
            >
              <Robot angle={angle} />
            </div>
          </div>
        </div>
        <p className="play-program__pose">
          {translate(shownFrames ? "play.program.pose" : "play.program.startPose", {
            cell: cellName(pose.position),
            direction: translate(DIRECTION_LABELS[pose.direction]),
          })}
        </p>
        {(running || (!disabled && execution && !execution.passed)) && (
          <div className="play-program__run-actions play-program__transport">
            {running ? (
              <>
                <GameButton
                  variant="secondary"
                  sound={false}
                  onClick={() => {
                    pendingView.current = {
                      kind: "editor",
                      commandIndex: currentFrame?.commandIndex ?? 0,
                    };
                    clearExecution();
                    setNotice("stopped");
                    playSound("ui.press");
                  }}
                >
                  {translate("play.program.stop")}
                </GameButton>
                <GameButton
                  variant="ghost"
                  sound={false}
                  onClick={() => {
                    if (activeRun.current) report(activeRun.current, true);
                    playSound("ui.press");
                  }}
                >
                  {translate("play.program.finishNow")}
                </GameButton>
              </>
            ) : (
              <GameButton
                variant="secondary"
                sound={false}
                onClick={() => {
                  showEditor(execution?.problem?.commandIndex);
                  playSound("ui.press");
                }}
              >
                {execution?.problem?.commandIndex === undefined
                  ? translate("play.program.backToEditor")
                  : translate("play.program.editCommand", {
                      command: execution.problem.commandIndex + 1,
                    })}
              </GameButton>
            )}
          </div>
        )}
        <div
          ref={mapFeedback}
          className="play-program__feedback"
          data-outcome={
            execution && !running ? (execution.passed ? "success" : "retry") : undefined
          }
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {execution && (
            <span className="play-program__step-counter">
              {translate("play.program.stepCount", {
                step: shownFrames,
                total: execution.frames.length,
              })}
            </span>
          )}
          <p>{statusText}</p>
        </div>
        <div className="play-program__legend" aria-hidden="true">
          <span>
            <ProgramIcon name="start" />
            {translate("play.program.start")}
          </span>
          <span>
            <ProgramIcon name="flag" />
            {translate("play.program.goal")}
          </span>
          <span>
            <span className="play-program__legend-checkpoint">1</span>
            {translate("play.program.checkpoint")}
          </span>
          <span>
            <span className="play-program__legend-wall" />
            {translate("play.program.wall")}
          </span>
        </div>
        <p className="play-program__note">{translate("play.program.boardNote")}</p>
      </section>

      <section className="play-program__editor" aria-labelledby={`${id}-program-title`}>
        <div className="play-program__section-heading">
          <h3 id={`${id}-program-title`} ref={editorHeading} tabIndex={-1}>
            {translate("play.program.programTitle")}
          </h3>
          <span className="play-program__budget">
            {translate("play.program.budget", {
              count: commands.length,
              maximum: activity.maxCommands,
            })}
          </span>
          <GameButton
            variant="ghost"
            sound={false}
            className="play-program__clear"
            disabled={locked || commands.length === 0}
            onClick={() => edit([])}
          >
            {translate("play.program.clear")}
          </GameButton>
        </div>
        <div className="play-program__palette">
          {OPERATIONS.map((op) => (
            <GameButton
              key={op}
              variant="secondary"
              sound={false}
              disabled={locked || commands.length >= activity.maxCommands}
              aria-label={translate("play.program.addCommand", {
                command: translate(COMMAND_LABELS[op]),
              })}
              onClick={() => add(op)}
            >
              <ProgramIcon name={op} />
              <span>{translate(COMMAND_LABELS[op])}</span>
            </GameButton>
          ))}
        </div>
        <p className="play-program__note">
          {translate(
            commands.length === activity.maxCommands
              ? "play.program.budgetFull"
              : "play.program.budgetNote",
            { maximum: activity.maxCommands, repeat: activity.maxRepeat },
          )}
        </p>
        {commands.length === 0 ? (
          <div className="play-program__empty">
            <ProgramIcon name="forward" />
            <strong>{translate("play.program.emptyTitle")}</strong>
            <p>{translate("play.program.emptyBody")}</p>
          </div>
        ) : (
          <ol className="play-program__commands">
            {commands.map((command, index) => (
              <li
                key={command.id}
                className="play-program__command"
                data-active={(running && currentFrame?.commandIndex === index) || undefined}
                data-failed={(!running && execution?.problem?.commandIndex === index) || undefined}
              >
                <span className="play-program__command-number" aria-hidden="true">
                  {index + 1}
                </span>
                <span className="play-program__command-name">
                  <ProgramIcon name={command.op} />
                  {translate(COMMAND_LABELS[command.op])}
                </span>
                <label className="play-program__repeat">
                  <span>{translate("play.program.repeat")}</span>
                  <GameInput
                    ref={(element) => {
                      if (element) commandInputs.current.set(command.id, element);
                      else commandInputs.current.delete(command.id);
                    }}
                    type="number"
                    min={1}
                    max={activity.maxRepeat}
                    step={1}
                    inputMode="numeric"
                    disabled={locked}
                    value={command.repeat}
                    aria-label={translate("play.program.repeatLabel", { command: index + 1 })}
                    onChange={(event) => {
                      const repeat = Number(event.target.value);
                      if (
                        Number.isSafeInteger(repeat) &&
                        repeat >= 1 &&
                        repeat <= activity.maxRepeat &&
                        repeat !== command.repeat
                      )
                        edit(
                          commands.map((item) =>
                            item.id === command.id ? { ...item, repeat } : item,
                          ),
                        );
                    }}
                  />
                  <span>{translate("play.program.times")}</span>
                </label>
                <div className="play-program__command-actions">
                  <GameButton
                    variant="ghost"
                    sound={false}
                    disabled={locked || index === 0}
                    aria-label={translate("play.program.moveUp", { command: index + 1 })}
                    onClick={() => move(index, -1)}
                  >
                    <ProgramIcon name="up" />
                  </GameButton>
                  <GameButton
                    variant="ghost"
                    sound={false}
                    disabled={locked || index === commands.length - 1}
                    aria-label={translate("play.program.moveDown", { command: index + 1 })}
                    onClick={() => move(index, 1)}
                  >
                    <ProgramIcon name="down" />
                  </GameButton>
                  <GameButton
                    variant="ghost"
                    sound={false}
                    disabled={locked}
                    aria-label={translate("play.program.remove", { command: index + 1 })}
                    onClick={() => remove(index)}
                  >
                    <ProgramIcon name="remove" />
                  </GameButton>
                </div>
              </li>
            ))}
          </ol>
        )}
        <div className="play-program__run-actions">
          <GameButton
            variant="primary"
            sound={false}
            disabled={locked || commands.length === 0}
            onClick={runProgram}
          >
            <ProgramIcon name="play" />
            {translate(
              running
                ? "play.program.running"
                : execution
                  ? "play.program.runAgain"
                  : "play.program.run",
            )}
          </GameButton>
        </div>
      </section>

      {visible.length > 0 && (
        <details className="play-program__trace">
          <summary>{translate("play.program.traceTitle", { count: visible.length })}</summary>
          <ol>
            {visible.map((frame, index) => (
              <li key={index} data-collision={Boolean(frame.collision) || undefined}>
                {traceText(frame, index)}
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
