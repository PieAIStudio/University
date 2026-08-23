import { evidenceHost, isUrlEvidenceView, type EvidenceView } from "../view/lesson-view.js";

/**
 * The public pages a lesson's claims stand on, listed where the lesson ends.
 *
 * Repository citations do not appear here, and that asymmetry is the whole
 * design. A citation into the studied code attaches to the sentence that makes
 * the claim — `[[evidence:path:line]]` opens the lines inline, right where you
 * doubted them — so a second list at the bottom would be the same information
 * twice. A public-page citation has no such marker, so without this it is data
 * the product holds and the reader never sees.
 *
 * That gap matters more than it looks. 通用课 is rewritten from someone else's
 * course, and the rule that makes the rewrite honest is that every claim points
 * at MDN or the W3C rather than at the course it came from. A reader who cannot
 * see where a claim comes from is being asked to take the honesty on trust,
 * which is the one thing this product does not ask.
 *
 * Deduplicated by URL: nineteen paragraphs may all rest on the same MDN page,
 * and a list that says so nineteen times is a list nobody reads.
 */
export function LessonSources({ evidence }: { readonly evidence: readonly EvidenceView[] }) {
  const seen = new Set<string>();
  const sources = evidence.filter((reference) => {
    if (!isUrlEvidenceView(reference)) return false;
    if (seen.has(reference.sourceUrl)) return false;
    seen.add(reference.sourceUrl);
    return true;
  });
  if (sources.length === 0) return null;

  return (
    <section className="lesson-sources" aria-label="出处">
      <h2 className="lesson-sources__label">出处</h2>
      <ul className="lesson-sources__list">
        {sources.map((reference) => {
          if (!isUrlEvidenceView(reference)) return null;
          return (
            <li key={reference.sourceUrl}>
              <a href={reference.sourceUrl} target="_blank" rel="noreferrer">
                {reference.sourceTitle}
              </a>{" "}
              <small>{evidenceHost(reference)}</small>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
