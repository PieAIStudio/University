/**
 * Where you are, in the address bar.
 *
 * Without this, refreshing throws a learner back to the world map — which they
 * will do, because a 3D page that stutters is a page people reload. Losing your
 * place as the punishment for that is the kind of small betrayal that ends
 * sessions. It also makes a lesson unlinkable, and a course nobody can send to
 * anyone is a course nobody talks about.
 *
 * The hash rather than the path, because this ships as a static bundle and a
 * real path would 404 on refresh without a server rewrite rule. The hash is the
 * one part of a URL a static host cannot get wrong.
 */
export const LIBRARY_TABS = ["concepts", "terms", "flavour", "favourites"] as const;

export type LibraryTab = (typeof LIBRARY_TABS)[number];

export type View =
  | { readonly kind: "world" }
  | { readonly kind: "course"; readonly studyId: string; readonly courseId: string }
  | {
      readonly kind: "lesson";
      readonly studyId: string;
      readonly courseId: string;
      readonly unitId: string;
      readonly lessonId: string;
    }
  | {
      readonly kind: "settled";
      readonly studyId: string;
      readonly courseId: string;
      readonly unitId: string;
      readonly lessonId: string;
    }
  | { readonly kind: "review" }
  // The library: three collections and the learner's shortlist, behind one
  // door. They were four top-bar buttons, which told a visitor that looking a
  // word up, browsing concepts, checking a tic and re-reading a favourite were
  // four different kinds of activity. They are one, and the index component has
  // been shared between them since SPEC-0004.
  //
  // The old single-segment routes still resolve, because a hash someone
  // bookmarked or pasted into a chat is a public contract.
  | { readonly kind: "library"; readonly tab: LibraryTab }
  | { readonly kind: "terms" }
  // One term's full entry. The side panel is the preview and this is the page:
  // same record, more of it. Two segments, so a term is linkable — the whole
  // point of a dictionary is sending someone a word.
  | { readonly kind: "term"; readonly senseId: string }
  // The learner's own shortlist. Single segment like review and terms, because
  // it belongs to the person rather than to any course.
  | { readonly kind: "favourites" }
  // 防止 AI 味儿. A second collection on the same entry system, so it gets a
  // route of the same shape rather than a second kind of page.
  | { readonly kind: "flavour" }
  | { readonly kind: "flavour-entry"; readonly id: string }
  // 概念图解. The third collection, and the routes are the same two shapes for
  // the third time — index and entry. When a fourth collection arrives and this
  // block is copied a fourth time, that is the moment to make it generic; three
  // is not yet enough evidence to know what the general case looks like.
  | { readonly kind: "concepts" }
  | { readonly kind: "concept"; readonly id: string }
  // An endless sitting of the questions the concept entries already carry. One
  // segment, like review and favourites, because it belongs to the learner
  // rather than to any course.
  | { readonly kind: "practice" };

export const WORLD: View = { kind: "world" };

export function toHash(view: View): string {
  switch (view.kind) {
    case "world":
      return "#/";
    case "review":
      return "#/review";
    case "library":
      return `#/library/${view.tab}`;
    case "terms":
      return "#/terms";
    case "term":
      return `#/terms/${enc(view.senseId)}`;
    case "favourites":
      return "#/favourites";
    case "flavour":
      return "#/flavour";
    case "flavour-entry":
      return `#/flavour/${enc(view.id)}`;
    case "concepts":
      return "#/concepts";
    case "concept":
      return `#/concepts/${enc(view.id)}`;
    case "practice":
      return "#/practice";
    case "course":
      return `#/${enc(view.studyId)}/${enc(view.courseId)}`;
    case "lesson":
      return `#/${enc(view.studyId)}/${enc(view.courseId)}/${enc(view.unitId)}/${enc(view.lessonId)}`;
    case "settled":
      return `#/${enc(view.studyId)}/${enc(view.courseId)}/${enc(view.unitId)}/${enc(view.lessonId)}/done`;
  }
}

/**
 * Read a view back out of a hash.
 *
 * Anything unrecognised falls back to the world map rather than throwing. A URL
 * is user input — someone will trim it, a chat client will mangle it, an old
 * link will outlive the course it pointed at — and the world map is always a
 * valid place to be.
 */
export function fromHash(hash: string): View {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(dec);
  if (parts.length === 0) return WORLD;
  if (parts.length === 1 && parts[0] === "review") return { kind: "review" };
  if (parts[0] === "library") {
    const tab = LIBRARY_TABS.find((candidate) => candidate === parts[1]);
    return { kind: "library", tab: tab ?? "concepts" };
  }
  if (parts.length === 1 && parts[0] === "terms") return { kind: "terms" };
  if (parts.length === 1 && parts[0] === "favourites") return { kind: "favourites" };
  if (parts.length === 1 && parts[0] === "flavour") return { kind: "flavour" };
  if (parts.length === 2 && parts[0] === "flavour" && parts[1]) {
    return { kind: "flavour-entry", id: parts[1] };
  }
  if (parts.length === 1 && parts[0] === "practice") return { kind: "practice" };
  if (parts.length === 1 && parts[0] === "concepts") return { kind: "concepts" };
  if (parts.length === 2 && parts[0] === "concepts" && parts[1]) {
    return { kind: "concept", id: parts[1] };
  }
  if (parts.length === 2 && parts[0] === "terms" && parts[1]) {
    return { kind: "term", senseId: parts[1] };
  }
  const [studyId, courseId, unitId, lessonId, tail] = parts;
  if (!studyId || !courseId) return WORLD;
  if (!unitId || !lessonId) return { kind: "course", studyId, courseId };
  if (tail === "done") return { kind: "settled", studyId, courseId, unitId, lessonId };
  return { kind: "lesson", studyId, courseId, unitId, lessonId };
}

// Ids are slugs today, but they are authored upstream and this side does not
// get to assume that. Encoding costs nothing and a slash in an id would
// otherwise silently reroute the whole app.
const enc = (value: string) => encodeURIComponent(value);
const dec = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};
