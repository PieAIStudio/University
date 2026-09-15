import { translate } from "../../i18n/index.js";
import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import {
  GameButton,
  GameCallout,
  GameField,
  GameInput,
  GameLoadingState,
  GameModal,
  GamePanel,
  GameTabs,
} from "@pieai/swimmer-ui-kit";
import type { IdentityPort } from "@pieai/university-core";
import { accountFailureMessage } from "./account-errors.js";

/**
 * The account door on `/me`. It is a door, not a wall.
 *
 * Unsigned, it sits under the avatar the way the league empty sits under the
 * rail: a quiet sentence and, when a backend is actually configured, a form.
 * It never intercepts a lesson. The kit supplies the fields — `GameField` and
 * `GameInput` — so this file does not invent a password box.
 */

export const ACCOUNT_UNSIGNED_TITLE = translate("product.account.title");
export const ACCOUNT_UNSIGNED_DESCRIPTION = translate("product.account.description");
/**
 * Said from the learner's side of the screen, not ours.
 *
 * If the backend is not configured, say that plainly. The local cache still
 * works, but it is not a cross-device guarantee until an account is connected.
 */
export const ACCOUNT_UNCONFIGURED_DESCRIPTION = translate("product.account.unconfigured");
export const ACCOUNT_UNCONFIGURED_ACTION = translate("product.account.open");
export const ACCOUNT_UNCONFIGURED_REASON = translate("product.account.retryReason");
export const ACCOUNT_SIGNED_IN_TITLE = translate("ui.navigation.empty.accountPanel.copy.已经登录");
export const ACCOUNT_PENDING_LABEL = translate("ui.navigation.empty.accountPanel.copy.正在登录");
export const ACCOUNT_SIGN_IN = translate("ui.navigation.empty.accountPanel.copy.登录");
const ACCOUNT_SIGN_UP = translate("ui.navigation.empty.accountPanel.copy.创建账号");
export const ACCOUNT_MAGIC_LINK = translate("ui.navigation.empty.accountPanel.copy.免密码登录");
export const ACCOUNT_SEND_MAGIC_LINK = translate(
  "ui.navigation.empty.accountPanel.copy.发送登录链接",
);
export const ACCOUNT_SIGN_OUT = translate("ui.navigation.empty.accountPanel.copy.退出登录");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const MIN_PASSWORD_LENGTH = 8;

type AuthMode = "login" | "register" | "magic";

const AUTH_TABS = [
  { id: "login", label: ACCOUNT_SIGN_IN, panelId: "account-form-panel" },
  { id: "register", label: ACCOUNT_SIGN_UP, panelId: "account-form-panel" },
  { id: "magic", label: ACCOUNT_MAGIC_LINK, panelId: "account-form-panel" },
] as const;

const PASSWORD_AUTH_TABS = AUTH_TABS.slice(0, 2);

export function AccountPanel({
  identity,
  authRedirectTo,
  focusRequest = 0,
}: {
  readonly identity: IdentityPort;
  /** The current shell's allow-listed Supabase Auth redirect URL. */
  readonly authRedirectTo?: string;
  /** A rail-avatar click, including a click while `/me` is already open. */
  readonly focusRequest?: number;
}) {
  const status = useSyncExternalStore(identity.subscribe, identity.status, identity.status);
  const [showUnavailableReason, setShowUnavailableReason] = useState(focusRequest > 0);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const formContext = useRef({ identity, anonymous: false, key: "unsigned" });
  if (formContext.current.identity !== identity || status.kind !== "pending") {
    formContext.current = {
      identity,
      anonymous: status.kind === "anonymous",
      key: status.kind === "anonymous" ? `guest:${status.user.id}` : "unsigned",
    };
  }

  useEffect(() => {
    if (focusRequest > 0) setShowUnavailableReason(true);
  }, [focusRequest]);

  if (status.kind === "unconfigured") {
    return (
      <section
        className="account-panel"
        aria-label={translate("ui.navigation.empty.accountPanel.copy.账号")}
      >
        <GamePanel className="account-panel__invitation" title={ACCOUNT_UNSIGNED_TITLE}>
          <p>{translate("product.account.invitation")}</p>
          <GameButton
            variant="primary"
            static
            type="button"
            onClick={() => setShowUnavailableReason(true)}
          >
            {ACCOUNT_UNCONFIGURED_ACTION}
          </GameButton>
        </GamePanel>
        {showUnavailableReason ? (
          <GameModal
            open
            title={translate("product.account.retryTitle")}
            closeLabel={translate("ui.navigation.empty.accountPanel.copy.关闭登录说明")}
            closeOnBackdrop
            onClose={() => setShowUnavailableReason(false)}
            footer={
              <GameButton
                variant="secondary"
                type="button"
                onClick={() => setShowUnavailableReason(false)}
              >
                {translate("ui.navigation.empty.accountPanel.copy.知道了")}
              </GameButton>
            }
          >
            <p>{ACCOUNT_UNCONFIGURED_REASON}</p>
          </GameModal>
        ) : null}
      </section>
    );
  }

  if (status.kind === "signed_in") {
    return (
      <section
        className="account-panel"
        aria-label={translate("ui.navigation.empty.accountPanel.copy.账号")}
      >
        <div className="account-panel__signed-in">
          <p>{status.user.email ?? ACCOUNT_SIGNED_IN_TITLE}</p>
          <GameButton
            variant="ghost"
            type="button"
            disabled={isSigningOut}
            onClick={() => {
              setSignOutError(null);
              setIsSigningOut(true);
              void identity
                .signOut()
                .catch((error: unknown) => {
                  setSignOutError(accountFailureMessage(error, "sign-out-failed"));
                })
                .finally(() => setIsSigningOut(false));
            }}
          >
            {isSigningOut ? translate("account.failure.signingOut") : ACCOUNT_SIGN_OUT}
          </GameButton>
        </div>
        {signOutError ? (
          <GameCallout tone="danger" heading={translate("account.failure.heading")}>
            {signOutError}
          </GameCallout>
        ) : null}
      </section>
    );
  }

  return (
    <UnsignedAccountForm
      key={formContext.current.key}
      identity={identity}
      error={status.kind === "error" ? accountFailureMessage(status) : signOutError}
      anonymous={formContext.current.anonymous}
      pending={status.kind === "pending"}
      authRedirectTo={authRedirectTo ?? currentPageOrigin()}
      focusRequest={focusRequest}
    />
  );
}

function UnsignedAccountForm({
  identity,
  error,
  anonymous,
  pending,
  authRedirectTo,
  focusRequest,
}: {
  readonly identity: IdentityPort;
  readonly error: string | null;
  readonly anonymous: boolean;
  readonly pending: boolean;
  readonly authRedirectTo: string;
  readonly focusRequest: number;
}) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitting = useRef(false);
  const [fieldError, setFieldError] = useState<string | null>(error);
  const emailId = useId();
  const passwordId = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const formDetails = useRef<HTMLDetailsElement>(null);
  const tabs = anonymous ? PASSWORD_AUTH_TABS : AUTH_TABS;
  const busy = pending || isSubmitting;

  useEffect(() => {
    if (focusRequest <= 0) return;
    if (formDetails.current) formDetails.current.open = true;
    emailRef.current?.scrollIntoView({ block: "nearest" });
    emailRef.current?.focus();
  }, [focusRequest]);

  useEffect(() => {
    if (error && formDetails.current) formDetails.current.open = true;
  }, [error]);

  useEffect(() => {
    if (!anonymous || mode !== "magic") return;
    setMode("login");
    setFieldError(null);
    setNotice(null);
  }, [anonymous, mode]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current || pending) return;
    const trimmed = email.trim();
    if (!trimmed || !EMAIL_PATTERN.test(trimmed)) {
      setFieldError(translate("ui.navigation.empty.accountPanel.copy.请输入有效的邮箱地址"));
      emailRef.current?.focus();
      return;
    }
    if (mode !== "magic" && password.length < MIN_PASSWORD_LENGTH) {
      setFieldError(translate("ui.navigation.empty.accountPanel.copy.密码至少需要-8-个字符"));
      passwordRef.current?.focus();
      return;
    }
    setFieldError(null);
    setNotice(null);
    submitting.current = true;
    setIsSubmitting(true);
    try {
      if (mode === "magic") {
        if (!authRedirectTo) {
          setFieldError(
            translate("ui.navigation.empty.accountPanel.copy.当前页面还没有可用的登录回跳地址"),
          );
          return;
        }
        await identity.requestMagicLink(trimmed, authRedirectTo);
        setNotice(
          translate(
            "ui.navigation.empty.accountPanel.copy.登录链接已经发到邮箱-请在这个浏览器里打开邮件中的链接-链接短时间有效",
          ),
        );
        return;
      }
      if (mode === "login") {
        await identity.signInWithEmail(trimmed, password);
        return;
      }
      if (anonymous) {
        await identity.linkEmail(trimmed, password);
        return;
      }
      const result = await identity.signUpWithEmail(trimmed, password);
      if (result.confirmationRequired) {
        setNotice(
          translate("ui.navigation.empty.accountPanel.copy.请去邮箱点开确认信-然后再回来登录"),
        );
      }
    } catch (reason: unknown) {
      setFieldError(
        accountFailureMessage(
          reason,
          anonymous
            ? "link-email-failed"
            : mode === "magic"
              ? "magic-link-failed"
              : mode === "register"
                ? "sign-up-failed"
                : "sign-in-failed",
        ),
      );
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
      setPassword("");
    }
  };

  return (
    <div className="account-panel" aria-busy={busy}>
      <h2>{ACCOUNT_UNSIGNED_TITLE}</h2>
      <p>{translate("product.account.invitation")}</p>
      <details className="product-details account-panel__form" ref={formDetails}>
        <summary>{translate("product.account.open")}</summary>
        <p>{ACCOUNT_UNSIGNED_DESCRIPTION}</p>
        {anonymous ? <p>{translate("product.save.anonymousMerge")}</p> : null}
        {busy ? <GameLoadingState label={ACCOUNT_PENDING_LABEL} /> : null}
        <fieldset className="account-panel__fields" disabled={busy}>
          <GameTabs
            id="account-mode"
            activeId={mode}
            tabs={tabs}
            onSelect={(id) => {
              if (busy) return;
              setMode(id as AuthMode);
              setFieldError(null);
              setNotice(null);
            }}
          />
          <div id="account-form-panel" role="tabpanel" aria-labelledby={`account-mode-${mode}`}>
            {error || fieldError ? (
              <GameCallout
                tone="danger"
                heading={translate("ui.navigation.empty.accountPanel.copy.没登上")}
              >
                {fieldError ?? error}
              </GameCallout>
            ) : null}
            {notice ? (
              <GameCallout
                tone="info"
                heading={translate("ui.navigation.empty.accountPanel.copy.还差一步")}
              >
                {notice}
              </GameCallout>
            ) : null}
            <form onSubmit={(event) => void handleSubmit(event)}>
              <GameField label={translate("ui.navigation.empty.accountPanel.copy.邮箱")} required>
                <GameInput
                  ref={emailRef}
                  id={emailId}
                  type="email"
                  name="email"
                  autoComplete="email"
                  inputMode="email"
                  value={email}
                  invalid={Boolean(fieldError)}
                  onChange={(event) => setEmail(event.currentTarget.value)}
                />
              </GameField>
              {mode === "magic" ? null : (
                <GameField label={translate("ui.navigation.empty.accountPanel.copy.密码")} required>
                  <GameInput
                    ref={passwordRef}
                    id={passwordId}
                    type="password"
                    name="password"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    value={password}
                    invalid={Boolean(fieldError)}
                    onChange={(event) => setPassword(event.currentTarget.value)}
                  />
                </GameField>
              )}
              <GameButton
                variant="primary"
                surface="liquid"
                liquidFinish="glossy"
                fullWidth
                className="university-cta"
                type="submit"
                disabled={isSubmitting}
              >
                {mode === "login"
                  ? ACCOUNT_SIGN_IN
                  : mode === "register"
                    ? ACCOUNT_SIGN_UP
                    : ACCOUNT_SEND_MAGIC_LINK}
              </GameButton>
            </form>
          </div>
        </fieldset>
      </details>
    </div>
  );
}

function currentPageOrigin(): string {
  return typeof window === "undefined" ? "" : window.location.origin;
}
