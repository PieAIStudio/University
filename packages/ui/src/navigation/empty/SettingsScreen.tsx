import { translate } from "../../i18n/index.js";
import { useEffect, useState, useSyncExternalStore } from "react";
import { GameButton, GameToggle } from "@pieai/swimmer-ui-kit";
import type {
  PresencePort,
  ProgressPort,
  ReviewReminderPort,
  SpeechQuality,
  ThemePreference,
} from "@pieai/university-core";

import { ForeignSettingsPanel } from "../../language/ForeignSettingsPanel.js";
import { readForeignSettings, writeForeignSettings } from "../../language/foreign-settings.js";
import {
  explainSpeechResolution,
  readSpeechQualityPreference,
  resolveSpeechTier,
  speechAvailabilityOf,
  SPEECH_QUALITY_OPTIONS,
  useEnglishVoices,
  writeSpeechQualityPreference,
} from "../../language/speech.js";
import { writeSharesPresence } from "../../presence/shares-presence.js";
import { SoundToggle } from "../../sound/SoundToggle.js";
import {
  resolvedThemeOf,
  subscribeSystemTheme,
  systemPrefersDark,
  THEME_PREFERENCE_OPTIONS,
} from "../../theme.js";
import { ReviewReminderSettings } from "./ReviewReminderSettings.js";

const NO_SYSTEM_SUBSCRIPTION = () => () => undefined;

/**
 * Settings is not an empty page. Sound and the language layer already exist;
 * this is where they live as a destination, with the right-column subnav W6
 * puts beside the preference form.
 */
export function SettingsScreen({
  presence,
  progress,
  reminders,
}: {
  readonly presence?: PresencePort;
  readonly progress?: ProgressPort;
  readonly reminders?: ReviewReminderPort;
} = {}) {
  const [settings, setSettings] = useState(
    () => progress?.accountData().preferences.foreignSettings ?? readForeignSettings(),
  );
  useEffect(() => {
    if (!progress) return;
    return progress.subscribe(() =>
      setSettings(progress.accountData().preferences.foreignSettings),
    );
  }, [progress]);
  return (
    <div className="settings-screen">
      <h1 className="settings-screen__title">
        {translate("ui.navigation.empty.settingsScreen.copy.偏好设置")}
      </h1>
      <ThemePreferenceControl progress={progress} />
      <section className="settings-screen__block" aria-labelledby="settings-sound">
        <h2 id="settings-sound" className="settings-screen__heading">
          {translate("ui.navigation.empty.settingsScreen.copy.声音")}
        </h2>
        <SoundToggle progress={progress} />
        <SpeechQualityControl progress={progress} />
      </section>
      {presence ? <PresenceSettings presence={presence} progress={progress} /> : null}
      {reminders ? <ReviewReminderSettings reminders={reminders} /> : null}
      <section className="settings-screen__block" aria-labelledby="settings-language">
        <h2 id="settings-language" className="settings-screen__heading">
          {translate("ui.navigation.empty.settingsScreen.copy.语言层")}
        </h2>
        <ForeignSettingsPanel
          embedded
          settings={settings}
          onChange={(next) => {
            setSettings(next);
            if (progress) {
              progress.setAccountPreferences({
                ...progress.accountData().preferences,
                foreignSettings: next,
              });
            } else {
              writeForeignSettings(next);
            }
          }}
        />
      </section>
    </div>
  );
}

function ThemePreferenceControl({ progress }: { readonly progress?: ProgressPort }) {
  const [theme, setTheme] = useState<ThemePreference>(
    () => progress?.accountData().preferences.theme ?? "system",
  );
  useEffect(() => {
    if (!progress) return;
    return progress.subscribe(() => setTheme(progress.accountData().preferences.theme));
  }, [progress]);

  function choose(next: ThemePreference): void {
    setTheme(next);
    if (progress) {
      progress.setAccountPreferences({
        ...progress.accountData().preferences,
        theme: next,
      });
    }
  }

  const systemDark = useSyncExternalStore(
    theme === "system" ? subscribeSystemTheme : NO_SYSTEM_SUBSCRIPTION,
    systemPrefersDark,
    () => false,
  );
  const resolved = resolvedThemeOf(theme, systemDark);
  const resolvedLabel =
    resolved === "dark"
      ? translate("ui.navigation.empty.settingsScreen.copy.深色")
      : translate("ui.navigation.empty.settingsScreen.copy.浅色");

  return (
    <section className="settings-screen__block" aria-labelledby="settings-theme">
      <h2 id="settings-theme" className="settings-screen__heading">
        {translate("ui.navigation.empty.settingsScreen.copy.外观")}
      </h2>
      <div className="theme-preference-control">
        <div
          className="theme-preference-control__options"
          role="group"
          aria-label={translate("ui.navigation.empty.settingsScreen.copy.主题")}
        >
          {THEME_PREFERENCE_OPTIONS.map((option) => (
            <GameButton
              key={option.id}
              className="theme-preference-control__option"
              type="button"
              variant={theme === option.id ? "primary" : "secondary"}
              aria-pressed={theme === option.id}
              title={option.description}
              onClick={() => choose(option.id)}
            >
              {option.label}
            </GameButton>
          ))}
        </div>
        <p className="settings-screen__hint">
          {translate("ui.navigation.empty.settingsScreen.copy.当前生效")}
          {resolvedLabel}
          {translate(
            "ui.navigation.empty.settingsScreen.copy.选择-跟随系统-后-会按设备的深色模式设置自动切换",
          )}
        </p>
        <p className="settings-screen__hint">
          {translate(
            "ui.navigation.empty.settingsScreen.copy.偏好会随学习者账号保存-在其他设备继续使用",
          )}
        </p>
      </div>
    </section>
  );
}

function SpeechQualityControl({ progress }: { readonly progress?: ProgressPort }) {
  const voices = useEnglishVoices();
  const [speechQuality, setSpeechQuality] = useState<SpeechQuality>(
    () => progress?.accountData().preferences.speechQuality ?? readSpeechQualityPreference(),
  );
  useEffect(() => {
    if (!progress) return;
    return progress.subscribe(() => {
      const next = progress.accountData().preferences.speechQuality;
      setSpeechQuality(next);
      writeSpeechQualityPreference(next);
    });
  }, [progress]);

  // The wallet/entitlement path does not exist yet. The resolver still takes
  // that capability explicitly, so automatic mode will adopt it when it does.
  const availability = speechAvailabilityOf(voices);
  const resolution = resolveSpeechTier(speechQuality, availability);

  function choose(next: SpeechQuality): void {
    setSpeechQuality(next);
    writeSpeechQualityPreference(next);
    if (progress) {
      progress.setAccountPreferences({
        ...progress.accountData().preferences,
        speechQuality: next,
      });
    }
  }

  return (
    <div className="speech-quality-control">
      <div
        className="speech-quality-control__options"
        role="group"
        aria-label={translate("ui.navigation.empty.settingsScreen.copy.朗读语音质量")}
      >
        {SPEECH_QUALITY_OPTIONS.map((option) => {
          const premium = option.id === "premium";
          return (
            <GameButton
              key={option.id}
              className="speech-quality-control__option"
              type="button"
              variant={speechQuality === option.id ? "primary" : "secondary"}
              aria-pressed={speechQuality === option.id}
              disabled={premium}
              title={
                premium
                  ? translate(
                      "ui.navigation.empty.settingsScreen.copy.高品质语音暂未开放-钱包和付费权益尚未接入",
                    )
                  : undefined
              }
              onClick={() => {
                if (!premium) choose(option.id);
              }}
            >
              {option.label}
            </GameButton>
          );
        })}
      </div>
      <p className="settings-screen__hint">{explainSpeechResolution(resolution, availability)}</p>
      <p className="settings-screen__hint">
        {translate(
          "ui.navigation.empty.settingsScreen.copy.自动每次按高品质-在线-本机顺序选择当前能拿到的一档-不会把-自动-存成具体档位-高品质语音暂未开放-钱包和付费",
        )}
      </p>
      <p className="settings-screen__hint">
        {translate(
          "ui.navigation.empty.settingsScreen.copy.在线语音只发送产品挑选的一个英文单词-学习者自己写的字-说的话和私有仓库内容不会因为打开朗读而外发-学习者口述自",
        )}
      </p>
    </div>
  );
}

/**
 * V4's copy, and the reason the switch exists: being watched while you
 * learn has to be refusable even on the plan whose value is being watched.
 * Default on. Off must untrack, not restyle a chip.
 */
function PresenceSettings({
  presence,
  progress,
}: {
  readonly presence: PresencePort;
  readonly progress?: ProgressPort;
}) {
  const snapshot = useSyncExternalStore(presence.subscribe, presence.snapshot, presence.snapshot);
  return (
    <section className="settings-screen__block" aria-labelledby="settings-presence">
      <h2 id="settings-presence" className="settings-screen__heading">
        {translate("ui.navigation.empty.settingsScreen.copy.一起学")}
      </h2>
      <GameToggle
        checked={snapshot.sharesPresence}
        label={translate("ui.navigation.empty.settingsScreen.copy.让小组看到我在学什么")}
        onClick={() => {
          const next = !snapshot.sharesPresence;
          presence.setSharesPresence(next);
          if (progress) {
            progress.setAccountPreferences({
              ...progress.accountData().preferences,
              sharesPresence: next,
            });
          } else {
            writeSharesPresence(next);
          }
        }}
      />
      <p className="settings-screen__hint">
        {translate(
          "ui.navigation.empty.settingsScreen.copy.关掉以后别人看不见你停在哪一关-也不会再发出你的光标-默认开-因为这是学习小组套餐的价值-被人看着学必须能拒绝",
        )}
      </p>
    </section>
  );
}

/** Right-column subnav, matching W6's stacked groups of destinations we have. */
export function SettingsSubnav() {
  return (
    <nav
      className="settings-subnav"
      aria-label={translate("ui.navigation.empty.settingsScreen.copy.设置")}
    >
      <section className="settings-subnav__group">
        <p className="settings-subnav__label">
          {translate("ui.navigation.empty.settingsScreen.copy.帐户")}
        </p>
        <a href="/settings" aria-current="page">
          {translate("ui.navigation.empty.settingsScreen.copy.偏好设置")}
        </a>
        <a href="/me">{translate("ui.navigation.empty.settingsScreen.copy.个人档案")}</a>
      </section>
      <section className="settings-subnav__group">
        <p className="settings-subnav__label">
          {translate("ui.navigation.empty.settingsScreen.copy.订阅")}
        </p>
        <a href="/plans">{translate("ui.navigation.empty.settingsScreen.copy.会员")}</a>
      </section>
    </nav>
  );
}
