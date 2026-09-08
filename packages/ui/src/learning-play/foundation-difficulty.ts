import type {
  ActivityFamily,
  ConnectActivity,
  DispatchActivity,
  HuntActivity,
  NumericExpression,
  ProgramActivity,
  TuneActivity,
  BriefActivity,
  ActivityDifficulty,
} from "@pieai/university-core";
import { translate as t } from "../i18n/index.js";

type Foundation =
  | ConnectActivity
  | DispatchActivity
  | HuntActivity
  | ProgramActivity
  | TuneActivity
  | BriefActivity;
const tag = <T extends Foundation>(task: T, difficulty: ActivityDifficulty): T => ({
  ...task,
  id: `${task.id}:${difficulty}:v1`,
  difficulty,
});
const constantControl = (
  expression: NumericExpression,
  id: string,
  value: number,
): NumericExpression =>
  typeof expression === "number"
    ? expression
    : "control" in expression
      ? expression.control === id
        ? value
        : expression
      : { ...expression, args: expression.args.map((part) => constantControl(part, id, value)) };

/** Curated task differences. Engines do not inspect difficulty or apply numeric multipliers. */
export function getFoundationFamily(activity: Foundation): ActivityFamily {
  const goal = (level: ActivityDifficulty) => t(`play.difficulty.${activity.kind}.${level}`);
  switch (activity.kind) {
    case "connect": {
      const startNodes = activity.nodes.slice(0, 3);
      const retry = {
        id: "retry",
        label: t("play.difficulty.connect.retry"),
        note: t("play.difficulty.connect.retryNote"),
        x: 16,
        y: 50,
      };
      return {
        id: activity.id,
        kind: activity.kind,
        levels: {
          intro: tag(
            {
              ...activity,
              goal: goal("intro"),
              nodes: startNodes,
              edges: activity.edges.slice(0, 2),
              probes: [
                {
                  label: t("play.difficulty.connect.firstChain"),
                  path: startNodes.map((node) => node.id),
                },
              ],
            },
            "intro",
          ),
          practice: tag(activity, "practice"),
          challenge: tag(
            {
              ...activity,
              goal: goal("challenge"),
              nodes: [...activity.nodes, retry],
              edges: [
                ...activity.edges,
                { from: "f", to: "retry", why: t("play.difficulty.connect.retryWhy") },
                { from: "retry", to: "b", why: t("play.difficulty.connect.againWhy") },
              ],
              probes: [
                activity.probes[0]!,
                {
                  label: t("play.difficulty.connect.recovery"),
                  path: ["a", "b", "c", "d", "f", "retry", "b", "c", "d", "e"],
                },
              ],
            },
            "challenge",
          ),
        },
      };
    }
    case "tune": {
      const image = activity.visualization?.kind === "image-detail";
      const fixedId = image ? "quality" : "workers";
      const fixedValue = image ? 80 : 1;
      const intro: TuneActivity = {
        ...activity,
        goal: goal("intro"),
        controls: activity.controls.filter((control) => control.id !== fixedId),
        metrics: activity.metrics
          .filter((metric) => metric.id !== "time")
          .map((metric) => ({
            ...metric,
            expression: constantControl(metric.expression, fixedId, fixedValue),
            ...(metric.id === "output" ? { min: 12 } : {}),
          })),
      };
      const challenge: TuneActivity = image
        ? {
            ...activity,
            goal: goal("challenge"),
            metrics: [
              ...activity.metrics.filter((metric) => metric.id !== "time"),
              {
                id: "minimum-width",
                label: t("play.difficulty.tune.minimumWidth"),
                unit: " px",
                expression: { control: "width" },
                min: 1000,
                scale: 1600,
                precision: 0,
                explanation: t("play.difficulty.tune.widthWhy"),
              },
            ],
          }
        : {
            ...activity,
            goal: goal("challenge"),
            metrics: activity.metrics.map((metric) => ({
              ...metric,
              ...(metric.id === "output"
                ? { min: 30 }
                : metric.id === "wait"
                  ? { max: 0.5 }
                  : { max: 70 }),
            })),
          };
      return {
        id: activity.id,
        kind: activity.kind,
        levels: {
          intro: tag(intro, "intro"),
          practice: tag(activity, "practice"),
          challenge: tag(challenge, "challenge"),
        },
      };
    }
    case "hunt": {
      const boundary = activity.model === "clamp" ? 0 : activity.boundary;
      return {
        id: activity.id,
        kind: activity.kind,
        levels: {
          intro: tag(
            {
              ...activity,
              goal: goal("intro"),
              input: {
                ...activity.input,
                min: boundary - 2,
                max: boundary + 2,
                initial: boundary + 1,
              },
            },
            "intro",
          ),
          practice: tag(activity, "practice"),
          challenge: tag(
            { ...activity, goal: goal("challenge"), verifyBoundarySides: true },
            "challenge",
          ),
        },
      };
    }
    case "dispatch": {
      const first = activity.cards[0]!;
      const fresh = activity.cards.find((card) => !card.cacheKey)!;
      const regularLane = activity.lanes
        .filter((lane) => first.allowedLaneIds.includes(lane.id))
        .sort((a, b) => a.cost - b.cost)[0]!;
      const freshCost = Math.min(
        ...activity.lanes
          .filter((lane) => fresh.allowedLaneIds.includes(lane.id))
          .map((lane) => lane.cost),
      );
      const revised = {
        ...first,
        id: `${first.id}-revision`,
        label: t("play.difficulty.dispatch.revised", { name: first.label }),
        detail: t("play.difficulty.dispatch.newVersion"),
        cacheKey: `${first.cacheKey}-revised`,
      };
      return {
        id: activity.id,
        kind: activity.kind,
        levels: {
          intro: tag(
            {
              ...activity,
              goal: goal("intro"),
              cards: [first, fresh, { ...first, id: `${first.id}-again` }],
              budget: regularLane.cost + freshCost,
            },
            "intro",
          ),
          practice: tag(activity, "practice"),
          challenge: tag(
            {
              ...activity,
              goal: goal("challenge"),
              cards: [
                ...activity.cards,
                revised,
                { ...fresh, id: `${fresh.id}-again` },
                { ...revised, id: `${revised.id}-again` },
                { ...first, id: `${first.id}-original-return` },
              ],
              budget: activity.budget + regularLane.cost + freshCost,
            },
            "challenge",
          ),
        },
      };
    }
    case "program": {
      const north = activity.start.direction === "north";
      const firstGoal = north ? { x: 0, y: 2 } : { x: 2, y: 4 };
      return {
        id: activity.id,
        kind: activity.kind,
        levels: {
          intro: tag(
            {
              ...activity,
              goal: goal("intro"),
              goalCell: firstGoal,
              checkpoints: [],
              maxCommands: 3,
            },
            "intro",
          ),
          practice: tag(activity, "practice"),
          challenge: tag(
            {
              ...activity,
              goal: goal("challenge"),
              checkpoints: [...activity.checkpoints, north ? { x: 4, y: 4 } : { x: 2, y: 0 }],
              maxCommands: north ? 7 : 9,
            },
            "challenge",
          ),
        },
      };
    }
    case "ai-brief": {
      const intro: BriefActivity = {
        ...activity,
        goal: goal("intro"),
        followUp: undefined,
        initialChoices: {
          confirmation: activity.target.confirmation,
          roster: activity.target.roster,
        },
      };
      return {
        id: activity.id,
        kind: activity.kind,
        levels: {
          intro: tag(intro, "intro"),
          practice: tag({ ...activity, goal: goal("practice"), followUp: undefined }, "practice"),
          challenge: tag({ ...activity, goal: goal("challenge") }, "challenge"),
        },
      };
    }
  }
}
