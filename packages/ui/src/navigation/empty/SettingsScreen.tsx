import { useState, useSyncExternalStore } from "react";
import { GameToggle } from "@pieai/swimmer-ui-kit";
import type { PresencePort } from "@pieai/university-core";

import { ForeignSettingsPanel } from "../../language/ForeignSettingsPanel.js";
import { readForeignSettings, writeForeignSettings } from "../../language/foreign-settings.js";
import { writeSharesPresence } from "../../presence/shares-presence.js";
import { SoundToggle } from "../../sound/SoundToggle.js";

/**
 * Settings is not an empty page. Sound and the language layer already exist;
 * this is where they live as a destination, with the right-column subnav W6
 * puts beside the preference form.
 */
export function SettingsScreen({ presence }: { readonly presence?: PresencePort } = {}) {
  const [settings, setSettings] = useState(readForeignSettings);
  return (
    <div className="settings-screen">
      <h1 className="settings-screen__title">偏好设置</h1>
      <section className="settings-screen__block" aria-labelledby="settings-sound">
        <h2 id="settings-sound" className="settings-screen__heading">
          声音
        </h2>
        <SoundToggle />
      </section>
      {presence ? <PresenceSettings presence={presence} /> : null}
      <section className="settings-screen__block" aria-labelledby="settings-language">
        <h2 id="settings-language" className="settings-screen__heading">
          语言层
        </h2>
        <ForeignSettingsPanel
          embedded
          settings={settings}
          onChange={(next) => {
            setSettings(next);
            writeForeignSettings(next);
          }}
        />
      </section>
    </div>
  );
}

/**
 * V4's copy, and the reason the switch exists: being watched while you
 * learn has to be refusable even on the plan whose value is being watched.
 * Default on. Off must untrack, not restyle a chip.
 */
function PresenceSettings({ presence }: { readonly presence: PresencePort }) {
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
          writeSharesPresence(next);
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
