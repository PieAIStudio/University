import { translate } from "@pieai/university-ui/i18n.js";
import { toPath, type View } from "@pieai/university-core";
import type { CourseView } from "@pieai/university-ui/view/lesson-view.js";
import { useEffect } from "react";

export const DEFAULT_PAGE_TITLE = "University";
export const DEFAULT_PAGE_DESCRIPTION = translate(
  "app.app.pagemetadata.copy.University-在群岛上把一件事学到会",
);

export interface PageMetadata {
  readonly title: string;
  readonly description: string;
  readonly type: "website" | "article";
  readonly url: string;
}

function concise(value: string): string {
  const text = value.replace(/\s+/gu, " ").trim();
  return text.length > 180 ? `${text.slice(0, 177)}…` : text;
}

function lessonOf(view: View, course: CourseView | null) {
  if (!course || (view.kind !== "lesson" && view.kind !== "settled")) return null;
  return course.units
    .find((unit) => unit.id === view.unitId)
    ?.lessons.find((lesson) => lesson.id === view.lessonId);
}

export function pageMetadataFor(
  view: View,
  course: CourseView | null,
  origin: string,
): PageMetadata {
  const lesson = lessonOf(view, course);
  const title = lesson
    ? `${lesson.title} · ${course?.title ?? "University"}`
    : course && (view.kind === "course" || view.kind === "lesson" || view.kind === "settled")
      ? course.title
      : DEFAULT_PAGE_TITLE;
  const description = lesson
    ? course?.description
      ? translate("app.app.pagemetadata.copy.value0-本节-value1", {
          value0: course.description,
          value1: lesson.title,
        })
      : translate("app.app.pagemetadata.copy.value0-本节-value1-m4ij3g", {
          value0: course?.title ?? "University",
          value1: lesson.title,
        })
    : course && (view.kind === "course" || view.kind === "lesson" || view.kind === "settled")
      ? course.description || course.title
      : DEFAULT_PAGE_DESCRIPTION;
  const route = toPath(view);

  return {
    title,
    description: concise(description),
    type: course && (view.kind === "course" || lesson) ? "article" : "website",
    url: new URL(route, origin).href,
  };
}

function setMeta(attribute: "name" | "property", key: string, content: string): void {
  const selector = `meta[${attribute}="${key}"]`;
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.append(element);
  }
  element.content = content;
}

function applyPageMetadata(metadata: PageMetadata): void {
  document.title = metadata.title;
  setMeta("name", "description", metadata.description);
  setMeta("property", "og:title", metadata.title);
  setMeta("property", "og:description", metadata.description);
  setMeta("property", "og:type", metadata.type);
  setMeta("property", "og:url", metadata.url);
  setMeta("name", "twitter:card", "summary");
  setMeta("name", "twitter:title", metadata.title);
  setMeta("name", "twitter:description", metadata.description);
  setMeta("name", "twitter:url", metadata.url);
}

/** Keep the document head in step with the one shared route and shelf. */
export function usePageMetadata(view: View, course: CourseView | null): void {
  useEffect(() => {
    applyPageMetadata(pageMetadataFor(view, course, window.location.origin));
  }, [course, view]);
}
