import { createAccountClosurePort } from "@pieai/university-backend/account-closure.js";
import { swimmerBackendClient } from "./identity.js";

export { ACCOUNT_CLOSURE_CONFIRMATION } from "@pieai/university-backend/account-closure.js";

// Product-data request over the same existing authenticated client. Shared
// AuthKit remains the only owner of login, verification and recovery flows.
export const accountClosurePort = swimmerBackendClient
  ? createAccountClosurePort(swimmerBackendClient)
  : null;
