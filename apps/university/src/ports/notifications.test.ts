// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMemoryPersistence, createProgressPort } from "@pieai/university-core";

import { createBrowserReviewReminderPort } from "./notifications";

type FakePushSubscription = PushSubscription & {
  readonly endpoint: string;
  readonly expirationTime: number | null;
  readonly unsubscribe: ReturnType<typeof vi.fn>;
};

type FakePushManager = Pick<PushManager, "getSubscription" | "subscribe">;

let permission: NotificationPermission;
let requestPermission: ReturnType<typeof vi.fn<() => Promise<NotificationPermission>>>;
let subscription: FakePushSubscription | null;
let serviceWorker: {
  readonly register: ReturnType<typeof vi.fn>;
  readonly getRegistration: ReturnType<typeof vi.fn>;
};
let originalServiceWorker: PropertyDescriptor | undefined;
let originalSecureContext: PropertyDescriptor | undefined;
let originalUserAgent: PropertyDescriptor | undefined;

beforeEach(() => {
  originalUserAgent = undefined;
  permission = "default";
  requestPermission = vi.fn<() => Promise<NotificationPermission>>(async () => {
    permission = "granted";
    notification.permission = permission;
    return permission;
  });
  subscription = null;
  const pushManager: FakePushManager = {
    getSubscription: vi.fn(async () => subscription),
    subscribe: vi.fn(async () => {
      subscription = fakeSubscription();
      return subscription;
    }),
  };
  const registration = { pushManager } as unknown as ServiceWorkerRegistration;
  serviceWorker = {
    register: vi.fn(async () => registration),
    getRegistration: vi.fn(async () => null),
  };
  originalServiceWorker = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: serviceWorker,
  });
  originalSecureContext = Object.getOwnPropertyDescriptor(window, "isSecureContext");
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  vi.stubGlobal("PushManager", class PushManager {});
  notification.permission = permission;
  notification.requestPermission = requestPermission;
  vi.stubGlobal("Notification", notification);
});

afterEach(() => {
  if (originalServiceWorker) {
    Object.defineProperty(navigator, "serviceWorker", originalServiceWorker);
  } else {
    Reflect.deleteProperty(navigator, "serviceWorker");
  }
  if (originalSecureContext) {
    Object.defineProperty(window, "isSecureContext", originalSecureContext);
  } else {
    Reflect.deleteProperty(window, "isSecureContext");
  }
  if (originalUserAgent) Object.defineProperty(navigator, "userAgent", originalUserAgent);
  vi.unstubAllGlobals();
});

const notification = {
  permission: "default" as NotificationPermission,
  requestPermission: (async () => "default") as () => Promise<NotificationPermission>,
};

function fakeSubscription(): FakePushSubscription {
  return {
    endpoint: "https://push.example/device",
    expirationTime: null,
    options: {} as PushSubscriptionOptions,
    toJSON: () => ({
      endpoint: "https://push.example/device",
      expirationTime: null,
      keys: { p256dh: "p256dh", auth: "auth" },
    }),
    getKey: () => null,
    unsubscribe: vi.fn(async () => true),
  } as unknown as FakePushSubscription;
}

function createPort(vapidPublicKey?: string) {
  const progress = createProgressPort({ persistence: createMemoryPersistence() });
  return { port: createBrowserReviewReminderPort({ progress, vapidPublicKey }), progress };
}

describe("browser review reminders", () => {
  it("does not ask while the app is constructed or reading existing state", async () => {
    const { port } = createPort();

    expect(requestPermission).not.toHaveBeenCalled();
    await port.refresh();
    expect(requestPermission).not.toHaveBeenCalled();
    expect(port.snapshot()).toEqual({ kind: "permission-default" });
    expect(serviceWorker.register).not.toHaveBeenCalled();
  });

  it("asks only when enable is called, then stores a subscribed endpoint honestly", async () => {
    const { port, progress } = createPort();

    await port.enable();

    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(serviceWorker.register).toHaveBeenCalledTimes(1);
    expect(port.snapshot()).toEqual({
      kind: "subscribed",
      endpoint: "https://push.example/device",
      serverConnected: false,
    });
    expect(progress.pushSubscriptions()).toHaveLength(1);
  });

  it("reports a reachable subscription once a sender is configured", async () => {
    const { port } = createPort("public-vapid-key");

    await port.enable();

    expect(port.snapshot()).toEqual({
      kind: "subscribed",
      endpoint: "https://push.example/device",
      serverConnected: true,
    });
  });

  it("never re-asks after the browser has denied permission", async () => {
    permission = "denied";
    notification.permission = permission;
    const { port } = createPort();

    expect(port.snapshot()).toEqual({ kind: "permission-denied" });
    await port.refresh();
    await port.enable();

    expect(requestPermission).not.toHaveBeenCalled();
    expect(port.snapshot()).toEqual({ kind: "permission-denied" });
  });

  it("leaves a revocation tombstone when this device is turned off", async () => {
    const { port, progress } = createPort();
    await port.enable();
    await port.disable();

    expect(progress.pushSubscriptions()[0]?.state).toBe("revoked");
    expect(port.snapshot()).toEqual({ kind: "permission-granted" });
  });

  it("explains ordinary iPhone Safari without offering a dead toggle", async () => {
    originalUserAgent = Object.getOwnPropertyDescriptor(navigator, "userAgent");
    Object.defineProperty(navigator, "userAgent", {
      configurable: true,
      value:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1",
    });
    const { port } = createPort();

    expect(port.snapshot()).toEqual({ kind: "ios-home-screen-required" });
    await port.enable();
    expect(requestPermission).not.toHaveBeenCalled();
  });
});
