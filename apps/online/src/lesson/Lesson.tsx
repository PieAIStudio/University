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
 * them. Reading typography belongs in the shared learning package, and this is
 * the note that says so until it moves there.
 *
 * The prose itself is no longer rendered here. It goes through the same
 * `MarkdownContent` the authoring shell uses, which is the whole point of
 * `packages/ui`: a second Markdown pipeline is not a convenience, it is drift
 * with a schedule. Swapping it in is also what gives this side Mermaid
 * diagrams, Shiki-highlighted code and the authoring directives for free —
 * none of which the previous `marked` call could do.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  assembleLessonIndex,
  parseLessonLinks,
  resolveEvidenceAnchors,
  resolveLessonLinks,
  resolveTermLinks,
  termRangeOf,
} from "@pieai/university-core";
import { MarkdownContent } from "@pieai/university-ui";
import type { LessonLinkTarget } from "@pieai/university-ui/markdown/remark-lesson-links.js";
import { ForeignSettingsPanel } from "@pieai/university-ui/language/ForeignSettingsPanel.js";
import {
  readForeignSettings,
  writeForeignSettings,
  type ForeignSettings,
} from "@pieai/university-ui/language/foreign-settings.js";
import {
  readForeignLanguageMode,
  writeForeignLanguageMode,
} from "@pieai/university-ui/language/reading-mode.js";
import { playSound, SoundToggle } from "@pieai/university-ui/sound/index.js";

import type { Course, Lesson as LessonData } from "../content/library";
import { stageWord, subscribe, snapshot, wordStages } from "../progress/store";
import { gradeDeterministically, normalise, type Verdict } from "./grading";
import { languageLayerFor, LEXICON } from "./language";

const LEXICON_BY_ID = new Map(LEXICON.map((entry) => [entry.senseId, entry]));

export function LessonView({
  lesson,
  course,
  unitId,
  courseTitle,
  unitTitle,
  position,
  onPass,
  onBack,
  onFollowLink,
}: {
  lesson: LessonData;
  course: Course;
  unitId: string;
  courseTitle: string;
  unitTitle: string;
  position: string;
  onPass: () => void;
  onBack: () => void;
  onFollowLink?: (target: LessonLinkTarget) => void;
}) {
  const { lessonLinks, evidenceAnchors, termAnchors } = useMemo(() => {
    const parsed = parseLessonLinks(lesson.content);
    const index = assembleLessonIndex(
      course.units.flatMap((unit) =>
        unit.lessons.map((item) => ({
          courseId: course.id,
          unitId: unit.id,
          lessonId: item.id,
          title: item.title,
          content: item.content,
          sections: [],
        })),
      ),
    );
    const from = { courseId: course.id, unitId, lessonId: lesson.id };
    return {
      lessonLinks: resolveLessonLinks(parsed, index, from).map((item) =>
        item.kind === "resolved"
          ? {
              start: item.link.start,
              end: item.link.end,
              label: item.link.label,
              target: item.target,
            }
          : {
              start: item.link.start,
              end: item.link.end,
              label: item.link.label,
              target: null,
            },
      ),
      evidenceAnchors: resolveEvidenceAnchors(lesson.content, lesson.evidence),
      termAnchors: resolveTermLinks(parsed, LEXICON_BY_ID).map(termRangeOf),
    };
  }, [course, lesson, unitId]);

  const [english, setEnglish] = useState(readForeignLanguageMode);
  // The preset is the difference between a reading aid and a study tool: only
  // `remember` shows the buttons that put a word into review, so without this
  // panel the word states below would be unreachable from the page.
  const [foreignSettings, setForeignSettings] = useState<ForeignSettings>(readForeignSettings);

  // The layer depends on what the learner has said about words, so it is
  // recomputed when they say something. Subscribing to the whole progress store
  // is coarser than it needs to be, but a lesson's worth of prose costs well
  // under a millisecond to scan and a second store would be a second thing to
  // keep in sync.
  const words = useSyncExternalStore(subscribe, snapshot);
  const language = useMemo(
    () => (english ? languageLayerFor(lesson.content) : undefined),
    [english, lesson.content, words],
  );
  const stages = useMemo(() => wordStages(), [words]);

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

  const submit = () => {
    const result = gradeDeterministically(answer, exercise?.answerKey);
    setVerdict(result);
    // The three outcomes sound different because they *are* different, and a
    // learner should be able to tell which one happened without reading.
    if (result.outcome === "pass") {
      playSound("answer.correct");
      onPass();
    } else if (result.outcome === "fail") {
      playSound("answer.wrong");
      setMisses((count) => count + 1);
    } else {
      playSound("answer.undecided");
    }
  };

  const clue = useMemo(() => {
    // The answer is not available here any more, and should not be — a clue
    // built from it was a step away from printing it. Anchoring on the
    // question's own words finds the passage the question came from, which is
    // what a learner who missed actually needs to re-read.
    if (!exercise?.prompt) return null;
    const needle = normalise(exercise.prompt).slice(0, 5);
    const line = lesson.content
      .split(/\n+/)
      .find((row) => row.includes(needle) && !row.startsWith("```") && row.length > 12);
    return line ? line.replace(/[*`]/g, "").trim() : null;
  }, [exercise, lesson.content]);

  return (
    <article className="lesson">
      <header className="lesson__bar">
        <button
          className="linkish"
          onClick={() => {
            playSound("nav.back");
            onBack();
          }}
        >
          ← 关卡地图
        </button>
        <span className="lesson__where">
          {courseTitle} · {unitTitle}
        </span>
        <span className="lesson__lang">
          <button
            className={`lesson__en${english ? " lesson__en--on" : ""}`}
            aria-pressed={english}
            title={english ? "关掉英文词" : "在课文里认几个英文词"}
            onClick={() => {
              const next = !english;
              setEnglish(next);
              writeForeignLanguageMode(next);
            }}
          >
            EN
          </button>
          {english ? (
            <ForeignSettingsPanel
              settings={foreignSettings}
              onChange={(next) => {
                setForeignSettings(next);
                writeForeignSettings(next);
              }}
            />
          ) : null}
          <SoundToggle />
        </span>
        <span className="lesson__pos">{position}</span>
      </header>

      <div className="lesson__body">
        <MarkdownContent
          assets={lesson.assets ?? []}
          language={language}
          englishEnabled={english}
          foreignSettings={foreignSettings}
          vocabularyStages={stages}
          onStageWord={stageWord}
          lessonLinks={lessonLinks}
          evidenceAnchors={evidenceAnchors}
          termAnchors={termAnchors}
          evidence={lesson.evidence.map((item) => ({
            kind: item.kind,
            sourcePath: item.sourcePath,
            lineStart: item.lineStart,
            lineEnd: item.lineEnd,
            sourceCommit: item.sourceCommit,
            nodeIds: [],
            note: item.note ?? null,
          }))}
          {...(onFollowLink ? { onFollowLink } : {})}
        >
          {lesson.content}
        </MarkdownContent>
      </div>

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
            {/*
              This line used to read 「确定性判分 · 不花额度」. Both halves are
              true and neither is the learner's problem: the tiering exists so
              this product does not go bankrupt behind a free tier, and a
              learner reading about billing tiers mid-question is being shown
              the plumbing. What they can actually use is that the answer comes
              back instantly.
            */}
            <small>当场判完，不用等</small>
          </div>

          {verdict?.outcome === "pass" ? (
            <div className="verdict verdict--pass">答对了。</div>
          ) : null}

          {/*
            The honesty is the feature and it stays. What changed is who it is
            addressed to: 「第 2 层未接入」 told a paying learner the product was
            half-built, when the actual message is the far better one — this
            answer needs a human read, so you are not being marked wrong by a
            checker that cannot judge it.
          */}
          {verdict?.outcome === "undecided" ? (
            <div className="verdict">
              {verdict.reason}
              <span className="tier">这一题这里判不了，所以不算你错。</span>
            </div>
          ) : null}

          {verdict?.outcome === "fail" ? (
            <>
              {clue ? (
                <div className="clue">
                  <div className="clue__eyebrow">再看一眼你刚才读过的这句</div>
                  <blockquote>{clue}</blockquote>
                  {/*
                    `README.md:1-12 @3b402e06` is a coordinate, and a learner
                    who does not have the repository cannot do anything with a
                    seven-character hash. The sentence says what the coordinate
                    means; the exact revision stays available on hover for
                    anyone who does have the repository.
                  */}
                  {lesson.evidence[0] ? (
                    <div
                      className="clue__src"
                      title={`${lesson.evidence[0].sourcePath} @${lesson.evidence[0].sourceCommit}`}
                    >
                      出自真实项目：{lesson.evidence[0].sourcePath} 第{" "}
                      {lesson.evidence[0].lineStart}–{lesson.evidence[0].lineEnd} 行
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="verdict">再想一下，答案就在上面这段里。</div>
              )}
              {misses >= 2 ? (
                <div className="paywall">
                  还是不通？可以叫导师来看这一题。
                  <span className="tier">导师会用掉一次答疑额度</span>
                </div>
              ) : null}
            </>
          ) : null}

          {/*
            The old copy said 「真实产品里这会…」 — the product telling a paying
            learner that it is not the real product. It is the real product.
          */}
          {appealed ? (
            <div className="verdict">
              按你说的放行了。会有人再看一遍这道题，<b>不用你出额度</b>——判错是我们的问题。
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
