/**
 * The screen the product's advantage lives on.
 *
 * Everything else here exists in every learning app. A paragraph of explanation
 * sitting next to the exact commit and line range in a shipping private
 * repository does not, and that is what the evidence anchors below are.
 *
 * Reading sizes are set here rather than taken from SwimmerUIKit, and that is
 * deliberate and temporary. The kit's body scale tops out at 1.18rem because it
 * is a HUD kit; lessons here average 2,363 characters of Chinese with code in
 * them. Reading typography belongs in the shared learning package both halves
 * will import, and this is the note that says so until it exists.
 */
import { useEffect, useMemo, useState } from "react";
import { marked } from "marked";

import type { Lesson as LessonData } from "../content/library";
import { gradeDeterministically, type Verdict } from "./grading";

const ANCHOR = /^\[\[evidence:([^\]]+)\]\]$/gm;

/**
 * Lift the inline anchors out before Markdown runs.
 *
 * `[[evidence:path:start-end]]` is the authoring side's own form and the one
 * construct in this prose that is not ordinary Markdown. Left alone it renders
 * as a stray line of text; lifted out it stays a first-class element, which is
 * the entire point of it.
 */
function renderLesson(markdown: string) {
  return marked.parse(
    markdown.replace(ANCHOR, (_, route: string) => `<div data-evidence="${route}"></div>`),
    {
      async: false,
    },
  ) as string;
}

export function LessonView({
  lesson,
  courseTitle,
  unitTitle,
  position,
  onPass,
  onBack,
}: {
  lesson: LessonData;
  courseTitle: string;
  unitTitle: string;
  position: string;
  onPass: () => void;
  onBack: () => void;
}) {
  const html = useMemo(() => renderLesson(lesson.content), [lesson.content]);
  const exercise = lesson.exercises[0];
  const [answer, setAnswer] = useState("");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [misses, setMisses] = useState(0);
  const [appealed, setAppealed] = useState(false);

  useEffect(() => {
    setAnswer("");
    setVerdict(null);
    setMisses(0);
    setAppealed(false);
  }, [lesson.id]);

  // Anchors become real rows in document order, matched to the lesson's own
  // evidence list so the commit and line range come from the package.
  useEffect(() => {
    const slots = document.querySelectorAll<HTMLElement>("[data-evidence]");
    slots.forEach((slot, index) => {
      if (slot.dataset.filled === "yes") return;
      const route = slot.dataset.evidence ?? "";
      const [path, lines] = route.split(/:(?=[^:]*$)/);
      const anchor = lesson.evidence[index];
      slot.className = "evidence";
      slot.dataset.filled = "yes";
      slot.innerHTML = `<b>${path ?? ""}</b><span>:${lines ?? ""}</span><span class="go">@${
        anchor?.sourceCommit.slice(0, 7) ?? "—"
      } ↗</span>`;
    });
  }, [html, lesson.evidence]);

  const submit = () => {
    const result = gradeDeterministically(answer, exercise?.expectedAnswer);
    setVerdict(result);
    if (result.outcome === "pass") onPass();
    else if (result.outcome === "fail") setMisses((count) => count + 1);
  };

  const clue = useMemo(() => {
    if (!exercise?.expectedAnswer) return null;
    const needle = exercise.expectedAnswer.slice(0, 6);
    const line = lesson.content
      .split(/\n+/)
      .find((row) => row.includes(needle) && !row.startsWith("```") && row.length > 12);
    return line ? line.replace(/[*`]/g, "").trim() : null;
  }, [exercise, lesson.content]);

  return (
    <article className="lesson">
      <header className="lesson__bar">
        <button className="linkish" onClick={onBack}>
          ← 关卡地图
        </button>
        <span className="lesson__where">
          {courseTitle} · {unitTitle}
        </span>
        <span className="lesson__pos">{position}</span>
      </header>

      <div className="lesson__body" dangerouslySetInnerHTML={{ __html: html }} />

      {exercise ? (
        <section className="quiz">
          <h3>{exercise.title ?? "自检"}</h3>
          <p>{exercise.prompt}</p>
          <input
            className="quiz__input"
            value={answer}
            placeholder="用你自己的话写"
            onChange={(event) => setAnswer(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
            }}
          />
          <div className="quiz__row">
            <button className="primary" onClick={submit}>
              提交
            </button>
            {misses > 0 || verdict?.outcome === "undecided" ? (
              <button
                className="ghost"
                onClick={() => {
                  setAppealed(true);
                  onPass();
                }}
              >
                我觉得我对了
              </button>
            ) : null}
            <small>确定性判分 · 不花额度</small>
          </div>

          {verdict?.outcome === "pass" ? (
            <div className="verdict verdict--pass">
              答对了。这一层没有花任何钱，也没有等待。<span className="tier">第 1 层 · 确定性</span>
            </div>
          ) : null}

          {verdict?.outcome === "undecided" ? (
            <div className="verdict">
              {verdict.reason}
              <span className="tier">第 2 层未接入 · 本地判不了就如实说</span>
            </div>
          ) : null}

          {verdict?.outcome === "fail" ? (
            <>
              {clue ? (
                <div className="clue">
                  <div className="clue__eyebrow">再看一眼你刚才读过的这句</div>
                  <blockquote>{clue}</blockquote>
                  {lesson.evidence[0] ? (
                    <div className="clue__src">
                      {lesson.evidence[0].sourcePath}:{lesson.evidence[0].lineStart}-
                      {lesson.evidence[0].lineEnd} @{lesson.evidence[0].sourceCommit.slice(0, 7)}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="verdict">再想一下，答案就在上面这段里。</div>
              )}
              {misses >= 2 ? (
                <div className="paywall">
                  还是不通？现在才出现导师入口。
                  <span className="tier">第 3 层 · 计入额度</span>
                </div>
              ) : null}
            </>
          ) : null}

          {appealed ? (
            <div className="verdict">
              已按你的申诉放行。真实产品里这会升到第 2 层重判一次，<b>不计额度</b>——
              误判是分层判分自己的故障。
            </div>
          ) : null}
        </section>
      ) : null}

      <footer className="lesson__drops">
        掉落 {lesson.cards.length} 张卡片 · {lesson.evidence.length} 条证据锚点
      </footer>
    </article>
  );
}
