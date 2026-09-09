import type { ConnectActivity, NumericExpression, TuneActivity } from "@pieai/university-core";
import { translate as t } from "../i18n/index.js";

const value = (control: string): NumericExpression => ({ control });
const product = (...args: NumericExpression[]): NumericExpression => ({ op: "product", args });

export function getBaseExamples(): readonly (ConnectActivity | TuneActivity)[] {
  const positions = [
    [16, 25],
    [50, 25],
    [84, 25],
    [50, 75],
    [84, 75],
    [16, 75],
  ] as const;
  const links = [
    ["a", "b"],
    ["b", "c"],
    ["c", "d"],
    ["d", "e"],
    ["d", "f"],
  ] as const;
  const graphs = (["web", "film"] as const).map(
    (topic): ConnectActivity => ({
      id: `connect-${topic}`,
      kind: "connect",
      title: t(`play.connect.${topic}.title`),
      brief: t(`play.connect.${topic}.brief`),
      goal: t(`play.connect.${topic}.goal`),
      takeaway: t(`play.connect.${topic}.takeaway`),
      hint: t(`play.connect.${topic}.hint`),
      source:
        topic === "web"
          ? {
              label: t("play.connect.source"),
              url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview",
            }
          : {
              label: t("play.connect.film.source"),
              url: "https://docs.blender.org/manual/en/latest/editors/video_sequencer/index.html",
            },
      nodes: (["a", "b", "c", "d", "e", "f"] as const).map((id, index) => ({
        id,
        label: t(`play.connect.${topic}.${id}`),
        note: t(`play.connect.${topic}.${id}n`),
        x: positions[index]![0],
        y: positions[index]![1],
      })),
      edges: links.map(([from, to], index) => ({
        from,
        to,
        why: t(`play.connect.${topic}.${(["ab", "bc", "cd", "de", "df"] as const)[index]!}`),
      })),
      probes: [
        { label: t(`play.connect.${topic}.ok`), path: ["a", "b", "c", "d", "e"] },
        { label: t(`play.connect.${topic}.fail`), path: ["a", "b", "c", "d", "f"] },
      ],
    }),
  );
  const size = product(180, value("width"), 0.001, value("width"), 0.001, value("quality"), 0.0125);
  const image: TuneActivity = {
    id: "tune-image",
    kind: "tune",
    visualization: { kind: "image-detail", detailMetric: "sharpness" },
    title: t("play.tune.image.title"),
    brief: t("play.tune.image.brief"),
    goal: t("play.tune.image.goal"),
    takeaway: t("play.tune.image.takeaway"),
    hint: t("play.tune.image.hint"),
    source: {
      label: t("play.tune.image.source"),
      url: "https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Performance/Multimedia",
    },
    controls: [
      { id: "width", label: t("play.tune.width"), unit: " px", min: 400, max: 1600, initial: 1400 },
      { id: "quality", label: t("play.tune.quality"), unit: "%", min: 30, max: 95, initial: 90 },
    ],
    metrics: [
      {
        id: "size",
        label: t("play.tune.size"),
        unit: " KB",
        expression: size,
        max: 150,
        scale: 550,
        precision: 0,
        explanation: t("play.tune.image.sizeWhy"),
      },
      {
        id: "time",
        label: t("play.tune.time"),
        unit: " s",
        expression: product(size, 0.008),
        max: 1.2,
        scale: 4.4,
        precision: 2,
        explanation: t("play.tune.image.timeWhy"),
      },
      {
        id: "sharpness",
        label: t("play.tune.sharpness"),
        unit: t("play.tune.points"),
        expression: { op: "min", args: [100, product(value("width"), 0.001, value("quality"))] },
        min: 65,
        scale: 100,
        precision: 0,
        explanation: t("play.tune.image.sharpWhy"),
      },
    ],
    modelNote: t("play.tune.image.model"),
  };
  const batch: TuneActivity = {
    id: "tune-batch",
    kind: "tune",
    visualization: { kind: "work-queue", batchControl: "batch", workersControl: "workers" },
    title: t("play.tune.batch.title"),
    brief: t("play.tune.batch.brief"),
    goal: t("play.tune.batch.goal"),
    takeaway: t("play.tune.batch.takeaway"),
    hint: t("play.tune.batch.hint"),
    source: {
      label: t("play.tune.batch.source"),
      url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Execution_model",
    },
    controls: [
      {
        id: "batch",
        label: t("play.tune.batch"),
        unit: t("play.tune.items"),
        min: 1,
        max: 10,
        initial: 2,
      },
      {
        id: "workers",
        label: t("play.tune.workers"),
        unit: t("play.tune.items"),
        min: 1,
        max: 8,
        initial: 1,
      },
    ],
    metrics: [
      {
        id: "output",
        label: t("play.tune.throughput"),
        unit: t("play.tune.perSecond"),
        expression: product(value("batch"), value("workers"), 2),
        min: 24,
        scale: 160,
        precision: 0,
        explanation: t("play.tune.batch.outputWhy"),
      },
      {
        id: "wait",
        label: t("play.tune.wait"),
        unit: " s",
        expression: product(value("batch"), 0.1),
        max: 0.6,
        scale: 1,
        precision: 1,
        explanation: t("play.tune.batch.waitWhy"),
      },
      {
        id: "memory",
        label: t("play.tune.memory"),
        unit: " MB",
        expression: {
          op: "sum",
          args: [product(value("workers"), 12), product(value("batch"), value("workers"), 2)],
        },
        max: 80,
        scale: 256,
        precision: 0,
        explanation: t("play.tune.batch.memoryWhy"),
      },
    ],
    modelNote: t("play.tune.batch.model"),
  };
  return [...graphs, image, batch];
}
