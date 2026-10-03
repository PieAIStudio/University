import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import {
  isLessonComplete,
  lessonRefKey,
  progressSourceOf,
  recordJourneyShown,
  shouldOfferEmailSave,
  shouldOfferMemberLine,
  type IdentityStatus,
  type LessonRef,
  type PaymentPort,
  type ProgressDocument,
  type ProgressPort,
  type View,
  answerUsed,
  pendingUsedQuestion,
  type UsedAnswer,
  calendarDay,
} from "@pieai/university-core";
import { UsedQuestion } from "@pieai/university-ui";
import { useI18n } from "@pieai/university-ui/i18n.js";
import { readingMinutes } from "@pieai/university-ui/path/path-stats.js";
import type { CourseView } from "@pieai/university-ui/view/lesson-view.js";
import { WrapUpCard } from "../../guide/WrapUpCard";
import type { JourneyOpening } from "../../guide/use-journey-opening";

export function journeyOwner(identity: IdentityStatus): string | null {
  return identity.kind === "signed_in" || identity.kind === "anonymous" ? identity.user.id : null;
}

interface Invitation {
  readonly key: string;
  readonly owner: string | null;
  readonly kind: "wrap-up" | "continue";
  readonly locator: LessonRef;
  readonly member: boolean;
  readonly hasEmail: boolean;
  readonly save: boolean;
  readonly memberLine: boolean;
  readonly message: string;
}

/** Product moments only. The one Nerve controller renders/dismisses them. */
export function useJourney({
  view,
  identity,
  progress,
  document,
  payment,
  courseOf,
  onMap,
  onLesson,
  onAccount,
  onMember,
  onReview,
}: {
  readonly view: View;
  readonly identity: IdentityStatus;
  readonly progress: ProgressPort;
  readonly document: ProgressDocument;
  readonly payment: PaymentPort;
  readonly courseOf: (studyId: string, courseId: string) => CourseView | null;
  readonly onMap: (locator: LessonRef) => void;
  readonly onLesson: (locator: LessonRef) => void;
  readonly onAccount: () => void;
  readonly onMember: () => void;
  readonly onReview: () => void;
}) {
  const t = useI18n();
  const owner = journeyOwner(identity);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [membership, setMembership] = useState<{ owner: string | null; member: boolean } | null>(
    null,
  );
  const serial = useRef(0);
  const latest = useRef({ owner, view, onMap, onLesson, onAccount, onMember, onReview });
  latest.current = { owner, view, onMap, onLesson, onAccount, onMember, onReview };
  const hasEmail = identity.kind === "signed_in" && Boolean(identity.user.email);
  useEffect(() => {
    let alive = true;
    setMembership(null);
    if (hasEmail)
      void payment
        .readEntitlements()
        .then((result) => {
          if (alive && latest.current.owner === owner && result.kind === "value") {
            setMembership({
              owner,
              member: result.value.source === "remote" && result.value.planId !== "free",
            });
          }
        })
        .catch(() => {
          /* Unknown membership is not permission to advertise a trial. */
        });
    return () => {
      alive = false;
    };
  }, [owner, hasEmail, payment]);

  const belongsHere =
    invitation &&
    invitation.owner === owner &&
    view.kind === "course" &&
    view.studyId === invitation.locator.studyId &&
    view.courseId === invitation.locator.courseId;
  useEffect(() => {
    if (invitation && !belongsHere) setInvitation(null);
  }, [invitation, belongsHere]);

  const offer = useCallback(
    (kind: Invitation["kind"], locator: LessonRef) => {
      if (latest.current.owner !== owner || progress.syncState().userId !== owner) return;
      const course = courseOf(locator.studyId, locator.courseId);
      const unit = course?.units.find((item) => item.id === locator.unitId);
      const lesson = unit?.lessons.find((item) => item.id === locator.lessonId);
      if (!course || !lesson) return;
      if (
        kind === "wrap-up" &&
        !isLessonComplete(progressSourceOf(progress).completionOf(locator, lesson))
      )
        return;
      const number =
        course.units
          .flatMap((item) => item.lessons)
          .findIndex((item) => item.id === locator.lessonId) + 1;
      const current = progress.snapshot();
      const history = current.account.preferences.journey;
      const now = Date.now();
      const member = membership?.owner === owner && membership.member;
      const count = Object.keys(current.cards).filter((key) =>
        key.startsWith(`${locator.studyId}/${locator.courseId}/${locator.lessonId}/`),
      ).length;
      const save =
        !hasEmail &&
        shouldOfferEmailSave(
          history,
          now,
          Object.values(current.lessons).filter((item) => item.progress >= 1).length,
        );
      setInvitation({
        key: `${kind}:${lessonRefKey(locator)}:${++serial.current}`,
        owner,
        kind,
        locator,
        member,
        hasEmail,
        save: kind === "wrap-up" && save,
        memberLine:
          kind === "wrap-up" &&
          hasEmail &&
          !member &&
          membership !== null &&
          shouldOfferMemberLine(history, now),
        message:
          kind === "continue"
            ? t.t("journey.continue.title", {
                number,
                minutes: readingMinutes(lesson.contentChars),
              })
            : progress.localSaveState?.() === "failed"
              ? t.t("journey.wrap.unsaved")
              : count > 0
                ? t.t("journey.wrap.saved", { count })
                : t.t("journey.wrap.empty"),
      });
      latest.current.onMap(locator);
    },
    [owner, progress, courseOf, membership, hasEmail, t],
  );

  const afterLesson = useCallback(
    (locator: LessonRef) => {
      const current = latest.current;
      if (
        current.owner !== owner ||
        current.view.kind !== "settled" ||
        lessonRefKey(current.view) !== lessonRefKey(locator)
      )
        return;
      offer("wrap-up", locator);
    },
    [owner, offer],
  );
  const continueAt = useCallback((locator: LessonRef) => offer("continue", locator), [offer]);

  const active = belongsHere && progress.syncState().userId === owner ? invitation : null;
  const currentInvitation = useRef(active);
  currentInvitation.current = active;
  const alive = (key: string) =>
    currentInvitation.current?.key === key &&
    latest.current.owner === owner &&
    progress.syncState().userId === owner;
  const close = () => {
    if (active && alive(active.key)) setInvitation(null);
  };
  // 「用了吗？」 rides on the return card (V7 amendment one). Read once per card,
  // so answering it does not make the question vanish before its confirmation.
  const usedQuestion = useMemo(
    () =>
      active?.kind === "continue"
        ? pendingUsedQuestion(progress.accountData().preferences.house, calendarDay(Date.now()))
        : null,
    [active?.key],
  );
  const answerUsedQuestion = (answer: UsedAnswer) => {
    if (!usedQuestion) return;
    const preferences = progress.accountData().preferences;
    const now = new Date().toISOString();
    progress.setAccountPreferences({
      ...preferences,
      house: answerUsed(
        preferences.house,
        usedQuestion.lessonKey,
        answer,
        calendarDay(Date.now()),
        now,
      ),
      updatedAt: { ...preferences.updatedAt, house: now },
    });
  };

  let opening: JourneyOpening | null = null;
  if (active) {
    const course = courseOf(active.locator.studyId, active.locator.courseId);
    const unit = course?.units.find((item) => item.id === active.locator.unitId);
    const lesson = unit?.lessons.find((item) => item.id === active.locator.lessonId);
    if (lesson) {
      const flat = course!.units.flatMap((item) =>
        item.lessons.map((entry) => ({ unit: item, lesson: entry })),
      );
      const index = flat.findIndex((item) => item.lesson.id === lesson.id);
      const number = index + 1;
      const next = flat[index + 1];
      const count = Object.values(document.cards).filter(
        (card) =>
          card.studyId === active.locator.studyId &&
          card.courseId === active.locator.courseId &&
          card.lessonId === active.locator.lessonId,
      ).length;
      const message =
        active.kind === "continue"
          ? active.message
          : progress.localSaveState?.() === "failed"
            ? t.t("journey.wrap.unsaved")
            : count > 0
              ? t.t("journey.wrap.saved", { count })
              : t.t("journey.wrap.empty");
      opening = {
        key: active.key,
        topic: active.kind,
        message,
        ...(active.kind === "wrap-up" && active.member ? { autoHideMs: 4000 } : {}),
        onClose: close,
        onShown: () => {
          if (!alive(active.key) || (!active.save && !active.memberLine)) return;
          const preferences = progress.accountData().preferences;
          progress.setAccountPreferences({
            ...preferences,
            journey: recordJourneyShown(
              preferences.journey,
              active.save ? "save" : "member",
              Date.now(),
            ),
          });
        },
        card:
          active.kind === "continue" ? (
            <div className="journey-card" data-journey-continue>
              {usedQuestion ? (
                <UsedQuestion task={usedQuestion.task} onAnswer={answerUsedQuestion} />
              ) : null}
              <GameButton
                variant="primary"
                static
                data-journey-start
                aria-label={t.t("journey.continue.label", { number, title: lesson.title })}
                onClick={() => {
                  if (!alive(active.key)) return;
                  close();
                  latest.current.onLesson(active.locator);
                }}
              >
                {t.t("journey.continue.start")}
              </GameButton>
            </div>
          ) : (
            <WrapUpCard
              progress={progress}
              locator={active.locator}
              owner={owner}
              member={active.member}
              hasEmail={active.hasEmail}
              offerSave={active.save}
              offerMember={active.memberLine}
              objective={unit?.objective ?? ""}
              contentRevision={lesson.contentRevision}
              onLater={close}
              onSave={(enabled) => {
                if (!alive(active.key)) return;
                progress.setAccountPreferences({
                  ...progress.accountData().preferences,
                  reviewEmail: {
                    enabled,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    schedule: "cards-due",
                  },
                });
                close();
                latest.current.onAccount();
              }}
              onMember={() => {
                if (alive(active.key)) {
                  close();
                  latest.current.onMember();
                }
              }}
              onReview={() => {
                if (alive(active.key)) {
                  close();
                  latest.current.onReview();
                }
              }}
              onNext={
                next
                  ? () => {
                      if (!alive(active.key)) return;
                      close();
                      latest.current.onLesson({
                        ...active.locator,
                        unitId: next.unit.id,
                        lessonId: next.lesson.id,
                      });
                    }
                  : undefined
              }
            />
          ),
      };
    }
  }
  return { opening, afterLesson, continueAt, target: active?.locator ?? null };
}
