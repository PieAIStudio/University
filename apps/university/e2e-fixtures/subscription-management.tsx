/** Explicit browser fixture: actual product screens/core port, synthetic identity
 * and portal only. Never imported by the app or evidence of a real cancellation. */
import { useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { createMemoryIdentityPort, createPaymentPort } from "@pieai/university-core";
import { InterfaceLanguageProvider, setInterfaceLocale } from "@pieai/university-ui/i18n.js";
import { PlansScreen } from "@pieai/university-ui/navigation/screens.js";
import { ProfileScreen } from "@pieai/university-ui/navigation/empty.js";
import { setClayAssetMode } from "@pieai/swimmer-ui-kit";
import "@pieai/swimmer-ui-kit/styles.css";
import "@pieai/university-ui/navigation/university-shell.css";

const locale = new URLSearchParams(location.search).get("lang") === "zh-CN" ? "zh-CN" : "en";
setInterfaceLocale(locale);
setClayAssetMode("source");
document.documentElement.lang = locale;
const identity = createMemoryIdentityPort({
  id: "synthetic-learner",
  email: "learner@example.test",
});
let requests = 0;
let resolve!: (url: string) => void;
const payment = createPaymentPort({
  identity,
  transport: {
    readEntitlement: async () => ({ planId: "member" }),
    createSubscriptionPortal: () => {
      requests++;
      return new Promise<string>((done) => {
        resolve = done;
      });
    },
  },
});
Object.assign(window, {
  __subscriptionFixture: {
    requests: () => requests,
    complete: () => resolve("https://payments.example.test/synthetic-account"),
    leave: () => identity.signOut(),
  },
});
function Fixture() {
  const [page, setPage] = useState("me");
  const status = useSyncExternalStore(identity.subscribe, identity.status, identity.status);
  return (
    <main
      className="shell-screen"
      onClick={(event) => {
        const target = event.target instanceof Element ? event.target.closest("a") : null;
        if (target && new URL(target.href).pathname === "/plans") {
          event.preventDefault();
          setPage("plans");
        }
      }}
    >
      <p data-synthetic-subscription>
        Isolated acceptance: synthetic account and portal. No real purchase, cancellation or refund.
      </p>
      {page === "me" ? (
        <ProfileScreen
          passagesRead={0}
          lessonsCompleted={0}
          accountEmail={status.kind === "signed_in" ? status.user.email : null}
        />
      ) : (
        <PlansScreen paymentPort={payment} />
      )}
    </main>
  );
}
createRoot(document.getElementById("root")!).render(
  <InterfaceLanguageProvider locale={locale}>
    <Fixture />
  </InterfaceLanguageProvider>,
);
