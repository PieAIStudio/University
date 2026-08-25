import { LEXICON } from "../lesson/language";

export const LEXICON_BY_SENSE = new Map(LEXICON.map((entry) => [entry.senseId, entry]));
