import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { GameButton, playGameCardRevealSound } from "@pieai/swimmer-ui-kit";
import { knowledgeRevealOrder, type KnowledgeAlbumCard } from "@pieai/university-core";
import { useI18n } from "../i18n/index.js";
import { CARD_RARITY, KnowledgeCardFace } from "./KnowledgeCard.js";

/** A finite presentation of already-earned cards. No progress writes, random
 * outcomes or independent sound unlock; leaving cancels the pending reveal. */
export function KnowledgeReveal({
  cards,
  reducedMotion,
  sound = false,
  onComplete,
}: {
  readonly cards: readonly KnowledgeAlbumCard[];
  readonly reducedMotion: boolean;
  readonly sound?: boolean;
  readonly onComplete: () => void;
}) {
  const t = useI18n();
  const ordered = useMemo(() => knowledgeRevealOrder(cards), [cards]);
  const [shown, setShown] = useState(reducedMotion ? ordered.length : 0);
  const complete = useRef(onComplete);
  complete.current = onComplete;
  const reported = useRef(false);
  const lastSound = useRef(0);
  const row = useRef<HTMLOListElement>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const [turned, setTurned] = useState<Readonly<Record<string, boolean>>>({});
  const active = viewing ?? Math.max(0, shown - 1);

  // Scroll only the card tray, never the island/page or keyboard focus. The
  // final rare card used to flip outside the phone's visible tray altogether.
  useLayoutEffect(() => {
    const tray = row.current;
    if (!tray || reducedMotion) return;
    const center = (smooth: boolean) => {
      const card = tray.children.item(active) as HTMLElement | null;
      if (!card) return;
      const left = Math.max(
        0,
        Math.min(
          tray.scrollWidth - tray.clientWidth,
          card.offsetLeft + card.offsetWidth / 2 - tray.clientWidth / 2,
        ),
      );
      if (typeof tray.scrollTo === "function")
        tray.scrollTo({ left, behavior: smooth ? "smooth" : "instant" });
      else tray.scrollLeft = left;
    };
    center(true);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => center(false));
    observer.observe(tray);
    return () => observer.disconnect();
  }, [active, reducedMotion]);

  useEffect(() => {
    if (reducedMotion && shown < ordered.length) {
      setShown(ordered.length);
      return;
    }
    if (shown >= ordered.length) {
      if (!reported.current) {
        reported.current = true;
        complete.current();
      }
      return;
    }
    const timer = window.setTimeout(() => setShown((count) => count + 1), 600);
    return () => window.clearTimeout(timer);
  }, [ordered.length, shown, reducedMotion]);
  useEffect(() => {
    if (shown > lastSound.current && sound && !reducedMotion && ordered[shown - 1])
      playGameCardRevealSound(CARD_RARITY[ordered[shown - 1]!.tier]);
    lastSound.current = shown;
  }, [shown, ordered, sound, reducedMotion]);
  return (
    <section
      className="knowledge-reveal"
      aria-label={t.t("album.reveal")}
      data-knowledge-revealed={shown}
      data-reduced-motion={reducedMotion}
      data-reveal-active={ordered[active]?.head.id}
    >
      <p role="status">{t.t("album.revealCount", { count: shown, total: ordered.length })}</p>
      <ol className="knowledge-reveal__cards" ref={row}>
        {ordered.map((card, index) => (
          <li
            key={card.head.id}
            data-reveal-card={card.head.id}
            data-revealed={index < shown}
            inert={index >= shown}
            onFocus={() => {
              if (index < shown) setViewing(index);
            }}
          >
            <KnowledgeCardFace
              card={card}
              faceDown={index >= shown || turned[card.head.id] === true}
              onFlip={(down) => {
                if (index < shown) setTurned((previous) => ({ ...previous, [card.head.id]: down }));
              }}
              sound={sound}
              spotlight={
                !reducedMotion &&
                index === ordered.length - 1 &&
                index < shown &&
                card.tier !== "new"
              }
            />
          </li>
        ))}
      </ol>
      {!reducedMotion && shown === ordered.length && ordered.length > 1 ? (
        <div className="knowledge-reveal__navigation">
          <GameButton
            variant="ghost"
            static
            data-reveal-previous
            disabled={active === 0}
            onClick={() => setViewing(Math.max(0, active - 1))}
          >
            {t.t("album.revealPrevious")}
          </GameButton>
          <GameButton
            variant="ghost"
            static
            data-reveal-next
            disabled={active === ordered.length - 1}
            onClick={() => setViewing(Math.min(ordered.length - 1, active + 1))}
          >
            {t.t("album.revealNext")}
          </GameButton>
        </div>
      ) : null}
      {shown < ordered.length ? (
        <GameButton variant="ghost" static onClick={() => setShown(ordered.length)}>
          {t.t("album.revealSkip")}
        </GameButton>
      ) : null}
    </section>
  );
}
