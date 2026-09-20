import { useCallback, useMemo, useRef, useState } from "react";
import type { LessonRef } from "@pieai/university-core";
import { useAnswerDraft } from "../review/use-answer-draft.js";

/** Reuses identity-scoped answer recovery. This is a local in-progress draft,
 * not a second account progress or review store. */
export function useSessionDraft<T>(options: {
  accountScope: string;
  locator: LessonRef;
  key: string;
  initial: T;
  restore: (value: unknown) => T | null;
}) {
  const identity = useMemo(
    () => ({
      accountScope: options.accountScope,
      locator: options.locator,
      exerciseId: options.key,
      contentRevision: 1,
    }),
    [options.accountScope, options.locator, options.key],
  );
  const draft = useAnswerDraft({ identity, submittedAnswer: "", submittedAt: null });
  const [state, setState] = useState<T>(() => {
    try {
      return options.restore(JSON.parse(draft.answer)) ?? options.initial;
    } catch {
      return options.initial;
    }
  });
  const ref = useRef(state);
  const update = useCallback(
    (value: T | ((current: T) => T)) => {
      const next = typeof value === "function" ? (value as (current: T) => T)(ref.current) : value;
      ref.current = next;
      setState(next);
      draft.setAnswer(JSON.stringify(next));
    },
    [draft.setAnswer],
  );
  return { state, update, ref, persistence: draft.persistence };
}
