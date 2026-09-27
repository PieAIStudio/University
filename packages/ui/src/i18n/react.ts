import { createElement, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { createI18nContext } from "@pieai/swimmer-i18n-kit/react";
import { interfaceI18n } from "./core.js";
import { interfaceTranslator, setInterfaceLocale, subscribeInterfaceLocale } from "./browser.js";
export const { Provider: InterfaceProvider, useI18n } = createI18nContext(interfaceI18n);
/** Host preference/event wiring; formatting and React context belong to the Kit. */
export function InterfaceLanguageProvider({
  locale,
  children,
}: {
  readonly locale?: string;
  readonly children: ReactNode;
}) {
  const stored = useSyncExternalStore(
    subscribeInterfaceLocale,
    () => interfaceTranslator.locale,
    () => locale ?? "zh-CN",
  );
  const selected = interfaceI18n.resolve(locale ?? stored);
  useEffect(() => {
    setInterfaceLocale(selected);
  }, [selected]);
  return createElement(InterfaceProvider, { locale: selected, children });
}
