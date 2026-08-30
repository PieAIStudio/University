import { translate } from "../../i18n/index.js";
import { useEffect, useState, useSyncExternalStore } from "react";
import { GameButton, GameCallout, GameToggle } from "@pieai/swimmer-ui-kit";
import type {
  NotificationExplanation,
  ReviewReminderPort,
  ReviewReminderStatus,
  ReviewReminderUnsupportedReason,
} from "@pieai/university-core";

import { CapabilityExplanation } from "../../capability/CapabilityExplanation.js";

export function ReviewReminderSettings({ reminders }: { readonly reminders: ReviewReminderPort }) {
  const status = useSyncExternalStore(reminders.subscribe, reminders.snapshot, reminders.snapshot);
  const [explanation, setExplanation] = useState<NotificationExplanation | null>(null);

  useEffect(() => {
    // Reading settings must never ask for permission. `refresh` only inspects
    // the existing browser permission and an already-registered subscription.
    void reminders.refresh();
  }, [reminders]);

  const checked = status.kind === "subscribed";
  const pending = status.kind === "pending";
  const canExplain =
    status.kind === "unsupported" ||
    status.kind === "ios-home-screen-required" ||
    status.kind === "permission-denied";

  async function toggle(): Promise<void> {
    if (pending) return;
    if (canExplain) {
      setExplanation(notificationExplanationOf(status));
      return;
    }
    if (checked) {
      await reminders.disable();
      return;
    }
    await reminders.enable();
  }

  return (
    <section className="settings-screen__block" aria-labelledby="settings-reminders">
      <h2 id="settings-reminders" className="settings-screen__heading">
        {translate("ui.navigation.empty.reviewReminderSettings.copy.复习提醒")}
      </h2>
      <GameToggle
        checked={checked}
        disabled={pending || canExplain}
        label={translate("ui.navigation.empty.reviewReminderSettings.copy.明天有卡时提醒我")}
        onClick={() => void toggle()}
      />
      <p className="settings-screen__hint">{statusLabel(status)}</p>
      {status.kind === "error" ? (
        <GameCallout
          heading={translate("ui.navigation.empty.reviewReminderSettings.copy.提醒没有开启")}
          tone="warning"
          role="alert"
        >
          <p>{status.message}</p>
        </GameCallout>
      ) : null}
      {status.kind === "permission-denied" ? (
        <GameCallout
          heading={translate("ui.navigation.empty.reviewReminderSettings.copy.浏览器已拒绝")}
          tone="warning"
        >
          <p>
            {translate(
              "ui.navigation.empty.reviewReminderSettings.copy.请到浏览器的网站通知设置里允许-University-这里不会反复弹窗",
            )}
          </p>
          <GameButton
            variant="secondary"
            type="button"
            onClick={() => setExplanation(notificationExplanationOf(status))}
          >
            {translate("ui.navigation.empty.reviewReminderSettings.copy.查看怎么开启")}
          </GameButton>
        </GameCallout>
      ) : null}
      {status.kind === "ios-home-screen-required" || status.kind === "unsupported" ? (
        <GameCallout
          heading={translate(
            "ui.navigation.empty.reviewReminderSettings.copy.这台设备需要先准备好",
          )}
          tone="info"
        >
          <p>{statusLabel(status)}</p>
          <GameButton
            variant="secondary"
            type="button"
            onClick={() => setExplanation(notificationExplanationOf(status))}
          >
            {translate("ui.navigation.empty.reviewReminderSettings.copy.查看说明")}
          </GameButton>
        </GameCallout>
      ) : null}
      {status.kind === "subscribed" ? (
        <p className="settings-screen__hint">
          {status.serverConnected
            ? translate(
                "ui.navigation.empty.reviewReminderSettings.copy.已订阅-每天最多一条-有卡才提醒",
              )
            : translate(
                "ui.navigation.empty.reviewReminderSettings.copy.已订阅-但服务端还没接上-暂时不会真的收到提醒-每天最多一条-有卡才提醒",
              )}
        </p>
      ) : null}
      {explanation ? (
        <CapabilityExplanation explanation={explanation} onClose={() => setExplanation(null)} />
      ) : null}
    </section>
  );
}

function statusLabel(status: ReviewReminderStatus): string {
  switch (status.kind) {
    case "permission-default":
      return translate(
        "ui.navigation.empty.reviewReminderSettings.copy.未开启-每天最多一条-有卡才提醒-随时可以在这里关掉",
      );
    case "permission-granted":
      return translate(
        "ui.navigation.empty.reviewReminderSettings.copy.浏览器已开启-但这台设备还没有订阅-打开开关后才会保存它",
      );
    case "permission-denied":
      return translate(
        "ui.navigation.empty.reviewReminderSettings.copy.浏览器已拒绝-请到浏览器设置里手动允许-University-不会再自动弹窗",
      );
    case "subscribed":
      return translate("ui.navigation.empty.reviewReminderSettings.copy.已开启-已订阅");
    case "ios-home-screen-required":
      return translate(
        "ui.navigation.empty.reviewReminderSettings.copy.在-iPhone-上需要先把它添加到主屏幕-并从主屏幕以-web-app-打开",
      );
    case "unsupported":
      return unsupportedLabel(status.reason);
    case "pending":
      return translate("ui.navigation.empty.reviewReminderSettings.copy.正在设置提醒");
    case "error":
      return status.message;
  }
}

function unsupportedLabel(reason: ReviewReminderUnsupportedReason): string {
  switch (reason) {
    case "secure-context":
      return translate(
        "ui.navigation.empty.reviewReminderSettings.copy.当前页面不是安全连接-暂时不能建立推送订阅",
      );
    case "notifications":
      return translate("ui.navigation.empty.reviewReminderSettings.copy.当前浏览器没有通知能力");
    case "service-worker":
      return translate(
        "ui.navigation.empty.reviewReminderSettings.copy.当前浏览器没有-Service-Worker-能力",
      );
    case "push":
      return translate(
        "ui.navigation.empty.reviewReminderSettings.copy.当前浏览器没有-Web-Push-能力",
      );
  }
}

function notificationExplanationOf(status: ReviewReminderStatus): NotificationExplanation {
  if (status.kind === "ios-home-screen-required") {
    return {
      kind: "explanation",
      title: translate(
        "ui.navigation.empty.reviewReminderSettings.copy.在-iPhone-上先添加到主屏幕",
      ),
      whatItDoes: translate(
        "ui.navigation.empty.reviewReminderSettings.copy.复习提醒通过主屏幕里的-University-web-app-发送-就像其他-App-的通知一样",
      ),
      whyUnavailable: translate(
        "ui.navigation.empty.reviewReminderSettings.copy.iPhone-上的-Safari-只把这项-Web-Push-能力给已经添加到主屏幕的-web-app-当前还是",
      ),
      futureSupport: translate(
        "ui.navigation.empty.reviewReminderSettings.copy.在-Safari-点分享-添加到主屏幕-若出现-以-web-app-打开-选项请保持开启-再从主屏幕打开-Uni",
      ),
    };
  }
  if (status.kind === "permission-denied") {
    return {
      kind: "explanation",
      title: translate("ui.navigation.empty.reviewReminderSettings.copy.浏览器已拒绝通知"),
      whatItDoes: translate(
        "ui.navigation.empty.reviewReminderSettings.copy.允许后-University-才能在明天有复习卡时显示一条提醒",
      ),
      whyUnavailable: translate(
        "ui.navigation.empty.reviewReminderSettings.copy.浏览器的拒绝决定只能由你在浏览器设置里改回-App-不能代替你改-也不会反复弹窗",
      ),
      futureSupport: translate(
        "ui.navigation.empty.reviewReminderSettings.copy.打开当前网站的通知权限后-回到这里再打开开关-如果浏览器没有提供入口-请按它的站点设置说明操作",
      ),
    };
  }
  const reason = status.kind === "unsupported" ? status.reason : "notifications";
  return {
    kind: "explanation",
    title: translate("ui.navigation.empty.reviewReminderSettings.copy.这台设备暂时不支持复习提醒"),
    whatItDoes: translate(
      "ui.navigation.empty.reviewReminderSettings.copy.复习提醒需要浏览器通知-推送和-Service-Worker-这几项能力",
    ),
    whyUnavailable:
      reason === "secure-context"
        ? translate(
            "ui.navigation.empty.reviewReminderSettings.copy.当前页面不是安全连接-浏览器不会在普通-HTTP-页面上建立推送订阅",
          )
        : translate(
            "ui.navigation.empty.reviewReminderSettings.copy.当前浏览器没有提供完整的通知或推送能力-所以这里不会给你一个按了没反应的开关",
          ),
    futureSupport: translate(
      "ui.navigation.empty.reviewReminderSettings.copy.换到支持-Web-Push-的安全浏览器-或在支持的设备上打开-University-你的学习进度不受影响",
    ),
  };
}
