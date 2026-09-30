import { useI18n } from "@pieai/university-ui/i18n.js";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

import { FirstUseGuide, useFirstUse, type GuideStep } from "./FirstUseGuide.js";

/**
 * First-use guides for a lesson's interaction components (Owner 2026-09-30):
 * the first time a learner meets each kind of step, 涟 points at where to look
 * and what to use — never at the answer.
 *
 * The lesson reader already says which kind of step is on screen
 * (`data-step-kind` on its current step) and marks the places a guide may
 * point at (`data-guide`). This watches for the kind to change — a DOM
 * observation, no polling — so the reader needs no guide-shaped props.
 */
const KINDS = ["choose", "send", "find", "match", "sort", "point", "build", "make"] as const;
type StepKind = (typeof KINDS)[number];

function useSteps(): Record<StepKind, readonly GuideStep[]> {
  const { t } = useI18n();
  return useMemo(
    () => ({
      choose: [
        { target: "step-title", say: t("guide.step.choose.title") },
        { target: "step-options", say: t("guide.step.choose.options") },
      ],
      send: [
        { target: "step-title", say: t("guide.step.send.title") },
        { target: "step-attach", say: t("guide.step.send.attach"), act: true },
        { target: "step-send", say: t("guide.step.send.send"), act: true },
      ],
      find: [
        { target: "step-title", say: t("guide.step.find.title") },
        { target: "step-sentences", say: t("guide.step.find.sentences") },
      ],
      match: [
        { target: "step-title", say: t("guide.step.match.title") },
        { target: "step-match", say: t("guide.step.match.answers") },
      ],
      sort: [
        { target: "step-card", say: t("guide.step.sort.card") },
        { target: "step-buckets", say: t("guide.step.sort.buckets") },
      ],
      point: [
        { target: "step-title", say: t("guide.step.point.title") },
        { target: "step-point", say: t("guide.step.point.image") },
      ],
      build: [
        { target: "step-tiles", say: t("guide.step.build.tiles") },
        { target: "step-line", say: t("guide.step.build.line") },
      ],
      make: [
        { target: "step-title", say: t("guide.step.make.title") },
        { target: "step-make", say: t("guide.step.make.write") },
      ],
    }),
    [t],
  );
}

const isKind = (value: string | null | undefined): value is StepKind =>
  (KINDS as readonly string[]).includes(value ?? "");

export function LessonFirstUse({ root }: { root: RefObject<HTMLElement | null> }) {
  const steps = useSteps();
  const [kind, setKind] = useState<StepKind | null>(null);
  const section = useRef<HTMLElement | null>(null);
  const [key, setKey] = useState(0);

  useEffect(() => {
    const host = root.current;
    if (!host) return;
    const read = () => {
      const current = host.querySelector<HTMLElement>(".primm-steps__step[data-step-kind]");
      const next = current?.getAttribute("data-step-kind");
      if (current === section.current) return;
      section.current = current;
      setKind(isKind(next) ? next : null);
      setKey((n) => n + 1);
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(host, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [root]);

  const firstUse = useFirstUse(kind ? `step:${kind}` : null);
  if (!kind || !firstUse.needed) return null;
  // The send step's attachment is gone once attached; guide what is there.
  const available = steps[kind].filter(
    (step) => section.current?.querySelector(`[data-guide="${step.target}"]`) !== null,
  );
  if (available.length < 2) return null;
  return (
    <FirstUseGuide
      key={`${kind}:${key}`}
      id={`step:${kind}`}
      steps={available}
      root={section}
      placement="page"
      onDone={firstUse.finish}
    />
  );
}
