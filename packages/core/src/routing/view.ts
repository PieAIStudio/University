/**
 * Where you are, in the address bar — for both shells, in one file.
 *
 * Without this, refreshing throws a learner back to the world map — which they
 * will do, because a 3D page that stutters is a page people reload. Losing your
 * place as the punishment for that is the kind of small betrayal that ends
 * sessions. It also makes a lesson unlinkable, and a course nobody can send to
 * anyone is a course nobody talks about.
 *
 * The hash rather than the path, because delivery ships as a static bundle and
 * a real path would 404 on refresh without a server rewrite rule. The hash is
 * the one part of a URL a static host cannot get wrong.
 *
 * It lives in `packages/core` because the authoring campus used to carry a
 * second address space — a pathname for study+lesson beside a hash for the rail
 * slot. Two addresses in one document is not a style difference: Chrome fires
 * `popstate` for a same-document fragment change too, so writing the hash ran
 * the pathname restore as a side effect and quietly threw the chosen project
 * away. One address, one parser, both campuses.
 *
 * No React, no DOM, no network — the same rule as the rest of this package.
 */

// `flavour` is the public hash segment (`#/flavour`, `#/library/flavour`).
// The collection itself is anti-pattern; view kinds use that name. Do not
// rename this string — bookmarked and shared URLs still have to parse.
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
  // Anti-pattern catalogue. Public hashes stay `#/flavour` and
  // `#/flavour/<id>` — those strings are the URL contract, these kinds are not.
  | { readonly kind: "anti-pattern" }
  | { readonly kind: "anti-pattern-entry"; readonly id: string }
  // 概念图解. The third collection, and the routes are the same two shapes for
  // the third time — index and entry. When a fourth collection arrives and this
  // block is copied a fourth time, that is the moment to make it generic; three
  // is not yet enough evidence to know what the general case looks like.
  | { readonly kind: "concepts" }
  | { readonly kind: "concept"; readonly id: string }
  // An endless sitting of the questions the concept entries already carry. One
  // segment, like review and favourites, because it belongs to the learner
  // rather than to any course.
  | { readonly kind: "practice" }
  // The 2D course directory. It is not a downgrade of the world map: the
  // product's own journey puts it first, and a keyboard has to be able to
  // reach every lesson without touching the canvas.
  | { readonly kind: "catalog" }
  // Temporary gloss-avatar lab. Not a product surface; hash-only so a static
  // host cannot 404 it. Drop the kind when the lab is retired.
  | { readonly kind: "avatar-lab" }
  | { readonly kind: "league" }
  /*
    The planet: every course series at once, which is the one thing the map
    deliberately cannot show any more. A route rather than an overlay, because
    an overlay would leave the map's canvas mounted and rendering behind an
    opaque page — and because 「我在哪」 deserves a back button.
  */
  | { readonly kind: "planet" }
  | { readonly kind: "quests" }
  | { readonly kind: "plans" }
  | { readonly kind: "settings" }
  | { readonly kind: "me" }
  /*
    The authoring workbench. Reached from 更多, and only offered where the
    authoring pipeline is on the other end of the address — it is a mode, not a
    ninth rail slot. The kind lives here rather than in one shell because the
    address space is one thing; whether a build answers this route is a separate
    question, decided where the routes are rendered.
  */
  | { readonly kind: "studio" };

/** Which library tab a legacy single-segment route lands on. */
export const LIBRARY_VIEW_TAB: Partial<Record<View["kind"], LibraryTab>> = {
  library: "concepts",
  concepts: "concepts",
  terms: "terms",
  "anti-pattern": "flavour",
  favourites: "favourites",
};

export function libraryTabOf(view: View): LibraryTab {
  return view.kind === "library" ? view.tab : (LIBRARY_VIEW_TAB[view.kind] ?? "concepts");
}

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
    case "anti-pattern":
      return "#/flavour";
    case "anti-pattern-entry":
      return `#/flavour/${enc(view.id)}`;
    case "concepts":
      return "#/concepts";
    case "concept":
      return `#/concepts/${enc(view.id)}`;
    case "practice":
      return "#/practice";
    case "catalog":
      return "#/catalog";
    case "avatar-lab":
      return "#/avatar-lab";
    case "league":
      return "#/league";
    case "planet":
      return "#/planet";
    case "quests":
      return "#/quests";
    case "plans":
      return "#/plans";
    case "settings":
      return "#/settings";
    case "me":
      return "#/me";
    case "studio":
      return "#/studio";
    case "course":
      return `#/${enc(view.studyId)}/${enc(view.courseId)}`;
    case "lesson":
      return `#/${enc(view.studyId)}/${enc(view.courseId)}/${enc(view.unitId)}/${enc(view.lessonId)}`;
    case "settled":
      return `#/${enc(view.studyId)}/${enc(view.courseId)}/${enc(view.unitId)}/${enc(view.lessonId)}/done`;
  }
}

/**
 * A content segment that could have been produced by formatting one.
 *
 * Study, course, unit and lesson ids are authored as directory names, and the
 * authoring campus joins them into a filesystem path on the far side of
 * `/api/studies/…`. Anything with a slash, a dot-dot, or an encoded separator
 * is a typo or a probe there, and its adapter refuses it before the join.
 *
 * Deliberately not applied inside `fromHash`. Parsing an address and deciding
 * an id is servable are different questions: delivery fetches a published
 * package by name and has never restricted the shape of one, so putting the
 * rule in the parser would quietly unroute a course the moment upstream
 * authored an id this regex did not expect.
 */
export function isSafeId(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value) && !value.includes("..");
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
  const parts = hash.replace(/^#\/?/u, "").split("/").filter(Boolean).map(dec);
  if (parts.length === 0) return WORLD;
  if (parts.length === 1 && parts[0] === "review") return { kind: "review" };
  if (parts[0] === "library") {
    const tab = LIBRARY_TABS.find((candidate) => candidate === parts[1]);
    return { kind: "library", tab: tab ?? "concepts" };
  }
  if (parts.length === 1 && parts[0] === "terms") return { kind: "terms" };
  if (parts.length === 1 && parts[0] === "favourites") return { kind: "favourites" };
  if (parts.length === 1 && parts[0] === "flavour") return { kind: "anti-pattern" };
  if (parts.length === 2 && parts[0] === "flavour" && parts[1]) {
    return { kind: "anti-pattern-entry", id: parts[1] };
  }
  if (parts.length === 1 && parts[0] === "practice") return { kind: "practice" };
  if (parts.length === 1 && parts[0] === "catalog") return { kind: "catalog" };
  if (parts.length === 1 && parts[0] === "avatar-lab") return { kind: "avatar-lab" };
  if (parts.length === 1 && parts[0] === "league") return { kind: "league" };
  if (parts.length === 1 && parts[0] === "planet") return { kind: "planet" };
  if (parts.length === 1 && parts[0] === "quests") return { kind: "quests" };
  if (parts.length === 1 && parts[0] === "plans") return { kind: "plans" };
  if (parts.length === 1 && parts[0] === "settings") return { kind: "settings" };
  if (parts.length === 1 && parts[0] === "me") return { kind: "me" };
  if (parts.length === 1 && parts[0] === "studio") return { kind: "studio" };
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

/** The series a view names, or null when it names none. */
export function studyIdOfView(view: View): string | null {
  return view.kind === "course" || view.kind === "lesson" || view.kind === "settled"
    ? view.studyId
    : null;
}

/** Lesson is a bare route: UniversityShell must not mount. */
export function isBareView(view: View): boolean {
  return view.kind === "lesson";
}

/** Which rail slot lights up for a view. */
export function activeIdForView(view: View): string {
  switch (view.kind) {
    case "world":
    case "course":
    case "settled":
    // The planet is where you choose which series to learn, so the rail's
    // 学习 stays lit while you are on it — you have not left learning to go
    // somewhere else, you are picking what to learn.
    case "planet":
      return "learn";
    case "library":
    case "terms":
    case "term":
    case "concepts":
    case "concept":
    case "anti-pattern":
    case "anti-pattern-entry":
      return "library";
    case "favourites":
      return "favourites";
    case "practice":
      return "practice";
    case "league":
      return "league";
    case "quests":
      return "quests";
    case "plans":
      return "plan";
    case "me":
    case "avatar-lab":
      return "profile";
    case "catalog":
      return "catalog";
    case "review":
      return "review";
    case "settings":
      return "settings";
    case "studio":
      return "studio";
    case "lesson":
      return "learn";
  }
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
