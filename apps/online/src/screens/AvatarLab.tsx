import { lazy } from "react";

export const AvatarLab = lazy(() =>
  import("../avatar-lab/AvatarLab.js").then((mod) => ({ default: mod.AvatarLab })),
);
