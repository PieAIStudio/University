import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import {
  GameButton,
  GameCallout,
  GameEmptyState,
  GameField,
  GameInput,
  GameLoadingState,
  GameTabs,
} from "@pieai/swimmer-ui-kit";
import type { IdentityPort } from "@pieai/university-core";

/**
 * The account door on `/me`. It is a door, not a wall.
 *
 * Unsigned, it sits under the avatar the way the league empty sits under the
 * rail: a quiet sentence and, when a backend is actually configured, a form.
 * It never intercepts a lesson. The kit supplies the fields — `GameField` and
 * `GameInput` — so this file does not invent a password box.
 */

export const ACCOUNT_UNSIGNED_TITLE = "登录后跨设备同步";
export const ACCOUNT_UNSIGNED_DESCRIPTION =
  "登录后进度、批注、答案、复习和收藏会跟账号走；断网时本机继续，联网后同步。";
/**
 * Said from the learner's side of the screen, not ours.
 *
 * If the backend is not configured, say that plainly. The local cache still
 * works, but it is not a cross-device guarantee until an account is connected.
 */
export const ACCOUNT_UNCONFIGURED_DESCRIPTION =
  "云端账号还未配置；当前仅保留本机离线缓存，配置完成后登录即可跨设备同步。";
export const ACCOUNT_SIGNED_IN_TITLE = "已经登录";
const ACCOUNT_SIGNED_IN_DESCRIPTION =
  "进度、批注、答案、复习、收藏和设置已绑定账号。断网也能继续学，连上再同步。";
export const ACCOUNT_PENDING_LABEL = "正在登录…";
export const ACCOUNT_SIGN_IN = "登录";
const ACCOUNT_SIGN_UP = "创建账号";
export const ACCOUNT_MAGIC_LINK = "免密码登录";
export const ACCOUNT_SEND_MAGIC_LINK = "发送登录链接";
export const ACCOUNT_SIGN_OUT = "退出登录";

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
}: {
  readonly identity: IdentityPort;
  /** The current shell's allow-listed Supabase Auth redirect URL. */
  readonly authRedirectTo?: string;
}) {
  const status = useSyncExternalStore(identity.subscribe, identity.status, identity.status);

  if (status.kind === "unconfigured") {
    return (
      <GameEmptyState
        className="account-panel"
        title={ACCOUNT_UNSIGNED_TITLE}
        description={ACCOUNT_UNCONFIGURED_DESCRIPTION}
      />
    );
  }

  if (status.kind === "pending") {
    return (
      <div className="account-panel">
        <GameLoadingState label={ACCOUNT_PENDING_LABEL} />
      </div>
    );
  }

  if (status.kind === "signed_in") {
    return (
      <section className="account-panel" aria-label="账号">
        <GameEmptyState
          title={ACCOUNT_SIGNED_IN_TITLE}
          description={
            status.user.email
              ? `${ACCOUNT_SIGNED_IN_DESCRIPTION} 现在是 ${status.user.email}。`
              : ACCOUNT_SIGNED_IN_DESCRIPTION
          }
          action={
            <GameButton variant="ghost" type="button" onClick={() => void identity.signOut()}>
              {ACCOUNT_SIGN_OUT}
            </GameButton>
          }
        />
      </section>
    );
  }

  return (
    <UnsignedAccountForm
      identity={identity}
      error={status.kind === "error" ? status.message : null}
      anonymous={status.kind === "anonymous"}
      authRedirectTo={authRedirectTo ?? currentPageOrigin()}
    />
  );
}

function UnsignedAccountForm({
  identity,
  error,
  anonymous,
  authRedirectTo,
}: {
  readonly identity: IdentityPort;
  readonly error: string | null;
  readonly anonymous: boolean;
  readonly authRedirectTo: string;
}) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(error);
  const emailId = useId();
  const passwordId = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const tabs = anonymous ? PASSWORD_AUTH_TABS : AUTH_TABS;

  useEffect(() => {
    if (!anonymous || mode !== "magic") return;
    setMode("login");
    setFieldError(null);
    setNotice(null);
  }, [anonymous, mode]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !EMAIL_PATTERN.test(trimmed)) {
      setFieldError("请输入有效的邮箱地址。");
      emailRef.current?.focus();
      return;
    }
    if (mode !== "magic" && password.length < MIN_PASSWORD_LENGTH) {
      setFieldError("密码至少需要 8 个字符。");
      passwordRef.current?.focus();
      return;
    }
    setFieldError(null);
    setNotice(null);
    setIsSubmitting(true);
    try {
      if (mode === "magic") {
        if (!authRedirectTo) {
          setFieldError("当前页面还没有可用的登录回跳地址。");
          return;
        }
        await identity.requestMagicLink(trimmed, authRedirectTo);
        setNotice("登录链接已经发到邮箱，请在这个浏览器里打开邮件中的链接；链接短时间有效。");
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
        setNotice("请去邮箱点开确认信，然后再回来登录。");
      }
    } catch (reason: unknown) {
      setFieldError(reason instanceof Error ? reason.message : "这次操作没有完成，请稍后再试。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="account-panel">
      <GameEmptyState title={ACCOUNT_UNSIGNED_TITLE} description={ACCOUNT_UNSIGNED_DESCRIPTION} />
      <div className="account-panel__form">
        <GameTabs
          id="account-mode"
          activeId={mode}
          tabs={tabs}
          onSelect={(id) => {
            setMode(id as AuthMode);
            setFieldError(null);
            setNotice(null);
          }}
        />
        <div id="account-form-panel" role="tabpanel" aria-labelledby={`account-mode-${mode}`}>
          {error || fieldError ? (
            <GameCallout tone="danger" heading="没登上">
              {fieldError ?? error}
            </GameCallout>
          ) : null}
          {notice ? (
            <GameCallout tone="info" heading="还差一步">
              {notice}
            </GameCallout>
          ) : null}
          <form onSubmit={(event) => void handleSubmit(event)}>
            <GameField label="邮箱" required>
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
              <GameField label="密码" required>
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
            <GameButton variant="primary" type="submit" disabled={isSubmitting}>
              {mode === "login"
                ? ACCOUNT_SIGN_IN
                : mode === "register"
                  ? ACCOUNT_SIGN_UP
                  : ACCOUNT_SEND_MAGIC_LINK}
            </GameButton>
          </form>
        </div>
      </div>
    </div>
  );
}

function currentPageOrigin(): string {
  return typeof window === "undefined" ? "" : window.location.origin;
}
