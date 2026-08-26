import type {
  ProgressPort,
  PushSubscriptionRecord,
  ReviewReminderPort,
  ReviewReminderStatus,
} from "@pieai/university-core";

const DEFAULT_SERVICE_WORKER_URL = "/service-worker.js";
const DEFAULT_SCOPE = "/";

export interface BrowserReviewReminderOptions {
  readonly progress: ProgressPort;
  /** Public VAPID key only. The private signing key belongs to SwimmerBackend. */
  readonly vapidPublicKey?: string;
  readonly serviceWorkerUrl?: string;
  readonly scope?: string;
}

/**
 * The browser implementation of the shared review-reminder port.
 *
 * Construction and `refresh` are read-only with respect to browser permission:
 * they inspect the existing state and an already-registered worker. The only
 * call to `Notification.requestPermission` is inside `enable`, which the UI
 * invokes from a learner click after showing its own plain-language prompt.
 */
export function createBrowserReviewReminderPort(
  options: BrowserReviewReminderOptions,
): ReviewReminderPort {
  const serviceWorkerUrl = options.serviceWorkerUrl ?? DEFAULT_SERVICE_WORKER_URL;
  const scope = options.scope ?? DEFAULT_SCOPE;
  const listeners = new Set<() => void>();
  let status = initialStatus();
  let operation: Promise<void> | null = null;
  let currentEndpoint: string | null = null;
  let stateVersion = 0;

  function setStatus(next: ReviewReminderStatus): void {
    status = next;
    for (const listener of listeners) listener();
  }

  async function refresh(): Promise<void> {
    if (operation) return;
    const version = ++stateVersion;
    const capability = capabilityStatus();
    if (capability.kind === "unsupported" || capability.kind === "ios-home-screen-required") {
      currentEndpoint = null;
      setStatus(capability);
      return;
    }

    const permission = readPermission();
    if (permission === "denied") {
      currentEndpoint = null;
      setStatus({ kind: "permission-denied" });
      return;
    }
    if (permission !== "granted") {
      currentEndpoint = null;
      setStatus({ kind: "permission-default" });
      return;
    }

    try {
      const registration = await serviceWorkerRegistration();
      const subscription = registration ? await registration.pushManager.getSubscription() : null;
      if (version !== stateVersion) return;
      if (!subscription) {
        currentEndpoint = null;
        setStatus({ kind: "permission-granted" });
        return;
      }
      const record = subscriptionRecordOf(subscription, options.vapidPublicKey);
      options.progress.savePushSubscription(record);
      void options.progress.flush();
      currentEndpoint = record.endpoint;
      setStatus({
        kind: "subscribed",
        endpoint: record.endpoint,
        serverConnected: false,
      });
    } catch (error) {
      setStatus({ kind: "error", message: browserErrorMessage(error) });
    }
  }

  async function enable(): Promise<void> {
    if (operation) return operation;
    operation = enableNow().finally(() => {
      operation = null;
    });
    return operation;
  }

  async function enableNow(): Promise<void> {
    stateVersion += 1;
    const capability = capabilityStatus();
    if (capability.kind === "unsupported" || capability.kind === "ios-home-screen-required") {
      setStatus(capability);
      return;
    }

    const currentPermission = readPermission();
    if (currentPermission === "denied") {
      setStatus({ kind: "permission-denied" });
      return;
    }

    setStatus({ kind: "pending" });
    let permission: NotificationPermission = currentPermission;
    if (permission === "default") {
      try {
        // This is deliberately the first browser permission call and is only
        // reached from the explicit "好" / settings-toggle action.
        permission = await Notification.requestPermission();
      } catch (error) {
        setStatus({ kind: "error", message: browserErrorMessage(error) });
        return;
      }
    }
    if (permission !== "granted") {
      setStatus({ kind: permission === "denied" ? "permission-denied" : "permission-default" });
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register(serviceWorkerUrl, { scope });
      if (!registration.pushManager) {
        setStatus({ kind: "unsupported", reason: "push" });
        return;
      }
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        const subscribeOptions: PushSubscriptionOptionsInit = { userVisibleOnly: true };
        const publicKey = options.vapidPublicKey?.trim();
        if (publicKey) subscribeOptions.applicationServerKey = decodeBase64Url(publicKey);
        subscription = await registration.pushManager.subscribe(subscribeOptions);
      }
      const record = subscriptionRecordOf(subscription, options.vapidPublicKey);
      options.progress.savePushSubscription(record);
      // The local progress write is already safe if the network is offline.
      // A best-effort flush makes a signed-in learner's cloud row catch up now,
      // without claiming that the absent sender service can deliver anything.
      try {
        await options.progress.flush();
      } catch {
        // The progress port keeps the dirty snapshot as its offline outbox.
      }
      currentEndpoint = record.endpoint;
      setStatus({
        kind: "subscribed",
        endpoint: record.endpoint,
        serverConnected: false,
      });
    } catch (error) {
      setStatus({ kind: "error", message: browserErrorMessage(error) });
    }
  }

  async function disable(): Promise<void> {
    if (operation) return operation;
    operation = disableNow().finally(() => {
      operation = null;
    });
    return operation;
  }

  async function disableNow(): Promise<void> {
    stateVersion += 1;
    setStatus({ kind: "pending" });
    try {
      const registration = await serviceWorkerRegistration();
      const subscription = registration ? await registration.pushManager.getSubscription() : null;
      const endpoint = subscription?.endpoint ?? currentEndpoint;
      const subscriptionRecord = subscription
        ? subscriptionRecordOf(subscription, options.vapidPublicKey)
        : null;
      if (subscription) {
        const unsubscribed = await subscription.unsubscribe();
        if (!unsubscribed) throw new Error("浏览器没有确认已关闭这台设备的推送订阅。");
      }
      if (endpoint) {
        options.progress.revokePushSubscription(
          subscriptionRecord
            ? { ...subscriptionRecord, state: "revoked", updatedAt: new Date().toISOString() }
            : endpoint,
        );
        try {
          await options.progress.flush();
        } catch {
          // The revocation remains in the local outbox and will merge later.
        }
      }
      currentEndpoint = null;
      setStatus({
        kind: readPermission() === "granted" ? "permission-granted" : "permission-default",
      });
    } catch (error) {
      setStatus({ kind: "error", message: browserErrorMessage(error) });
    }
  }

  return {
    snapshot: () => status,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    enable,
    disable,
    refresh,
  };

  function initialStatus(): ReviewReminderStatus {
    const capability = capabilityStatus();
    if (capability.kind === "unsupported" || capability.kind === "ios-home-screen-required") {
      return capability;
    }
    const permission = readPermission();
    if (permission === "denied") return { kind: "permission-denied" };
    if (permission === "granted") return { kind: "permission-granted" };
    return { kind: "permission-default" };
  }

  function capabilityStatus():
    | Extract<ReviewReminderStatus, { kind: "unsupported" }>
    | Extract<ReviewReminderStatus, { kind: "ios-home-screen-required" }>
    | { readonly kind: "supported" } {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return { kind: "unsupported", reason: "notifications" };
    }
    if (window.isSecureContext === false) {
      return { kind: "unsupported", reason: "secure-context" };
    }
    if (isIosDevice() && !isStandalone()) return { kind: "ios-home-screen-required" };
    if (typeof Notification === "undefined") {
      return { kind: "unsupported", reason: "notifications" };
    }
    if (!navigator.serviceWorker || typeof navigator.serviceWorker.register !== "function") {
      return { kind: "unsupported", reason: "service-worker" };
    }
    if (typeof PushManager === "undefined") {
      return { kind: "unsupported", reason: "push" };
    }
    return { kind: "supported" };
  }

  function readPermission(): NotificationPermission {
    if (typeof Notification === "undefined") return "default";
    return Notification.permission;
  }

  async function serviceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
    if (typeof navigator === "undefined" || !navigator.serviceWorker) return null;
    if (typeof navigator.serviceWorker.getRegistration !== "function") return null;
    return (await navigator.serviceWorker.getRegistration(scope)) ?? null;
  }
}

function subscriptionRecordOf(
  subscription: PushSubscription,
  vapidPublicKey: string | undefined,
): PushSubscriptionRecord {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh ?? base64UrlOf(subscription.getKey("p256dh"));
  const auth = json.keys?.auth ?? base64UrlOf(subscription.getKey("auth"));
  if (!subscription.endpoint || !p256dh || !auth) {
    throw new Error("浏览器没有返回完整的推送订阅密钥。");
  }
  return {
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime ?? null,
    keys: { p256dh, auth },
    state: "active",
    updatedAt: new Date().toISOString(),
    vapidPublicKey: vapidPublicKey?.trim() || null,
  };
}

function base64UrlOf(value: ArrayBuffer | null): string {
  if (!value) return "";
  let binary = "";
  for (const byte of new Uint8Array(value)) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodeBase64Url(value: string): ArrayBuffer {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function isIosDevice(): boolean {
  const userAgent = navigator.userAgent;
  const platform = navigator.platform;
  return (
    /iPhone|iPad|iPod/i.test(userAgent) || (platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandalone(): boolean {
  const standaloneNavigator = navigator as Navigator & { readonly standalone?: boolean };
  return (
    standaloneNavigator.standalone === true ||
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches)
  );
}

function browserErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "浏览器没有完成提醒设置，请稍后重试。";
}
