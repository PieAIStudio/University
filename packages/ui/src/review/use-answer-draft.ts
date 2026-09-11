import { useCallback, useEffect, useRef, useState } from "react";

import {
  browserAnswerDraftStorage,
  readAnswerDraft,
  writeAnswerDraft,
  type AnswerDraftIdentity,
  type AnswerDraftStorage,
  type AnswerDraftWriteResult,
} from "./answer-draft.js";

export type AnswerDraftPersistenceState = "idle" | AnswerDraftWriteResult["status"];

export function useAnswerDraft(options: {
  readonly identity: AnswerDraftIdentity;
  readonly submittedAnswer: string;
  readonly submittedAt: string | null;
  readonly storage?: AnswerDraftStorage | null;
}) {
  const storageRef = useRef<AnswerDraftStorage | null>(
    options.storage === undefined ? browserAnswerDraftStorage() : options.storage,
  );
  const initialRef = useRef<ReturnType<typeof initialAnswer> | null>(null);
  initialRef.current ??= initialAnswer(options, storageRef.current);
  const initial = initialRef.current;
  const [answer, setAnswerState] = useState(initial.answer);
  const [persistence, setPersistence] = useState<AnswerDraftPersistenceState>(initial.persistence);
  const answerRef = useRef(answer);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const setAnswer = useCallback(
    (next: string) => {
      answerRef.current = next;
      setAnswerState(next);
      setPersistence(writeAnswerDraft(storageRef.current, options.identity, next).status);
    },
    [options.identity],
  );

  const markSubmitted = useCallback(
    (submitted: string) => {
      // The textarea is read-only while a request is pending, but keep this
      // comparison as a race guard for programmatic updates and future shells.
      if (!mounted.current || answerRef.current !== submitted) return;
      const stored = readAnswerDraft(storageRef.current, options.identity);
      // A different tab may have started a new answer while this request ran.
      // Its newer recovery text is not the response this request acknowledged.
      if (stored.status === "restored" && stored.answer !== submitted) return;
      setPersistence(writeAnswerDraft(storageRef.current, options.identity, "").status);
    },
    [options.identity],
  );

  const discardDraft = useCallback(
    (submitted: string) => {
      answerRef.current = submitted;
      setAnswerState(submitted);
      setPersistence(writeAnswerDraft(storageRef.current, options.identity, "").status);
    },
    [options.identity],
  );

  return { answer, setAnswer, persistence, markSubmitted, discardDraft } as const;
}

function initialAnswer(
  options: {
    readonly identity: AnswerDraftIdentity;
    readonly submittedAnswer: string;
    readonly submittedAt: string | null;
  },
  storage: AnswerDraftStorage | null,
): { readonly answer: string; readonly persistence: AnswerDraftPersistenceState } {
  const draft = readAnswerDraft(storage, options.identity);
  if (draft.status !== "restored") return { answer: options.submittedAnswer, persistence: "idle" };
  const submittedAt = options.submittedAt ? Date.parse(options.submittedAt) : Number.NaN;
  if (!Number.isFinite(submittedAt) || draft.updatedAt > submittedAt) {
    return { answer: draft.answer, persistence: "saved" };
  }
  // Reads during render stay pure. Old entries are ignored and expire on the
  // next explicit write; an interrupted render cannot destroy learner text.
  return { answer: options.submittedAnswer, persistence: "idle" };
}
