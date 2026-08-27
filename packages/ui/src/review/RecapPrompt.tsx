import { useState, useSyncExternalStore } from "react";
import { GameButton, GameCallout, GamePanel } from "@pieai/swimmer-ui-kit";
import type { LessonRef, ProgressPort } from "@pieai/university-core";
import { recapCardKeyOf } from "@pieai/university-core";

/**
 * The one text-first teach-back prompt shared by the authoring and delivery
 * builds.
 *
 * `unitObjective` is the existing first-person capability sentence from the
 * shelf. This component adds no authored question and makes no grading or AI
 * call: its only write is the learner's answer into the shared progress port.
 */
export function RecapPrompt({
  locator,
  unitObjective,
  contentRevision,
  progress,
  onSaved,
  onWorthwhileProgress,
}: {
  readonly locator: LessonRef;
  readonly unitObjective: string;
  readonly contentRevision: number;
  readonly progress: ProgressPort;
  readonly onSaved?: () => Promise<void>;
  readonly onWorthwhileProgress?: () => void;
}) {
  const document = useSyncExternalStore(progress.subscribe, progress.snapshot);
  const [answer, setAnswer] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saved = document.cards[recapCardKeyOf(locator)] !== undefined;

  // A missing capability sentence is an invalid shelf row, not permission to
  // invent a prompt. The current course data supplies all 146 sentences.
  if (!unitObjective.trim()) return null;

  async function save() {
    if (!answer.trim() || pending) return;
    setPending(true);
    setError(null);
    try {
      progress.createRecapCard({
        locator,
        contentRevision,
        commandId: crypto.randomUUID(),
        answer,
      });
      if (!progress.recapCard(locator)) throw new Error("复习卡没有写入云端缓存");
      onWorthwhileProgress?.();
      try {
        await onSaved?.();
      } catch {
        setError("复习卡已保存，但界面没有刷新，请重新加载页面。");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "复习卡没有保存");
    } finally {
      setPending(false);
    }
  }

  return (
    <GamePanel className="recap-prompt" tone="strong">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">课后复习</p>
          <h2 id="recap-prompt-title">讲一遍</h2>
        </div>
      </div>
      <p className="recap-prompt__instruction">请用自己的话，讲给一个完全不知道这件事的人听。</p>
      <section className="recap-prompt__objective" aria-label="本单元能力句">
        <p className="eyebrow">本单元能力句</p>
        <p>{unitObjective}</p>
      </section>
      {saved ? (
        <GameCallout heading="复习卡已保存" tone="success">
          到期时它会回来，请再讲一遍。
        </GameCallout>
      ) : (
        <>
          <label className="answer-field">
            <span>你的复述</span>
            <textarea
              aria-label="你的复述"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="在这里写你的复述……"
              disabled={pending}
              rows={5}
            />
          </label>
          <GameButton
            variant="primary"
            onClick={() => void save()}
            disabled={!answer.trim() || pending}
          >
            {pending ? "正在保存…" : "保存为复习卡"}
          </GameButton>
        </>
      )}
      <p className="recap-prompt__voice-note">
        语音输入：还在设计
        <br />
        （不会因为你打开了「听发音」就自动启用。）
      </p>
      {error ? (
        <p className="inline-error" role="alert">
          {error}
        </p>
      ) : null}
    </GamePanel>
  );
}
