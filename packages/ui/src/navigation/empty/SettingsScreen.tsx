import { useEffect, useState, useSyncExternalStore } from "react";
import { GameButton, GameToggle } from "@pieai/swimmer-ui-kit";
import type { PresencePort, ProgressPort, SpeechQuality } from "@pieai/university-core";

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

/**
 * Settings is not an empty page. Sound and the language layer already exist;
 * this is where they live as a destination, with the right-column subnav W6
 * puts beside the preference form.
 */
export function SettingsScreen({
  presence,
  progress,
}: {
  readonly presence?: PresencePort;
  readonly progress?: ProgressPort;
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
      <h1 className="settings-screen__title">偏好设置</h1>
      <section className="settings-screen__block" aria-labelledby="settings-sound">
        <h2 id="settings-sound" className="settings-screen__heading">
          声音
        </h2>
        <SoundToggle progress={progress} />
        <SpeechQualityControl progress={progress} />
      </section>
      {presence ? <PresenceSettings presence={presence} progress={progress} /> : null}
      <section className="settings-screen__block" aria-labelledby="settings-language">
        <h2 id="settings-language" className="settings-screen__heading">
          语言层
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
      <div className="speech-quality-control__options" role="group" aria-label="朗读语音质量">
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
              title={premium ? "高品质语音暂未开放，钱包和付费权益尚未接入。" : undefined}
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
        自动每次按高品质、在线、本机顺序选择当前能拿到的一档，不会把“自动”存成具体档位。
        高品质语音暂未开放；钱包和付费权益接入后才会启用。
      </p>
      <p className="settings-screen__hint">
        在线语音只发送产品挑选的一个英文单词；学习者自己写的字、说的话和私有仓库内容不会因为打开朗读而外发。
        学习者口述自己的理解要另行明确选择加入。
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
        一起学
      </h2>
      <GameToggle
        checked={snapshot.sharesPresence}
        label="让小组看到我在学什么"
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
        关掉以后别人看不见你停在哪一关，也不会再发出你的光标。默认开，因为这是学习小组套餐的价值；被人看着学必须能拒绝。
      </p>
    </section>
  );
}

/** Right-column subnav, matching W6's stacked groups of destinations we have. */
export function SettingsSubnav() {
  return (
    <nav className="settings-subnav" aria-label="设置">
      <section className="settings-subnav__group">
        <p className="settings-subnav__label">帐户</p>
        <a href="#/settings" aria-current="page">
          偏好设置
        </a>
        <a href="#/me">个人档案</a>
      </section>
      <section className="settings-subnav__group">
        <p className="settings-subnav__label">订阅</p>
        <a href="#/plans">会员</a>
      </section>
    </nav>
  );
}
