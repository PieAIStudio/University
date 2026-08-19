import { randomUUID } from "node:crypto";

import type { EvidenceReference, KnowledgeNote, StudyManifest } from "../../src/domain/schemas.js";
import { resolveEvidenceAnchors } from "../content/evidence-anchors.js";
import { readCommitDate } from "../content/commit-date.js";
import { readEvidenceSnippet } from "../content/evidence.js";
import { resolveEvidenceUa } from "../ua/study-map.js";
import {
  backlinksOf,
  buildLessonIndex,
  parseLessonLinks,
  resolveLessonLinks,
} from "../content/lesson-links.js";
import { readLatestLesson, readUnit } from "../content/repository.js";
import { openStudyRepository } from "../studies/snapshots.js";
import { listKnowledgeNotes, readLatestKnowledgeNote } from "../knowledge/repository.js";
import type { SqliteLearningStore } from "../learning/sqlite-learning-store.js";
import { exerciseContentKey, lessonContentKey } from "../learning/types.js";
import { composeLanguageLayer } from "../language/layer.js";
import { selectLexicon } from "../language/lexicon.js";
import type { VocabularyState } from "../language/vocabulary-store.js";
import {
  buildExerciseCoachingPacket,
  disclosesReference,
  type CoachingPacketEvidence,
} from "../workflows/exercise-coaching-packet.js";
import { HttpError } from "./errors.js";
import type { LearningRoute } from "./routes.js";
import {
  listActiveCourses,
  requireActiveCard,
  requireActiveExercise,
  requireActiveLesson,
} from "./content-access.js";
import { serializeProgress } from "./serialize.js";

function publicEvidence(
  evidence: readonly EvidenceReference[],
  ua: ReturnType<typeof resolveEvidenceUa> = [],
): unknown {
  return evidence.map((reference, index) => {
    const place = ua[index] ?? null;
    return {
      kind: reference.kind,
      sourcePath: reference.sourcePath,
      lineStart: reference.lineStart ?? null,
      lineEnd: reference.lineEnd ?? null,
      sourceCommit: reference.sourceCommit,
      nodeIds: reference.nodeIds,
      // Every reference is written with a sentence saying what this code proves.
      // It was stored and never served, so the rail could only ever show a file
      // path — the learner had to open the snippet and work out the relevance
      // themselves, for a question the author had already answered.
      note: reference.note ?? null,
      ua: place
        ? {
            nodeId: place.nodeId,
            name: place.name,
            summary: place.summary,
            layerName: place.layerName,
          }
        : null,
    };
  });
}

function publicKnowledgeNote(note: KnowledgeNote, content: string): unknown {
  return {
    id: note.id,
    title: note.title,
    question: note.question,
    summary: note.summary,
    claimType: note.claimType,
    status: note.status,
    contentRevision: note.contentRevision,
    cardCount: note.cards.length,
    evidence: publicEvidence(note.evidence),
    content,
  };
}

function buildStudyView(
  studiesRoot: string,
  study: StudyManifest,
  store: SqliteLearningStore | null,
): unknown {
  const courseViews = listActiveCourses(studiesRoot, study).map((course) => {
    const units = course.unitIds.map((unitId) => {
      const unit = readUnit(studiesRoot, study.id, course.id, unitId);
      return {
        ...unit,
        lessons: unit.lessonIds.map((lessonId) => {
          const lesson = readLatestLesson(
            studiesRoot,
            study.id,
            course.id,
            unit.id,
            lessonId,
          ).manifest;
          const key = lessonContentKey({ courseId: course.id, unitId: unit.id, lessonId });
          return {
            id: lesson.id,
            title: lesson.title,
            status: lesson.status,
            contentRevision: lesson.contentRevision,
            cardCount: lesson.cardIds.length,
            exerciseCount: lesson.exerciseIds.length,
            progress: serializeProgress(
              store?.getLessonProgress(key) ?? null,
              store?.hasLessonCompletion(key, lesson.contentRevision) ?? false,
            ),
          };
        }),
      };
    });
    return { ...course, units, isDefault: course.id === study.defaultCourseId };
  });
  const notes = listKnowledgeNotes(studiesRoot, study.id).map((note) => {
    const stored = readLatestKnowledgeNote(studiesRoot, study.id, note.id);
    return publicKnowledgeNote(stored.note, stored.content);
  });
  return { study, courses: courseViews, notes };
}

/**
 * Build the link index for the current lesson contents.
 *
 * Lesson revisions can be written while the development server is running.
 * Rebuilding here keeps links and backlinks correct across those revisions;
 * this is one build per lesson request, and the caller uses it only once.
 */
function getLessonIndex(studiesRoot: string, studyId: string) {
  return buildLessonIndex(studiesRoot, studyId);
}

/**
 * The commit a lesson is pinned to, with its date when the mirror can supply
 * one. Undefined when the lesson cites nothing, and — deliberately — also when
 * its citations disagree: a lesson spanning two commits has no single version
 * to open, and offering one of them would be picking a side silently.
 */
function pinnedVersion(
  evidence: readonly EvidenceReference[],
  repository: string | null,
): { readonly pinnedCommit?: { readonly commit: string; readonly date?: string } } {
  const commits = new Set(evidence.map((item) => item.sourceCommit));
  const [commit] = [...commits];
  if (commits.size !== 1 || !commit) return {};
  const date = repository ? readCommitDate(repository, commit) : null;
  return { pinnedCommit: { commit, ...(date ? { date } : {}) } };
}

function buildLessonView(
  studiesRoot: string,
  route: LearningRoute,
  store: SqliteLearningStore | null,
  vocabulary: readonly VocabularyState[],
): unknown {
  const { lesson, content } = requireActiveLesson(studiesRoot, route);
  /*
    Dates for the commits this lesson's pictures came from.

    Read from UniversityLocal's own mirror of the studied project rather than
    from the project's checkout, so a screenshot keeps its date even after the
    source repository has moved, been re-cloned, or gone away entirely.

    A study whose repository was never initialised simply has no dates; the
    lesson still shows every hash it showed before.
  */
  let assetRepository: string | null = null;
  try {
    assetRepository = openStudyRepository(studiesRoot, route.studyId);
  } catch {
    assetRepository = null;
  }
  const assetCommitDate = (commit: string): string | null =>
    assetRepository ? readCommitDate(assetRepository, commit) : null;
  const lessonKey = lessonContentKey({
    courseId: route.courseId,
    unitId: route.unitId,
    lessonId: route.lessonId,
  });
  // The foreign-language layer travels with every lesson and costs a few
  // hundred bytes: ranges plus the senses those ranges use. Whether any of it
  // is shown is the reader's choice, made in the browser, because it changes
  // nothing about what the lesson is — only about how it reads.
  //
  // Composed rather than merely read: an authored overlay is honoured where one
  // exists, and detection covers the rest, so which words a lesson can teach no
  // longer depends on whether anyone annotated it.
  const language = composeLanguageLayer({
    studiesRoot,
    studyId: route.studyId,
    language: "en",
    courseId: route.courseId,
    unitId: route.unitId,
    lessonId: route.lessonId,
    contentRevision: lesson.contentRevision,
    content,
    vocabulary,
  });
  // Associative links, both directions. Resolution happens here rather than in
  // the browser because a broken link has to be visible to whoever wrote it,
  // and the browser has no way to know a target does not exist.
  const linkIndex = getLessonIndex(studiesRoot, route.studyId);
  const linkResolutions = resolveLessonLinks(parseLessonLinks(content), linkIndex, route);
  return {
    lesson: {
      id: lesson.id,
      title: lesson.title,
      contentRevision: lesson.contentRevision,
      content,
      sections: lesson.sections,
      links: linkResolutions.map((item) =>
        item.kind === "resolved"
          ? {
              start: item.link.start,
              end: item.link.end,
              label: item.link.label,
              target: item.target,
            }
          : { start: item.link.start, end: item.link.end, label: item.link.label, target: null },
      ),
      backlinks: backlinksOf(linkIndex, route),
      /*
        The one commit this lesson is pinned to, so the reader can be offered a
        checkout of it. Read off the citations rather than stored separately —
        the manifest already pins every one of them, and no current lesson
        cites more than a single commit, which is what makes "this
        lesson's version" a thing that exists at all. A lesson with no evidence
        has no version to open, and says so by omitting this.
      */
      ...pinnedVersion(lesson.evidence, assetRepository),
      // Resolved against this lesson's own citations, so prose can only point
      // at lines the manifest already pinned to the snapshot.
      evidenceAnchors: resolveEvidenceAnchors(content, lesson.evidence),
      language: {
        status: language.status,
        ranges: language.ranges,
        lexicon: selectLexicon(language.senseIds),
        // Why each word is here. The body dims the ones already retired and the
        // sidebar sorts by it, so "认识" visibly quiets a word instead of only
        // changing a number in a database.
        reasons: language.reasons,
      },
      evidence: publicEvidence(
        lesson.evidence,
        resolveEvidenceUa(studiesRoot, route.studyId, lesson.evidence),
      ),
      assets: lesson.assets.map((asset) => ({
        id: asset.id,
        kind: asset.kind,
        mime: asset.mime,
        url: `/api/studies/${route.studyId}/courses/${route.courseId}/units/${route.unitId}/lessons/${route.lessonId}/revisions/${lesson.contentRevision}/assets/${asset.id}`,
        ...(asset.posterAssetId
          ? {
              posterUrl: `/api/studies/${route.studyId}/courses/${route.courseId}/units/${route.unitId}/lessons/${route.lessonId}/revisions/${lesson.contentRevision}/assets/${asset.posterAssetId}`,
            }
          : {}),
        alt: asset.alt,
        ...(asset.caption ? { caption: asset.caption } : {}),
        ...(asset.transcript ? { transcript: asset.transcript } : {}),
        ...(asset.capture
          ? {
              sourceCommit: asset.capture.sourceCommit,
              // Derived, never stored: a commit's date is a property of the
              // commit, and copying it into the manifest would create a second
              // version of a fact that can be looked up — which eventually
              // disagrees with the first.
              ...(assetCommitDate(asset.capture.sourceCommit)
                ? { sourceCommitDate: assetCommitDate(asset.capture.sourceCommit) }
                : {}),
              capture: {
                route: asset.capture.route,
                state: asset.capture.state,
                viewport: asset.capture.viewport,
                locale: asset.capture.locale,
                captureRecipe: asset.capture.captureRecipe,
                capturedAt: asset.capture.capturedAt,
              },
            }
          : {}),
        ...(asset.source?.attribution ? { attribution: asset.source.attribution } : {}),
        ...(asset.source?.license ? { license: asset.source.license } : {}),
        ...(asset.source?.aiNote ? { aiNote: asset.source.aiNote } : {}),
      })),
      progress: serializeProgress(
        store?.getLessonProgress(lessonKey) ?? null,
        store?.hasLessonCompletion(lessonKey, lesson.contentRevision) ?? false,
      ),
      exercises: lesson.exerciseIds.map((exerciseId) => {
        const exercise = requireActiveExercise(studiesRoot, { ...route, contentId: exerciseId });
        const exerciseKey = exerciseContentKey({
          courseId: route.courseId,
          unitId: route.unitId,
          lessonId: route.lessonId,
          exerciseId: exercise.id,
        });
        const hostGrade = store?.getLatestHostExerciseGrade(exerciseKey, exercise.contentRevision);
        const hostPassed = store?.hasCorrectExerciseAttempt(exerciseKey, exercise.contentRevision);
        // The store has kept every submission since the exercise log existed,
        // and the reader has been throwing them away on every reload: a learner
        // who answered yesterday came back to an empty box and a disabled
        // button, with no way to tell "saved" from "lost". Unlike a review
        // card, an exercise is answered once and then discussed, so restoring
        // the text costs no retrieval — it is the same answer, still open.
        const submission = store?.getLatestLearnerSubmission(exerciseKey, exercise.contentRevision);
        return {
          id: exercise.id,
          kind: exercise.kind,
          title: exercise.title,
          prompt: exercise.prompt,
          contentRevision: exercise.contentRevision,
          awaitingHostGrade: !hostPassed,
          latestSubmission: submission
            ? { answer: submission.answer, occurredAt: submission.occurredAt.toISOString() }
            : null,
          hostGrade: hostGrade
            ? {
                passed: hostGrade.passed,
                evaluation: hostGrade.evaluation,
                extensions: hostGrade.extensions,
                host: hostGrade.host,
                learnerAnswer: hostGrade.learnerAnswer,
                occurredAt: hostGrade.occurredAt.toISOString(),
              }
            : null,
        };
      }),
      cards: lesson.cardIds.map((cardId) => {
        const card = requireActiveCard(studiesRoot, { ...route, contentId: cardId });
        return {
          id: card.id,
          kind: card.kind,
          front: card.front,
          contentRevision: card.contentRevision,
        };
      }),
    },
  };
}

/**
 * Evidence carried by the packet. The exercise's own references come first
 * because they are what the question is about; the lesson's references follow
 * as context. Five is a clipboard budget, not a correctness limit — a packet
 * nobody can paste teaches nothing.
 */
const PACKET_EVIDENCE_LIMIT = 5;
const PACKET_EVIDENCE_CONTEXT_LINES = 2;

function evidenceIdentity(reference: EvidenceReference): string {
  return `${reference.sourcePath}:${reference.lineStart ?? ""}-${reference.lineEnd ?? ""}`;
}

function collectPacketEvidence(
  studiesRoot: string,
  studyId: string,
  references: readonly EvidenceReference[],
): { readonly evidence: readonly CoachingPacketEvidence[]; readonly omitted: number } {
  const evidence: CoachingPacketEvidence[] = [];
  const seen = new Set<string>();
  let omitted = 0;
  for (const reference of references) {
    const identity = evidenceIdentity(reference);
    if (seen.has(identity)) continue;
    seen.add(identity);
    if (evidence.length >= PACKET_EVIDENCE_LIMIT) {
      omitted += 1;
      continue;
    }
    try {
      evidence.push({
        note: reference.note ?? null,
        snippet: readEvidenceSnippet(
          studiesRoot,
          studyId,
          reference,
          PACKET_EVIDENCE_CONTEXT_LINES,
        ),
      });
    } catch {
      // A reference can point at a file too large to display, or at build
      // configuration outside the UA graph. One unreadable snippet must not
      // cost the learner the whole packet.
      omitted += 1;
    }
  }
  return { evidence, omitted };
}

function buildCoachingPacketResponse(
  studiesRoot: string,
  route: LearningRoute,
  getStore: (studyId: string, create?: boolean) => SqliteLearningStore | null,
): unknown {
  const exercise = requireActiveExercise(studiesRoot, route);
  const lesson = requireActiveLesson(studiesRoot, route).lesson;
  const store = getStore(route.studyId);
  const exerciseKey = exerciseContentKey({
    courseId: route.courseId,
    unitId: route.unitId,
    lessonId: route.lessonId,
    exerciseId: exercise.id,
  });
  const submission = store?.getLatestLearnerSubmission(exerciseKey, exercise.contentRevision);
  if (!submission) {
    throw new HttpError(409, "Submit an answer before copying the coaching packet");
  }
  const submissionCount = store!.countLearnerSubmissions(exerciseKey, exercise.contentRevision);
  const passed = store!.hasCorrectExerciseAttempt(exerciseKey, exercise.contentRevision);
  const disclose = disclosesReference({ passed, submissionCount });

  const { evidence, omitted } = collectPacketEvidence(studiesRoot, route.studyId, [
    ...exercise.evidence,
    ...lesson.evidence,
  ]);

  const packet = buildExerciseCoachingPacket({
    locator: {
      studyId: route.studyId,
      courseId: route.courseId,
      unitId: route.unitId,
      lessonId: route.lessonId,
    },
    lessonTitle: lesson.title,
    exercise: {
      id: exercise.id,
      kind: exercise.kind,
      title: exercise.title,
      prompt: exercise.prompt,
      contentRevision: exercise.contentRevision,
    },
    learnerAnswer: submission.answer,
    submissionCount,
    commandId: randomUUID(),
    evidence,
    evidenceOmitted: omitted,
    reference: !disclose
      ? null
      : exercise.kind === "short-answer"
        ? { kind: "short-answer", expectedAnswer: exercise.expectedAnswer }
        : { kind: "explain", rubric: exercise.rubric },
  });

  return {
    packet,
    referenceDisclosed: disclose,
    evidenceCount: evidence.length,
    evidenceOmitted: omitted,
    submissionCount,
  };
}

export { buildStudyView, buildLessonView, buildCoachingPacketResponse };
