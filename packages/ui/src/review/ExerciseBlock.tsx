import { useEffect, useRef, useState } from "react";
import { GameButton, GameCallout, GamePanel } from "@pieai/swimmer-ui-kit";
import { METERED_GRADING_COST_POWER_UNITS } from "@pieai/university-core";
import type {
  CoachingPacket,
  ExerciseAttemptResult,
  GradingPort,
  HostExerciseGrade,
  MeteredGradingExplanation,
  MeteredGradingOffer,
} from "@pieai/university-core";

import { MarkdownContent } from "../markdown/MarkdownContent.js";
import { STALE_TOKEN_NOTICE, isStaleTokenFailure } from "../api/client.js";
import { CapabilityExplanation } from "../capability/CapabilityExplanation.js";
import type { LessonRef, LessonView } from "../view/lesson-view.js";

/**
 * How long the page keeps watching for a host grade on its own. Past this the
 * learner is no longer waiting on an assistant that is about to answer, and a
 * page that polls forever is a page that never stops. Returning to the tab
 * still refreshes immediately.
 */
const HOST_GRADE_POLL_LIMIT_MS = 10 * 60 * 1000;

const METERED_OFFER_READ_FAILURE: MeteredGradingOffer = {
  kind: "unavailable",
  costPowerUnits: METERED_GRADING_COST_POWER_UNITS,
  availablePowerUnits: null,
  explanation: {
    kind: "explanation",
    title: "AI 批改额度暂时读不到",
    whatItDoes: "它会在确定性判题无法判断的开放题上提供一次额外的结构化评估。",
    whyUnavailable:
      "这次没有读到费用或钱包余额，所以不会发起可能扣费的请求；下面的免费提示仍然可用。",
    futureSupport: "服务恢复后，重新提交这道题就会再次读取费用和余额。",
  },
};

export function ExerciseBlock({
  locator,
  exercise,
  grading,
  onRefresh,
}: {
  readonly locator: LessonRef;
  readonly exercise: LessonView["lesson"]["exercises"][number];
  readonly grading: GradingPort;
  /**
   * Reloads campus data after a submission or a host write-back. Completion is
   * owned by the explicit lesson confirmation endpoint, never by rendering a
   * passed exercise.
   */
  readonly onRefresh: () => Promise<void>;
}) {
  /**
   * The answer the server already has, or the one being typed now.
   *
   * `hostGrade.learnerAnswer` is the fallback because a grade written back
   * through the CLI carries the answer it judged even when the submission row
   * predates it.
   */
  const storedAnswer = exercise.latestSubmission?.answer ?? exercise.hostGrade?.learnerAnswer ?? "";
  const [answer, setAnswer] = useState(storedAnswer);
  const [result, setResult] = useState<ExerciseAttemptResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [packetCopied, setPacketCopied] = useState(false);
  const [packetCopyFailed, setPacketCopyFailed] = useState(false);
  const [packetInfo, setPacketInfo] = useState<CoachingPacket | null>(null);
  const [expressionCopied, setExpressionCopied] = useState(false);
  const [hostGrade, setHostGrade] = useState<HostExerciseGrade | null>(exercise.hostGrade ?? null);
  const [meteredOffer, setMeteredOffer] = useState<MeteredGradingOffer | null>(null);
  const [meteredOfferLoading, setMeteredOfferLoading] = useState(false);
  const [meteredChoice, setMeteredChoice] = useState<"tier-1" | "free-ai" | "wallet-ai" | null>(
    null,
  );
  const [meteredExplanation, setMeteredExplanation] = useState<MeteredGradingExplanation | null>(
    null,
  );
  /**
   * A passed exercise is read-only until the learner asks for it back. Locking
   * it forever was the wrong end of the trade: rehearsing an answer you already
   * got right is how it sticks, and passing is recorded once — re-answering
   * cannot take the pass away.
   */
  const [reopened, setReopened] = useState(false);
  const isExplain = exercise.kind === "explain";
  const passed = hostGrade?.passed === true;
  const solved = passed && !reopened;

  useEffect(() => {
    setHostGrade(exercise.hostGrade ?? null);
  }, [exercise.id, exercise.contentRevision, exercise.hostGrade]);

  // A different exercise, or the same one at new content, is a different
  // question. Carrying the previous answer's text into it would be a lie about
  // what was submitted.
  const answeredExercise = useRef(`${exercise.id}@${exercise.contentRevision}`);
  useEffect(() => {
    const identity = `${exercise.id}@${exercise.contentRevision}`;
    if (answeredExercise.current === identity) return;
    answeredExercise.current = identity;
    setAnswer(storedAnswer);
    setReopened(false);
    setResult(null);
    setMeteredOffer(null);
    setMeteredChoice(null);
  }, [exercise.id, exercise.contentRevision, storedAnswer]);

  useEffect(() => {
    if (result?.meteredEligible !== true || hostGrade?.host !== "tier-1") {
      setMeteredOffer(null);
      setMeteredOfferLoading(false);
      return;
    }
    let cancelled = false;
    setMeteredOfferLoading(true);
    void grading
      .meteredGradingOffer()
      .then((offer) => {
        if (cancelled) return;
        setMeteredOffer(offer);
      })
      .catch(() => {
        if (cancelled) return;
        setMeteredOffer(METERED_OFFER_READ_FAILURE);
      })
      .finally(() => {
        if (!cancelled) setMeteredOfferLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [exercise.id, exercise.contentRevision, grading, hostGrade?.host, result?.meteredEligible]);

  useEffect(() => {
    if (!packetCopied) return;
    const timer = setTimeout(() => setPacketCopied(false), 8_000);
    return () => clearTimeout(timer);
  }, [packetCopied]);

  /**
   * Where the host grade stood when this answer was submitted. Polling stops
   * when a grade newer than this arrives — including a failing one, which is
   * feedback the learner came back for just as much as a pass.
   */
  const [gradeWatermark, setGradeWatermark] = useState<string | null>(null);
  useEffect(() => {
    setGradeWatermark(null);
  }, [exercise.id, exercise.contentRevision]);
  const awaitingGrade = gradeWatermark !== null && (hostGrade?.occurredAt ?? "") <= gradeWatermark;

  // `onRefresh` is rebuilt on every render of the campus, so depending on it
  // here would clear and restart the timer before it could ever fire.
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  useEffect(() => {
    if (!awaitingGrade) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();

    const poll = async () => {
      if (cancelled) return;
      await refreshRef.current().catch(() => undefined);
      if (cancelled) return;
      const elapsed = Date.now() - startedAt;
      if (elapsed >= HOST_GRADE_POLL_LIMIT_MS) return;
      // Quick at first to catch a fast write-back, then slower so a long wait
      // does not spend ten minutes hammering the local API.
      timer = setTimeout(() => void poll(), elapsed < 60_000 ? 3_000 : 10_000);
    };
    timer = setTimeout(() => void poll(), 3_000);

    // The learner is in the assistant's window while it grades, so a hidden tab
    // is the normal case here rather than a reason to stop. Coming back is the
    // moment the answer should already be on screen.
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshRef.current().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [awaitingGrade]);

  async function copyExpressionPacket() {
    if (!grading.expressionPacket) return;
    try {
      const body = await grading.expressionPacket(locator.studyId);
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(body.packet);
      setExpressionCopied(true);
      setTimeout(() => setExpressionCopied(false), 8_000);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "暂时无法生成点评包");
    }
  }

  async function copyCoachingPacket() {
    if (!grading.coachingPacket) return;
    try {
      const body = await grading.coachingPacket({ locator, exerciseId: exercise.id });
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(body.packet);
      setPacketInfo(body);
      setPacketCopied(true);
      setPacketCopyFailed(false);
    } catch {
      setPacketCopied(false);
      setPacketCopyFailed(true);
    }
  }

  async function submit(allowMetered = false, funding: "free" | "wallet" = "wallet") {
    setPending(true);
    setError(null);
    setPacketCopied(false);
    setPacketCopyFailed(false);
    setPacketInfo(null);
    setResult(null);
    setMeteredOffer(null);
    setMeteredChoice(allowMetered ? (funding === "free" ? "free-ai" : "wallet-ai") : null);
    try {
      const body: ExerciseAttemptResult = await grading.submitExercise({
        locator,
        exerciseId: exercise.id,
        contentRevision: exercise.contentRevision,
        answer,
        commandId: crypto.randomUUID(),
        allowMetered,
        meteredFunding: allowMetered ? funding : undefined,
      });
      setResult(body);
      if (body.hostGrade) setHostGrade(body.hostGrade);
      if (allowMetered && body.hostGrade?.host !== "tier-2") setMeteredChoice("tier-1");
      setGradeWatermark(body.hostGrade?.occurredAt ?? "");
      if (!body.hostGrade?.passed) await copyCoachingPacket();
      await onRefresh();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "暂时无法提交练习";
      setError(isStaleTokenFailure(message) ? STALE_TOKEN_NOTICE : message);
      if (isStaleTokenFailure(message)) await onRefresh().catch(() => undefined);
    } finally {
      setPending(false);
    }
  }

  async function refreshHostGrade() {
    setPending(true);
    setError(null);
    try {
      await onRefresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "刷新失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <GamePanel className="exercise-panel" title={exercise.title}>
      <div className="exercise-prompt">
        <MarkdownContent>{exercise.prompt}</MarkdownContent>
      </div>
      <label className="answer-field">
        <span>你的答案</span>
        <textarea
          value={answer}
          onChange={(event) => {
            setAnswer(event.target.value);
            setResult(null);
            setMeteredOffer(null);
            setMeteredChoice(null);
            setPacketCopied(false);
            setPacketCopyFailed(false);
          }}
          placeholder={
            isExplain
              ? grading.coachingPacket
                ? "用自己的话完整解释；对错与点评由 AI 宿主完成。"
                : "用自己的话完整解释。"
              : grading.coachingPacket
                ? "用自己的话回答；对错由 AI 宿主判定，不要求一字不差。"
                : "用自己的话回答。"
          }
          rows={isExplain ? 6 : 3}
          readOnly={solved}
        />
      </label>
      {exercise.latestSubmission && !result ? (
        <p className="answer-field__saved">
          这是你 {new Date(exercise.latestSubmission.occurredAt).toLocaleString("zh-CN")}{" "}
          提交的答案， 已存在本机。
        </p>
      ) : null}

      <div className="exercise-actions">
        <GameButton
          variant="primary"
          onClick={() => void submit()}
          disabled={!answer.trim() || pending || solved}
        >
          {/* 「判」 alone is not a verb you can end a Chinese sentence on, and
              this is the primary action of every lesson in the product. */}
          {/*
            The grading port may copy an authoring answer to an AI host while
            delivery submits it to its metered grader. That is an implementation
            boundary, not a second learner surface: the button says what the
            learner is doing in both campuses.
          */}
          {pending ? "正在提交…" : solved ? "已完成" : reopened ? "重新提交" : "提交"}
        </GameButton>
        {passed ? (
          <GameButton
            variant="ghost"
            onClick={() => {
              // Leaving the reopen restores what the server holds, so backing
              // out cannot be the thing that loses the saved answer.
              if (reopened) setAnswer(storedAnswer);
              setReopened(!reopened);
              setResult(null);
            }}
            disabled={pending}
          >
            {reopened ? "放弃重答" : "重新回答"}
          </GameButton>
        ) : null}
        {/*
          Why the button is dead.

          A lesson cannot be completed without answering its exercise, so this
          is where a learner arrives to finish — and finds the one button on the
          panel greyed out, at a contrast the kit reserves for disabled
          controls, with nothing saying what would wake it. The gate itself is
          right: the whole point of the exercise is that you write the answer
          before an AI sees it. It just has to be a gate the reader can see the
          latch on.
        */}
        {!answer.trim() && !solved && !pending ? (
          <span className="exercise-actions__hint">写下你的答案后就能提交</span>
        ) : null}
      </div>

      {result && !hostGrade?.passed && grading.coachingPacket ? (
        <GameCallout heading="答案已记录 · 等 AI 评估" tone="warning" role="status">
          {awaitingGrade
            ? "本页不自己判对错。把答疑包贴给任意 AI 宿主，它写回后这里会自动出现评估 —— 不用守着，回到这个页面时也会立刻刷新。"
            : "本页不自己判对错。请把答疑包贴到任意 AI 宿主，让它判分并写回。"}
        </GameCallout>
      ) : null}

      {hostGrade ? (
        <div
          className={`host-grade host-grade--${hostGrade.passed ? "pass" : "fail"}`}
          role="region"
          aria-label="AI 宿主评估"
        >
          <p className="host-grade__eyebrow">
            AI 评估 · {hostGrade.passed ? "通过" : "未通过"}
            {hostGrade.host ? ` · ${hostGrade.host}` : ""}
          </p>
          <div className="host-grade__body markdown-body">
            <MarkdownContent>{hostGrade.evaluation}</MarkdownContent>
          </div>
          {hostGrade.extensions.length > 0 ? (
            <div className="host-grade__extensions">
              <p className="eyebrow">引申</p>
              <ul>
                {hostGrade.extensions.map((item) => (
                  // Same Markdown treatment the evaluation above gets. An
                  // assistant writing about `pnpm dev` naturally reaches for
                  // backticks, and rendering them raw here made the two halves
                  // of one answer look like they came from different products.
                  <li key={item} className="markdown-body">
                    <MarkdownContent>{item}</MarkdownContent>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {isExplain && grading.expressionPacket ? (
            <div className="host-grade__coach">
              {/* Grading answered "was it right"; this offers "was it clear". The
                  page only prepares the material — the coaching itself happens in
                  whatever AI host the learner pastes into, same as grading.
                  short-answer exercises have no prose to critique, so the
                  invitation only makes sense where the answer is free text. */}
              <GameButton
                variant="ghost"
                onClick={() => void copyExpressionPacket()}
                disabled={pending}
              >
                {expressionCopied ? "已复制表达点评包" : "让 AI 点评我这段表达"}
              </GameButton>
              {expressionCopied ? (
                <span className="host-grade__coach-hint">
                  贴到任意 AI 宿主。它只评你怎么说，不改判对错。
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {result?.meteredEligible ? (
        <section className="metered-grading-choice" aria-label="AI 语义批改选择">
          {meteredOfferLoading ? (
            <GameCallout heading="正在读取 AI 批改费用与余额" tone="neutral" role="status">
              先把这次大约要花多少、你的钱包还剩多少读清楚；读取完成前不会发起计量请求。
            </GameCallout>
          ) : meteredOffer?.kind === "free" ? (
            <GameCallout heading="今天的免费 AI 批改还可用" tone="neutral" role="region">
              <div className="metered-grading-choice__copy">
                <p>
                  这次使用 <strong>{meteredOffer.costPowerUnits} power units</strong> 的每日免费 AI
                  额度；今天还剩 <strong>{meteredOffer.remainingPowerUnits} power units</strong>，
                  不会扣钱包。
                </p>
                <p>
                  只有点“使用今日免费 AI 批改”才会占用每日免费额度；下面的 tier‑1 免费提示不占 AI
                  额度。
                </p>
              </div>
              {meteredChoice === "tier-1" ? (
                <p className="metered-grading-choice__selected" role="status">
                  已选择 tier‑1 免费提示（不占 AI 额度）。
                </p>
              ) : meteredChoice === "free-ai" ? (
                <p className="metered-grading-choice__selected" role="status">
                  已选择今天的免费 AI 批改。
                </p>
              ) : null}
              <div className="metered-grading-choice__actions">
                <GameButton
                  variant="primary"
                  onClick={() => void submit(true, "free")}
                  disabled={pending}
                >
                  使用今日免费 AI 批改（占用 {meteredOffer.costPowerUnits}）
                </GameButton>
                <GameButton
                  variant="ghost"
                  onClick={() => setMeteredChoice("tier-1")}
                  disabled={pending}
                >
                  只看 tier‑1 免费提示（不占 AI 额度）
                </GameButton>
              </div>
            </GameCallout>
          ) : meteredOffer?.kind === "available" ? (
            <GameCallout heading="AI 语义批改会使用额度" tone="warning" role="region">
              <div className="metered-grading-choice__copy">
                {meteredOffer.freeQuotaExhausted ? (
                  <p>
                    今天的免费 AI 批改用完了，明天恢复。现在使用会从钱包扣除{" "}
                    <strong>{meteredOffer.costPowerUnits} power units</strong>；你的钱包还剩{" "}
                    <strong>{meteredOffer.availablePowerUnits} power units</strong>。
                  </p>
                ) : (
                  <p>
                    这次约消耗 <strong>{meteredOffer.costPowerUnits} power units</strong>
                    ；你的钱包还剩 <strong>{meteredOffer.availablePowerUnits} power units</strong>。
                  </p>
                )}
                <p>只有点“使用 AI 批改”才会扣钱包额度；下面的 tier‑1 免费提示不花钱包额度。</p>
              </div>
              {meteredChoice === "tier-1" ? (
                <p className="metered-grading-choice__selected" role="status">
                  已选择 tier‑1 免费提示（不花钱包额度）。
                </p>
              ) : null}
              <div className="metered-grading-choice__actions">
                <GameButton
                  variant="primary"
                  onClick={() => void submit(true, "wallet")}
                  disabled={pending}
                >
                  使用 AI 批改（消耗 {meteredOffer.costPowerUnits}）
                </GameButton>
                <GameButton
                  variant="ghost"
                  onClick={() => setMeteredChoice("tier-1")}
                  disabled={pending}
                >
                  只看 tier‑1 免费提示（不花钱包额度）
                </GameButton>
              </div>
            </GameCallout>
          ) : meteredOffer ? (
            <GameCallout heading={meteredOffer.explanation.title} tone="neutral" role="status">
              <div className="metered-grading-choice__copy">
                <p>
                  {meteredOffer.freeQuotaExhausted
                    ? "今天的免费 AI 批改用完了，明天恢复。"
                    : `本次 AI 批改约消耗 ${meteredOffer.costPowerUnits} power units。`}
                  {meteredOffer.availablePowerUnits !== null
                    ? ` 你的钱包还剩 ${meteredOffer.availablePowerUnits} power units。`
                    : " 钱包余额暂时读不到。"}
                </p>
                <p>{meteredOffer.explanation.whyUnavailable}</p>
              </div>
              {meteredChoice === "tier-1" ? (
                <p className="metered-grading-choice__selected" role="status">
                  已选择 tier‑1 免费提示（不花钱包额度）。
                </p>
              ) : null}
              <div className="metered-grading-choice__actions">
                <GameButton
                  variant="secondary"
                  onClick={() => setMeteredExplanation(meteredOffer.explanation)}
                >
                  查看 AI 批改说明
                </GameButton>
                <GameButton
                  variant="ghost"
                  onClick={() => setMeteredChoice("tier-1")}
                  disabled={pending}
                >
                  只看 tier‑1 免费提示（不花钱包额度）
                </GameButton>
              </div>
            </GameCallout>
          ) : null}
        </section>
      ) : null}

      {result && !hostGrade?.passed && grading.coachingPacket ? (
        <div className="coaching-packet" role="region" aria-label="答疑包与粘贴步骤">
          <p className="coaching-packet__status">
            {packetCopied
              ? "已复制「练习答疑包」到剪贴板"
              : packetCopyFailed
                ? "自动复制失败，请点下面按钮手动复制"
                : "复制答疑包 → 任意 AI 宿主判分并写回"}
          </p>
          {packetCopied && packetInfo ? (
            // An assistant in a fresh chat cannot open the repository, so the
            // packet carries the cited code with it. Saying so is what stops
            // the learner from wondering whether the AI is judging blind.
            <p className="coaching-packet__contents">
              包里带了 {packetInfo.evidenceCount} 段本课引用的真实源码
              {packetInfo.evidenceOmitted > 0
                ? `（另有 ${packetInfo.evidenceOmitted} 段略过）`
                : ""}
              ，
              {packetInfo.referenceDisclosed
                ? "以及参考答案 —— 你已经答过多次了。"
                : "但不含参考答案 —— 第一次尝试时提前给答案会让这道题白做。"}
            </p>
          ) : null}
          <ol className="coaching-packet__steps">
            <li>打开 AI 助手（Grok Build、Claude Code、Antigravity、Codex 等）。</li>
            <li>新开一条对话，粘贴（⌘V / Ctrl+V）→ 发送。</li>
            <li>让 AI 按包内说明写 `/tmp/ul-host-grade.json` 并执行 host-grade 命令。</li>
            <li>回到本页，评估写回后会自动出现。</li>
          </ol>
          <div className="coaching-packet__actions">
            <GameButton
              variant="secondary"
              onClick={() => void copyCoachingPacket()}
              disabled={pending}
            >
              {packetCopied ? "已复制，可再复制" : "复制答疑包"}
            </GameButton>
            {/* The page polls on its own; this stays as the escape hatch for a
                write-back that lands after polling has given up. */}
            <GameButton variant="ghost" onClick={() => void refreshHostGrade()} disabled={pending}>
              {awaitingGrade ? "正在等评估 · 手动刷新" : "刷新评估"}
            </GameButton>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="inline-error" role="alert">
          {error}
        </p>
      ) : null}

      {meteredExplanation ? (
        <CapabilityExplanation
          explanation={meteredExplanation}
          onClose={() => setMeteredExplanation(null)}
        />
      ) : null}
    </GamePanel>
  );
}
