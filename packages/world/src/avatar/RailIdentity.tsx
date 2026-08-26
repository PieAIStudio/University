/**
 * Who you are, at the foot of the nav rail. One implementation, both shells.
 *
 * This exists because of a bug the boss found by opening the two shells side by
 * side: the authoring campus had no avatar and the delivery campus did. Nothing
 * was forked — `UniversityShell` is one component and both shells render it.
 * What differed was that its `identity` slot is optional, so one shell passed
 * an avatar and the other passed nothing, and an optional prop left empty looks
 * exactly like an optional prop nobody needed. The compiler cannot tell those
 * apart, and neither can a reviewer reading one file.
 *
 * Sharing a component is not the same as sharing a decision. The counter row
 * learned this first — `universityCounters` exists for the same reason — and
 * the cure is the same: the answer to "what does University put here" lives in
 * one place, and a shell may choose where the click goes and nothing else.
 *
 * It lives in `packages/world` rather than beside `universityCounters` in
 * `packages/ui` because the avatar is WebGL, and `packages/ui` is held at zero
 * `three` so a test of the lesson reader never has to stand up a GL mock.
 */
import type { AvatarRecipe } from "@pieai/swimmer-avatar-kit";
import { Suspense } from "react";

import { AvatarChip } from "./AvatarChip.js";

/**
 * 78px, and that number is measured rather than chosen.
 *
 * It first sat in the counter capsule at 38–44px, where a 3D bust rendered as a
 * coloured dot — there is no detail small enough to survive that box. The rail
 * foot is the only slot in the chrome wide enough for a face.
 */
export const RAIL_IDENTITY_SIZE = 78;

export function RailIdentity({
  recipe,
  signedIn = false,
  onOpen,
}: {
  /** A signed-in learner wears their own recipe; a guest wears the stable default. */
  readonly recipe?: AvatarRecipe | null;
  readonly signedIn?: boolean;
  /** Where "me" is. The one thing a shell is allowed to answer differently. */
  readonly onOpen: () => void;
}) {
  return (
    // Suspense because the avatar drags in the kit's geometry builder, and the
    // rail must not wait on it — the rail is how you leave this screen.
    <Suspense fallback={<span className="avatar-chip avatar-chip--placeholder" />}>
      <AvatarChip
        recipe={recipe ?? undefined}
        signedIn={signedIn}
        size={RAIL_IDENTITY_SIZE}
        onClick={onOpen}
      />
    </Suspense>
  );
}
