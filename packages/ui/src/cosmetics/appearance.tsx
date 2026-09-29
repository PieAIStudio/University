import { createContext, useContext, type ReactNode } from "react";
import type { CosmeticSlot } from "@pieai/university-core";
import "../assets.js";
import "./cosmetics.css";
import crown from "@pieai/swimmer-ui-kit/assets/game/ui/clay/phase03-clay-kit/icons/function/crown-v1.png";
import { KNOWLEDGE_CARD_ART, KNOWLEDGE_CARD_BACK } from "../reference/knowledge-card-art.js";

export const COSMETIC_NAMES = {
  "face-meadow": "cosmetics.item.faceMeadow",
  "face-harbour": "cosmetics.item.faceHarbour",
  "face-dusk": "cosmetics.item.faceDusk",
  "face-sunrise": "cosmetics.item.faceSunrise",
  "back-book": "cosmetics.item.backBook",
  "back-compass": "cosmetics.item.backCompass",
  "back-gem": "cosmetics.item.backGem",
  "back-crown": "cosmetics.item.backCrown",
  "avatar-flower": "cosmetics.item.avatarFlower",
  "avatar-bow": "cosmetics.item.avatarBow",
  "avatar-beanie": "cosmetics.item.avatarBeanie",
  "avatar-crown": "cosmetics.item.avatarCrown",
  "island-flower": "cosmetics.item.islandFlower",
  "island-crystal": "cosmetics.item.islandCrystal",
  "island-banner": "cosmetics.item.islandBanner",
  "island-crown": "cosmetics.item.islandCrown",
  "avatar-set-band": "cosmetics.item.avatarSetBand",
} as const;
export type KnownCosmetic = keyof typeof COSMETIC_NAMES;
export function knownCosmetic(id: string): id is KnownCosmetic {
  return Object.hasOwn(COSMETIC_NAMES, id);
}
const ART: Record<KnownCosmetic, string> = {
  "face-meadow": KNOWLEDGE_CARD_ART.frontend,
  "face-harbour": KNOWLEDGE_CARD_ART.backend,
  "face-dusk": KNOWLEDGE_CARD_ART.design,
  "face-sunrise": KNOWLEDGE_CARD_ART.technology,
  "back-book": KNOWLEDGE_CARD_ART.frontend,
  "back-compass": KNOWLEDGE_CARD_ART.product,
  "back-gem": KNOWLEDGE_CARD_ART.design,
  "back-crown": crown,
  "avatar-flower": KNOWLEDGE_CARD_ART.frontend,
  "avatar-bow": KNOWLEDGE_CARD_ART.design,
  "avatar-beanie": KNOWLEDGE_CARD_ART.backend,
  "avatar-crown": crown,
  "island-flower": KNOWLEDGE_CARD_ART.frontend,
  "island-crystal": KNOWLEDGE_CARD_ART.design,
  "island-banner": KNOWLEDGE_CARD_ART.product,
  "island-crown": crown,
  "avatar-set-band": KNOWLEDGE_CARD_ART.product,
};
export function cosmeticArt(id: string | undefined): string | undefined {
  return id && knownCosmetic(id) ? ART[id] : undefined;
}
const EMPTY: Readonly<Partial<Record<CosmeticSlot, string>>> = Object.freeze({});
const Appearance = createContext(EMPTY);
/** Presentation only: the host supplies its current account's server receipt. */
export function CosmeticAppearanceProvider({
  equipped,
  children,
}: {
  readonly equipped?: Readonly<Partial<Record<CosmeticSlot, string>>>;
  readonly children: ReactNode;
}) {
  return <Appearance.Provider value={equipped ?? EMPTY}>{children}</Appearance.Provider>;
}
export function useCardCosmetics() {
  const equipped = useContext(Appearance);
  return {
    face: knownCosmetic(equipped.face ?? "") ? equipped.face : undefined,
    backArt: cosmeticArt(equipped.back) ?? KNOWLEDGE_CARD_BACK,
  };
}
