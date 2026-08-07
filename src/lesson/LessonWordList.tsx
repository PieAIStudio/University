import { useMemo, useState } from "react";
import { GameBadge } from "@pieai/swimmer-ui-kit";

import type { LexiconEntry } from "../language/WordPopover.js";
import {
  readVoicePreference,
  selectVoice,
  speakWord,
  useEnglishVoices,
  writeVoicePreference,
} from "../language/speech.js";

/**
 * What each vocabulary stage means to someone reading the panel, rather than
 * to the scheduler. "认识" is not "已掌握": the word stays scheduled until a
 * retrieval on a later day earns that, and saying otherwise here would make
 * the panel disagree with the queue.
 */
const STAGE_PRESENTATION: Readonly<
  Record<string, { readonly label: string; readonly tone: "warning" | "success" | "neutral" }>
> = {
  learning: { label: "复习中", tone: "warning" },
  familiar: { label: "认识", tone: "success" },
  stable: { label: "已掌握", tone: "success" },
  paused: { label: "已暂停", tone: "neutral" },
  candidate: { label: "读到过", tone: "neutral" },
};

const REASON_RANK: Record<string, number> = { new: 0, learning: 1, familiar: 2 };

/**
 * The English words this lesson actually annotates, and where each one stands.
 *
 * Turning English mode on used to change only the body text, which left the
 * learner with no way to answer "how many words are in this lesson, and which
 * ones have I already dealt with" short of hovering every underline. The rail
 * beside the lesson had the room for it and was showing nothing.
 */
export function LessonWordList({
  lexicon,
  stages,
  reasons,
}: {
  readonly lexicon: readonly LexiconEntry[];
  readonly stages: ReadonlyMap<string, string>;
  readonly reasons?: Readonly<Record<string, "new" | "learning" | "familiar">> | undefined;
}) {
  const voices = useEnglishVoices();
  const [voiceURI, setVoiceURI] = useState(readVoicePreference);
  const active = selectVoice(voices, voiceURI);

  const counts = useMemo(() => {
    let handled = 0;
    for (const entry of lexicon) {
      const stage = stages.get(entry.senseId);
      if (stage && stage !== "candidate") handled += 1;
    }
    return { handled, total: lexicon.length };
  }, [lexicon, stages]);

  if (lexicon.length === 0) return null;

  return (
    <section className="word-list" aria-label="本课外语词">
      <p className="eyebrow">ENGLISH IN THIS LESSON</p>
      <h3>
        {counts.total} 个词 · 已处理 {counts.handled}
      </h3>
      {voices.length > 1 ? (
        <label className="word-list__voice">
          <span>朗读声音</span>
          {/*
            No ranking is right on every machine, and the person listening is
            the only one who can hear the result. The default is the best-ranked
            local voice; this is the escape hatch when that judgement is wrong.
          */}
          <select
            value={active?.voiceURI ?? ""}
            onChange={(event) => {
              setVoiceURI(event.target.value);
              writeVoicePreference(event.target.value);
              const chosen = voices.find((voice) => voice.voiceURI === event.target.value);
              if (chosen) speakWord("preview", chosen);
            }}
          >
            {voices.map((voice) => (
              <option key={voice.voiceURI} value={voice.voiceURI}>
                {voice.name}（{voice.lang}）
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <ul className="word-list__items">
        {/* Words the learner has not met lead the list. The ones they have
            claimed stay visible — this is also where they take it back — but
            they sink, so the list answers "what is new here" at a glance. */}
        {lexicon
          .toSorted(
            (left, right) =>
              (REASON_RANK[reasons?.[left.senseId] ?? "new"] ?? 0) -
              (REASON_RANK[reasons?.[right.senseId] ?? "new"] ?? 0),
          )
          .map((entry) => {
            const stage = stages.get(entry.senseId);
            const presentation = stage ? STAGE_PRESENTATION[stage] : undefined;
            return (
              <li key={entry.senseId} data-reason={reasons?.[entry.senseId]}>
                <button
                  type="button"
                  className="word-list__word"
                  onClick={() => {
                    const anchor = document.querySelector<HTMLElement>(
                      `[data-sense-id="${CSS.escape(entry.senseId)}"]`,
                    );
                    anchor?.scrollIntoView({ block: "center", behavior: "smooth" });
                    anchor?.focus();
                  }}
                >
                  <span lang="en">{entry.headword}</span>
                  <small>{entry.gloss}</small>
                </button>
                {presentation ? (
                  <GameBadge tone={presentation.tone}>{presentation.label}</GameBadge>
                ) : null}
              </li>
            );
          })}
      </ul>
    </section>
  );
}
