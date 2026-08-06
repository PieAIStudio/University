import { useEffect, useRef, useState } from "react";

export interface LexiconEntry {
  readonly senseId: string;
  readonly headword: string;
  readonly phonetic: string;
  readonly partOfSpeech: string;
  readonly gloss: string;
  readonly usage: string;
  readonly track: "technical" | "general";
}

/**
 * Speaks a word using a voice that lives on this machine.
 *
 * Chrome lists cloud voices alongside local ones, and speaking through one
 * sends the text to a server. This project's whole promise is that nothing it
 * renders reaches the network on its own — the same reason external images are
 * blocked — so an unverified voice is not a fallback, it is the failure. When
 * no local English voice exists the button says so instead of quietly working
 * in a way the learner did not agree to.
 */
function findLocalEnglishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  return voices.find((voice) => voice.localService && /^en(-|$)/i.test(voice.lang)) ?? null;
}

export type VocabularyStage = "learning" | "familiar" | "paused";

export function WordPopover({
  entry,
  stage,
  onDismiss,
  onStage,
}: {
  readonly entry: LexiconEntry;
  readonly stage?: string | undefined;
  readonly onDismiss: () => void;
  readonly onStage?: ((stage: VocabularyStage) => void) | undefined;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null);

  useEffect(() => {
    // Voices load asynchronously on first use, so the list is often empty on
    // the first read and arrives on the event.
    const update = () => setVoice(findLocalEnglishVoice());
    update();
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.addEventListener("voiceschanged", update);
      return () => window.speechSynthesis.removeEventListener("voiceschanged", update);
    }
    return undefined;
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onDismiss]);

  function speak() {
    if (!voice) return;
    const utterance = new SpeechSynthesisUtterance(entry.headword);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  return (
    <div
      className="word-popover"
      role="dialog"
      aria-label={`${entry.headword} 的释义`}
      ref={panelRef}
      tabIndex={-1}
    >
      <p className="word-popover__head">
        <span lang="en" className="word-popover__word">
          {entry.headword}
        </span>
        <span className="word-popover__phonetic">{entry.phonetic}</span>
        <span className="word-popover__pos">{entry.partOfSpeech}</span>
      </p>
      <p className="word-popover__gloss">{entry.gloss}</p>
      <p className="word-popover__usage">{entry.usage}</p>
      <div className="word-popover__actions">
        <button type="button" onClick={speak} disabled={!voice}>
          {voice ? "🔊 朗读" : "本机没有英语语音"}
        </button>
        <button type="button" onClick={onDismiss}>
          关闭
        </button>
      </div>
      {onStage ? (
        <div className="word-popover__stages">
          {/*
            Three buttons, no scoring. Opening this popover already says the
            learner stopped for the word; what it cannot say is why, so the
            learner says it. "认识" quiets the word without claiming mastery —
            it stays scheduled until a retrieval on a later day earns that.
          */}
          <button
            type="button"
            className="word-popover__stage"
            aria-pressed={stage === "learning"}
            onClick={() => onStage("learning")}
          >
            不熟 · 加入复习
          </button>
          <button
            type="button"
            className="word-popover__stage"
            aria-pressed={stage === "familiar" || stage === "stable"}
            onClick={() => onStage("familiar")}
          >
            认识
          </button>
          <button
            type="button"
            className="word-popover__stage"
            aria-pressed={stage === "paused"}
            onClick={() => onStage("paused")}
          >
            暂不学这个
          </button>
        </div>
      ) : null}
      {voice ? null : (
        <p className="word-popover__note">
          只用本机语音朗读。系统里没装英语语音时不联网合成 —— 音标仍然可以照着念。
        </p>
      )}
    </div>
  );
}
