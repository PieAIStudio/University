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
import { translate } from "../i18n/index.js";
import { useEffect, useId, type RefObject } from "react";
import { GamePanel } from "@pieai/swimmer-ui-kit";

import { LiquidCtaButton } from "../cta/LiquidCtaButton.js";
import type { CoursePickStats } from "./course-pick-stats.js";

export function CoursePickCard({
  title,
  studyTitle,
  depth,
  prerequisiteCount,
  objectives,
  stats,
  onEnter,
  onDismiss,
  cardRef,
}: {
  readonly title: string;
  readonly studyTitle: string;
  readonly depth: number;
  readonly prerequisiteCount: number;
  readonly objectives: readonly string[];
  readonly stats: CoursePickStats;
  readonly onEnter: () => void;
  readonly onDismiss: () => void;
  readonly cardRef: RefObject<HTMLElement | null>;
}) {
  const headingId = useId();
  const outcomesHeadingId = useId();
  const inventoryHeadingId = useId();

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
        <section className="picked__outcomes" aria-labelledby={outcomesHeadingId}>
          <h4 id={outcomesHeadingId}>{translate("ui.path.coursePickCard.copy.学完这门课-你能")}</h4>
          <ul className="picked__objectives">
            {objectives.map((objective, index) => (
              <li key={`${index}-${objective}`}>{objective}</li>
            ))}
          </ul>
        </section>
        {/*
          The evidence count is said once, in the sentence, and not repeated as
          a row below. It is the one number here that is not an inventory
          figure — it is the claim the product is making — and a card that
          prints it twice reads as padding rather than as a promise.
        */}
        {stats.evidenceCount !== undefined ? (
          <p className="picked__evidence">
            {translate("ui.path.coursePickCard.copy.这些本事来自")} {stats.evidenceCount}{" "}
            {translate("ui.path.coursePickCard.copy.段真实项目代码")}
          </p>
        ) : null}
        <dl className="picked__meta">
          <dt>{translate("ui.path.coursePickCard.copy.层")}</dt>
          <dd>{depth + 1}</dd>
          <dt>{translate("ui.path.coursePickCard.copy.先修")}</dt>
          <dd>{prerequisiteCount || translate("ui.path.coursePickCard.copy.无")}</dd>
        </dl>
        <div className="picked__action">
          <section className="picked__inventory" aria-labelledby={inventoryHeadingId}>
            <h4 id={inventoryHeadingId}>{translate("ui.path.coursePickCard.copy.这门课有")}</h4>
            <dl className="picked__inventory-list">
              <dt>{translate("ui.path.coursePickCard.copy.课时数")}</dt>
              <dd>{stats.lessons}</dd>
              <dt>{translate("ui.path.coursePickCard.copy.练习数")}</dt>
              <dd>{stats.exercises}</dd>
              <dt>{translate("ui.path.coursePickCard.copy.最多可得-XP")}</dt>
              <dd>{stats.maxXp}</dd>
            </dl>
          </section>
          <LiquidCtaButton width="full" className="picked__enter" onClick={onEnter}>
            {translate("ui.path.coursePickCard.copy.进入这门课")}
          </LiquidCtaButton>
        </div>
      </GamePanel>
    </aside>
  );
}
