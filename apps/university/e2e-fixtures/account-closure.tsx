/** Isolated browser fixture, never imported by product builds. */
import { createRoot } from "react-dom/client";
import { createMemoryIdentityPort } from "@pieai/university-core";
import { AccountClosurePanel } from "@pieai/university-ui/navigation/empty.js";
import { I18nProvider, setActiveLocale } from "@pieai/university-ui/i18n.js";
import type { AuthPort } from "@pieai/university-backend/browser.js";
import {
  ACCOUNT_CLOSURE_CONFIRMATION,
  createAccountClosurePort,
} from "@pieai/university-backend/account-closure.js";
import type { SupabaseClient } from "@supabase/supabase-js";
import "@pieai/swimmer-ui-kit/styles.css";
import "@pieai/university-ui/navigation/university-shell.css";
import "./account-feedback.css";

const locale = new URLSearchParams(location.search).get("lang") === "zh-CN" ? "zh-CN" : "en";
setActiveLocale(locale);
document.documentElement.lang = locale;
const user = {
  id: "764fc275-4116-4b6a-a98b-b942234f4167",
  email: "synthetic@example.test",
  is_anonymous: false,
};
const identity = createMemoryIdentityPort(user);
let authRequests = 0;
let requestCount = 0;
let lastArgs: Record<string, unknown> | null = null;
let release: (() => void) | null = null;
const auth: AuthPort = {
  getSession: async () => ({ user }),
  getCurrentUser: async () => user,
  onAuthStateChange: () => ({ unsubscribe() {} }),
  execute: async () => {
    authRequests++;
    return { status: "authenticated", user };
  },
};
const client = {
  schema(name: string) {
    if (name !== "university") throw Error("Wrong schema");
    return {
      rpc(name: string, args: Record<string, unknown>) {
        if (name !== "request_account_deletion") throw Error("Wrong RPC");
        return {
          async abortSignal(signal: AbortSignal) {
            requestCount++;
            lastArgs = args;
            await new Promise<void>((resolve, reject) => {
              release = resolve;
              signal.addEventListener("abort", () => reject(new Error("synthetic timeout")), {
                once: true,
              });
            });
            return {
              data: { status: "review-required", operationId: args.p_operation_id },
              error: null,
            };
          },
        };
      },
    };
  },
} as unknown as SupabaseClient;
const port = createAccountClosurePort(client);
Object.assign(window, {
  __CLOSURE_PROOF__: {
    snapshot: () => ({
      authRequests,
      requestCount,
      lastArgs,
      accountPresent: identity.status().kind === "signed_in",
    }),
    release: () => release?.(),
    signOut: () => identity.signOut(),
  },
});
createRoot(document.getElementById("root")!).render(
  <I18nProvider locale={locale}>
    <main className="account-preview">
      <p>Synthetic account request only. No external service, real account or deletion.</p>
      <AccountClosurePanel
        identity={identity}
        auth={auth}
        confirmationPhrase={ACCOUNT_CLOSURE_CONFIRMATION}
        requestClosure={port.request}
      />
    </main>
  </I18nProvider>,
);
