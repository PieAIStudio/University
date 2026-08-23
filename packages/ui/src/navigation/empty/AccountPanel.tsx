import { useId, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
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
 * The account door on `#/me`. It is a door, not a wall.
 *
 * Unsigned, it sits under the avatar the way the league empty sits under the
 * rail: a quiet sentence and, when a backend is actually configured, a form.
 * It never intercepts a lesson. The kit supplies the fields — `GameField` and
 * `GameInput` — so this file does not invent a password box.
 */

export const ACCOUNT_UNSIGNED_TITLE = "进度记在这台设备上";
export const ACCOUNT_UNSIGNED_DESCRIPTION =
  "登录之后换一台也能接着学。不登录也完全没问题，今天的课一样能上完。";
/**
 * Said from the learner's side of the screen, not ours.
 *
 * It used to read 「账号还没接到这台构建上」. 「构建」 is what we call the
 * compiled copy of the app; to the person reading it that sentence names
 * nothing they can see. What they actually need to know is two facts and no
 * vocabulary: there is nowhere to sign in yet, and their progress is safe on
 * this machine meanwhile.
 */
export const ACCOUNT_UNCONFIGURED_DESCRIPTION =
  "现在还没有可以登录的地方。你的进度就存在这台设备里，照常学就行。";
export const ACCOUNT_SIGNED_IN_TITLE = "已经登录";
export const ACCOUNT_SIGNED_IN_DESCRIPTION =
  "这一台和账号上的进度会并在一起。断网也能继续学，连上再同步。";
export const ACCOUNT_PENDING_LABEL = "正在登录…";
export const ACCOUNT_SIGN_IN = "登录";
export const ACCOUNT_SIGN_UP = "创建账号";
export const ACCOUNT_SIGN_OUT = "退出登录";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const MIN_PASSWORD_LENGTH = 8;

type AuthMode = "login" | "register";

const AUTH_TABS = [
  { id: "login", label: ACCOUNT_SIGN_IN, panelId: "account-form-panel" },
  { id: "register", label: ACCOUNT_SIGN_UP, panelId: "account-form-panel" },
] as const;

export function AccountPanel({ identity }: { readonly identity: IdentityPort }) {
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
    />
  );
}

function UnsignedAccountForm({
  identity,
  error,
}: {
  readonly identity: IdentityPort;
  readonly error: string | null;
}) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(error);
  const emailId = useId();
  const passwordId = useId();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !EMAIL_PATTERN.test(trimmed)) {
      setFieldError("请输入有效的邮箱地址。");
      emailRef.current?.focus();
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setFieldError("密码至少需要 8 个字符。");
      passwordRef.current?.focus();
      return;
    }
    setFieldError(null);
    setNotice(null);
    if (mode === "login") {
      await identity.signInWithEmail(trimmed, password);
      return;
    }
    const result = await identity.signUpWithEmail(trimmed, password);
    if (result.confirmationRequired) {
      setNotice("请去邮箱点开确认信，然后再回来登录。");
    }
  };

  return (
    <div className="account-panel">
      <GameEmptyState title={ACCOUNT_UNSIGNED_TITLE} description={ACCOUNT_UNSIGNED_DESCRIPTION} />
      <div className="account-panel__form">
        <GameTabs
          id="account-mode"
          activeId={mode}
          tabs={AUTH_TABS}
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
            <GameButton variant="primary" type="submit">
              {mode === "login" ? ACCOUNT_SIGN_IN : ACCOUNT_SIGN_UP}
            </GameButton>
          </form>
        </div>
      </div>
    </div>
  );
}
