import { useEffect, useRef } from "react";
import type { PrimmStep } from "@pieai/university-core";
import { useI18n } from "../../i18n/index.js";
import { pointerDrag, stopCoach } from "../primm-coach.js";

export const DEMO_KINDS = new Set<PrimmStep["kind"]>(["send", "match", "sort", "build"]);

export function RunStatus({
  busy,
  error,
  onCancel,
  onRetry,
}: {
  readonly busy: boolean;
  readonly error: string;
  readonly onCancel: () => void;
  readonly onRetry: () => void;
}) {
  const { t } = useI18n();
  if (busy)
    return (
      <p className="primm-steps__status" role="status">
        {t("primm.steps.running")}
        <button type="button" className="primm-steps__link" onClick={onCancel}>
          {t("primm.steps.cancel")}
        </button>
      </p>
    );
  if (error)
    return (
      <p className="primm-steps__status" role="alert">
        {error}
        <button type="button" className="primm-steps__link" onClick={onRetry}>
          {t("primm.steps.retry")}
        </button>
      </p>
    );
  return null;
}

export function AttachTile({
  stepId,
  label,
  hint,
  url,
  onAttach,
}: {
  readonly stepId: string;
  readonly label: string;
  readonly hint: string;
  readonly url: string | undefined;
  readonly onAttach: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const attach = useRef(onAttach);
  attach.current = onAttach;
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    return pointerDrag(element, {
      targets: () => [...document.querySelectorAll<HTMLElement>(`[data-composer="${stepId}"]`)],
      onDrop: () => attach.current(),
      onStart: stopCoach,
    });
  }, [stepId]);
  return (
    <div className="primm-steps__tray">
      <button
        ref={ref}
        type="button"
        className="primm-steps__attach"
        data-guide="step-attach"
        data-attach={stepId}
        aria-label={label}
        title={hint}
        onClick={() => attach.current()}
      >
        {url ? <img src={url} alt="" /> : <span>{label}</span>}
      </button>
      <p className="primm-steps__hint">{hint}</p>
    </div>
  );
}

/** Seeded order, so a reload shows the same shuffle rather than a new puzzle. */
export function shuffled<T>(items: readonly T[], seed: string): T[] {
  let hash = [...seed].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7);
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    hash = (hash * 1103515245 + 12345) >>> 0;
    const other = hash % (index + 1);
    [copy[index], copy[other]] = [copy[other]!, copy[index]!];
  }
  if (copy.length > 1 && copy.every((item, index) => item === items[index]))
    copy.push(copy.shift()!);
  return copy;
}
