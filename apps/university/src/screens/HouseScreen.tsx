import { useMemo, useState, useSyncExternalStore } from "react";
import { GameModal } from "@pieai/swimmer-ui-kit";
import {
  chooseMarkStyle,
  parseHouseState,
  placeItem,
  type ProgressDocument,
  type View,
} from "@pieai/university-core";
import { CosmeticsPanel, HouseRoom, useI18n } from "@pieai/university-ui";
import type { Shelf } from "@pieai/university-ui/content/port.js";
import { AvatarChip, type AvatarRecipe } from "@pieai/university-world/avatar.js";
import { cosmeticOwner, cosmeticsStore } from "../cosmetics/store.js";
import { progressPort } from "../progress/store.js";
import { keepsakesOf, localDay, readHouse, saveHouse, takeArrival } from "./house-keepsakes.js";

export default function HouseScreen({
  shelf,
  progress,
  avatarRecipe,
  signedIn,
  highlight,
  onOpen,
}: {
  readonly shelf: Shelf | null;
  readonly progress: ProgressDocument;
  readonly avatarRecipe: AvatarRecipe | null;
  readonly signedIn: boolean;
  /** A keepsake just carried in from a chest. */
  readonly highlight?: string | null;
  readonly onOpen: (view: View) => void;
}) {
  const raw = useSyncExternalStore(progressPort.subscribe, readHouse, readHouse);
  const house = useMemo(() => parseHouseState(JSON.parse(raw)), [raw]);
  const keepsakes = useMemo(() => keepsakesOf(shelf, progress), [shelf, progress]);
  const t = useI18n();
  const [arrived] = useState(takeArrival);
  const [wardrobe, setWardrobe] = useState<"rack" | "packs" | null>(null);
  const now = () => new Date().toISOString();
  return (
    <>
      <HouseRoom
        keepsakes={keepsakes}
        house={house}
        today={localDay()}
        highlight={highlight ?? arrived}
        avatar={<AvatarChip recipe={avatarRecipe ?? undefined} signedIn={signedIn} size={120} />}
        onPlace={(id, x, y) => saveHouse(placeItem(house, id, x, y, now()))}
        onMarkStyle={(style) => saveHouse(chooseMarkStyle(house, style, now()))}
        onOpenWardrobe={setWardrobe}
        onOpenSegment={(keepsake) =>
          onOpen({ kind: "course", studyId: keepsake.studyId, courseId: keepsake.courseId })
        }
      />
      {wardrobe ? (
        <GameModal
          open
          title={t.t(wardrobe === "rack" ? "house.rack" : "house.packs")}
          onClose={() => setWardrobe(null)}
        >
          <CosmeticsPanel
            store={cosmeticsStore}
            owner={cosmeticOwner()}
            onBack={() => setWardrobe(null)}
            onSignIn={() => onOpen({ kind: "me" })}
            avatar={
              <AvatarChip recipe={avatarRecipe ?? undefined} signedIn={signedIn} size={144} />
            }
            sound={progressPort.accountData().preferences.soundEnabled}
          />
        </GameModal>
      ) : null}
    </>
  );
}
