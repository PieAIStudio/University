import type { SortActivity } from "./sort.js";
import type { PrimmActivity } from "./primm.js";

/** Experimental activity payloads. These are not a second lesson/export schema. */
export const ACTIVITY_DIFFICULTIES = ["intro", "practice", "challenge"] as const;
export type ActivityDifficulty = (typeof ACTIVITY_DIFFICULTIES)[number];
export interface ActivityBase {
  readonly id: string;
  /** Task demand, independent from whether the host shows guidance. */
  readonly difficulty?: ActivityDifficulty;
  /**
   * Ties this activity to its other difficulty levels.
   *
   * Same family + same kind + different `difficulty` means one activity the
   * learner can move between, not three activities in a row. Without it a
   * lesson could only ever store one payload and a label, which is why the
   * three-level design existed for a year while only the play lab could reach
   * it: `selectActivityLevel` had no way to be given a lesson's levels.
   */
  readonly family?: string;
  readonly title: string;
  readonly brief: string;
  readonly goal: string;
  readonly takeaway: string;
  readonly hint: string;
  /** Optional complete UI copy for the same activity payload and identity. */
  readonly locales?: Readonly<
    Record<
      string,
      {
        readonly title?: string;
        readonly brief?: string;
        readonly goal?: string;
        readonly takeaway?: string;
        readonly hint?: string;
        readonly sourceLabel?: string;
        /** Exact original display text → translation; never IDs or rule values. */
        readonly strings?: Readonly<Record<string, string>>;
      }
    >
  >;
  /**
   * Where this activity's facts come from.
   *
   * A web address, or a place in the studied repository. It was a URL only,
   * and that quietly barred three quarters of the courses: fifteen of
   * browser-ai's twenty-one lessons cite a pinned file and line rather than a
   * page, because that is what an honest citation is when the subject is the
   * code in front of you. An activity for one of those lessons could not name
   * its own source without either inventing a link or borrowing an unrelated
   * one, so the field shape was deciding which lessons may have an activity.
   */
  readonly source:
    | { readonly label: string; readonly url: string }
    | {
        readonly label: string;
        readonly path: string;
        /**
         * `line` alone, or `line`–`lineEnd` for a span.
         *
         * The evidence an activity cites records `lineStart`/`lineEnd`, so a
         * citation that could hold only one number silently truncated every
         * span it was given to its first line — which for `App.jsx` lines 1–4
         * meant a receipt pointing at the React import while its label promised
         * three component imports. The url form could already write `#L1-L4`.
         */
        readonly line?: number;
        readonly lineEnd?: number;
        readonly commit?: string;
      };
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

export type LearningActivitySpec = ConnectActivity | SortActivity | TuneActivity | PrimmActivity;
export type ActivityKind = LearningActivitySpec["kind"];
export type ActivityFamily = {
  [K in ActivityKind]: {
    readonly id: string;
    readonly kind: K;
    readonly levels: Readonly<
      Record<ActivityDifficulty, Extract<LearningActivitySpec, { kind: K }>>
    >;
  };
}[ActivityKind];
export interface ActivityResult {
  readonly activityId: string;
  readonly kind: ActivityKind;
  readonly difficulty?: ActivityDifficulty;
  readonly occurrenceId?: string;
  readonly guidanceUsed?: boolean;
  readonly status: "completed" | "skipped";
  readonly attempts: number;
  readonly hintsUsed: number;
  readonly submission: Readonly<Record<string, unknown>>;
}
