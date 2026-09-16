import type { ReactNode } from "react";
import type { LessonAssetView } from "../view/lesson-view.js";

/** The same editable work surface becomes the finished artifact, not a score card. */
export function PathArtifact({
  title,
  children,
  tools,
  image,
  settled = false,
}: {
  readonly title: string;
  readonly children: ReactNode;
  readonly tools?: ReactNode;
  readonly image?: LessonAssetView;
  readonly settled?: boolean;
}) {
  return (
    <section className="path-artifact" aria-label={title} data-settled={settled}>
      {image ? (
        <figure className="path-artifact__image">
          <img src={image.url} alt={image.alt} />
          {(image.caption ?? image.attribution) ? (
            <figcaption>{image.caption ?? image.attribution}</figcaption>
          ) : null}
        </figure>
      ) : null}
      <header className="path-artifact__header">
        <h3>{title}</h3>
        {tools}
      </header>
      {children}
    </section>
  );
}
