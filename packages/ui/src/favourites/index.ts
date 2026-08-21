export { FavouriteStar } from "./FavouriteStar.js";
export { favouriteStarLabel, shouldPlayFavouriteSound } from "./favourite-star.js";
export {
  FAVOURITES_EMPTY_ACTION,
  FAVOURITES_EMPTY_DESCRIPTION,
  FAVOURITES_EMPTY_TITLE,
  FavouritesEmpty,
} from "./FavouritesEmpty.js";
export {
  FAVOURITES_STORAGE_KEY,
  createLocalFavouritesStore,
  readLocalFavourites,
  writeLocalFavourites,
  type FavouritesStore,
} from "./storage.js";
