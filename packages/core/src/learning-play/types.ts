import type { BriefActivity } from "./ai-brief.js";
import type { ContextActivity } from "./ai-context.js";
import type { AgentActivity } from "./ai-agent.js";
import type { EvalActivity } from "./ai-eval.js";
import type { RepairActivity } from "./ai-repair.js";

/** Experimental activity payloads. These are not a second lesson/export schema. */
export interface ActivityBase {
  readonly id: string;
  readonly title: string;
  readonly brief: string;
  readonly goal: string;
  readonly takeaway: string;
  readonly hint: string;
  readonly source: { readonly label: string; readonly url: string };
}

export interface ConnectActivity extends ActivityBase {
  readonly kind: "connect";
  readonly nodes: readonly {
    readonly id: string;
    readonly label: string;
    readonly note: string;
    readonly x: number;
    readonly y: number;
  }[];
  readonly edges: readonly { readonly from: string; readonly to: string; readonly why: string }[];
  readonly probes: readonly { readonly label: string; readonly path: readonly string[] }[];
}

export type NumericExpression =
  | number
  | { readonly control: string }
  | {
      readonly op: "sum" | "product" | "min" | "max";
      readonly args: readonly NumericExpression[];
    };

export interface TuneActivity extends ActivityBase {
  readonly kind: "tune";
  /** Optional observable teaching model, bound to the same controls and metrics. */
  readonly visualization?:
    | { readonly kind: "image-detail"; readonly detailMetric: string }
    | {
        readonly kind: "work-queue";
        readonly batchControl: string;
        readonly workersControl: string;
      };
  readonly controls: readonly {
    readonly id: string;
    readonly label: string;
    readonly unit: string;
    readonly min: number;
    readonly max: number;
    readonly initial: number;
  }[];
  readonly metrics: readonly {
    readonly id: string;
    readonly label: string;
    readonly unit: string;
    readonly expression: NumericExpression;
    readonly min?: number;
    readonly max?: number;
    readonly scale: number;
    readonly precision: number;
    readonly explanation: string;
  }[];
  readonly modelNote: string;
}

export interface HuntActivity extends ActivityBase {
  readonly kind: "hunt";
  readonly model: "threshold" | "clamp";
  readonly boundary: number;
  readonly input: {
    readonly label: string;
    readonly unit: string;
    readonly min: number;
    readonly max: number;
    readonly initial: number;
  };
  readonly rule: string;
  readonly program: string;
  readonly outputLabel: string;
}

export interface DispatchActivity extends ActivityBase {
  readonly kind: "dispatch";
  readonly lanes: readonly {
    readonly id: string;
    readonly label: string;
    readonly note: string;
    readonly cost: number;
  }[];
  readonly cards: readonly {
    readonly id: string;
    readonly label: string;
    readonly detail: string;
    readonly allowedLaneIds: readonly string[];
    readonly cacheKey?: string;
    readonly why: string;
  }[];
  /** This lane becomes available only after the matching key has been warmed. */
  readonly cacheLaneId: string;
  readonly budget: number;
  readonly seconds: number;
}

export type Direction = "north" | "east" | "south" | "west";
export interface Cell {
  readonly x: number;
  readonly y: number;
}
export interface ProgramCommand {
  readonly op: "forward" | "left" | "right";
  readonly repeat: number;
}
export interface ProgramActivity extends ActivityBase {
  readonly kind: "program";
  readonly width: number;
  readonly height: number;
  readonly start: Cell & { readonly direction: Direction };
  readonly goalCell: Cell;
  readonly walls: readonly Cell[];
  readonly checkpoints: readonly Cell[];
  readonly maxCommands: number;
  readonly maxRepeat: number;
}

export type LearningActivitySpec =
  | ConnectActivity
  | TuneActivity
  | HuntActivity
  | DispatchActivity
  | ProgramActivity
  | BriefActivity
  | ContextActivity
  | AgentActivity
  | EvalActivity
  | RepairActivity;
export type ActivityKind = LearningActivitySpec["kind"];
export interface ActivityResult {
  readonly activityId: string;
  readonly kind: ActivityKind;
  readonly status: "completed" | "skipped";
  readonly attempts: number;
  readonly hintsUsed: number;
  readonly submission: Readonly<Record<string, unknown>>;
}
