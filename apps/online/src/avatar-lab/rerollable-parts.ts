import { PARTS } from "@pieai/swimmer-avatar-kit";

/** Kit `rerollPart` throws on unknown ids; the dock only offers these. */
export const REROLLABLE_PARTS = PARTS.filter((part) => part.id !== "body" && part.id !== "frame");
