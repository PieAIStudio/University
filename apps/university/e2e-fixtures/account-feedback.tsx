/** Browser acceptance only: real product component/adapter, synthetic provider.
 * This file is not imported by a delivery build or the product application. */
import { createRoot } from "react-dom/client";
import { createIdentityPort, type IdentityAuth } from "@pieai/university-core";
import { I18nProvider, setActiveLocale } from "@pieai/university-ui/i18n.js";
import "@pieai/swimmer-ui-kit/styles.css";
import "@pieai/university-ui/navigation/university-shell.css";
import "./account-feedback.css";

type IdentityAuthSession = Awaited<ReturnType<IdentityAuth["getSession"]>>;

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
setActiveLocale(locale);
document.documentElement.lang = locale;
const { AccountPanel } = await import("@pieai/university-ui/navigation/empty.js");
const guest = { user: { id: "synthetic-guest", email: null, is_anonymous: true } };
const login = deferred<IdentityAuthSession>();
const registration = deferred<IdentityAuthSession>();
let loginRequests = 0;
let registrationRequests = 0;
const auth: IdentityAuth = {
  getSession: async () => (query.get("scenario") === "register" ? null : guest),
  getAccessToken: async () => null,
  onAuthStateChange: () => ({ unsubscribe() {} }),
  signInAnonymously: async () => guest,
  signInWithEmail: async () => {
    loginRequests += 1;
    return loginRequests === 1
      ? login.promise
      : { user: { id: "synthetic-member", email: "learner@example.test" } };
  },
  signUpWithEmail: async () => {
    registrationRequests += 1;
    return registration.promise;
  },
  requestMagicLink: async () => {},
  linkEmail: async () => guest,
  signOut: async () => {},
};
const identity = createIdentityPort(auth);
declare global {
  interface Window {
    __ACCOUNT_FEEDBACK_PROOF__: {
      read: () => {
        loginRequests: number;
        registrationRequests: number;
        status: ReturnType<typeof identity.status>;
      };
      rejectLogin: () => void;
      requireConfirmation: () => void;
    };
  }
}
window.__ACCOUNT_FEEDBACK_PROOF__ = {
  read: () => ({ loginRequests, registrationRequests, status: identity.status() }),
  rejectLogin: () => login.reject(new Error("synthetic-private-provider-body")),
  requireConfirmation: () => registration.resolve(null),
};
createRoot(document.getElementById("root")!).render(
  <I18nProvider>
    <main className="account-feedback-fixture">
      <p>
        {locale === "en"
          ? "Synthetic account acceptance. No real account, email or payment request."
          : "合成账号验收：没有真实账号、邮件或付款请求。"}
      </p>
      <AccountPanel identity={identity} />
    </main>
  </I18nProvider>,
);
