import { lazy } from "react";

export const AvatarCompare = lazy(() =>
  import("../avatar-compare/AvatarCompare.js").then((mod) => ({ default: mod.AvatarCompare })),
);
