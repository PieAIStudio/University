/** Browser acceptance only: real product component/adapter, synthetic provider.
 * This file is not imported by a delivery build or the product application. */
import { createRoot } from "react-dom/client";
import { createIdentityPort, type IdentityAuth } from "@pieai/university-core";
import type {
  AuthEvent,
  AuthPort,
  AuthResult,
  AuthSession,
  AuthUser,
} from "@pieai/university-backend/browser.js";
import { I18nProvider, setActiveLocale } from "@pieai/university-ui/i18n.js";
import {
  AccountPanel,
  AuthCallbackScreen,
  AuthResetScreen,
} from "@pieai/university-ui/navigation/empty.js";
import "@pieai/swimmer-ui-kit/styles.css";
import "@pieai/university-ui/navigation/university-shell.css";
import "./account-feedback.css";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

const query = new URLSearchParams(location.search);
const locale = query.get("lang") === "zh-CN" ? "zh-CN" : "en";
const scenario = query.get("scenario") ?? "login";
setActiveLocale(locale);
document.documentElement.lang = locale;

const guest: AuthUser = { id: "synthetic-guest", email: null, is_anonymous: true };
const member: AuthUser = {
  id: "synthetic-member",
  email: "learner@example.test",
  is_anonymous: false,
};
const login = deferred<AuthResult>();
const registration = deferred<AuthResult>();
let loginRequests = 0;
let registrationRequests = 0;
let codeRequests = 0;
let resetRequests = 0;
let passwordUpdates = 0;
let lastAction: { type: string } | null = null;
let currentUser: AuthUser | null =
  scenario === "reset-ready" || scenario === "callback"
    ? member
    : scenario === "login" || scenario === "return"
      ? guest
      : null;
let session: AuthSession = currentUser ? { user: currentUser } : null;
const listeners = new Set<(next: AuthSession, event: AuthEvent) => void>();

const emit = (next: AuthSession, event: AuthEvent) => {
  session = next;
  currentUser = next?.user ?? null;
  for (const listener of listeners) listener(next, event);
};

const auth: IdentityAuth & AuthPort = {
  getSession: async () => session,
  getCurrentUser: async () => currentUser,
  getAccessToken: async () => null,
  onAuthStateChange: (listener) => {
    listeners.add(listener);
    return {
      unsubscribe() {
        listeners.delete(listener);
      },
    };
  },
  signInAnonymously: async () => session,
  signInWithEmail: async () => session,
  signUpWithEmail: async () => session,
  requestMagicLink: async () => {},
  linkEmail: async () => session,
  signOut: async () => {
    emit(null, "SIGNED_OUT");
  },
  execute: async (action) => {
    lastAction = { type: action.type };
    if (action.type === "sign-in") {
      loginRequests += 1;
      if (loginRequests === 1) return login.promise;
      emit({ user: member }, "SIGNED_IN");
      return { status: "authenticated", user: member };
    }
    if (action.type === "sign-up" || action.type === "link-email") {
      registrationRequests += 1;
      return registration.promise;
    }
    if (action.type === "send-link" || action.type === "request-reset") {
      if (action.type === "send-link") codeRequests += 1;
      else resetRequests += 1;
      return { status: "email-requested" };
    }
    if (action.type === "verify-code") {
      if ("token" in action && action.token === "000000") {
        throw new Error("synthetic-private-provider-body");
      }
      emit({ user: member }, "SIGNED_IN");
      return { status: "authenticated", user: member };
    }
    if (action.type === "update-password") {
      if (!currentUser || currentUser.is_anonymous) {
        throw new Error("synthetic-private-provider-body");
      }
      passwordUpdates += 1;
      return { status: "updated" };
    }
    if (action.type === "sign-out") {
      emit(null, "SIGNED_OUT");
      return { status: "signed-out" };
    }
    return { status: "email-requested" };
  },
};

const identity = createIdentityPort(auth);
const continueHref = "/ai-literacy/understanding-ai/first-useful-step/ask-about-a-picture";

function markReturned(): void {
  const main = document.querySelector("main");
  if (main) main.dataset.returnedTo = continueHref;
}

declare global {
  interface Window {
    __ACCOUNT_FEEDBACK_PROOF__: {
      read: () => {
        loginRequests: number;
        registrationRequests: number;
        codeRequests: number;
        resetRequests: number;
        passwordUpdates: number;
        lastAction: { type: string } | null;
        returnedTo: string | null;
        status: ReturnType<typeof identity.status>;
      };
      rejectLogin: () => void;
      requireConfirmation: () => void;
      emitMember: () => void;
      emitSignOut: () => void;
      clearCurrentUser: () => void;
    };
  }
}

window.__ACCOUNT_FEEDBACK_PROOF__ = {
  read: () => ({
    loginRequests,
    registrationRequests,
    codeRequests,
    resetRequests,
    passwordUpdates,
    lastAction,
    returnedTo:
      document.querySelector<HTMLElement>("[data-returned-to]")?.dataset.returnedTo ?? null,
    status: identity.status(),
  }),
  rejectLogin: () => login.reject(new Error("synthetic-private-provider-body")),
  requireConfirmation: () => registration.resolve({ status: "confirmation-required" }),
  emitMember: () => emit({ user: member }, "SIGNED_IN"),
  emitSignOut: () => emit(null, "SIGNED_OUT"),
  clearCurrentUser: () => {
    currentUser = null;
    emit(null, "SIGNED_OUT");
  },
};

const screen =
  scenario === "callback" || scenario === "callback-invalid" ? (
    <AuthCallbackScreen auth={auth} locale={locale} onContinue={markReturned} />
  ) : scenario === "reset-ready" || scenario === "reset-check" ? (
    <AuthResetScreen auth={auth} locale={locale} onUpdated={markReturned} />
  ) : (
    <AccountPanel
      identity={identity}
      auth={auth}
      continueLearningHref={scenario === "return" ? continueHref : null}
      onContinueLearning={markReturned}
    />
  );

createRoot(document.getElementById("root")!).render(
  <I18nProvider>
    <main className="account-feedback-fixture" data-returned-to="">
      <p>
        {locale === "en"
          ? "Synthetic account acceptance. No real account, email or payment request."
          : "合成账号验收：没有真实账号、邮件或付款请求。"}
      </p>
      {screen}
    </main>
  </I18nProvider>,
);
