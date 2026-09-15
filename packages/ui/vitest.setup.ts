import { beforeEach } from "vitest";

import { setActiveLocale } from "./src/i18n/index.js";

// Existing behavior assertions use the Chinese source catalog. A complete
// English catalog must not silently make their result depend on Node/jsdom's
// host language. Locale-specific tests select their own locale explicitly.
if (typeof navigator !== "undefined") {
  Object.defineProperty(navigator, "language", { configurable: true, value: "zh-CN" });
}
setActiveLocale("zh-CN");
beforeEach(() => {
  setActiveLocale("zh-CN");
});
