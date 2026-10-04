import type {
  ActivityDifficulty,
  ActivityFamily,
  ConnectActivity,
  NumericExpression,
  TuneActivity,
} from "@pieai/university-core";
import { interfaceTranslator } from "../i18n/index.js";

type Foundation = ConnectActivity | TuneActivity;
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

/** Curated task differences for the retained connect and tune boards. */
export function getFoundationFamily(activity: Foundation): ActivityFamily {
  const goal = (level: ActivityDifficulty) =>
    interfaceTranslator.t(`play.difficulty.${activity.kind}.${level}`);
  switch (activity.kind) {
    case "connect": {
      const startNodes = activity.nodes.slice(0, 3);
      const retry = {
        id: "retry",
        label: interfaceTranslator.t("play.difficulty.connect.retry"),
        note: interfaceTranslator.t("play.difficulty.connect.retryNote"),
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
                  label: interfaceTranslator.t("play.difficulty.connect.firstChain"),
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
                {
                  from: "f",
                  to: "retry",
                  why: interfaceTranslator.t("play.difficulty.connect.retryWhy"),
                },
                {
                  from: "retry",
                  to: "b",
                  why: interfaceTranslator.t("play.difficulty.connect.againWhy"),
                },
              ],
              probes: [
                activity.probes[0]!,
                {
                  label: interfaceTranslator.t("play.difficulty.connect.recovery"),
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
                label: interfaceTranslator.t("play.difficulty.tune.minimumWidth"),
                unit: " px",
                expression: { control: "width" },
                min: 1000,
                scale: 1600,
                precision: 0,
                explanation: interfaceTranslator.t("play.difficulty.tune.widthWhy"),
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
  }
}
