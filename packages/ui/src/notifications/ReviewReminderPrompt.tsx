import { useState, useSyncExternalStore } from "react";
import { GameButton, GamePanel } from "@pieai/swimmer-ui-kit";
import type { ReviewReminderPort } from "@pieai/university-core";

/**
 * The in-product question that comes before the browser permission question.
 *
 * This component deliberately knows nothing about `Notification`. The port's
 * `enable` method is called only by the 「好」 click, so rendering a settlement
 * or loading a page cannot spend the browser's one useful permission moment.
 *
 * It also does not decide whether the moment is worth spending at all. The
 * host answers that through `eligible`, which now requires a configured push
 * sender as well as a fresh completion — which is why this card no longer
 * carries a line apologising that nothing will arrive. When it renders,
 * something can.
 */
export function ReviewReminderPrompt({
  dueTomorrow,
  eligible,
  eventKey,
  dismissed,
  onDismiss,
  reminders,
}: {
  readonly dueTomorrow: number;
  /** Directly opening an old settlement is not a fresh value event. */
  readonly eligible: boolean;
  /** A completion key lets the local fallback reset when a new event arrives. */
  readonly eventKey?: string;
  /** The host keeps dismissal across leaving and re-entering this settlement. */
  readonly dismissed?: boolean;
  readonly onDismiss?: () => void;
  readonly reminders: ReviewReminderPort;
}) {
  const status = useSyncExternalStore(reminders.subscribe, reminders.snapshot, reminders.snapshot);
  const [dismissedEvent, setDismissedEvent] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dismissedLocally = dismissedEvent === (eventKey ?? "current");

  if (
    !eligible ||
    dueTomorrow <= 0 ||
    dismissed ||
    dismissedLocally ||
    (status.kind !== "permission-default" &&
      status.kind !== "permission-granted" &&
      status.kind !== "pending" &&
      status.kind !== "error")
  ) {
    return null;
  }

  const pending = working || status.kind === "pending";
  const statusError = status.kind === "error" ? status.message : null;

  return (
    <GamePanel className="review-reminder-prompt" tone="strong">
      <p className="review-reminder-prompt__eyebrow">明天的复习</p>
      <h2>明天有 {dueTomorrow} 张复习卡回来</h2>
      <p>要我提醒你吗？每天最多一条，有卡才提醒，随时可以在设置里关掉。</p>
      <div className="review-reminder-prompt__actions">
        <GameButton
          variant="primary"
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            setWorking(true);
            void reminders
              .enable()
              .catch((reason: unknown) => {
                setError(reason instanceof Error ? reason.message : "提醒没有开启，请稍后重试。");
              })
              .finally(() => setWorking(false));
          }}
        >
          {pending ? "正在开启…" : "好"}
        </GameButton>
        <GameButton
          variant="secondary"
          type="button"
          disabled={pending}
          onClick={() => {
            setDismissedEvent(eventKey ?? "current");
            onDismiss?.();
          }}
        >
          以后再说
        </GameButton>
      </div>
      {(error ?? statusError) ? (
        <p className="review-reminder-prompt__error" role="alert">
          {error ?? statusError}
        </p>
      ) : null}
    </GamePanel>
  );
}
