import { formatLineRange } from "@pieai/university-core";
import { useI18n } from "../i18n/index.js";
import type { LessonAssetView } from "../view/lesson-view.js";
import type { PrimmActivity } from "./primm-types.js";

export function PrimmSource({ source }: { readonly source?: PrimmActivity["sources"][number] }) {
  if (!source) return null;
  const reference = source.reference;
  return (
    <span className="primm__credit">
      {"url" in reference ? (
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
      )}
    </span>
  );
}

export function PrimmAsset({ asset }: { readonly asset?: LessonAssetView }) {
  const { t, locale } = useI18n();
  if (!asset) return <p role="alert">{t("primm.missingAsset")}</p>;
  const copy = asset.locales?.[locale];
  return (
    <figure className="primm__asset">
      {asset.mime.startsWith("image/") ? (
        <div className="primm__image-frame">
          <img src={asset.url} alt={copy?.alt ?? asset.alt} />
        </div>
      ) : asset.mime.startsWith("audio/") ? (
        <audio controls src={asset.url} />
      ) : (
        <video controls src={asset.url} poster={asset.posterUrl} />
      )}
      <figcaption>
        {asset.kind === "synthetic-audio" ? <span>{t("primm.syntheticAudio")} · </span> : null}
        {copy?.caption ?? asset.caption ?? copy?.attribution ?? asset.attribution}
      </figcaption>
      {(copy?.transcript ?? asset.transcript) ? (
        <details>
          <summary>{copy?.alt ?? asset.alt}</summary>
          <p>{copy?.transcript ?? asset.transcript}</p>
        </details>
      ) : null}
    </figure>
  );
}

export function PrimmMaterials({
  activity,
  materialIds,
  assetIds,
  assets,
  omitAssetId,
}: {
  readonly activity: PrimmActivity;
  readonly materialIds: readonly string[];
  readonly assetIds: readonly string[];
  readonly assets?: readonly LessonAssetView[];
  readonly omitAssetId?: string;
}) {
  const { t } = useI18n();
  const materials = activity.materials.filter((item) => materialIds.includes(item.id));
  const images = new Set([
    ...assetIds,
    ...materials.flatMap((item) => (item.assetId ? [item.assetId] : [])),
  ]);
  const credited = new Set<string>();
  return (
    <aside className="primm__materials" aria-label={t("primm.material")}>
      {materials.map((material) => {
        const source =
          material.sourceId && !credited.has(material.sourceId)
            ? activity.sources.find((item) => item.id === material.sourceId)
            : undefined;
        if (material.sourceId) credited.add(material.sourceId);
        if (material.assetId) {
          images.delete(material.assetId);
          return (
            <section key={material.id} data-material-id={material.id}>
              {material.assetId !== omitAssetId ? (
                <PrimmAsset asset={assets?.find((asset) => asset.id === material.assetId)} />
              ) : null}
              <PrimmSource source={source} />
            </section>
          );
        }
        return (
          <section key={material.id} data-material-id={material.id}>
            <h3>{material.label}</h3>
            {material.kind !== "practice" ? (
              <p className="primm__credit">
                {t(
                  material.kind === "source-summary"
                    ? "primm.sourceSummary"
                    : "primm.teachingDraft",
                )}
              </p>
            ) : null}
            <p className="primm__text">{material.text}</p>
            <PrimmSource source={source} />
          </section>
        );
      })}
      {[...images]
        .filter((id) => id !== omitAssetId)
        .map((id) => (
          <PrimmAsset key={id} asset={assets?.find((asset) => asset.id === id)} />
        ))}
    </aside>
  );
}
