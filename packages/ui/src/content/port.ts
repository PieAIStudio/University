/**
 * Where a lesson's text comes from.
 *
 * One of exactly two differences between the campuses. The authoring campus
 * asks a loopback server that reads the disk, so what was saved a second ago is
 * on screen now; the delivery campus reads a published package, so what a
 * customer sees was frozen and shipped on purpose. Everything above this line —
 * the reader, the review card, the vocabulary panel — is one implementation and
 * must stay that way.
 *
 * The interface is written down once, here, rather than agreed by coincidence
 * between two app files. It lives in `packages/ui` rather than in
 * `packages/core` because it names this package's read models (`LessonView`,
 * the review locators) and `core` may not depend on them — the same reason
 * `ReviewCardPort` is next door. No fetching, no React, no state: this file is
 * the shape of the question.
 */

import type { LessonRef } from "@pieai/university-core";

import type {
  CourseReviewCardLocator,
  CourseView,
  KnowledgeNoteView,
  LessonView,
} from "../view/lesson-view.js";

/**
 * One series, and every course in it.
 *
 * Shape only: units, lesson titles, how long each lesson is, how many cards and
 * exercises it carries. Deliberately no progress — that is the shared document's
 * answer, and a shelf that carried a second one is how a campus ends up drawing
 * a stone lit in one place and dark in another. The authoring API used to fill
 * these `progress` fields from its own SQLite; that database is now imported
 * into the document once and read from there.
 */
export interface ShelfStudy {
  readonly id: string;
  readonly title: string;
  readonly courses: readonly CourseView[];
}

/** Everything on offer, in the order the shelf holds it. */
export interface Shelf {
  readonly studies: readonly ShelfStudy[];
}

/** A series by name, before anything has been counted about it. */
export interface ContentStudy {
  readonly id: string;
  readonly title: string;
}

/** Both sides of one card, at the revision the shelf currently holds. */
export interface CardBody {
  readonly front: string;
  readonly back: string;
  readonly contentRevision: number;
}

/**
 * The small, explicit content read needed to explain one stored mistake.
 *
 * Normal lesson reads intentionally do not include the reference answer. The
 * mistake book is the one place that asks for it, after the learner has
 * already submitted an answer; keeping that question on ContentPort makes
 * both campuses use the same UI without leaking the delivery package's raw
 * authoring shape into the reader.
 */
export interface MistakeExercise {
  readonly id: string;
  readonly lessonTitle: string;
  readonly title: string;
  readonly prompt: string;
  readonly correctAnswer: string;
  readonly contentRevision: number;
}

export interface ContentPort {
  /**
   * Who is on the shelf without asking anyone — or null, for a build that has
   * to ask.
   *
   * The delivery build ships the catalogue inside the bundle, so it can name
   * every series during the first render; the authoring build has to call a
   * loopback server, so it cannot. Saying so out loud is what lets the screen
   * paint the picker immediately where the answer is already known and show
   * 「正在打开校园档案」 where it is not, without either build testing which
   * build it is.
   */
  readonly knownStudies: readonly ContentStudy[] | null;
  /**
   * Who is on the shelf. A name and an id; no lesson is ever read for this.
   *
   * Separate from `shelf()` because the two questions cost different amounts.
   * The capsule at the top of every screen answers 「我在哪个项目」, and it used
   * to get that from the authoring API's opening payload — one request. Folding
   * it into `shelf()` made the capsule wait while the server measured 579
   * lessons, and the picker sat empty for seconds on the screen a session
   * starts on.
   */
  studies(): Promise<readonly ContentStudy[]>;
  /**
   * Every series and every course's shape, fetched once.
   *
   * Both campuses already paid for this: the delivery campus loads every
   * package to compute the prerequisite graph, and the authoring campus loads
   * every study view to draw the shelf. One request shape, one cache, and the
   * map, the switcher, the planet and the 2D directory all read it.
   */
  shelf(): Promise<Shelf>;
  /**
   * One lesson, as the shared reader renders it.
   *
   * Rejects rather than returning null: a lesson that cannot be read is
   * something the learner has to be told about, and both campuses already have
   * a retry affordance for it. The signal is part of the contract rather than
   * a constructor option because the thing being abandoned is one navigation,
   * not the shelf.
   */
  lesson(locator: LessonRef, options?: { readonly signal?: AbortSignal }): Promise<LessonView>;
  /** The current question and reference answer for one stored mistake. */
  exercise(locator: LessonRef, exerciseId: string): Promise<MistakeExercise>;
  /**
   * One review card's two sides.
   *
   * Only course cards. A knowledge card is answered by the note that produced
   * it, and no campus schedules one yet — see `KnowledgeReviewCardLocator`.
   */
  card(card: CourseReviewCardLocator): Promise<CardBody>;
  /**
   * What the learner kept from arguing with an AI host about one series.
   *
   * Empty is a real answer, not a failure: the delivery build's packages do
   * not carry notes yet, so its library shows the fifth collection's empty
   * state — the same shape as a collection nobody has added to. The question
   * belongs on this port because it is the same question as 「where does a
   * lesson's text come from」, asked about a different kind of text.
   */
  notes(studyId: string): Promise<readonly KnowledgeNoteView[]>;
  /**
   * Where one note's evidence is fetched from, in this build.
   *
   * The evidence rail needs a URL prefix and only the build knows it: the
   * authoring server serves the repository off disk, and the delivery build
   * will serve whatever the export pipeline publishes. It was written into the
   * notes component as `/api/studies/…`, which is one server's address and
   * nobody else's.
   */
  noteEvidenceBase(studyId: string, noteId: string): string;
}
