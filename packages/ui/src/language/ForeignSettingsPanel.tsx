import {
  autoUpdate,
  flip,
  FloatingFocusManager,
  FloatingPortal,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import { useState } from "react";

import {
  FOREIGN_PRESETS,
  PRESET_HINTS,
  PRESET_LABELS,
  presetOf,
  type ForeignSettings,
  type WordMarkStyle,
} from "./foreign-settings.js";

const MARK_LABELS: Readonly<Record<WordMarkStyle, string>> = {
  underline: "下划线",
  marker: "马克笔",
  plain: "不标",
};

/**
 * The gear beside the vocabulary panel, and what it opens.
 *
 * A gear rather than the word 「设置」: the panel it opens is small and the
 * icon is universally read, so spending a line of the rail's narrow width on a
 * label buys nothing.
 *
 * Presets come first and switches second, because the switches are not
 * independent — turning the Chinese back on undoes most of what the review
 * buttons are for. Leading with three named ways of reading lets someone choose
 * an intent; the switches below are for the reader who already knows which one
 * of them they disagree with.
 */
export function ForeignSettingsPanel({
  settings,
  onChange,
}: {
  readonly settings: ForeignSettings;
  readonly onChange: (next: ForeignSettings) => void;
}) {
  const [open, setOpen] = useState(false);
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement: "bottom-end",
    middleware: [offset(8), flip({ padding: 12 }), shift({ padding: 12 })],
    whileElementsMounted: autoUpdate,
  });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    useClick(context),
    useDismiss(context, { escapeKey: true, outsidePress: true }),
    useRole(context, { role: "dialog" }),
  ]);

  const active = presetOf(settings);
  const set = <K extends keyof ForeignSettings>(key: K, value: ForeignSettings[K]) =>
    onChange({ ...settings, [key]: value });

  return (
    <>
      <button
        type="button"
        className="rail-panel__gear"
        ref={refs.setReference}
        aria-label="外语模式设置"
        aria-expanded={open}
        {...getReferenceProps()}
      >
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
          <path
            fill="currentColor"
            d="M8 5.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Zm0 1.4a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8Z"
          />
          <path
            fill="currentColor"
            d="m14.2 9.1-.1-1.1.1-1.1-1.4-.5-.4-1 .6-1.3-1.1-1.1-1.3.6-1-.4L9.1 1.8 8 1.9l-1.1-.1-.5 1.4-1 .4-1.3-.6-1.1 1.1.6 1.3-.4 1-1.4.5.1 1.1-.1 1.1 1.4.5.4 1-.6 1.3 1.1 1.1 1.3-.6 1 .4.5 1.4L8 14.1l1.1.1.5-1.4 1-.4 1.3.6 1.1-1.1-.6-1.3.4-1 1.4-.5Zm-2.6 1.6-.2.5-.7.3-.5.2-.3.7-.2.5-.6-.1h-.6l-.6.1-.2-.5-.3-.7-.5-.2-.7-.3-.2-.5-.5-.2v-1.2l.1-.6-.1-.6.5-.2.2-.5.3-.7.5-.2.7-.3.2-.5.6.1h.6l.6-.1.2.5.3.7.5.2.7.3.2.5.5.2v1.2l-.1.6.1.6-.5.2Z"
            opacity="0.55"
          />
        </svg>
      </button>
      {open ? (
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={false}>
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              className="foreign-settings"
              aria-label="外语模式设置"
              {...getFloatingProps()}
            >
              <p className="foreign-settings__group-label">这一遍你想干什么</p>
              <div className="foreign-settings__presets">
                {(["read", "pronounce", "remember"] as const).map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="foreign-settings__preset"
                    aria-pressed={active === name}
                    onClick={() => onChange(FOREIGN_PRESETS[name])}
                  >
                    <strong>{PRESET_LABELS[name]}</strong>
                    <small>{PRESET_HINTS[name]}</small>
                  </button>
                ))}
              </div>

              <p className="foreign-settings__group-label">
                细调{active === "custom" ? " · 自定义" : ""}
              </p>
              <label className="foreign-settings__row">
                <span>正文里同时显示中文</span>
                <input
                  type="checkbox"
                  checked={settings.showOriginal}
                  onChange={(event) => set("showOriginal", event.target.checked)}
                />
              </label>
              {settings.showOriginal ? (
                <p className="foreign-settings__note">
                  意思就在旁边，读起来不卡；但也没什么可回想的，记不太住。
                </p>
              ) : (
                <p className="foreign-settings__note">
                  只显示英文，鼠标停一下才给意思。先想一下再看，才留得下印象。
                </p>
              )}

              <label className="foreign-settings__row">
                <span>标注样式</span>
                <select
                  value={settings.markStyle}
                  onChange={(event) => set("markStyle", event.target.value as WordMarkStyle)}
                >
                  {(Object.keys(MARK_LABELS) as WordMarkStyle[]).map((style) => (
                    <option key={style} value={style}>
                      {MARK_LABELS[style]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="foreign-settings__row">
                <span>音标</span>
                <input
                  type="checkbox"
                  checked={settings.showPhonetic}
                  onChange={(event) => set("showPhonetic", event.target.checked)}
                />
              </label>
              <label className="foreign-settings__row">
                <span>朗读按钮</span>
                <input
                  type="checkbox"
                  checked={settings.showSpeak}
                  onChange={(event) => set("showSpeak", event.target.checked)}
                />
              </label>
              <label className="foreign-settings__row">
                <span>例句</span>
                <input
                  type="checkbox"
                  checked={settings.showUsage}
                  onChange={(event) => set("showUsage", event.target.checked)}
                />
              </label>
              <label className="foreign-settings__row">
                <span>认识 / 还不熟 按钮</span>
                <input
                  type="checkbox"
                  checked={settings.showStageButtons}
                  onChange={(event) => set("showStageButtons", event.target.checked)}
                />
              </label>
              <p className="foreign-settings__note">
                关掉这排按钮，词就不会进复习队列——只是这一遍读着清静。
              </p>
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      ) : null}
    </>
  );
}
