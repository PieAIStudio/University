import { useCallback, useMemo } from "react";

import {
  avatarRecipeForAccount,
  avatarRecipeFromAccount,
  type AvatarRecipe,
} from "@pieai/university-world/avatar.js";

import { progressPort } from "../progress/store";

interface AvatarPreferencesOptions {
  readonly accountAvatarRecipe: string | null | undefined;
  readonly signedIn: boolean;
}

/** Keep the account representation and the renderer's recipe together. */
export function useAvatarPreferences({ accountAvatarRecipe, signedIn }: AvatarPreferencesOptions) {
  const avatarRecipe = useMemo(
    () => avatarRecipeFromAccount(accountAvatarRecipe),
    [accountAvatarRecipe],
  );
  const saveAvatarRecipe = useCallback(
    (recipe: AvatarRecipe) => {
      if (!signedIn) return;
      const preferences = progressPort.accountData().preferences;
      progressPort.setAccountPreferences({
        ...preferences,
        avatarRecipe: avatarRecipeForAccount(recipe),
      });
    },
    [signedIn],
  );

  return { avatarRecipe, saveAvatarRecipe };
}
