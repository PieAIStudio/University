import { GameButton } from "@pieai/swimmer-ui-kit";
import { useEffect, useRef } from "react";
import type { ContextActivity, ContextPackResult, ContextVisit } from "@pieai/university-core";
import { translate as t } from "../i18n/index.js";

/** The little counter is fed by the same sourced rows as the material inspector. */
export function ContextCounter({
  activity,
  result,
  visits,
  served,
  active,
  stale,
  disabled,
  guided = false,
  onVisit,
  onSource,
  onMaterials,
  onBuild,
  onFinish,
}: {
  readonly activity: ContextActivity;
  readonly result: ContextPackResult;
  readonly visits: readonly ContextVisit[];
  readonly served: readonly string[];
  readonly active: string | null;
  readonly stale: boolean;
  readonly disabled: boolean;
  readonly guided?: boolean;
  readonly onVisit: (id: string) => void;
  readonly onSource: (id: string) => void;
  readonly onMaterials: () => void;
  readonly onBuild: () => void;
  readonly onFinish: () => void;
}) {
  const customer =
    activity.visitors?.find((visitor) => visitor.id === active) ??
    (guided ? activity.visitors?.[0] : undefined);
  const reply = visits.findLast((visit) => visit.visitorId === customer?.id);
  const row = result.rows.find((item) => item.slotId === customer?.slotId);
  const replyMatchesBuild =
    !!reply &&
    reply.paragraphIds.length === result.selectedParagraphIds.length &&
    reply.paragraphIds.every((id) => result.selectedParagraphIds.includes(id));
  const nextCustomer = activity.visitors?.find((visitor) => !served.includes(visitor.id));
  const allServed = !stale && result.passed && !nextCustomer;
  const guideTitle = stale
    ? "play.ai.context.guide.changed"
    : allServed
      ? "play.ai.context.guide.done"
      : !reply
        ? "play.ai.context.guide.first"
        : !replyMatchesBuild
          ? "play.ai.context.guide.rebuilt"
          : reply.passed
            ? "play.ai.context.guide.next"
            : "play.ai.context.guide.failed";
  const answer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (active) answer.current?.scrollIntoView?.({ block: "nearest", behavior: "instant" });
  }, [active, visits.length]);
  return (
    <section
      className="ai-context-counter"
      data-guided={guided}
      aria-label={t("play.ai.context.counter")}
    >
      <header className="ai-context-counter__sign">
        <span>{t("play.ai.context.counter")}</span>
        <h4>{guided ? t(guideTitle) : activity.workTitle}</h4>
        {!guided ? <p>{t("play.ai.context.takeOver")}</p> : null}
      </header>
      <div
        ref={answer}
        className="ai-context-counter__answer"
        data-passed={reply?.passed ?? false}
        role="status"
        aria-atomic="true"
      >
        {customer && row ? (
          <>
            <strong>
              {customer.name}：{customer.question}
            </strong>
            {reply ? (
              <>
                <p className="ai-context-counter__response">
                  {reply.value ??
                    t(
                      `play.ai.context.reason.${reply.status === "ready" ? "missing" : reply.status}`,
                      {
                        label: row.label,
                      },
                    )}
                </p>
                <p>
                  {t(
                    guided && (!replyMatchesBuild || stale)
                      ? "play.ai.context.guide.oldAnswer"
                      : result.overCapacity
                        ? "play.ai.context.guide.overCapacity"
                        : reply.passed
                          ? "play.ai.context.customerReady"
                          : "play.ai.context.customerBlocked",
                    { extra: Math.max(0, result.units - activity.capacity) },
                  )}
                </p>
                {!reply.passed && replyMatchesBuild && !stale && row.evidence.length ? (
                  <div className="ai-context-counter__clues">
                    <span>{t("play.ai.context.followClue")}</span>
                    {row.evidence.map((item) => {
                      const document = activity.documents.find(
                        (doc) => doc.id === item.documentId,
                      )!;
                      return (
                        <GameButton
                          key={item.paragraphId}
                          variant="ghost"
                          disabled={disabled}
                          onClick={() => onSource(document.id)}
                        >
                          {guided
                            ? t("play.ai.context.guide.openSource", { title: document.title })
                            : item.text}
                          <small>{guided ? item.text : document.title}</small>
                        </GameButton>
                      );
                    })}
                  </div>
                ) : null}
              </>
            ) : null}
            {guided && !stale && (!reply || !replyMatchesBuild) ? (
              <GameButton
                variant="primary"
                disabled={disabled}
                onClick={() => onVisit(customer.id)}
              >
                {t(reply ? "play.ai.context.guide.retry" : "play.ai.context.guide.visit", {
                  name: customer.name,
                })}
              </GameButton>
            ) : null}
          </>
        ) : (
          <p>{t("play.ai.context.firstCustomer")}</p>
        )}
      </div>
      {stale ? (
        <p className="ai-context-counter__stale" role="status">
          {t("play.ai.context.counterStale")}
        </p>
      ) : null}
      <footer>
        <span>
          {t("play.ai.context.servedCount", {
            count: served.length,
            total: activity.visitors?.length ?? 0,
          })}
        </span>
        <div className="play-action-row">
          {!guided || stale ? (
            <GameButton
              variant={guided ? "primary" : "secondary"}
              disabled={disabled}
              onClick={onBuild}
            >
              {t("play.ai.context.buildCounter")}
            </GameButton>
          ) : null}
          {guided && reply && replyMatchesBuild && !stale && !allServed ? (
            reply.passed && nextCustomer ? (
              <GameButton
                variant="primary"
                disabled={disabled}
                onClick={() => onVisit(nextCustomer.id)}
              >
                {t("play.ai.context.guide.visit", { name: nextCustomer.name })}
              </GameButton>
            ) : (
              <GameButton variant="secondary" disabled={disabled} onClick={onMaterials}>
                {t("play.ai.context.guide.materials")}
              </GameButton>
            )
          ) : null}
          {!guided || allServed ? (
            <GameButton variant="primary" disabled={disabled} onClick={onFinish}>
              {t("play.ai.context.deliverCounter")}
            </GameButton>
          ) : null}
        </div>
      </footer>
      <details className="play-context-queue" open={!guided}>
        <summary>
          {t("play.ai.context.guide.queue", {
            count: served.length,
            total: activity.visitors?.length ?? 0,
          })}
        </summary>
        <div className="ai-context-counter__queue" aria-label={t("play.ai.context.customers")}>
          {activity.visitors?.map((visitor, index) => (
            <GameButton
              key={visitor.id}
              variant={active === visitor.id ? "primary" : "secondary"}
              disabled={disabled || stale}
              aria-pressed={active === visitor.id}
              onClick={() => onVisit(visitor.id)}
            >
              <span className="ai-context-counter__person" aria-hidden="true">
                {index + 1}
              </span>
              <span>
                <strong>{visitor.name}</strong>
                <small>{visitor.question}</small>
              </span>
              <span
                aria-label={t(
                  served.includes(visitor.id)
                    ? "play.ai.context.served"
                    : "play.ai.context.unserved",
                )}
                role="img"
              >
                {served.includes(visitor.id) ? "✓" : "…"}
              </span>
            </GameButton>
          ))}
        </div>
      </details>
    </section>
  );
}
