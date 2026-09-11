import { translate } from "../i18n/index.js";
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
  | MeteredGradingExplanation
  | NotificationExplanation;

function actionOf(explanation: CapabilityExplanationData) {
  return "action" in explanation ? explanation.action : undefined;
}

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
  const action = actionOf(explanation);

  return (
    <GameModal
      open
      className="capability-explanation"
      title={explanation.title}
      closeLabel={translate("ui.capability.capabilityExplanation.copy.关闭说明")}
      closeOnBackdrop
      onClose={onClose}
      footer={
        <GameButton variant="secondary" onClick={onClose}>
          {translate("ui.capability.capabilityExplanation.copy.知道了")}
        </GameButton>
      }
    >
      <div className="capability-explanation__body">
        <p>{explanation.whyUnavailable}</p>
        {action ? (
          <p className="capability-explanation__action">
            <a href={action.href}>{action.label}</a>
          </p>
        ) : null}
        <details className="product-details">
          <summary>{translate("product.feedback.moreDetails")}</summary>
          <p>{explanation.whatItDoes}</p>
          <p>{explanation.futureSupport}</p>
        </details>
      </div>
    </GameModal>
  );
}
