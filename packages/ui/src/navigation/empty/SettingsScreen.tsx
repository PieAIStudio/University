import { useState } from "react";

import { ForeignSettingsPanel } from "../../language/ForeignSettingsPanel.js";
import { readForeignSettings, writeForeignSettings } from "../../language/foreign-settings.js";
import { SoundToggle } from "../../sound/SoundToggle.js";

/**
 * Settings is not an empty page. Sound and the language layer already exist;
 * this is where they live as a destination, with the right-column subnav W6
 * puts beside the preference form.
 */
export function SettingsScreen() {
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
