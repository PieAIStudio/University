import {
  GameButton,
  GameCollectibleCard,
  GameCollectibleCardSlot,
  type GameCollectibleCardRarity,
  type GameCardTilt,
} from "@pieai/swimmer-ui-kit";
import { memo } from "react";
import {
  knowledgeCardPips,
  type KnowledgeAlbumCard,
  type KnowledgeCardTier,
} from "@pieai/university-core";
import { useI18n } from "../i18n/index.js";
import { KNOWLEDGE_CARD_ART, KNOWLEDGE_CARD_BACK } from "./knowledge-card-art.js";

export const CARD_RARITY: Record<KnowledgeCardTier, GameCollectibleCardRarity> = {
  new: "common",
  known: "rare",
  shining: "legendary",
};

/** The brand card owns flip/tilt/glare/sound; this adapter supplies teaching facts. */
export function KnowledgeCardFace({
  card,
  faceDown,
  spotlight = false,
  sound = false,
  tilt,
  onFlip,
}: {
  readonly card: KnowledgeAlbumCard;
  readonly faceDown?: boolean;
  readonly onFlip?: (faceDown: boolean) => void;
  readonly spotlight?: boolean;
  readonly sound?: boolean;
  readonly tilt?: GameCardTilt | null;
}) {
  const t = useI18n();
  const title = t.locale === "en" ? card.head.en || card.head.zh : card.head.zh;
  return (
    <GameCollectibleCard
      className="knowledge-card__face"
      rarity={CARD_RARITY[card.tier]}
      title={title}
      caption={card.head.tagline}
      setLabel={t.t(`album.category.${card.head.category}`)}
      rarityLabel={t.t(`album.tier.${card.tier}`)}
      pips={knowledgeCardPips(card.tier)}
      {...(card.starter ? { sticker: t.t("album.starter") } : {})}
      art={
        <img
          className="knowledge-card__art"
          src={KNOWLEDGE_CARD_ART[card.head.category]}
          alt=""
          draggable={false}
        />
      }
      back={
        <span className="knowledge-card__back">
          <img src={KNOWLEDGE_CARD_BACK} alt="" draggable={false} />
          <span>{title}</span>
          <span>{t.t("album.back")}</span>
        </span>
      }
      label={t.t("album.flip", {
        title,
        tier: t.t(`album.tier.${card.tier}`),
        description: card.head.tagline,
      })}
      {...(faceDown === undefined ? {} : { faceDown })}
      {...(onFlip ? { onFlip } : {})}
      spotlight={spotlight}
      sound={sound}
      tilt={tilt}
    />
  );
}

export const KnowledgeCardTile = memo(function KnowledgeCardTile({
  card,
  onOpen,
  onReview,
  sound = false,
  tilt,
  onActivate,
}: {
  readonly card: KnowledgeAlbumCard;
  readonly onOpen: (id: string) => void;
  readonly onReview?: () => void;
  readonly sound?: boolean;
  readonly tilt?: GameCardTilt | null;
  readonly onActivate?: (id: string) => void;
}) {
  const t = useI18n();
  const first = card.lessons.find((lesson) => !lesson.complete);
  const title = t.locale === "en" ? card.head.en || card.head.zh : card.head.zh;
  return (
    <article
      className="knowledge-card"
      data-concept-card={card.head.id}
      data-collected={card.collected}
      data-memory-tier={card.tier}
      onPointerEnter={() => card.collected && onActivate?.(card.head.id)}
      onFocusCapture={() => card.collected && onActivate?.(card.head.id)}
    >
      {card.collected ? (
        <KnowledgeCardFace card={card} sound={sound} tilt={tilt} />
      ) : (
        <GameCollectibleCardSlot
          label={`${title} · ${first ? t.t("album.unlock", { number: first.number }) : t.t("album.notYet")}`}
        />
      )}
      <div className="knowledge-card__actions">
        <GameButton
          variant="ghost"
          static
          data-concept-open
          aria-label={t.t("album.readLabel", { title })}
          onClick={() => onOpen(card.head.id)}
        >
          {t.t("album.read")}
        </GameButton>
        {card.reviewKeys.length > 0 && onReview ? (
          <GameButton variant="ghost" static onClick={onReview}>
            {t.t("album.review")}
          </GameButton>
        ) : null}
      </div>
    </article>
  );
});
