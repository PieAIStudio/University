import { useMemo, useState } from "react";
import { playSound } from "../sound/index.js";
import { GameBadge } from "@pieai/swimmer-ui-kit";

import { Tip } from "../Tip.js";
import { ForeignSettingsPanel } from "../language/ForeignSettingsPanel.js";
import type { ForeignSettings } from "../language/foreign-settings.js";
import type { LexiconEntry } from "../language/WordPopover.js";
import {
  readSpeechQualityPreference,
  readVoicePreference,
  selectSpeechVoice,
  speakWord,
  useEnglishVoices,
  writeVoicePreference,
  type SpeechQuality,
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
  familiar: { label: "本来就会", tone: "success" },
  stable: { label: "跨日检索稳定", tone: "success" },
  paused: { label: "暂不学", tone: "neutral" },
  candidate: { label: "待判断", tone: "neutral" },
};

const REASON_RANK: Record<string, number> = { learning: 0, new: 1, familiar: 2 };

/**
 * The English words this lesson actually annotates, and where each one stands.
 *
 * Turning English mode on used to change only the body text, which left the
 * learner with no way to answer "how many words are in this lesson, and which
 * ones have I already dealt with" short of hovering every underline. The rail
 * beside the lesson had the room for it and was showing nothing.
 *
 * Renders nothing when the lesson has no lexicon — an empty word panel is
 * chrome announcing its own emptiness.
 */
export function LessonWordList({
  lexicon,
  stages,
  reasons,
  onStageWord,
  settings,
  speechQuality,
  onSettingsChange,
}: {
  readonly lexicon: readonly LexiconEntry[];
  readonly stages: ReadonlyMap<string, string>;
  readonly reasons?: Readonly<Record<string, "new" | "learning" | "familiar">> | undefined;
  readonly onStageWord?:
    | ((senseId: string, stage: "learning" | "familiar" | "paused") => void)
    | undefined;
  readonly settings: ForeignSettings;
  readonly speechQuality?: SpeechQuality;
  readonly onSettingsChange: (next: ForeignSettings) => void;
}) {
  const voices = useEnglishVoices();
  const [voiceURI, setVoiceURI] = useState(readVoicePreference);
  const selectedQuality = speechQuality ?? readSpeechQualityPreference();
  const selection = selectSpeechVoice(voices, selectedQuality, voiceURI);
  const active = selection.voice;

  const { activeEntries, historyEntries } = useMemo(() => {
    const activeEntries: LexiconEntry[] = [];
    const historyEntries: LexiconEntry[] = [];
    for (const entry of lexicon) {
      const stage = stages.get(entry.senseId);
      if (stage === "learning" || stage === undefined || stage === "candidate") {
        activeEntries.push(entry);
      } else {
        historyEntries.push(entry);
      }
    }
    const rank = (entry: LexiconEntry) => {
      const stage = stages.get(entry.senseId);
      if (stage === "learning") return 0;
      return REASON_RANK[reasons?.[entry.senseId] ?? "new"] ?? 1;
    };
    activeEntries.sort((left, right) => rank(left) - rank(right));
    return { activeEntries, historyEntries };
  }, [lexicon, stages, reasons]);

  if (lexicon.length === 0) return null;

  return (
    <section
      className={`word-list${activeEntries.length === 0 ? " word-list--quiet" : ""}`}
      aria-label="生词"
    >
      <div className="rail-panel__header">
        <h3 className="rail-panel__label">生词</h3>
        <Tip term="lesson-vocabulary" className="rail-panel__help">
          <span aria-label="关于生词">?</span>
        </Tip>
        <ForeignSettingsPanel settings={settings} onChange={onSettingsChange} />
      </div>
      {activeEntries.length > 0 ? (
        <p className="word-list__summary">
          {activeEntries.length} 个要留意
          {historyEntries.length > 0 ? ` · ${historyEntries.length} 个已处理` : ""}
        </p>
      ) : null}
      {/* Picking a voice is only a question for someone who is listening. */}
      {settings.showSpeak && activeEntries.length > 0 && selection.voices.length > 1 ? (
        <label className="word-list__voice">
          <span>朗读声音</span>
          {/*
            No ranking is right on every machine, and the person listening is
            the only one who can hear the result. The default is the best-ranked
            voice in the resolved quality tier; this is the escape hatch when
            that judgement is wrong.
          */}
          <select
            value={active?.voiceURI ?? ""}
            onChange={(event) => {
              setVoiceURI(event.target.value);
              writeVoicePreference(event.target.value);
              const chosen = selection.voices.find(
                (voice) => voice.voiceURI === event.target.value,
              );
              if (chosen) speakWord("preview", chosen);
            }}
          >
            {selection.voices.map((voice) => (
              <option key={voice.voiceURI} value={voice.voiceURI}>
                {voice.name}（{voice.lang}）
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {activeEntries.length > 0 ? (
        <ul className="word-list__items">
          {activeEntries.map((entry) => {
            const stage = stages.get(entry.senseId);
            const presentation = stage ? STAGE_PRESENTATION[stage] : undefined;
            return (
              <WordListItem
                key={entry.senseId}
                entry={entry}
                reason={reasons?.[entry.senseId] ?? "new"}
                presentation={presentation}
              />
            );
          })}
        </ul>
      ) : null}
      {historyEntries.length > 0 ? (
        <details className="word-list__history">
          <summary>已处理的词 · {historyEntries.length}（可撤销）</summary>
          <ul className="word-list__items">
            {historyEntries.map((entry) => {
              const stage = stages.get(entry.senseId);
              const presentation = stage ? STAGE_PRESENTATION[stage] : undefined;
              return (
                <li key={entry.senseId} data-reason="familiar" className="word-list__history-item">
                  <WordListItem entry={entry} reason="familiar" presentation={presentation} />
                  {onStageWord ? (
                    <button
                      type="button"
                      className="word-list__undo"
                      onClick={() => {
                        playSound("word.staged");
                        onStageWord(entry.senseId, "learning");
                      }}
                    >
                      重新加入复习
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function WordListItem({
  entry,
  reason,
  presentation,
}: {
  readonly entry: LexiconEntry;
  readonly reason: "new" | "learning" | "familiar";
  readonly presentation:
    | { readonly label: string; readonly tone: "warning" | "success" | "neutral" }
    | undefined;
}) {
  return (
    <>
      <button
        type="button"
        className="word-list__word"
        data-reason={reason}
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
      {presentation ? <GameBadge tone={presentation.tone}>{presentation.label}</GameBadge> : null}
    </>
  );
}
