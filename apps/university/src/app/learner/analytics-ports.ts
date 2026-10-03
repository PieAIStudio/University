import { useCallback, useEffect, useMemo } from "react";
import { createGuestAdoption } from "../../account/guest-adoption";

import { authPort, identityPort } from "../../account/identity";
import { paymentPort } from "../../account/payment";
import { progressPort } from "../../progress/store";
import {
  withProductAnalyticsAuth,
  withProductAnalyticsIdentity,
  withProductAnalyticsPayment,
} from "../../analytics/productAnalytics";

/** Keep analytics decoration at the app boundary and stable across renders. */
export function useAnalyticsPorts() {
  const analyticsIdentityPort = useMemo(() => withProductAnalyticsIdentity(identityPort), []);
  const analyticsAuthPort = useMemo(() => withProductAnalyticsAuth(authPort), []);
  const analyticsPaymentPort = useMemo(() => withProductAnalyticsPayment(paymentPort), []);
  const guestAdoption = useMemo(
    () => createGuestAdoption(analyticsIdentityPort, progressPort),
    [analyticsIdentityPort],
  );
  useEffect(() => guestAdoption.connect(), [guestAdoption]);
  const onWorthwhileProgress = useCallback(() => {
    void guestAdoption.create();
  }, [guestAdoption]);

  return {
    analyticsIdentityPort,
    analyticsAuthPort,
    analyticsPaymentPort,
    onWorthwhileProgress,
    guestAdoption,
  };
}
