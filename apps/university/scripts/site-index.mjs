#!/usr/bin/env node

/**
 * Build the public crawler files from the generated delivery shelf.
 *
 * `shelf.json` is the importer’s structural projection of the published
 * courses. This module deliberately does not know how a View becomes a URL;
 * Vite injects the one canonical `toPath` function from university-core. That
 * keeps the sitemap from becoming a second route table or a second course
 * list.
 */

function xmlEscape(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function publicOriginOf(value) {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`site-index: public origin must use http or https, got ${value}`);
  }
  return url.origin;
}

/** Flatten exactly the lessons present in the generated shelf. */
export function lessonRefsForShelf(shelf) {
  if (!shelf || !Array.isArray(shelf.studies)) {
    throw new Error("site-index: generated shelf has no studies array");
  }
  const refs = [];
  for (const study of shelf.studies) {
    for (const course of study.courses ?? []) {
      for (const unit of course.units ?? []) {
        for (const lesson of unit.lessons ?? []) {
          refs.push({
            studyId: study.id,
            courseId: course.id,
            unitId: unit.id,
            lessonId: lesson.id,
          });
        }
      }
    }
  }
  return refs;
}

/**
 * Return both crawler files and the count used by the build log and tests.
 * `pathForLesson` is required so callers cannot quietly invent a second URL
 * spelling here.
 */
export function buildSiteIndex(shelf, { publicOrigin, pathForLesson }) {
  if (typeof pathForLesson !== "function") {
    throw new Error("site-index: a canonical lesson path function is required");
  }
  const origin = publicOriginOf(publicOrigin);
  const refs = lessonRefsForShelf(shelf);
  const locations = refs.map((ref) => {
    const path = pathForLesson(ref);
    if (!path.startsWith("/") || path.includes("#")) {
      throw new Error(`site-index: lesson path is not canonical: ${path}`);
    }
    return new URL(path, origin).href;
  });
  if (new Set(locations).size !== locations.length) {
    throw new Error("site-index: duplicate lesson URL in generated shelf");
  }

  const sitemap = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...locations.map((location) => `  <url><loc>${xmlEscape(location)}</loc></url>`),
    "</urlset>",
    "",
  ].join("\n");
  const robots = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /studio",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ].join("\n");

  return { lessonCount: refs.length, locations, robots, sitemap };
}
