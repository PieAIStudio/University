import { Tip } from "../Tip.js";
import type { LessonLinkTarget } from "../markdown/remark-lesson-links.js";

function targetKey(entry: LessonLinkTarget): string {
  return `${entry.courseId}/${entry.unitId}/${entry.lessonId}`;
}

/**
 * Quiet navigation out of this lesson: destinations the prose points to, and
 * lessons that point back. Renders nothing when both lists are empty — an empty
 * "related" panel is noise, not information.
 */
export function LessonRelated({
  outgoing,
  backlinks,
  onFollowLink,
}: {
  /** Unique targets of `[[lesson:…]]` in this lesson's prose. */
  readonly outgoing: readonly LessonLinkTarget[];
  readonly backlinks: readonly LessonLinkTarget[];
  readonly onFollowLink?: ((target: LessonLinkTarget) => void) | undefined;
}) {
  if (outgoing.length === 0 && backlinks.length === 0) return null;

  return (
    <section className="lesson-related" aria-label="相关">
      <div className="rail-panel__header">
        <h3 className="rail-panel__label">相关</h3>
        <Tip term="lesson-related" className="rail-panel__help">
          <span aria-label="关于相关">?</span>
        </Tip>
      </div>
      {outgoing.length > 0 ? (
        <div className="lesson-related__group">
          <p className="lesson-related__group-label">本课指向</p>
          <ul className="lesson-related__list">
            {outgoing.map((entry) => (
              <li key={`out:${targetKey(entry)}`}>
                <button
                  type="button"
                  onClick={() => onFollowLink?.(entry)}
                  disabled={!onFollowLink}
                >
                  {entry.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {backlinks.length > 0 ? (
        <div className="lesson-related__group">
          <p className="lesson-related__group-label">指向本课</p>
          <ul className="lesson-related__list">
            {backlinks.map((entry) => (
              <li key={`back:${targetKey(entry)}`}>
                <button
                  type="button"
                  onClick={() => onFollowLink?.(entry)}
                  disabled={!onFollowLink}
                >
                  {entry.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

/**
 * Deduplicate resolved forward links from the prose ranges the view already
 * carries. Broken tokens (target null) stay visible only inline.
 */
export function uniqueOutgoingTargets(
  links: readonly { readonly target: LessonLinkTarget | null }[] | undefined,
): LessonLinkTarget[] {
  if (!links || links.length === 0) return [];
  const seen = new Set<string>();
  const out: LessonLinkTarget[] = [];
  for (const link of links) {
    if (!link.target) continue;
    const key = targetKey(link.target);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(link.target);
  }
  return out;
}
