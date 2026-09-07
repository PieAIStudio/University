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
  onVisit,
  onSource,
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
  readonly onVisit: (id: string) => void;
  readonly onSource: (id: string) => void;
  readonly onBuild: () => void;
  readonly onFinish: () => void;
}) {
  const customer = activity.visitors?.find((visitor) => visitor.id === active);
  const reply = visits.findLast((visit) => visit.visitorId === active);
  const row = result.rows.find((item) => item.slotId === customer?.slotId);
  const answer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (active) answer.current?.scrollIntoView?.({ block: "nearest", behavior: "instant" });
  }, [active, visits.length]);
  return (
    <section className="ai-context-counter" aria-label={t("play.ai.context.counter")}>
      <header className="ai-context-counter__sign">
        <span>{t("play.ai.context.counter")}</span>
        <h4>{activity.workTitle}</h4>
        <p>{t("play.ai.context.takeOver")}</p>
      </header>
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
                served.includes(visitor.id) ? "play.ai.context.served" : "play.ai.context.unserved",
              )}
              role="img"
            >
              {served.includes(visitor.id) ? "✓" : "…"}
            </span>
          </GameButton>
        ))}
      </div>
      <div
        ref={answer}
        className="ai-context-counter__answer"
        data-passed={reply?.passed ?? false}
        role="status"
        aria-atomic="true"
      >
        {customer && reply && row ? (
          <>
            <strong>
              {customer.name}：{customer.question}
            </strong>
            <p className="ai-context-counter__response">
              {reply.value ??
                t(`play.ai.context.reason.${reply.status === "ready" ? "missing" : reply.status}`, {
                  label: row.label,
                })}
            </p>
            <p>
              {t(
                reply.passed ? "play.ai.context.customerReady" : "play.ai.context.customerBlocked",
              )}
            </p>
            {!reply.passed && row.evidence.length ? (
              <div className="ai-context-counter__clues">
                <span>{t("play.ai.context.followClue")}</span>
                {row.evidence.map((item) => {
                  const document = activity.documents.find((doc) => doc.id === item.documentId)!;
                  return (
                    <GameButton
                      key={item.paragraphId}
                      variant="ghost"
                      disabled={disabled}
                      onClick={() => onSource(document.id)}
                    >
                      {item.text}
                      <small>{document.title}</small>
                    </GameButton>
                  );
                })}
              </div>
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
          <GameButton variant="secondary" disabled={disabled} onClick={onBuild}>
            {t("play.ai.context.buildCounter")}
          </GameButton>
          <GameButton variant="primary" disabled={disabled} onClick={onFinish}>
            {t("play.ai.context.deliverCounter")}
          </GameButton>
        </div>
      </footer>
    </section>
  );
}
