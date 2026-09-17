import { useEffect, useState, useSyncExternalStore } from "react";
import { GameButton, GameLoadingState } from "@pieai/swimmer-ui-kit";
import {
  createAccountSession,
  type AccountState,
  type AuthPort,
} from "@pieaistudio/swimmer-auth-kit";
import { AuthForm, UpdatePasswordForm, type AuthLocale } from "@pieaistudio/swimmer-auth-kit/react";
import { translate } from "../../i18n/index.js";
import { authKitLocale } from "./AccountPanel.js";

const IDLE: AccountState = { session: null, checking: false, error: null, event: null };
const CHECKING: AccountState = { session: null, checking: true, error: null, event: null };

const AUTH_SEARCH_KEYS = new Set(["code", "error", "error_code", "error_description"]);

function isAuthOwnedHash(hash: string): boolean {
  if (!hash || hash.startsWith("#/")) return false;
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  return (
    params.has("access_token") ||
    params.has("refresh_token") ||
    params.has("error_code") ||
    params.has("error_description") ||
    (params.has("type") &&
      ["magiclink", "recovery", "signup", "email", "invite"].includes(params.get("type") ?? ""))
  );
}

/** Drop consumed SDK tokens/codes; keep language and other product query values. */
export function clearConsumedAuthParams(): void {
  if (typeof location === "undefined") return;
  const url = new URL(location.href);
  let changed = false;
  for (const key of AUTH_SEARCH_KEYS) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  const nextHash = isAuthOwnedHash(url.hash) ? "" : url.hash;
  if (nextHash !== url.hash) changed = true;
  if (!changed) return;
  const search = url.searchParams.toString();
  history.replaceState(null, "", `${url.pathname}${search ? `?${search}` : ""}${nextHash}`);
}

function useAccountSession(auth: AuthPort | null): AccountState {
  const [controller, setController] = useState<ReturnType<typeof createAccountSession> | null>(
    null,
  );
  useEffect(() => {
    if (!auth) {
      setController(null);
      return;
    }
    const next = createAccountSession(auth);
    setController(next);
    return () => next.dispose();
  }, [auth]);
  return useSyncExternalStore(
    controller ? controller.subscribe : () => () => undefined,
    controller ? controller.getSnapshot : () => (auth ? CHECKING : IDLE),
    controller ? controller.getSnapshot : () => (auth ? CHECKING : IDLE),
  );
}

function isRegistered(snapshot: AccountState): boolean {
  const user = snapshot.session?.user;
  return Boolean(user && user.is_anonymous !== true);
}

export function AuthCallbackScreen({
  auth,
  locale,
  onContinue,
}: {
  readonly auth: AuthPort | null;
  readonly locale: string;
  readonly onContinue: () => void;
}) {
  const kitLocale: AuthLocale = authKitLocale(locale);
  const snapshot = useAccountSession(auth);
  const ready = !snapshot.checking && isRegistered(snapshot);

  useEffect(() => {
    if (snapshot.checking) return;
    clearConsumedAuthParams();
  }, [snapshot.checking]);

  if (!auth) {
    return (
      <section className="account-panel">
        <h1>{translate("product.account.authCallbackTitle")}</h1>
        <p>{translate("product.account.authCallbackInvalid")}</p>
        <p>{translate("product.account.retryReason")}</p>
      </section>
    );
  }

  if (snapshot.checking && !ready) {
    return (
      <section className="account-panel" aria-busy="true">
        <h1>{translate("product.account.authCallbackTitle")}</h1>
        <GameLoadingState label={translate("product.account.authCallbackTitle")} />
      </section>
    );
  }

  if (ready) {
    return (
      <section className="account-panel">
        <h1>{translate("product.account.authCallbackTitle")}</h1>
        <GameButton
          variant="primary"
          surface="liquid"
          liquidFinish="glossy"
          className="university-cta"
          type="button"
          onClick={onContinue}
        >
          {translate("product.account.continueLearning")}
        </GameButton>
      </section>
    );
  }

  return (
    <section className="account-panel">
      <h1>{translate("product.account.authCallbackTitle")}</h1>
      <p>{translate("product.account.authCallbackInvalid")}</p>
      {auth ? (
        <AuthForm port={auth} locale={kitLocale} allowEmailCode allowRegistration />
      ) : (
        <p>{translate("product.account.retryReason")}</p>
      )}
    </section>
  );
}

export function AuthResetScreen({
  auth,
  locale,
  onUpdated,
}: {
  readonly auth: AuthPort | null;
  readonly locale: string;
  readonly onUpdated: () => void;
}) {
  const kitLocale: AuthLocale = authKitLocale(locale);
  const snapshot = useAccountSession(auth);
  const ready = !snapshot.checking && isRegistered(snapshot);

  useEffect(() => {
    if (snapshot.checking) return;
    clearConsumedAuthParams();
  }, [snapshot.checking]);

  if (!auth) {
    return (
      <section className="account-panel">
        <h1>{translate("product.account.authResetTitle")}</h1>
        <p>{translate("product.account.authResetInvalid")}</p>
        <p>{translate("product.account.retryReason")}</p>
      </section>
    );
  }

  if (snapshot.checking && !ready) {
    return (
      <section className="account-panel" aria-busy="true">
        <h1>{translate("product.account.authResetTitle")}</h1>
        <GameLoadingState label={translate("product.account.authResetTitle")} />
      </section>
    );
  }

  if (ready) {
    return (
      <section className="account-panel">
        <h1>{translate("product.account.authResetTitle")}</h1>
        <UpdatePasswordForm
          port={auth}
          locale={kitLocale}
          requireCurrentPassword={false}
          onResult={(result) => {
            if (result.status === "updated") onUpdated();
          }}
        />
      </section>
    );
  }

  return (
    <section className="account-panel">
      <h1>{translate("product.account.authResetTitle")}</h1>
      <p>{translate("product.account.authResetInvalid")}</p>
      <AuthForm
        port={auth}
        locale={kitLocale}
        initialMode="request-reset"
        allowEmailCode
        allowRegistration={false}
      />
    </section>
  );
}
