import { translate } from "../i18n/index.js";
import { useCallback, useEffect, useState } from "react";
import { GameBadge, GameButton, GamePanel } from "@pieai/swimmer-ui-kit";

import { readJson } from "../api/client.js";
import type { LexiconEntry } from "../language/WordPopover.js";
import type { VocabularyDueWord, VocabularyReviewPort } from "./ports.js";

type DueWord = VocabularyDueWord & { readonly entry: LexiconEntry };

/**
 * The review queue for words the learner asked to be asked about.
 *
 * Without it the English layer is a trap door: marking a word 「不熟」 puts it on
 * a schedule that nothing ever reads, so the promise to come back is silently
 * broken. Recall is deliberately self-reported rather than typed — the claim
 * being tested is "do I know this word", and typing it out tests spelling.
 */
export function VocabularyReview({
  requestToken,
  review,
}: {
  readonly requestToken?: string;
  readonly review?: VocabularyReviewPort;
}) {
  const [due, setDue] = useState<readonly DueWord[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewedToday, setReviewedToday] = useState(0);

  const load = useCallback(async () => {
    try {
      if (review) {
        const body = await review.load();
        setDue(body.due);
        setReviewedToday(body.reviewedToday);
      } else {
        if (!requestToken) return;
        const body = await readJson<{
          readonly due: readonly DueWord[];
          readonly budget: { readonly reviewedToday: number };
        }>(await fetch("/api/vocabulary"));
        setDue(body.due);
        setReviewedToday(body.budget.reviewedToday);
      }
    } catch {
      // A learner without a vocabulary database yet simply has nothing due;
      // that is not a failure worth interrupting the day with.
      setDue([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const word = due[0];
  if (!word) return null;

  async function rate(rating: 1 | 2 | 3 | 4) {
    setPending(true);
    setError(null);
    try {
      if (review) {
        await review.rate(word.senseId, rating);
      } else {
        if (!requestToken)
          throw new Error(translate("ui.review.vocabularyReview.copy.生词复习服务尚未接通"));
        await readJson(
          await fetch(`/api/vocabulary/${encodeURIComponent(word!.senseId)}/grade`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-University-Local-Token": requestToken,
            },
            body: JSON.stringify({ rating }),
          }),
        );
      }
      setRevealed(false);
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : translate("ui.review.vocabularyReview.copy.评分失败"),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <GamePanel className="vocab-review" tone="strong">
      <header className="vocab-review__header">
        <div>
          <p className="eyebrow">
            {translate("ui.review.vocabularyReview.copy.生词")} {due.length}{" "}
            {translate("ui.review.vocabularyReview.copy.个待复习")}
          </p>
          <h2 lang="en">{word.entry.headword}</h2>
          <p className="vocab-review__phonetic">{word.entry.phonetic}</p>
        </div>
        <GameBadge tone={word.stage === "learning" ? "warning" : "success"}>
          {word.stage === "learning"
            ? translate("ui.review.vocabularyReview.copy.还不熟")
            : translate("ui.review.vocabularyReview.copy.复习中")}
        </GameBadge>
      </header>
      {revealed ? (
        <div className="vocab-review__answer" aria-live="polite">
          <p className="vocab-review__gloss">{word.entry.gloss}</p>
          <p className="vocab-review__usage">{word.entry.usage}</p>
          <div
            className="rating-row"
            aria-label={translate("ui.review.vocabularyReview.copy.根据回忆难度评分")}
          >
            <GameButton variant="danger" onClick={() => void rate(1)} disabled={pending}>
              {translate("ui.review.vocabularyReview.copy.没想起来")}
            </GameButton>
            <GameButton variant="ghost" onClick={() => void rate(2)} disabled={pending}>
              {translate("ui.review.vocabularyReview.copy.勉强想起")}
            </GameButton>
            <GameButton variant="secondary" onClick={() => void rate(3)} disabled={pending}>
              {translate("ui.review.vocabularyReview.copy.想起来了")}
            </GameButton>
            <GameButton variant="success" onClick={() => void rate(4)} disabled={pending}>
              {translate("ui.review.vocabularyReview.copy.一眼就懂")}
            </GameButton>
          </div>
        </div>
      ) : (
        <GameButton variant="primary" onClick={() => setRevealed(true)}>
          {translate("ui.review.vocabularyReview.copy.我想好了-看释义")}
        </GameButton>
      )}
      <p className="vocab-review__meta">
        {translate("ui.review.vocabularyReview.copy.今天已复习")} {reviewedToday}{" "}
        {translate("ui.review.vocabularyReview.copy.个词")}
      </p>
      {error ? (
        <p className="inline-error" role="alert">
          {error}
        </p>
      ) : null}
    </GamePanel>
  );
}
