import { translate, useI18n } from "../../i18n/index.js";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  GameButton,
  GameCallout,
  GameLoadingState,
  GameModal,
  GamePanel,
} from "@pieai/swimmer-ui-kit";
import { AuthFlowError, type AuthPort, type AuthResult } from "@pieaistudio/swimmer-auth-kit";
import {
  AuthForm,
  UpdatePasswordForm,
  authErrorMessage,
  type AuthLocale,
} from "@pieaistudio/swimmer-auth-kit/react";
import type { IdentityPort } from "@pieai/university-core";
import { accountFailureMessage } from "./account-errors.js";

/**
 * The account door on `/me`. It is a door, not a wall.
 *
 * Unsigned, it sits under the avatar the way the league empty sits under the
 * rail: a quiet sentence and, when a backend is actually configured, the
 * shared AuthKit form. It never intercepts a lesson.
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
export const ACCOUNT_SIGN_OUT = translate("ui.navigation.empty.accountPanel.copy.退出登录");

export function authKitLocale(locale: string): AuthLocale {
  return locale.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function AccountPanel({
  identity,
  auth = null,
  focusRequest = 0,
  continueLearningHref = null,
  onContinueLearning,
  onResult,
}: {
  readonly identity: IdentityPort;
  readonly auth?: AuthPort | null;
  /** A rail-avatar click, including a click while `/me` is already open. */
  readonly focusRequest?: number;
  readonly continueLearningHref?: string | null;
  readonly onContinueLearning?: () => void;
  readonly onResult?: (result: AuthResult) => void | Promise<void>;
}) {
  const status = useSyncExternalStore(identity.subscribe, identity.status, identity.status);
  const i18n = useI18n();
  const locale = authKitLocale(i18n.locale);
  const [showUnavailableReason, setShowUnavailableReason] = useState(focusRequest > 0);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const operation = useHeldAuth(auth);
  const formContext = useRef({ identity, anonymous: false, key: "unsigned" });
  if (formContext.current.identity !== identity) {
    formContext.current = {
      identity,
      anonymous: status.kind === "anonymous",
      key: status.kind === "anonymous" && "user" in status ? `guest:${status.user.id}` : "unsigned",
    };
  }
  if (status.kind === "anonymous") {
    formContext.current.anonymous = true;
    formContext.current.key = `guest:${status.user.id}`;
  } else if (status.kind !== "pending" && !operation.holding && status.kind !== "signed_in") {
    formContext.current.anonymous = false;
    formContext.current.key = "unsigned";
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

  const showSignedIn = status.kind === "signed_in" && !operation.holding;
  if (showSignedIn) {
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
              const request = auth
                ? auth.execute({ type: "sign-out", scope: "local" })
                : identity.signOut();
              void request
                .catch((error: unknown) => {
                  setSignOutError(
                    error instanceof AuthFlowError
                      ? authErrorMessage(error.code, locale)
                      : accountFailureMessage(error, "sign-out-failed"),
                  );
                })
                .finally(() => setIsSigningOut(false));
            }}
          >
            {isSigningOut ? translate("account.failure.signingOut") : ACCOUNT_SIGN_OUT}
          </GameButton>
        </div>
        {continueLearningHref ? (
          <GameButton
            variant="primary"
            surface="liquid"
            liquidFinish="glossy"
            className="university-cta"
            type="button"
            onClick={() => onContinueLearning?.()}
          >
            {translate("product.account.continueLearning")}
          </GameButton>
        ) : null}
        {auth ? (
          <details className="product-details account-panel__password">
            <summary>{translate("product.account.changePassword")}</summary>
            <UpdatePasswordForm
              port={auth}
              locale={locale}
              requireCurrentPassword
              onResult={onResult}
            />
          </details>
        ) : null}
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
      auth={operation.port}
      locale={locale}
      error={status.kind === "error" ? accountFailureMessage(status) : signOutError}
      anonymous={formContext.current.anonymous}
      pending={status.kind === "pending" || operation.busy}
      focusRequest={focusRequest}
      onResult={async (result) => {
        try {
          await onResult?.(result);
        } finally {
          operation.release();
        }
      }}
    />
  );
}

function UnsignedAccountForm({
  auth,
  locale,
  error,
  anonymous,
  pending,
  focusRequest,
  onResult,
}: {
  readonly auth: AuthPort | null;
  readonly locale: AuthLocale;
  readonly error: string | null;
  readonly anonymous: boolean;
  readonly pending: boolean;
  readonly focusRequest: number;
  readonly onResult?: (result: AuthResult) => void | Promise<void>;
}) {
  const formDetails = useRef<HTMLDetailsElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusRequest <= 0) return;
    if (formDetails.current) formDetails.current.open = true;
    const email = panelRef.current?.querySelector<HTMLInputElement>('input[type="email"]');
    email?.scrollIntoView({ block: "nearest" });
    email?.focus();
  }, [focusRequest]);

  useEffect(() => {
    if (error && formDetails.current) formDetails.current.open = true;
  }, [error]);

  return (
    <div className="account-panel" aria-busy={pending} ref={panelRef}>
      <h2>{ACCOUNT_UNSIGNED_TITLE}</h2>
      <p>{translate("product.account.invitation")}</p>
      <details className="product-details account-panel__form" ref={formDetails}>
        <summary>{translate("product.account.open")}</summary>
        {anonymous ? <p>{translate("product.save.anonymousMerge")}</p> : null}
        {pending ? <GameLoadingState label={ACCOUNT_PENDING_LABEL} /> : null}
        {error ? (
          <GameCallout
            tone="danger"
            heading={translate("ui.navigation.empty.accountPanel.copy.没登上")}
          >
            {error}
          </GameCallout>
        ) : null}
        {auth ? (
          <AuthForm
            port={auth}
            locale={locale}
            allowRegistration
            allowEmailCode
            anonymous={anonymous}
            onResult={onResult}
          />
        ) : null}
        <details className="product-details">
          <summary>{translate("product.account.help")}</summary>
          <p>{ACCOUNT_UNSIGNED_DESCRIPTION}</p>
          <p>{translate("product.account.mailboxHint")}</p>
        </details>
      </details>
    </div>
  );
}

function useHeldAuth(port: AuthPort | null): {
  readonly port: AuthPort | null;
  readonly holding: boolean;
  readonly busy: boolean;
  readonly release: () => void;
} {
  const [holding, setHolding] = useState(false);
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const wrapped = useMemo(() => {
    if (!port) return null;
    return {
      getSession: () => port.getSession(),
      getCurrentUser: () => port.getCurrentUser(),
      onAuthStateChange: (listener: Parameters<AuthPort["onAuthStateChange"]>[0]) =>
        port.onAuthStateChange(listener),
      execute: async (action: Parameters<AuthPort["execute"]>[0]) => {
        const token = ++generation.current;
        setHolding(true);
        setBusy(true);
        try {
          return await port.execute(action);
        } catch (error) {
          if (token === generation.current) setHolding(false);
          throw error;
        } finally {
          if (token === generation.current) setBusy(false);
        }
      },
    } satisfies AuthPort;
  }, [port]);
  return {
    port: wrapped,
    holding,
    busy,
    release: () => {
      generation.current += 1;
      setHolding(false);
      setBusy(false);
    },
  };
}
