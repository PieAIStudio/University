import { readJson } from "@pieai/university-ui/api/client.js";
import type { BootstrapData } from "@pieai/university-ui/view/lesson-view.js";

/**
 * The authoring server's opening payload, fetched once per document.
 *
 * Owned independently of the content adapter because separate consumers need it — the
 * shelf, the request token every state-changing call carries, and the
 * workbench's own counters — and three fetches of one endpoint is three answers
 * that can disagree with each other by a few hundred milliseconds.
 */
let opening: Promise<BootstrapData> | null = null;

export function localBootstrap(): Promise<BootstrapData> {
  if (!opening) opening = openingRequest();
  return opening;
}

/** Re-read after an authoring action changed what is on disk. */
export function refreshLocalBootstrap(): Promise<BootstrapData> {
  opening = openingRequest();
  return opening;
}

function openingRequest(): Promise<BootstrapData> {
  const request = fetchBootstrap();
  let retryable: Promise<BootstrapData>;
  retryable = request.catch((reason: unknown) => {
    if (opening === retryable) opening = null;
    throw reason;
  });
  return retryable;
}

async function fetchBootstrap(): Promise<BootstrapData> {
  return readLocalJson<BootstrapData>("/api/bootstrap");
}

export async function readLocalJson<T>(url: string): Promise<T> {
  try {
    return await readJson<T>(await fetch(url));
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : String(reason);
    throw new Error(`${url}: ${message}`);
  }
}

/** Request tokens are read for each action; JSON is also required on bodyless writes. */
export function createLocalRequestHeaders(requestToken?: () => Promise<string>) {
  const token = requestToken ?? (async () => (await localBootstrap()).requestToken);
  return async () => ({
    "Content-Type": "application/json",
    "X-University-Local-Token": await token(),
  });
}
