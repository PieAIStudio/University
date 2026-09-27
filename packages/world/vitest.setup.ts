import { beforeEach } from "vitest";
import { setInterfaceLocale } from "@pieai/university-ui/i18n.js";

// Source-language assertions must not depend on the test host's locale.
// Language-specific tests override this deliberately inside their own case.
if (typeof navigator !== "undefined") {
  Object.defineProperty(navigator, "language", { configurable: true, value: "zh-CN" });
}
setInterfaceLocale("zh-CN");
beforeEach(() => setInterfaceLocale("zh-CN"));
