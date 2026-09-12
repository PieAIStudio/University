import { useCallback, useMemo } from "react";

import { identityPort } from "../account/identity";
import { paymentPort } from "../account/payment";
import { progressPort } from "../progress/store";
import {
  withProductAnalyticsIdentity,
  withProductAnalyticsPayment,
} from "../analytics/productAnalytics";

/** Keep analytics decoration at the app boundary and stable across renders. */
export function useAnalyticsPorts() {
  const analyticsIdentityPort = useMemo(() => withProductAnalyticsIdentity(identityPort), []);
  const analyticsPaymentPort = useMemo(() => withProductAnalyticsPayment(paymentPort), []);
  const onWorthwhileProgress = useCallback(() => {
    const before = analyticsIdentityPort.status();
    if (before.kind === "anonymous" || before.kind === "signed_in") return;
    void analyticsIdentityPort
      .signInAnonymously()
      .then(async () => {
        const after = analyticsIdentityPort.status();
        // Only this explicit value-event creation adopts guest progress. Restoring
        // an account or signing into another email never silently imports it.
        if (after.kind === "anonymous" && progressPort.syncState().userId === after.user.id) {
          await progressPort.importGuestProgress?.();
        }
      })
      .catch(() => undefined);
  }, [analyticsIdentityPort]);

  return { analyticsIdentityPort, analyticsPaymentPort, onWorthwhileProgress };
}
