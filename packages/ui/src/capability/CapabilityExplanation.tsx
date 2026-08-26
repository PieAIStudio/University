import { GameButton, GameModal } from "@pieai/swimmer-ui-kit";
import type {
  MeteredGradingExplanation,
  NotificationExplanation,
  PaymentExplanation,
  SourceAccessExplanation,
} from "@pieai/university-core";

export type CapabilityExplanationData =
  | SourceAccessExplanation
  | PaymentExplanation
  | MeteredGradingExplanation;
  | NotificationExplanation;

/**
 * The common answer when a learner-facing capability is not available in one
 * shell. The entry remains in the same place; only its port result changes.
 */
export function CapabilityExplanation({
  explanation,
  onClose,
}: {
  readonly explanation: CapabilityExplanationData;
  readonly onClose: () => void;
}) {
  return (
    <GameModal
      open
      className="capability-explanation"
      title={explanation.title}
      closeLabel="关闭说明"
      closeOnBackdrop
      onClose={onClose}
      footer={
        <GameButton variant="secondary" onClick={onClose}>
          知道了
        </GameButton>
      }
    >
      <div className="capability-explanation__body">
        <section>
          <h3>它是什么</h3>
          <p>{explanation.whatItDoes}</p>
        </section>
        <section>
          <h3>为什么这一端现在做不到</h3>
          <p>{explanation.whyUnavailable}</p>
        </section>
        <section>
          <h3>以后怎么支持</h3>
          <p>{explanation.futureSupport}</p>
        </section>
      </div>
    </GameModal>
  );
}
