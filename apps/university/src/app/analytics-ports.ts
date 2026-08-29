import { useCallback, useMemo } from "react";

import { identityPort } from "../account/identity";
import { paymentPort } from "../account/payment";
import {
  withProductAnalyticsIdentity,
  withProductAnalyticsPayment,
} from "../analytics/productAnalytics";

/** Keep analytics decoration at the app boundary and stable across renders. */
export function useAnalyticsPorts() {
  const analyticsIdentityPort = useMemo(() => withProductAnalyticsIdentity(identityPort), []);
  const analyticsPaymentPort = useMemo(() => withProductAnalyticsPayment(paymentPort), []);
  const onWorthwhileProgress = useCallback(() => {
    void analyticsIdentityPort.signInAnonymously();
  }, [analyticsIdentityPort]);

  return { analyticsIdentityPort, analyticsPaymentPort, onWorthwhileProgress };
}
