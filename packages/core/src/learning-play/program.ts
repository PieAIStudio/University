import type { Cell, Direction, ProgramActivity, ProgramCommand } from "./types.js";

const DIRECTIONS: readonly Direction[] = ["north", "east", "south", "west"];
const DELTAS: Readonly<Record<Direction, Cell>> = {
  north: { x: 0, y: -1 },
  east: { x: 1, y: 0 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 },
};

/** These bounds apply even when a caller bypasses the TypeScript payload type. */
const LIMITS = { side: 16, commands: 32, repeat: 16 } as const;

export interface ProgramState {
  readonly position: Cell;
  readonly direction: Direction;
  /** Indices refer to the activity's checkpoint array, in first-visit order. */
  readonly visitedCheckpoints: readonly number[];
}

export interface ProgramFrame extends ProgramState {
  /** Zero-based command index, and one-based repetition within that command. */
  readonly commandIndex: number;
  readonly repetition: number;
  readonly op: ProgramCommand["op"];
  /** A blocked step keeps the robot in its last legal cell. */
  readonly collision?: "wall" | "bounds";
  readonly attemptedCell?: Cell;
}

export type ProgramOutcome =
  | "success"
  | "empty"
  | "invalid-activity"
  | "invalid-command"
  | "command-budget"
  | "wall"
  | "bounds"
  | "missing-checkpoints"
  | "not-at-goal";

export interface ProgramResult {
  readonly passed: boolean;
  readonly outcome: ProgramOutcome;
  readonly commandCount: number;
  /** Includes a blocked movement attempt; turns are steps too. */
  readonly executedSteps: number;
  readonly initialState: ProgramState | null;
  readonly finalState: ProgramState | null;
  readonly frames: readonly ProgramFrame[];
  readonly problem?: {
    readonly commandIndex?: number;
    readonly repetition?: number;
    readonly attemptedCell?: Cell;
  };
}

function sameCell(left: Cell, right: Cell): boolean {
  return left.x === right.x && left.y === right.y;
}

function inBounds(cell: Cell, activity: Pick<ProgramActivity, "width" | "height">): boolean {
  return cell.x >= 0 && cell.y >= 0 && cell.x < activity.width && cell.y < activity.height;
}

function boundedInteger(value: number, maximum: number): boolean {
  return Number.isSafeInteger(value) && value >= 1 && value <= maximum;
}

/** Geometry validation also keeps the DOM grid and simulation finite. */
export function isValidProgramActivity(activity: ProgramActivity): boolean {
  if (!activity || typeof activity !== "object") return false;
  if (
    !boundedInteger(activity.width, LIMITS.side) ||
    !boundedInteger(activity.height, LIMITS.side) ||
    !boundedInteger(activity.maxCommands, LIMITS.commands) ||
    !boundedInteger(activity.maxRepeat, LIMITS.repeat)
  )
    return false;

  const validCell = (cell: Cell): boolean =>
    Boolean(cell) &&
    Number.isSafeInteger(cell.x) &&
    Number.isSafeInteger(cell.y) &&
    inBounds(cell, activity);
  if (!validCell(activity.start) || !validCell(activity.goalCell)) return false;
  if (!DIRECTIONS.includes(activity.start.direction)) return false;
  if (!Array.isArray(activity.walls) || !Array.isArray(activity.checkpoints)) return false;
  const maximumCells = activity.width * activity.height;
  if (activity.walls.length > maximumCells || activity.checkpoints.length > maximumCells)
    return false;
  if (
    !Array.from(activity.walls).every(validCell) ||
    !Array.from(activity.checkpoints).every(validCell)
  )
    return false;
  const uniqueCells = (cells: readonly Cell[]) =>
    new Set(cells.map((cell) => `${cell.x},${cell.y}`)).size === cells.length;
  if (!uniqueCells(activity.walls) || !uniqueCells(activity.checkpoints)) return false;
  return !activity.walls.some(
    (wall) =>
      sameCell(wall, activity.start) ||
      sameCell(wall, activity.goalCell) ||
      activity.checkpoints.some((checkpoint) => sameCell(wall, checkpoint)),
  );
}

/**
 * Run the whole submitted program, not just its prefix up to the goal.
 * Repetition expands only validated, bounded data; no source code is evaluated.
 * All legal programs satisfying the goal are accepted, regardless of route.
 */
export function simulateProgram(
  activity: ProgramActivity,
  commands: readonly ProgramCommand[],
): ProgramResult {
  const commandCount = Array.isArray(commands) ? commands.length : 0;
  if (!isValidProgramActivity(activity)) {
    return {
      passed: false,
      outcome: "invalid-activity",
      commandCount,
      executedSteps: 0,
      initialState: null,
      finalState: null,
      frames: [],
    };
  }

  let position: Cell = { x: activity.start.x, y: activity.start.y };
  let direction = activity.start.direction;
  const visited = new Set<number>();
  const visitCurrentCell = () => {
    activity.checkpoints.forEach((cell, index) => {
      if (sameCell(cell, position)) visited.add(index);
    });
  };
  visitCurrentCell();
  const state = (): ProgramState => ({
    position: { ...position },
    direction,
    visitedCheckpoints: [...visited],
  });
  const initialState = state();
  const frames: ProgramFrame[] = [];
  const result = (outcome: ProgramOutcome, problem?: ProgramResult["problem"]): ProgramResult => ({
    passed: outcome === "success",
    outcome,
    commandCount,
    executedSteps: frames.length,
    initialState,
    finalState: state(),
    frames,
    ...(problem ? { problem } : {}),
  });

  if (!Array.isArray(commands)) return result("invalid-command");
  if (commandCount > activity.maxCommands) return result("command-budget");
  if (commandCount === 0) return result("empty");
  // Validate before moving. A malformed later command must never half-run.
  for (let commandIndex = 0; commandIndex < commands.length; commandIndex += 1) {
    const command = commands[commandIndex];
    if (
      !command ||
      !["forward", "left", "right"].includes(command.op) ||
      !boundedInteger(command.repeat, activity.maxRepeat)
    )
      return result("invalid-command", { commandIndex });
  }

  for (let commandIndex = 0; commandIndex < commands.length; commandIndex += 1) {
    const command = commands[commandIndex]!;
    for (let repetition = 1; repetition <= command.repeat; repetition += 1) {
      if (command.op === "forward") {
        const delta = DELTAS[direction];
        const attemptedCell = { x: position.x + delta.x, y: position.y + delta.y };
        const collision = !inBounds(attemptedCell, activity)
          ? "bounds"
          : activity.walls.some((wall) => sameCell(wall, attemptedCell))
            ? "wall"
            : undefined;
        if (collision) {
          frames.push({
            ...state(),
            commandIndex,
            repetition,
            op: command.op,
            collision,
            attemptedCell,
          });
          return result(collision, { commandIndex, repetition, attemptedCell });
        }
        position = attemptedCell;
        visitCurrentCell();
      } else {
        const turn = command.op === "right" ? 1 : -1;
        direction =
          DIRECTIONS[
            (DIRECTIONS.indexOf(direction) + turn + DIRECTIONS.length) % DIRECTIONS.length
          ]!;
      }
      frames.push({ ...state(), commandIndex, repetition, op: command.op });
    }
  }
  if (visited.size !== activity.checkpoints.length) return result("missing-checkpoints");
  if (!sameCell(position, activity.goalCell)) return result("not-at-goal");
  return result("success");
}
