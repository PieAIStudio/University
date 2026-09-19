import type { ReactNode } from "react";
import "./scene-label.css";

/** One title/status family for a planet, a course island and a lesson marker.
 * Only the title may ellipsize; real state never loses its first or last glyph. */
export function SceneLabelText({
  title,
  status,
  note,
}: {
  readonly title: string;
  readonly status?: ReactNode;
  readonly note?: ReactNode;
}) {
  return (
    <span className="scene-label__text">
      <span className="scene-label__title label__course-title" title={title}>
        {title}
      </span>
      {status ? (
        <small className="scene-label__status label__course-progress" aria-hidden="true">
          {status}
        </small>
      ) : null}
      {note ? <small className="scene-label__status label__course-status">{note}</small> : null}
    </span>
  );
}
