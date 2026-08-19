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
  | { readonly kind: "review" };

export const WORLD: View = { kind: "world" };

export function toHash(view: View): string {
  switch (view.kind) {
    case "world":
      return "#/";
    case "review":
      return "#/review";
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
