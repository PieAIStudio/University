import type { IdentityFailureCode } from "@pieai/university-core";
import { interfaceTranslator } from "../../i18n/index.js";

const codes = new Set<IdentityFailureCode>([
  "sign-in-failed",
  "sign-up-failed",
  "magic-link-failed",
  "link-email-failed",
  "sign-out-failed",
  "anonymous-link-required",
  "anonymous-only",
]);

/** Do not expose raw SDK response bodies, addresses or debug details to learners. */
export function accountFailureMessage(error: unknown, fallback?: IdentityFailureCode): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { code: unknown }).code
      : undefined;
  const selected =
    typeof code === "string" && codes.has(code as IdentityFailureCode)
      ? (code as IdentityFailureCode)
      : fallback;
  return selected
    ? interfaceTranslator.t(`account.failure.${selected}`)
    : interfaceTranslator.t("account.failure.unavailable");
}
