import { useState } from "react";

import { Tip } from "../Tip.js";
import {
  buildQuestionPrompt,
  type LessonTitleLookup,
  type ReaderMark,
} from "@pieai/university-core/domain/reader-marks.js";

/**
 * The batch of open questions, and one button that turns them into something an
 * assistant can answer.
 *
 * Deliberately not a list of the marks. Each one already shows itself in the
 * margin, level with the passage it belongs to; repeating them here would put
 * the same sentence on screen twice and make the reader work out whether the
 * two copies were the same thing. What the margin cannot do is collect them —
 * a question is answered one at a time, but asked most efficiently all at once.
 */
export function LessonMarkList({
  marks,
  studyTitle,
  lessonTitles,
}: {
  readonly marks: readonly ReaderMark[];
  readonly studyTitle: string;
  readonly lessonTitles: LessonTitleLookup;
}) {
  const [copied, setCopied] = useState(false);

  const questions = marks.filter((mark) => mark.kind === "question" && mark.resolvedAt === null);
  const highlights = marks.filter((mark) => mark.kind === "highlight" && mark.resolvedAt === null);
  if (questions.length === 0 && highlights.length === 0) return null;

  return (
    <section className="mark-list" aria-label="我的标记">
      <div className="rail-panel__header">
        <h3 className="rail-panel__label">我的标记</h3>
        <Tip term="lesson-marks" className="rail-panel__help">
          <span aria-label="关于标记">?</span>
        </Tip>
      </div>
      <p className="mark-list__summary">
        {questions.length > 0 ? `${questions.length} 处没看懂` : "没有待解决的疑问"}
        {highlights.length > 0 ? ` · ${highlights.length} 处高亮` : ""}
      </p>
      {questions.length > 0 ? (
        <button
          type="button"
          className="mark-list__copy-all"
          onClick={() => {
            void navigator.clipboard?.writeText(
              buildQuestionPrompt(questions, { studyTitle, lessonTitles }),
            );
            setCopied(true);
          }}
        >
          {copied
            ? `已拷贝 ${questions.length} 条 · 去问 AI`
            : `拷贝全部去问 AI（${questions.length} 条）`}
        </button>
      ) : null}
    </section>
  );
}
