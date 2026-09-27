import { createElement, type ReactNode } from "react";
import { InterfaceLanguageProvider } from "../src/i18n/react.js";
/** Real catalog context for unit renderers; no translation mocks. */
export const withInterfaceLocale = (children: ReactNode) =>
  createElement(InterfaceLanguageProvider, { children });
