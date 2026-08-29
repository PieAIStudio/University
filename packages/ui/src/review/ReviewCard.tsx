import { useEffect, useRef, useState } from "react";
import { playSound } from "../sound/index.js";
import { GameBadge, GameButton, GameCallout, GamePanel } from "@pieai/swimmer-ui-kit";

import { MarkdownContent } from "../markdown/MarkdownContent.js";
import { Tip } from "../Tip.js";
import {
  STALE_TOKEN_NOTICE,
  cardActionPath,
  isStaleTokenFailure,
  readJson,
  reviewCardIdentity,
} from "../api/client.js";
import type { PriorAttempt, ReviewCardLocator } from "../view/lesson-view.js";
import {
  buildCardCoachingPacket,
  buildCardRevealPayload,
  createRetrievalAttemptDraft,
} from "../view/lesson-view.js";
import type { ReviewCardPort, ReviewRatingPreview } from "./ports.js";
import { reviewIntervalLabel } from "./review-interval.js";

export function ReviewCard({
  card,
  requestToken,
  review,
  onReviewed,
  remaining,
}: {
  readonly card: ReviewCardLocator;
  /** Required only for the local HTTP fallback. Online injects a cloud port. */
  readonly requestToken?: string;
  readonly review?: ReviewCardPort;
  readonly onReviewed: () => Promise<void>;
  /**
   * How many cards are still due today, this one included.
   *
   * The queue has always advanced one card at a time — rating this one loads
   * the next in its place. Nothing said so, so a learner looking at a card and
   * a "4 due" metric on the other side of the page could only conclude the
   * other three were unreachable.
   */
  readonly remaining?: number;
}) {
  const [answer, setAnswer] = useState("");
  const [back, setBack] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [nextDue, setNextDue] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealFailed, setRevealFailed] = useState(false);
  const [retrievalDraft, setRetrievalDraft] = useState(createRetrievalAttemptDraft);
  /**
   * Earlier answers to this card, and the reason the box above stays empty.
   *
   * Every answer typed here has always been stored; none of it was ever read
   * back, so the learner had no way to tell "saved" from "gone". The fix is not
   * to refill the box — a card whose answer is already in it on the next review
   * is not a card, it is a page of notes. The history arrives with the reveal
   * and is shown next to the reference answer, where seeing that last month you
   * wrote something vaguer is the useful part.
   */
  const [priorAttempts, setPriorAttempts] = useState<readonly PriorAttempt[]>([]);
  const [coachCopied, setCoachCopied] = useState(false);
  const cardIdentity = reviewCardIdentity(card);
  const previousCardIdentity = useRef(cardIdentity);

  useEffect(() => {
    if (previousCardIdentity.current === cardIdentity) return;
    previousCardIdentity.current = cardIdentity;
    setAnswer("");
    setBack(null);
    setRevealed(false);
    setNextDue(null);
    setError(null);
    setRevealFailed(false);
    setPriorAttempts([]);
    setCoachCopied(false);
    setRetrievalDraft(createRetrievalAttemptDraft());
  }, [cardIdentity]);

  async function post(path: string, body: unknown) {
    if (!requestToken) throw new Error("复习服务尚未接通");
    return fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-University-Local-Token": requestToken,
      },
      body: JSON.stringify(body),
    });
  }

  async function reveal() {
    setPending(true);
    setError(null);
    try {
      const result = review
        ? await review.reveal(card, {
            commandId: retrievalDraft.commandId,
            contentRevision: card.contentRevision,
            answer,
            startedAt: retrievalDraft.startedAt,
          })
        : await readJson<{
            readonly back: string | null;
            readonly priorAttempts?: readonly PriorAttempt[];
          }>(
            await post(
              cardActionPath(card, "reveal"),
              buildCardRevealPayload(retrievalDraft, card.contentRevision, answer),
            ),
          );
      setBack(result.back);
      setRevealed(true);
      setPriorAttempts(result.priorAttempts ?? []);
      setRevealFailed(false);
      setRetrievalDraft(createRetrievalAttemptDraft());
    } catch (reason) {
      // The answer field stays editable on failure. Locking it on *attempt*
      // used to strand the learner: a 409 revision conflict disabled the
      // field and every retry replayed the same stale contentRevision.
      const message = reason instanceof Error ? reason.message : "暂时无法揭示答案";
      setRevealFailed(true);
      setError(isStaleTokenFailure(message) ? STALE_TOKEN_NOTICE : message);
      if (isStaleTokenFailure(message)) {
        await onReviewed().catch(() => undefined);
      }
      if (/revision/i.test(message)) {
        // Card content moved underneath us; pull the fresh revision so the
        // retry has something valid to send.
        await onReviewed().catch(() => undefined);
      }
    } finally {
      setPending(false);
    }
  }

  async function rate(rating: 1 | 2 | 3 | 4) {
    setPending(true);
    setError(null);
    try {
      const result = review
        ? await review.rate(card, rating)
        : await readJson<{ readonly state: { readonly dueAt: string } }>(
            await post(cardActionPath(card, "review"), {
              commandId: crypto.randomUUID(),
              contentRevision: card.contentRevision,
              rating,
            }),
          ).then((body) => body.state);
      setNextDue(result.dueAt);
      // After the grade is committed, never before: a sound that fires on the
      // click and then the save fails has told the learner something untrue.
      playSound("review.graded");
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "暂时无法保存复习结果";
      setError(isStaleTokenFailure(message) ? STALE_TOKEN_NOTICE : message);
      if (isStaleTokenFailure(message)) await onReviewed().catch(() => undefined);
      setPending(false);
      return;
    }
    // The grade is committed at this point. A failure refreshing the rest of
    // the campus must not be reported as "the grade was not saved".
    try {
      await onReviewed();
    } catch {
      setError("评分已保存，但界面没能刷新，请重新加载页面。");
    } finally {
      setPending(false);
    }
  }

  const isRecap = card.kind === "recap-card";
  const ratingPreview =
    revealed && nextDue === null && review && card.kind !== "knowledge-card"
      ? review.preview(card)
      : null;
  const ratingLabel = (rating: keyof ReviewRatingPreview, label: string): string => {
    const interval = ratingPreview?.[rating];
    return interval === undefined ? label : `${label} · ${reviewIntervalLabel(interval)}`;
  };

  return (
    <GamePanel className="review-card" tone="strong">
      <div className="panel-heading">
        <div>
          {isRecap ? (
            <h2>讲一遍</h2>
          ) : (
            <Tip term="retrieval-practice">
              <h2>通过答题复习</h2>
            </Tip>
          )}
          {remaining !== undefined && remaining > 1 ? (
            <p className="review-card__queue">
              今天还剩 <strong>{remaining}</strong> 张 · 评分后自动换下一张
            </p>
          ) : null}
        </div>
        <Tip term="fsrs">
          <GameBadge tone="ai">FSRS</GameBadge>
        </Tip>
      </div>
      <p className="review-card__question">
        <MarkdownContent inline>{card.front}</MarkdownContent>
      </p>
      {isRecap ? (
        <p className="review-card__instruction">请用自己的话，讲给一个完全不知道这件事的人听。</p>
      ) : null}
      <label className="answer-field">
        <span>{isRecap ? "这次复述" : "你的回答"}</span>
        <textarea
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          disabled={pending || revealed || nextDue !== null}
          placeholder={isRecap ? "在这里写你的复述……" : "先写下自己的答案；非空后才能揭示。"}
          rows={4}
        />
      </label>
      {!revealed ? (
        <GameButton
          variant="primary"
          onClick={() => void reveal()}
          disabled={!answer.trim() || pending}
        >
          {pending
            ? isRecap
              ? "正在记录…"
              : "正在核对…"
            : isRecap
              ? revealFailed
                ? "重试查看"
                : "查看以前的复述"
              : revealFailed
                ? "重试揭示"
                : "揭示答案"}
        </GameButton>
      ) : (
        <div
          className={`answer-reveal${isRecap ? " answer-reveal--recap" : ""}`}
          aria-live="polite"
        >
          {isRecap ? (
            <div className="recap-review__comparison" aria-label="本次与以前的复述">
              <div className="recap-review__answer">
                <p className="eyebrow">这次复述</p>
                <p>{answer}</p>
              </div>
              <div className="recap-review__answer">
                <p className="eyebrow">以前的复述（{priorAttempts.length} 次）</p>
                {priorAttempts.length > 0 ? (
                  <ul className="recap-review__history">
                    {priorAttempts.map((attempt) => (
                      <li key={`${attempt.revealedAt}:${attempt.answer}`}>
                        <time dateTime={attempt.revealedAt}>
                          {new Date(attempt.revealedAt).toLocaleDateString("zh-CN")}
                        </time>
                        <span>{attempt.answer}</span>
                        {attempt.contentRevision !== card.contentRevision ? (
                          // The card has been rewritten since. The old answer is
                          // still real history, but it answered a different card.
                          <small>答的是旧版</small>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>还没有更早的复述。</p>
                )}
              </div>
            </div>
          ) : (
            <>
              <p className="eyebrow">参考答案</p>
              <div className="answer-reveal__body">
                <MarkdownContent>{back ?? ""}</MarkdownContent>
              </div>
              {priorAttempts.length > 0 ? (
                <div className="answer-history">
                  <p className="eyebrow">你以前答过 {priorAttempts.length} 次</p>
                  <ul>
                    {priorAttempts.map((attempt) => (
                      <li key={`${attempt.revealedAt}:${attempt.answer}`}>
                        <time dateTime={attempt.revealedAt}>
                          {new Date(attempt.revealedAt).toLocaleDateString("zh-CN")}
                        </time>
                        <span>{attempt.answer}</span>
                        {attempt.contentRevision !== card.contentRevision ? (
                          // The card has been rewritten since. The old answer is
                          // still real history, but it answered a different card.
                          <small>答的是旧版</small>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="answer-reveal__coach">
                <GameButton
                  variant="ghost"
                  onClick={() => {
                    void navigator.clipboard
                      ?.writeText(
                        buildCardCoachingPacket({
                          front: card.front,
                          back: back ?? "",
                          answer,
                          priorAttempts,
                        }),
                      )
                      .then(() => setCoachCopied(true))
                      .catch(() => setError("复制失败，剪贴板不可用"));
                  }}
                >
                  {coachCopied ? "已复制讲解包" : "让 AI 讲讲这张卡"}
                </GameButton>
                {coachCopied ? (
                  <span className="answer-reveal__coach-hint">
                    贴到任意 AI 宿主。它只负责讲解 —— 下面这四个按钮问的是「你回忆得费不费劲」，
                    只有你答得了。
                  </span>
                ) : null}
              </div>
            </>
          )}
          {nextDue ? (
            <GameCallout heading="复习结果已保存" tone="success">
              下一次安排：{new Date(nextDue).toLocaleString("zh-CN")}
            </GameCallout>
          ) : (
            <div className="rating-row" aria-label="根据回忆难度评分">
              <Tip term={isRecap ? "review-rating-recap" : "review-rating"}>
                <span className="rating-row__help" aria-hidden="true">
                  这四个按钮是什么意思？
                </span>
              </Tip>
              <GameButton variant="danger" onClick={() => void rate(1)} disabled={pending}>
                {ratingLabel("again", "重来")}
              </GameButton>
              <GameButton variant="ghost" onClick={() => void rate(2)} disabled={pending}>
                {ratingLabel("hard", "困难")}
              </GameButton>
              <GameButton variant="secondary" onClick={() => void rate(3)} disabled={pending}>
                {ratingLabel("good", "良好")}
              </GameButton>
              <GameButton variant="success" onClick={() => void rate(4)} disabled={pending}>
                {ratingLabel("easy", "简单")}
              </GameButton>
            </div>
          )}
        </div>
      )}
      {error ? (
        <p className="inline-error" role="alert">
          {error}
        </p>
      ) : null}
    </GamePanel>
  );
}
