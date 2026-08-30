import { translate } from "../i18n/index.js";
import { useCallback, useEffect, useState } from "react";

import type { ReaderMark } from "@pieai/university-core/domain/reader-marks.js";
import { findQuote } from "./find-quote.js";

/** Vertical breathing room between two notes that would otherwise overlap. */
const NOTE_GAP = 8;
/** Assumed height before a note has been measured, used only on first paint. */
const ESTIMATED_NOTE_HEIGHT = 64;

interface PlacedNote {
  readonly mark: ReaderMark;
  /** Where the marked passage actually is, relative to the lesson column. */
  readonly anchorTop: number;
  /** Where the note is drawn, after pushing overlapping notes apart. */
  readonly top: number;
  /** True when the passage could not be found in the current revision. */
  readonly orphaned: boolean;
}

/**
 * Lays notes out beside their passages without letting them overlap.
 *
 * Each note wants to sit level with the text it belongs to. Two marks a line
 * apart want the same pixel, so the second is pushed down until it clears the
 * first. Pushing down rather than centring the group keeps every note at or
 * below its anchor, which is what makes the association readable: a note above
 * its passage looks like it belongs to the paragraph before.
 *
 * Orphans — passages that no longer exist after a revision — are collected at
 * the end rather than dropped. A note the reader wrote is theirs; silently
 * discarding it because the lesson changed is the system deciding their work
 * did not matter.
 */
export function layoutNotes(
  notes: readonly { mark: ReaderMark; anchorTop: number | null; height: number }[],
): readonly PlacedNote[] {
  const anchored = notes
    .filter((note): note is typeof note & { anchorTop: number } => note.anchorTop !== null)
    .sort((left, right) => left.anchorTop - right.anchorTop);
  const orphans = notes.filter((note) => note.anchorTop === null);

  const placed: PlacedNote[] = [];
  let floor = 0;
  for (const note of anchored) {
    const top = Math.max(note.anchorTop, floor);
    placed.push({ mark: note.mark, anchorTop: note.anchorTop, top, orphaned: false });
    floor = top + note.height + NOTE_GAP;
  }
  for (const note of orphans) {
    placed.push({ mark: note.mark, anchorTop: floor, top: floor, orphaned: true });
    floor += note.height + NOTE_GAP;
  }
  return placed;
}

/**
 * The reader's marks, drawn in the margin beside the passages they mark.
 *
 * Positions are measured from the rendered page rather than stored, because the
 * only thing that knows where a passage ended up is the browser that laid it
 * out — and that changes with window width, font size, whether an image has
 * loaded, and whether a `<details>` block is open. Measuring on those events is
 * the difference between notes that track the text and notes that were right
 * once.
 */
export function LessonMargin({
  marks,
  bodyRef,
  columnRef,
  onResolve,
  onDelete,
}: {
  readonly marks: readonly ReaderMark[];
  readonly bodyRef: React.RefObject<HTMLElement | null>;
  /** The element notes are positioned within; offsets are measured from its top. */
  readonly columnRef: React.RefObject<HTMLElement | null>;
  readonly onResolve?: ((markId: string) => void) | undefined;
  readonly onDelete?: ((markId: string) => void) | undefined;
}) {
  const [placed, setPlaced] = useState<readonly PlacedNote[]>([]);
  const [active, setActive] = useState<string | null>(null);

  const measure = useCallback(() => {
    const body = bodyRef.current;
    const column = columnRef.current;
    if (!body || !column) return;
    const origin = column.getBoundingClientRect().top;
    const measured = marks.map((mark) => {
      const range = findQuote(body, mark.quote);
      const rect = range?.getBoundingClientRect();
      // A found range with a zero-height rect is inside something collapsed —
      // a closed `<details>`, for instance. It exists but has no place on the
      // page, so it is treated as unanchored rather than pinned to y = 0.
      const anchorTop = rect && (rect.height > 0 || rect.width > 0) ? rect.top - origin : null;
      const node = column.querySelector<HTMLElement>(`[data-mark-id="${CSS.escape(mark.markId)}"]`);
      return {
        mark,
        anchorTop,
        height: node?.offsetHeight ?? ESTIMATED_NOTE_HEIGHT,
      };
    });
    setPlaced(layoutNotes(measured));
  }, [marks, bodyRef, columnRef]);

  useEffect(() => {
    measure();
    const body = bodyRef.current;
    if (!body) return;
    // ResizeObserver rather than a resize listener: the prose reflows for
    // reasons the window never hears about — a detail block opening, an image
    // arriving, the reading level changing.
    const observer = new ResizeObserver(() => measure());
    observer.observe(body);
    // Two passes: the first placement uses estimated heights, and the second
    // uses the heights the browser just produced from that placement.
    const settle = window.setTimeout(measure, 0);
    document.addEventListener("toggle", measure, true);
    return () => {
      observer.disconnect();
      window.clearTimeout(settle);
      document.removeEventListener("toggle", measure, true);
    };
  }, [measure, bodyRef]);

  if (marks.length === 0) return null;

  return (
    <div className="lesson-margin" aria-label={translate("ui.lesson.lessonMargin.copy.页边批注")}>
      {placed.map((note) => (
        <article
          key={note.mark.markId}
          data-mark-id={note.mark.markId}
          className="margin-note"
          data-kind={note.mark.kind}
          data-orphaned={note.orphaned || undefined}
          data-active={active === note.mark.markId || undefined}
          style={{ top: `${note.top}px` }}
        >
          <button
            type="button"
            className="margin-note__body"
            onClick={() => {
              const body = bodyRef.current;
              const range = body ? findQuote(body, note.mark.quote) : null;
              if (!range) return;
              setActive(note.mark.markId);
              const selection = window.getSelection();
              selection?.removeAllRanges();
              selection?.addRange(range);
            }}
          >
            {note.orphaned ? (
              <small className="margin-note__orphan">
                {translate("ui.lesson.lessonMargin.copy.这段已不在本版课文里")}
              </small>
            ) : note.mark.sectionTitle ? (
              <small>{note.mark.sectionTitle}</small>
            ) : null}
            <span>{note.mark.quote.exact}</span>
          </button>
          <div className="margin-note__actions">
            {note.mark.kind === "question" && onResolve ? (
              <button type="button" onClick={() => onResolve(note.mark.markId)}>
                {translate("ui.lesson.lessonMargin.copy.已弄懂")}
              </button>
            ) : null}
            {onDelete ? (
              <button type="button" onClick={() => onDelete(note.mark.markId)}>
                {translate("ui.lesson.lessonMargin.copy.删除")}
              </button>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
