/**
 * The 「进入这门课」 card that follows a picked island.
 *
 * Readable text is DOM, never geometry. Positioning is not this file's job —
 * LabelProbe already projects a world point into a screen-space box, the same
 * way it places course names. This component is the 2D body both shells
 * render; each shell only supplies the enter action.
 *
 * Why not GameTooltip / GameDialog: GameTooltip wraps a trigger and takes a
 * string label, so it cannot sit at an arbitrary (x, y) or hold a button.
 * GameDialog is an unpositioned <section> with no coordinate API. GamePanel
 * spreads HTML attributes and can be the visual chrome inside a box that
 * LabelProbe translates. Kit components that cannot be placed at a point are
 * the wrong shape; the ones that can, we use.
 */
import { useEffect, useId, type RefObject } from "react";
import { GameButton, GamePanel } from "@pieai/swimmer-ui-kit";

export function CoursePickCard({
  title,
  studyTitle,
  lessons,
  depth,
  prerequisiteCount,
  onEnter,
  onDismiss,
  cardRef,
}: {
  readonly title: string;
  readonly studyTitle: string;
  readonly lessons: number;
  readonly depth: number;
  readonly prerequisiteCount: number;
  readonly onEnter: () => void;
  readonly onDismiss: () => void;
  readonly cardRef: RefObject<HTMLElement | null>;
}) {
  const headingId = useId();

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    // The shell that contains this screen, not document. A document listener
    // would have to guess whether a click on a rail button was "outside",
    // which is how those buttons stop working. Canvas clicks are Stage's
    // onPointerMissed / island onClick — the same <canvas> node is both sea
    // and island, so this listener must not decide them.
    const found = card.closest(".app-shell") ?? card.parentElement;
    if (!(found instanceof HTMLElement)) return;

    const onPointerDown = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (card.contains(target)) return;
      // Canvas clicks are Stage's onPointerMissed / island onClick — the
      // same <canvas> node is both sea and island, so this listener must
      // not decide them.
      if (target.closest("canvas")) return;
      // A course-name button is the same activate as the island mesh.
      // Dismissing on pointerdown would unmount this card before the
      // click replaced `picked`, and the projector would spend a frame
      // placing nothing. Study names are not buttons; clicking one is
      // "elsewhere" and should close.
      if (target.closest("button.label")) return;
      onDismiss();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onDismiss();
    };
    found.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      found.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [cardRef, onDismiss]);

  return (
    <aside
      ref={cardRef}
      className="picked picked--follow"
      role="dialog"
      aria-labelledby={headingId}
    >
      <GamePanel tone="strong">
        <h3 id={headingId}>{title}</h3>
        <p className="picked__study">{studyTitle}</p>
        <dl>
          <dt>课时</dt>
          <dd>{lessons}</dd>
          <dt>层</dt>
          <dd>{depth + 1}</dd>
          <dt>先修</dt>
          <dd>{prerequisiteCount || "无"}</dd>
        </dl>
        <GameButton variant="primary" className="picked__enter" onClick={onEnter}>
          进入这门课
        </GameButton>
      </GamePanel>
    </aside>
  );
}
