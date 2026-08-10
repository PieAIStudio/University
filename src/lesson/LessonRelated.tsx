import { Tip } from "../Tip.js";
import type { LessonLinkTarget } from "../markdown/remark-lesson-links.js";

/**
 * Quiet list of lessons that point here. Renders nothing when the graph has
 * no inbound edges — an empty "related" panel is noise, not information.
 */
export function LessonRelated({
  backlinks,
  onFollowLink,
}: {
  readonly backlinks: readonly LessonLinkTarget[];
  readonly onFollowLink?: ((target: LessonLinkTarget) => void) | undefined;
}) {
  if (backlinks.length === 0) return null;

  return (
    <section className="lesson-related" aria-label="相关">
      <div className="rail-panel__header">
        <h3 className="rail-panel__label">相关</h3>
        <Tip term="lesson-related" className="rail-panel__help">
          <span aria-label="关于相关">?</span>
        </Tip>
      </div>
      <ul className="lesson-related__list">
        {backlinks.map((entry) => (
          <li key={`${entry.courseId}/${entry.unitId}/${entry.lessonId}`}>
            <button type="button" onClick={() => onFollowLink?.(entry)} disabled={!onFollowLink}>
              {entry.title}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
