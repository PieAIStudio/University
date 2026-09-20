import {
  formatLineRange,
  type InteractionPathActivity,
  type InteractionStep,
} from "@pieai/university-core";
import { useI18n } from "../i18n/index.js";
import type { LessonAssetView } from "../view/lesson-view.js";

type PathSource = InteractionPathActivity["sources"][number];

function SourceReference({ source }: { readonly source: PathSource }) {
  const reference = source.reference;
  return "url" in reference ? (
    <a href={reference.url} target="_blank" rel="noreferrer">
      {reference.label}
    </a>
  ) : (
    <span>
      {reference.label}{" "}
      <code>
        {reference.path}
        {reference.line ? `:${formatLineRange(reference.line, reference.lineEnd)}` : ""}
        {reference.commit ? `@${reference.commit.slice(0, 8)}` : ""}
      </code>
    </span>
  );
}

export function PathIntroduction({ activity }: { readonly activity: InteractionPathActivity }) {
  const { t } = useI18n();
  const context = activity.context;
  return context ? (
    <section className="path-materials__context" aria-label={context.title}>
      <h3>{context.title}</h3>
      <p>{context.introduction}</p>
      <p>
        <strong>{t("path.task")}</strong> {context.task}
      </p>
      {context.sourceIds.map((id) => {
        const source = activity.sources.find((item) => item.id === id);
        return source ? (
          <p className="path-materials__citation" key={id}>
            <SourceReference source={source} />
          </p>
        ) : null;
      })}
    </section>
  ) : null;
}

/** Named materials remain readable beside the action, without a second scroll container. */
export function PathMaterials({
  activity,
  step,
  first,
}: {
  readonly activity: InteractionPathActivity;
  readonly step: InteractionStep;
  readonly first: boolean;
}) {
  const { t } = useI18n();
  return (
    <aside className="path-materials" aria-label={t("path.currentMaterial")}>
      {!first && activity.context ? (
        <details className="path-materials__recall" key={step.id}>
          <summary>{t("path.recallContext")}</summary>
          <PathIntroduction activity={activity} />
        </details>
      ) : null}
      {step.materialIds?.map((id) => {
        const material = activity.materials?.find((item) => item.id === id);
        if (!material) return null;
        const source = activity.sources.find((item) => item.id === material.sourceId);
        return (
          <section className="path-materials__item" key={id} data-material-id={id}>
            <p className="path-materials__kind">
              {t(material.kind === "source-summary" ? "path.sourceSummary" : "path.teachingDraft")}
            </p>
            <h3>{material.label}</h3>
            <p className="path-materials__text">{material.text}</p>
            {source ? (
              <p className="path-materials__citation">
                <SourceReference source={source} />
              </p>
            ) : null}
          </section>
        );
      })}
    </aside>
  );
}

export function PathSources({
  sources,
  image,
  all = false,
}: {
  readonly sources: readonly PathSource[];
  readonly image?: LessonAssetView;
  readonly all?: boolean;
}) {
  const { t } = useI18n();
  return (
    <details className="interaction-path__source">
      <summary>{t(all ? "path.allSources" : "path.source")}</summary>
      {sources.map((source) => (
        <section key={source.id}>
          <SourceReference source={source} />
          {source.date ? <p>{source.date}</p> : null}
          {source.summary ? <p>{source.summary}</p> : null}
          <p>{source.note}</p>
          {source.limitation ? <p>{source.limitation}</p> : null}
        </section>
      ))}
      {image ? <p>{image.attribution ?? image.caption}</p> : null}
    </details>
  );
}
