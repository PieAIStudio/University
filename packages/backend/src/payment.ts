import { createWalletClient } from "@pieai/swimmer-backend-client/wallet";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaymentTransport } from "@pieai/university-core";

/** The SwimmerBackend app id is stable; provider/channel names do not cross this boundary. */
export const UNIVERSITY_PAYMENT_APP_ID = "university";

/** Browser-side order ids use the platform's cryptographic UUID generator. */
export function createPaymentOrderId(): string {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID !== "function") {
    throw new Error("browser crypto.randomUUID is required to create a payment order");
  }
  return randomUUID.call(globalThis.crypto);
}

/**
 * The browser's current SwimmerBackend payment transport.
 *
 * The wallet facade is deliberately used for the read RPC only. Order
 * creation, webhook verification, and wallet mutation stay absent until the
 * backend owner publishes University's server-side payment surface.
 */
export function createSupabasePaymentRemote(client: SupabaseClient): PaymentTransport {
  const wallet = createWalletClient(client, UNIVERSITY_PAYMENT_APP_ID);
  return {
    readBalance: (userId) => wallet.getBalance(userId),
  };
}
