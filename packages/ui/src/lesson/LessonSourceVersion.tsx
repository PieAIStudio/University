import { useState } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import type {
  SourceAccessExplanation,
  SourceAccessPort,
  SourceCheckout,
} from "@pieai/university-core";

import { CapabilityExplanation } from "../capability/CapabilityExplanation.js";

export type LessonSourceVersionCheckout = SourceCheckout;

/**
 * Running the version this lesson teaches.
 *
 * A lesson is pinned to a commit and the studied project keeps moving, so
 * sooner or later the screenshots and the running app disagree — a button has
 * moved, a screen has been renamed — and the learner is comparing prose against
 * something that is no longer the thing described. Reading the cited source
 * always worked, because the mirror holds the commit; using the product at that
 * commit did not.
 *
 * Placed with the lesson's own version line rather than on a settings page,
 * because that is where the question occurs: the reader has just been told this
 * lesson is pinned to a date, and the next thought is "so where is that one".
 *
 * It stops after preparing the checkout, and hands over the commands instead of
 * running them. Starting somebody else's project is not a thing to do to a
 * reader who clicked a button in a lesson — the last one turned out to open
 * with ambient audio.
 */
export function LessonSourceVersion({
  studyId,
  sourceCommit,
  sourceCommitDate,
  sourceAccess,
}: {
  readonly studyId: string;
  readonly sourceCommit: string;
  readonly sourceCommitDate?: string;
  /** Both shells render the entry; the port returns an action or an explanation. */
  readonly sourceAccess: SourceAccessPort;
}) {
  const [checkout, setCheckout] = useState<LessonSourceVersionCheckout | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [explanation, setExplanation] = useState<SourceAccessExplanation | null>(null);

  async function call(method: "open" | "close") {
    setPending(true);
    setError(null);
    setExplanation(null);
    try {
      if (method === "open") {
        const access = sourceAccess.lessonVersion({ studyId, sourceCommit });
        if (access.kind === "explanation") {
          setExplanation(access);
          return;
        }
        setCheckout(await access.run());
      } else {
        const access = sourceAccess.closeLessonVersion({ studyId, sourceCommit });
        if (access.kind === "explanation") {
          setExplanation(access);
          return;
        }
        await access.run();
        setCheckout(null);
      }
      setCopied(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "打不开正在学习的 App");
    } finally {
      setPending(false);
    }
  }

  const dated = sourceCommitDate ? formatDate(sourceCommitDate) : "";

  return (
    <div className="lesson-version">
      {checkout === null ? (
        <>
          <span className="lesson-version__label">
            这节课钉在{dated ? ` ${dated} ` : ""}的版本（{sourceCommit.slice(0, 8)}）
          </span>
          <button
            type="button"
            className="text-button"
            data-parity-control="lesson-source-version"
            onClick={() => void call("open")}
            disabled={pending}
          >
            {pending ? "正在打开…" : "打开正在学习的 App"}
          </button>
        </>
      ) : (
        <div className="lesson-version__ready">
          <p className="lesson-version__label">
            {checkout.created ? "已取出到" : "这个版本已经在"}
            <code>{checkout.path}</code>
          </p>
          {checkout.run.length > 0 ? (
            <>
              {/* The commands, not a running server. See the note on the
                  component: what a studied project does on start is its own
                  business, and the reader should be the one who decides to
                  find out. */}
              <pre className="lesson-version__run">{checkout.run.join("\n")}</pre>
              <div className="lesson-version__actions">
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    void navigator.clipboard
                      ?.writeText(checkout.run.join("\n"))
                      .then(() => setCopied(true))
                      .catch(() => setError("复制失败，剪贴板不可用"));
                  }}
                >
                  {copied ? "已复制" : "复制命令"}
                </button>
                <GameButton variant="ghost" onClick={() => void call("close")} disabled={pending}>
                  {pending ? "正在删除…" : "用完了，删掉"}
                </GameButton>
              </div>
            </>
          ) : (
            <div className="lesson-version__actions">
              <GameButton variant="ghost" onClick={() => void call("close")} disabled={pending}>
                用完了，删掉
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
      {explanation ? (
        <CapabilityExplanation explanation={explanation} onClose={() => setExplanation(null)} />
      ) : null}
    </div>
  );
}

function formatDate(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  const now = new Date();
  const month = at.getMonth() + 1;
  const day = at.getDate();
  return at.getFullYear() === now.getFullYear()
    ? `${month}月${day}日`
    : `${at.getFullYear()}年${month}月${day}日`;
}
