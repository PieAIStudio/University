import { describe, expect, it } from "vitest";
import { IdentityOperationError } from "@pieai/university-core";
import { setActiveLocale } from "../../i18n/index.js";
import { accountFailureMessage } from "./account-errors.js";

describe("bounded localized account failures", () => {
  it("uses stable codes in either language", () => {
    const error = new IdentityOperationError("sign-out-failed", "raw provider message");
    expect(accountFailureMessage(error)).toContain("退出登录没有完成");
    setActiveLocale("en");
    expect(accountFailureMessage(error)).toContain("Sign-out did not finish");
    expect(accountFailureMessage(error)).not.toContain("raw provider message");
  });
  it("does not reflect unrecognized codes, provider messages or arbitrary HTML", () => {
    setActiveLocale("en");
    for (const error of [
      new Error("secret-body"),
      { code: "<img onerror=x>" },
      "raw response",
      null,
    ]) {
      expect(accountFailureMessage(error)).toBe(
        "This account action did not finish. Check your details or connection and try again.",
      );
    }
  });
});
