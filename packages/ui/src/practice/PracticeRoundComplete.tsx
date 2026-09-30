import type { Ref } from "react";
import { GameAssetIcon, GameButton, GamePanel } from "@pieai/swimmer-ui-kit";
import { useI18n } from "../i18n/index.js";

/** The existing, finite practice ending shared by native lesson rehearsal and
 * the reference quiz surface. Counts are supplied by their respective records;
 * the decoration never awards progress or invents a grade. */
export function PracticeRoundComplete({
  count,
  receipt,
  focusRef,
  onFinish,
  onFree,
  onRound,
}: {
  readonly count: number;
  readonly receipt?: string;
  readonly focusRef: Ref<HTMLHeadingElement>;
  readonly onFinish: () => void;
  readonly onFree: () => void;
  readonly onRound: () => void;
}) {
  const t = useI18n();
  return (
    <section
      className="practice-stream"
      data-practice-phase="complete"
      data-practice-round-complete
    >
      <GamePanel>
        <h1 ref={focusRef} tabIndex={-1} data-practice-focus className="practice-stream__heading">
          {t.t("product.practice.roundDone")}
        </h1>
        <div className="practice-stream__celebrate" aria-hidden="true">
          <GameAssetIcon icon="trophy" size="xl" />
        </div>
        <p>{receipt ?? t.t("product.practice.roundReceipt", { count })}</p>
        <div className="practice-stream__actions">
          <GameButton variant="primary" static data-practice-finish onClick={onFinish}>
            {t.t("product.practice.stop")}
          </GameButton>
          <GameButton variant="secondary" static onClick={onFree}>
            {t.t("product.practice.free")}
          </GameButton>
          <GameButton variant="ghost" static onClick={onRound}>
            {t.t("product.practice.another")}
          </GameButton>
        </div>
      </GamePanel>
    </section>
  );
}
