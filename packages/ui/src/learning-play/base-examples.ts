import type { ConnectActivity, NumericExpression, TuneActivity } from "@pieai/university-core";
import { interfaceTranslator } from "../i18n/index.js";

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
      title: interfaceTranslator.t(`play.connect.${topic}.title`),
      brief: interfaceTranslator.t(`play.connect.${topic}.brief`),
      goal: interfaceTranslator.t(`play.connect.${topic}.goal`),
      takeaway: interfaceTranslator.t(`play.connect.${topic}.takeaway`),
      hint: interfaceTranslator.t(`play.connect.${topic}.hint`),
      source:
        topic === "web"
          ? {
              label: interfaceTranslator.t("play.connect.source"),
              url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview",
            }
          : {
              label: interfaceTranslator.t("play.connect.film.source"),
              url: "https://docs.blender.org/manual/en/latest/editors/video_sequencer/index.html",
            },
      nodes: (["a", "b", "c", "d", "e", "f"] as const).map((id, index) => ({
        id,
        label: interfaceTranslator.t(`play.connect.${topic}.${id}`),
        note: interfaceTranslator.t(`play.connect.${topic}.${id}n`),
        x: positions[index]![0],
        y: positions[index]![1],
      })),
      edges: links.map(([from, to], index) => ({
        from,
        to,
        why: interfaceTranslator.t(
          `play.connect.${topic}.${(["ab", "bc", "cd", "de", "df"] as const)[index]!}`,
        ),
      })),
      probes: [
        {
          label: interfaceTranslator.t(`play.connect.${topic}.ok`),
          path: ["a", "b", "c", "d", "e"],
        },
        {
          label: interfaceTranslator.t(`play.connect.${topic}.fail`),
          path: ["a", "b", "c", "d", "f"],
        },
      ],
    }),
  );
  const size = product(180, value("width"), 0.001, value("width"), 0.001, value("quality"), 0.0125);
  const image: TuneActivity = {
    id: "tune-image",
    kind: "tune",
    visualization: { kind: "image-detail", detailMetric: "sharpness" },
    title: interfaceTranslator.t("play.tune.image.title"),
    brief: interfaceTranslator.t("play.tune.image.brief"),
    goal: interfaceTranslator.t("play.tune.image.goal"),
    takeaway: interfaceTranslator.t("play.tune.image.takeaway"),
    hint: interfaceTranslator.t("play.tune.image.hint"),
    source: {
      label: interfaceTranslator.t("play.tune.image.source"),
      url: "https://developer.mozilla.org/en-US/docs/Learn_web_development/Extensions/Performance/Multimedia",
    },
    controls: [
      {
        id: "width",
        label: interfaceTranslator.t("play.tune.width"),
        unit: " px",
        min: 400,
        max: 1600,
        initial: 1400,
      },
      {
        id: "quality",
        label: interfaceTranslator.t("play.tune.quality"),
        unit: "%",
        min: 30,
        max: 95,
        initial: 90,
      },
    ],
    metrics: [
      {
        id: "size",
        label: interfaceTranslator.t("play.tune.size"),
        unit: " KB",
        expression: size,
        max: 150,
        scale: 550,
        precision: 0,
        explanation: interfaceTranslator.t("play.tune.image.sizeWhy"),
      },
      {
        id: "time",
        label: interfaceTranslator.t("play.tune.time"),
        unit: " s",
        expression: product(size, 0.008),
        max: 1.2,
        scale: 4.4,
        precision: 2,
        explanation: interfaceTranslator.t("play.tune.image.timeWhy"),
      },
      {
        id: "sharpness",
        label: interfaceTranslator.t("play.tune.sharpness"),
        unit: interfaceTranslator.t("play.tune.points"),
        expression: { op: "min", args: [100, product(value("width"), 0.001, value("quality"))] },
        min: 65,
        scale: 100,
        precision: 0,
        explanation: interfaceTranslator.t("play.tune.image.sharpWhy"),
      },
    ],
    modelNote: interfaceTranslator.t("play.tune.image.model"),
  };
  const batch: TuneActivity = {
    id: "tune-batch",
    kind: "tune",
    visualization: { kind: "work-queue", batchControl: "batch", workersControl: "workers" },
    title: interfaceTranslator.t("play.tune.batch.title"),
    brief: interfaceTranslator.t("play.tune.batch.brief"),
    goal: interfaceTranslator.t("play.tune.batch.goal"),
    takeaway: interfaceTranslator.t("play.tune.batch.takeaway"),
    hint: interfaceTranslator.t("play.tune.batch.hint"),
    source: {
      label: interfaceTranslator.t("play.tune.batch.source"),
      url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Execution_model",
    },
    controls: [
      {
        id: "batch",
        label: interfaceTranslator.t("play.tune.batch"),
        unit: interfaceTranslator.t("play.tune.items"),
        min: 1,
        max: 10,
        initial: 2,
      },
      {
        id: "workers",
        label: interfaceTranslator.t("play.tune.workers"),
        unit: interfaceTranslator.t("play.tune.items"),
        min: 1,
        max: 8,
        initial: 1,
      },
    ],
    metrics: [
      {
        id: "output",
        label: interfaceTranslator.t("play.tune.throughput"),
        unit: interfaceTranslator.t("play.tune.perSecond"),
        expression: product(value("batch"), value("workers"), 2),
        min: 24,
        scale: 160,
        precision: 0,
        explanation: interfaceTranslator.t("play.tune.batch.outputWhy"),
      },
      {
        id: "wait",
        label: interfaceTranslator.t("play.tune.wait"),
        unit: " s",
        expression: product(value("batch"), 0.1),
        max: 0.6,
        scale: 1,
        precision: 1,
        explanation: interfaceTranslator.t("play.tune.batch.waitWhy"),
      },
      {
        id: "memory",
        label: interfaceTranslator.t("play.tune.memory"),
        unit: " MB",
        expression: {
          op: "sum",
          args: [product(value("workers"), 12), product(value("batch"), value("workers"), 2)],
        },
        max: 80,
        scale: 256,
        precision: 0,
        explanation: interfaceTranslator.t("play.tune.batch.memoryWhy"),
      },
    ],
    modelNote: interfaceTranslator.t("play.tune.batch.model"),
  };
  return [...graphs, image, batch];
}
