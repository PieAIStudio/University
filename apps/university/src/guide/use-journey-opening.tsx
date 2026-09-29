import { useEffect, useRef, type ReactNode } from "react";
import type { NerveOpeningController } from "@pieai/swimmer-nerve-kit/opening";

export interface JourneyOpening {
  readonly key: string;
  readonly topic: "wrap-up" | "continue";
  readonly message: string;
  readonly card: ReactNode;
  readonly autoHideMs?: number;
  readonly onShown?: () => void;
  readonly onClose: () => void;
}

/** A product invitation to the existing kit, not another queue or renderer. */
export function useJourneyOpening(
  controller: NerveOpeningController<ReactNode> | null,
  invitation: JourneyOpening | null,
  ready: boolean,
) {
  const current = useRef(invitation);
  current.current = invitation;
  const announced = useRef<{ controller: NerveOpeningController<ReactNode>; key: string } | null>(
    null,
  );
  useEffect(() => {
    if (!controller || !invitation || !ready) return;
    const expected = invitation.key;
    let alive = true,
      seen = false,
      closed = false;
    let shownKey: string | null = null;
    const observe = () => {
      if (!alive || current.current?.key !== expected) return;
      const view = controller.getSnapshot();
      if (view.closed) return;
      if (view.current?.topic === invitation.topic) {
        shownKey = view.current.key;
        if (!seen) {
          seen = true;
          if (announced.current?.controller !== controller || announced.current.key !== expected) {
            announced.current = { controller, key: expected };
            current.current.onShown?.();
          }
        }
      } else if (seen && !closed) {
        closed = true;
        current.current.onClose();
      }
    };
    const off = controller.subscribe(observe);
    controller.offer({
      topic: invitation.topic,
      message: invitation.message,
      card: invitation.card,
      priority: 4,
      // Each completed lesson leaves the reader for a newly owned map scope.
      // Do not exceed the kit's 1..10 contract or invent random topic identities.
      maxPerDay: 1,
      cooldownMs: 0,
      ...(invitation.autoHideMs ? { autoHideMs: invitation.autoHideMs } : {}),
    });
    observe();
    return () => {
      alive = false;
      off();
      // Courtesy/readiness may temporarily hide the same invitation. Only a
      // genuinely retired product invitation releases its visible opening.
      if (current.current?.key !== expected && shownKey) controller.dismiss(shownKey);
    };
  }, [controller, invitation?.key, ready]);

  useEffect(() => {
    if (!controller || !invitation || !ready) return;
    const shown = controller.getSnapshot().current;
    if (!shown || shown.topic !== invitation.topic) return;
    // A save receipt or new count changes the words, not the card's identity,
    // input state, entrance animation or the kit's existing courtesy timer.
    controller.update(shown.key, { message: invitation.message, card: invitation.card });
  }, [controller, invitation?.key, invitation?.message, invitation?.card, ready]);
}
