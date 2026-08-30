import { translate } from "../i18n/index.js";
import { Tip } from "../Tip.js";
import type { LessonLinkTarget } from "../markdown/remark-lesson-links.js";

function targetKey(entry: LessonLinkTarget): string {
  return `${entry.courseId}/${entry.unitId}/${entry.lessonId}`;
}

/**
 * The lessons that point at this one, shown after the reader has finished it.
 *
 * Only backlinks. Outgoing links used to be listed here too, and were a second
 * copy of something the reader had already walked past: a `[[lesson:…]]`
 * renders as a button inside the sentence that motivated it, which is context
 * no list can reproduce. Backlinks are the opposite case — nothing in this
 * lesson's prose mentions them, so without this panel a lesson can never say
 * "other lessons build on this".
 *
 * At the end rather than in the margin because a backlink has no position in
 * this text to sit beside, and because "where does this lead" is a question the
 * reader asks after reading, not during.
 */
export function LessonBacklinks({
  backlinks,
  onFollowLink,
}: {
  readonly backlinks: readonly LessonLinkTarget[];
  readonly onFollowLink?: ((target: LessonLinkTarget) => void) | undefined;
}) {
  if (backlinks.length === 0) return null;

  return (
    <section
      className="lesson-backlinks"
      aria-label={translate("ui.lesson.lessonRelated.copy.哪些课用到这节")}
    >
      <div className="rail-panel__header">
        <h3 className="rail-panel__label">
          {translate("ui.lesson.lessonRelated.copy.哪些课用到这节")}
        </h3>
        <Tip term="lesson-related" className="rail-panel__help">
          <span aria-label={translate("ui.lesson.lessonRelated.copy.关于反向链接")}>?</span>
        </Tip>
      </div>
      <ul className="lesson-backlinks__list">
        {backlinks.map((entry) => (
          <li key={targetKey(entry)}>
            <button type="button" onClick={() => onFollowLink?.(entry)} disabled={!onFollowLink}>
              {entry.title}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
