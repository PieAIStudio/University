import type {
  RepairActivity,
  RepairEffect,
  RepairEvent,
  RepairProduct,
  RepairTrace,
} from "@pieai/university-core";
import { translate as t } from "../i18n/index.js";

export const repairChoiceLabel = (activity: RepairActivity, value: string): string =>
  activity.choices.find((choice) => choice.id === value)?.label ?? value;
export function repairProductSummary(activity: RepairActivity, product: RepairProduct): string {
  return activity.model === "booking"
    ? t("play.aiQuality.repair.bookingState", {
        count: product.reservations.length,
        items:
          product.reservations.map((choice) => repairChoiceLabel(activity, choice)).join(" / ") ||
          t("play.aiQuality.repair.none"),
      })
    : t("play.aiQuality.repair.preferenceState", {
        choice: repairChoiceLabel(activity, product.choice),
        saved: repairChoiceLabel(activity, product.savedChoice),
      });
}
export function repairEventLabel(activity: RepairActivity, event: RepairEvent): string {
  return event.type === "choose"
    ? t("play.aiQuality.repair.choose", { choice: repairChoiceLabel(activity, event.value) })
    : event.type === "submit"
      ? activity.submitLabel
      : t(`play.aiQuality.repair.${event.type}`);
}
export function RepairTraceRecord({
  activity,
  trace,
}: {
  readonly activity: RepairActivity;
  readonly trace: RepairTrace;
}) {
  return (
    <details className="ai-repair__trace">
      <summary>{t("play.aiQuality.repair.trace", { count: trace.entries.length })}</summary>
      {trace.entries.length === 0 ? (
        <p>{t("play.aiQuality.repair.traceEmpty")}</p>
      ) : (
        <ol>
          {trace.entries.map((entry, index) => (
            <li key={index}>
              <strong>{repairEventLabel(activity, entry.event)}</strong>
              <span>{t(`play.aiQuality.repair.${entry.effect}`)}</span>
              <p>{repairProductSummary(activity, entry.after)}</p>
            </li>
          ))}
        </ol>
      )}
    </details>
  );
}
/** One state view used for live play and both sides of a timeline frame. */
export function RepairProductView({
  activity,
  product,
  label,
  effect,
  compact = false,
}: {
  readonly activity: RepairActivity;
  readonly product: RepairProduct;
  readonly label: string;
  readonly effect?: RepairEffect;
  readonly compact?: boolean;
}) {
  return (
    <div className="ai-repair__state-view" data-compact={compact} role="group" aria-label={label}>
      <strong className="ai-repair__state-label">{label}</strong>
      {!compact && activity.model === "preference" ? (
        <div className="ai-repair__meal" data-choice={product.choice} aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
      ) : null}
      {activity.model === "booking" ? (
        <>
          <div className="ai-repair__capacity" aria-hidden="true">
            {Array.from({ length: activity.capacity }, (_, index) => (
              <span key={index} data-used={index < product.reservations.length}>
                {index < product.reservations.length ? "✓" : "·"}
              </span>
            ))}
          </div>
          <strong>
            {t("play.aiQuality.repair.reservations", {
              used: product.reservations.length,
              capacity: activity.capacity,
            })}
          </strong>
          {product.reservations.length > 0 ? (
            <ol className="ai-repair__receipts">
              {product.reservations.map((choice, index) => (
                <li key={index}>
                  {t("play.aiQuality.repair.receipt", {
                    number: index + 1,
                    choice: repairChoiceLabel(activity, choice),
                  })}
                </li>
              ))}
            </ol>
          ) : (
            <p>{t("play.aiQuality.repair.noReservations")}</p>
          )}
        </>
      ) : (
        <>
          <strong>
            {t("play.aiQuality.repair.selection", {
              choice: repairChoiceLabel(activity, product.choice),
            })}
          </strong>
          <p>
            {t(
              effect === "reloaded"
                ? "play.aiQuality.repair.loaded"
                : product.confirmed
                  ? "play.aiQuality.repair.confirmed"
                  : "play.aiQuality.repair.pending",
            )}
          </p>
        </>
      )}
      {effect ? (
        <p className="ai-repair__last-effect">{t(`play.aiQuality.repair.${effect}`)}</p>
      ) : null}
    </div>
  );
}
