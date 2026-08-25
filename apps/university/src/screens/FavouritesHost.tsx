import { createProgressFavouritesStore } from "@pieai/university-ui";

import { progressPort } from "../progress/store";

export const FAVOURITES_STORE = createProgressFavouritesStore(progressPort);
