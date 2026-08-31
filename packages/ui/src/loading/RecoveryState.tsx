import { GameButton, GameCallout } from "@pieai/swimmer-ui-kit";

import { translate } from "../i18n/index.js";

export type RecoveryReason = "context-lost" | "webgl-unavailable" | "scene-timeout" | "content";

interface RecoveryCopy {
  readonly heading: string;
  readonly body: string;
  readonly retryLabel: string;
  readonly continueLabel?: string;
}

function recoveryCopy(reason: RecoveryReason): RecoveryCopy {
  switch (reason) {
    case "context-lost":
      return {
        heading: translate("ui.recovery.recoveryState.copy.地图暂时停了一下"),
        body: translate(
          "ui.recovery.recoveryState.copy.地图刚刚失去连接-再试一次可以重新打开它-课程文字和练习不受影响",
        ),
        retryLabel: translate("ui.recovery.recoveryState.copy.再试一次"),
        continueLabel: translate("ui.recovery.recoveryState.copy.直接开始今天的课"),
      };
    case "webgl-unavailable":
      return {
        heading: translate("ui.recovery.recoveryState.copy.这台设备打不开-3D-地图"),
        body: translate(
          "ui.recovery.recoveryState.copy.浏览器没有提供可用的-3D-画面-课程文字和练习仍然可以继续-不必等地图",
        ),
        retryLabel: translate("ui.recovery.recoveryState.copy.再试一次"),
        continueLabel: translate("ui.recovery.recoveryState.copy.直接开始今天的课"),
      };
    case "scene-timeout":
      return {
        heading: translate("ui.recovery.recoveryState.copy.地图加载得有点久"),
        body: translate(
          "ui.recovery.recoveryState.copy.3D-地图还没有准备好-可以再试一次-也可以先直接开始今天的课",
        ),
        retryLabel: translate("ui.recovery.recoveryState.copy.再试一次"),
        continueLabel: translate("ui.recovery.recoveryState.copy.直接开始今天的课"),
      };
    case "content":
      return {
        heading: translate("ui.recovery.recoveryState.copy.课程资料没有打开"),
        body: translate(
          "ui.recovery.recoveryState.copy.这次没有拿到课程资料-可能是网络刚刚断了一下-再试一次-或先回到课程列表",
        ),
        retryLabel: translate("ui.recovery.recoveryState.copy.重试课程资料"),
        continueLabel: translate("ui.recovery.recoveryState.copy.先看课程列表"),
      };
  }
}

export function RecoveryState({
  reason,
  onRetry,
  onContinue,
  retryLabel,
  continueLabel,
  overlay = false,
}: {
  readonly reason: RecoveryReason;
  readonly onRetry: () => void;
  readonly onContinue?: () => void;
  readonly retryLabel?: string;
  readonly continueLabel?: string;
  readonly overlay?: boolean;
}) {
  const copy = recoveryCopy(reason);
  const className = overlay ? "recovery-state recovery-state--overlay" : "recovery-state";

  return (
    <section className={className} data-recovery-state={reason}>
      <div className="recovery-state__card">
        <GameCallout heading={copy.heading} tone="warning" role="alert">
          <p className="recovery-state__body">{copy.body}</p>
          <div className="recovery-state__actions">
            <GameButton type="button" static variant="primary" onClick={onRetry}>
              {retryLabel ?? copy.retryLabel}
            </GameButton>
            {onContinue && (continueLabel ?? copy.continueLabel) ? (
              <GameButton type="button" static variant="secondary" onClick={onContinue}>
                {continueLabel ?? copy.continueLabel}
              </GameButton>
            ) : null}
          </div>
        </GameCallout>
      </div>
    </section>
  );
}
