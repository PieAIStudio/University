import { useState, useSyncExternalStore } from "react";
import { GameButton } from "@pieai/swimmer-ui-kit";
import type { LessonRef, ProgressPort } from "@pieai/university-core";
import { useI18n } from "@pieai/university-ui/i18n.js";
import { RecapPrompt } from "@pieai/university-ui/review/RecapPrompt.js";
import "./journey-cards.css";

/** Numbers and synchronization claims come from the same current document. */
export function WrapUpCard({
  progress,
  locator,
  owner,
  member,
  hasEmail,
  offerSave,
  offerMember,
  objective,
  contentRevision,
  onSave,
  onLater,
  onMember,
  onReview,
  onNext,
}: {
  readonly progress: ProgressPort;
  readonly locator: LessonRef;
  readonly owner: string | null;
  readonly member: boolean;
  readonly hasEmail: boolean;
  readonly offerSave: boolean;
  readonly offerMember: boolean;
  readonly objective: string;
  readonly contentRevision: number;
  readonly onSave: (reminders: boolean) => void;
  readonly onLater: () => void;
  readonly onMember: () => void;
  readonly onReview: () => void;
  readonly onNext?: () => void;
}) {
  const t = useI18n();
  const document = useSyncExternalStore(progress.subscribe, progress.snapshot);
  const [recap, setRecap] = useState(false);
  const sync = progress.syncState();
  if (sync.userId !== owner) return null;
  const synced = Boolean(
    owner && sync.remoteAvailable && !sync.dirty && sync.status === "idle" && sync.lastSyncedAt,
  );
  const count = Object.keys(document.cards).filter((key) =>
    key.startsWith(`${locator.studyId}/${locator.courseId}/${locator.lessonId}/`),
  ).length;
  return (
    <div
      className="journey-card"
      data-wrap-up={member ? "member" : hasEmail ? "email" : "guest"}
      data-wrap-up-card-count={count}
    >
      {hasEmail && !member ? (
        <p data-wrap-up-sync={synced ? "saved" : "pending"}>
          {t.t(synced ? "journey.wrap.synced" : "journey.wrap.syncPending")}
        </p>
      ) : null}
      {!hasEmail && offerSave ? (
        <div className="journey-card__save" data-email-save-card>
          <GameButton
            variant="primary"
            static
            data-journey-save="remind"
            onClick={() => onSave(true)}
          >
            {t.t("journey.wrap.save")}
          </GameButton>
          <div className="journey-card__links">
            <GameButton
              variant="ghost"
              static
              data-journey-save="only"
              onClick={() => onSave(false)}
            >
              {t.t("journey.wrap.saveOnly")}
            </GameButton>
            <GameButton variant="ghost" static data-journey-later onClick={onLater}>
              {t.t("journey.wrap.later")}
            </GameButton>
          </div>
          <p className="journey-card__note">{t.t("journey.wrap.accountBoundary")}</p>
          <p className="journey-card__note">{t.t("journey.wrap.emailBoundary")}</p>
        </div>
      ) : null}
      {hasEmail && !member && offerMember ? (
        <div data-member-line>
          <p>{t.t("journey.wrap.member")}</p>
          <GameButton variant="ghost" static onClick={onMember}>
            {t.t("journey.wrap.memberOpen")}
          </GameButton>
        </div>
      ) : null}
      <div className="journey-card__links">
        {onNext ? (
          <GameButton variant="ghost" static data-journey-next onClick={onNext}>
            {t.t("journey.wrap.next")}
          </GameButton>
        ) : null}
        {!member ? (
          <GameButton variant="ghost" static data-journey-review onClick={onReview}>
            {t.t("journey.wrap.review")}
          </GameButton>
        ) : null}
      </div>
      {objective ? (
        <>
          <GameButton
            variant="ghost"
            static
            data-journey-recap
            aria-expanded={recap}
            onClick={() => setRecap(!recap)}
          >
            {t.t(recap ? "journey.wrap.recapClose" : "journey.wrap.recap")}
          </GameButton>
          {recap ? (
            <RecapPrompt
              locator={locator}
              unitObjective={objective}
              contentRevision={contentRevision}
              progress={progress}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
