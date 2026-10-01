import type { LessonStageCue } from "@pieai/university-core";
import type { AvatarRecipe } from "@pieai/university-world/avatar.js";
import { hasWebGLContext } from "@pieai/university-world/webgl-capability.js";
import { lazy, Suspense, useState } from "react";

const LessonStage = lazy(() =>
  import("@pieai/university-world/game-kit.js").then((m) => ({ default: m.LessonStage })),
);

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * A step lesson's 3D stage (V7 amendment one), with the learner's own avatar.
 * Without WebGL, under reduced motion or after a render failure it draws
 * nothing and the reader's reserved band stays a plain colour: a capability
 * fallback, never a mode branch, and the lesson goes on either way.
 */
export function LessonStageHost({
  cue,
  recipe,
}: {
  readonly cue: LessonStageCue;
  readonly recipe?: AvatarRecipe | null;
}) {
  const [drawable] = useState(() => hasWebGLContext() && !prefersReducedMotion());
  const [failed, setFailed] = useState(false);
  if (!drawable || failed) return null;
  return (
    <Suspense fallback={null}>
      <LessonStage
        cue={cue}
        recipe={recipe ?? null}
        aiLabel="AI"
        onFailure={() => setFailed(true)}
      />
    </Suspense>
  );
}
