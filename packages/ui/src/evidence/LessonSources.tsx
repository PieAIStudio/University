import { formatDate, translate } from "../i18n/index.js";
import {
  evidenceHost,
  isUrlEvidenceView,
  type EvidenceView,
  type UrlEvidenceView,
} from "../view/lesson-view.js";

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
  const grouped = new Map<string, UrlEvidenceView[]>();
  for (const reference of evidence) {
    if (!isUrlEvidenceView(reference)) continue;
    const group = grouped.get(reference.sourceUrl) ?? [];
    // Deduplicate the link, not distinct claims supported by the same source.
    if (
      !group.some(
        (item) =>
          item.kind === reference.kind &&
          item.provenance?.supports === reference.provenance?.supports &&
          item.provenance?.limitations === reference.provenance?.limitations,
      )
    ) {
      group.push(reference);
    }
    grouped.set(reference.sourceUrl, group);
  }
  const sources = [...grouped.values()];
  if (sources.length === 0) return null;

  return (
    <section
      className="lesson-sources"
      aria-label={translate("ui.evidence.lessonSources.copy.出处")}
    >
      <h2 className="lesson-sources__label">{translate("ui.evidence.lessonSources.copy.出处")}</h2>
      <ul className="lesson-sources__list">
        {sources.map((references) => {
          const reference = references[0]!;
          return (
            <li key={reference.sourceUrl}>
              <a href={reference.sourceUrl} target="_blank" rel="noreferrer">
                {reference.sourceTitle}
              </a>{" "}
              <small>{evidenceHost(reference)}</small>
              {references.some((item) => item.provenance) ? (
                <details className="lesson-sources__details">
                  <summary>{translate("sources.why")}</summary>
                  {references.map((item, index) => (
                    <SourceDetails key={index} reference={item} />
                  ))}
                </details>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SourceDetails({ reference }: { readonly reference: UrlEvidenceView }) {
  const source = reference.provenance;
  if (!source) return null;
  // A calendar date is not a timestamp. UTC formatting keeps a Honolulu
  // reader from seeing the preceding day for a publication dated at midnight.
  const date = (value: string) => formatDate(`${value}T00:00:00Z`, { timeZone: "UTC" });
  return (
    <dl className="lesson-sources__provenance">
      <dt>{translate("sources.publisher")}</dt>
      <dd>{source.publisher}</dd>
      <dt>{translate("sources.type")}</dt>
      <dd>{translate(`sources.type.${source.type}`)}</dd>
      {source.publishedOn ? (
        <>
          <dt>{translate("sources.published")}</dt>
          <dd>
            <time dateTime={source.publishedOn}>{date(source.publishedOn)}</time>
          </dd>
        </>
      ) : null}
      <dt>{translate("sources.accessed")}</dt>
      <dd>
        <time dateTime={source.accessedOn}>{date(source.accessedOn)}</time>
      </dd>
      {source.locator ? (
        <>
          <dt>{translate("sources.location")}</dt>
          <dd>{source.locator}</dd>
        </>
      ) : null}
      <dt>
        {translate(reference.kind === "inference" ? "sources.inference" : "sources.supports")}
      </dt>
      <dd>{source.supports}</dd>
      <dt>{translate("sources.limits")}</dt>
      <dd>{source.limitations}</dd>
    </dl>
  );
}
