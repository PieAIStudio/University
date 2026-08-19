import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  safePolygon,
  shift,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import { useState } from "react";

import { readVoicePreference, selectVoice, speakWord, useEnglishVoices } from "./speech.js";

/**
 * Re-exported, not redeclared. The lexicon entry this popover renders is the
 * same one the server validates and sends, and it already has a home in
 * `src/domain/schemas.ts`. A hand-written copy here was structurally identical,
 * which is exactly why it was dangerous: TypeScript accepted both, so the two
 * could have drifted a field apart without a single error.
 */
import type { LexiconEntry } from "../domain/schemas.js";
import type { ForeignSettings } from "./foreign-settings.js";

export type { LexiconEntry };

export type VocabularyStage = "learning" | "familiar" | "paused";

/**
 * How long the cursor has to sit still on a word before its card appears.
 *
 * `restMs` rather than a plain open delay because these words sit inline in
 * prose: a delay opens a card for every word the pointer *crosses* on its way
 * somewhere else, which turns reading into a slideshow. Requiring the cursor
 * to come to rest asks the question the card answers — "what is this word?" —
 * instead of guessing from a trajectory.
 */
const HOVER_REST_MS = 90;
/**
 * Grace period before a card closes after the pointer leaves. Paired with
 * `safePolygon`, which keeps it open while the pointer travels *toward* the
 * card: without that, moving diagonally from the word to the 「认识」 button
 * exits both elements mid-journey and the card vanishes under the cursor.
 */
const HOVER_CLOSE_MS = 160;

/**
 * A word in the lesson body, and the card that explains it.
 *
 * Three ways in, because three kinds of reader arrive here. Resting the pointer
 * opens it for a glance. Clicking *pins* it, so the pointer can leave without
 * taking the card with it — the card holds buttons, and a panel that evaporates
 * when you reach for its buttons is not a panel. Keyboard focus opens it too,
 * which is the only route a keyboard user has; a hover-only card would put the
 * vocabulary controls permanently out of their reach.
 */
export function WordAnchor({
  entry,
  original,
  stage,
  reason,
  onStage,
  settings,
}: {
  readonly entry: LexiconEntry;
  readonly original: React.ReactNode;
  readonly settings: ForeignSettings;
  readonly stage?: string | undefined;
  /**
   * Why this word is on the page. A word the learner has already claimed stays
   * in the text — seeing it again in context is most of what makes it stick —
   * but it stops competing for attention with the words they have not met.
   */
  readonly reason?: "new" | "learning" | "familiar" | undefined;
  readonly onStage?: ((stage: VocabularyStage) => void) | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: (next) => {
      setOpen(next);
      if (!next) setPinned(false);
    },
    placement: "bottom-start",
    // Without these a word near the right edge or the bottom of the viewport
    // opens its card off-screen. The old card was absolutely positioned by CSS
    // and had no idea where the viewport ended.
    middleware: [offset(10), flip({ padding: 12 }), shift({ padding: 12 })],
    whileElementsMounted: autoUpdate,
  });

  const hover = useHover(context, {
    // A pinned card is a deliberate act; pointer movement must not undo it.
    enabled: !pinned,
    // Touch has no hover. Leaving this false makes a tap open *and* immediately
    // re-trigger the card, so touch goes through the click path instead.
    mouseOnly: true,
    restMs: HOVER_REST_MS,
    delay: { close: HOVER_CLOSE_MS },
    handleClose: safePolygon({ buffer: 6 }),
  });
  const focus = useFocus(context);
  const dismiss = useDismiss(context, { escapeKey: true, outsidePress: true });
  const role = useRole(context, { role: "dialog" });
  const { getReferenceProps, getFloatingProps } = useInteractions([hover, focus, dismiss, role]);

  return (
    <span className="word-anchor">
      <button
        type="button"
        className="word-anchor__trigger"
        // The side panel lists these words and scrolls to the one you pick;
        // this is how it finds the occurrence in the body.
        data-sense-id={entry.senseId}
        data-pinned={pinned || undefined}
        data-reason={reason}
        data-mark={settings.markStyle}
        ref={refs.setReference}
        {...getReferenceProps({
          onClick: () => {
            if (pinned) {
              setPinned(false);
              setOpen(false);
              return;
            }
            setPinned(true);
            setOpen(true);
          },
        })}
      >
        <span lang="en">{entry.headword}</span>
        {/*
          The Chinese is printed beside the English, or it is not, and that one
          choice decides what the layer is for. Beside it, the reader is never
          stuck. Absent, meeting the word is an attempt at recall — which is
          what actually leaves a trace — and the meaning is still one hover
          away, so the effort stays brief rather than punishing.
        */}
        {settings.showOriginal ? (
          <span className="word-anchor__original">（{original}）</span>
        ) : null}
      </button>
      {open ? (
        <FloatingPortal>
          {/*
            `modal={false}` and `initialFocus={-1}`: the card must never steal
            focus, because most of the time it opened because a pointer paused
            nearby, not because anyone asked to go there. The manager is still
            what routes Tab into the card for a keyboard user who did.
          */}
          <FloatingFocusManager context={context} modal={false} initialFocus={-1}>
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              className="word-popover"
              aria-label={`${entry.headword} 的释义`}
              {...getFloatingProps()}
            >
              <WordPopoverBody
                entry={entry}
                settings={settings}
                stage={stage}
                pinned={pinned}
                onDismiss={() => {
                  setPinned(false);
                  setOpen(false);
                }}
                {...(onStage ? { onStage } : {})}
              />
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      ) : null}
    </span>
  );
}

function WordPopoverBody({
  entry,
  settings,
  stage,
  pinned,
  onDismiss,
  onStage,
}: {
  readonly entry: LexiconEntry;
  readonly settings: ForeignSettings;
  readonly stage?: string | undefined;
  readonly pinned: boolean;
  readonly onDismiss: () => void;
  readonly onStage?: ((stage: VocabularyStage) => void) | undefined;
}) {
  const voices = useEnglishVoices();
  const voice = selectVoice(voices, readVoicePreference());

  return (
    <>
      <button
        type="button"
        className="word-popover__close"
        onClick={onDismiss}
        aria-label="关闭释义"
        title={pinned ? "关闭（也可按 Esc）" : "移开鼠标即可关闭"}
      >
        ×
      </button>
      <p className="word-popover__head">
        <span lang="en" className="word-popover__word">
          {entry.headword}
        </span>
        {settings.showPhonetic ? (
          <span className="word-popover__phonetic">{entry.phonetic}</span>
        ) : null}
        <span className="word-popover__pos">{entry.partOfSpeech}</span>
      </p>
      {/* The gloss is never optional: this card is the way out of a word the
          reader does not know, and a card that can withhold the meaning is a
          dead end rather than a setting. */}
      <p className="word-popover__gloss">{entry.gloss}</p>
      {settings.showUsage ? <p className="word-popover__usage">{entry.usage}</p> : null}
      {settings.showSpeak ? (
        <div className="word-popover__actions">
          <button
            type="button"
            onClick={() => voice && speakWord(entry.headword, voice)}
            disabled={!voice}
          >
            {voice ? "🔊 朗读" : "本机没有英语语音"}
          </button>
        </div>
      ) : null}
      {onStage && settings.showStageButtons ? (
        <div className="word-popover__stages">
          {/*
            Three buttons, no scoring. Opening this card already says the
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
            还不熟 · 加入复习
          </button>
          <button
            type="button"
            className="word-popover__stage"
            aria-pressed={stage === "familiar" || stage === "stable"}
            onClick={() => onStage("familiar")}
          >
            本来就会 · 以后不提示
          </button>
          <button
            type="button"
            className="word-popover__stage"
            aria-pressed={stage === "paused"}
            onClick={() => onStage("paused")}
          >
            暂不学 · 这个词义不对
          </button>
        </div>
      ) : null}
      {/* Only worth explaining when speech was asked for and cannot be given. */}
      {settings.showSpeak && !voice ? (
        <p className="word-popover__note">
          只用本机语音朗读。系统里没装英语语音时不联网合成 —— 音标仍然可以照着念。
        </p>
      ) : null}
    </>
  );
}
