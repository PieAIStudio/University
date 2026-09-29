import type { View } from "@pieai/university-core";
import { CosmeticsPanel } from "@pieai/university-ui";
import { AvatarChip, type AvatarRecipe } from "@pieai/university-world/avatar.js";
import { cosmeticOwner, cosmeticsStore } from "../cosmetics/store.js";
import { progressPort } from "../progress/store.js";

export default function WardrobeScreen({
  avatarRecipe,
  signedIn,
  onOpen,
}: {
  readonly avatarRecipe: AvatarRecipe | null;
  readonly signedIn: boolean;
  readonly onOpen: (view: View) => void;
}) {
  return (
    <CosmeticsPanel
      store={cosmeticsStore}
      owner={cosmeticOwner()}
      onBack={() => onOpen({ kind: "me" })}
      onSignIn={() => onOpen({ kind: "me" })}
      avatar={<AvatarChip recipe={avatarRecipe ?? undefined} signedIn={signedIn} size={144} />}
      sound={progressPort.accountData().preferences.soundEnabled}
    />
  );
}
