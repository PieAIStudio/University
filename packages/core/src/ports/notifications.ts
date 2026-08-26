/**
 * The browser notification capability shared by both University shells.
 *
 * The subscription is learner data, but it is device-specific data: one
 * account may have one endpoint on a phone and another on a laptop. The
 * ProgressDocument keeps both, keyed by endpoint, so a remote save does not
 * need a second storage model.
 */

export type PushSubscriptionState = "active" | "revoked";

export interface PushSubscriptionRecord {
  readonly endpoint: string;
  readonly expirationTime: number | null;
  readonly keys: {
    readonly p256dh: string;
    readonly auth: string;
  };
  /** A revoke is a tombstone; deleting the row would let an old device revive it. */
  readonly state: PushSubscriptionState;
  readonly updatedAt: string;
  /** Public identifier only. The matching private VAPID key never enters the browser. */
  readonly vapidPublicKey: string | null;
}

export type ReviewReminderUnsupportedReason =
  | "secure-context"
  | "notifications"
  | "service-worker"
  | "push";

export type ReviewReminderStatus =
  | {
      readonly kind: "unsupported";
      readonly reason: ReviewReminderUnsupportedReason;
    }
  | { readonly kind: "ios-home-screen-required" }
  | { readonly kind: "permission-default" }
  | { readonly kind: "permission-denied" }
  | { readonly kind: "permission-granted" }
  | {
      readonly kind: "subscribed";
      readonly endpoint: string;
      /** The server-side VAPID sender is deliberately not part of this release. */
      readonly serverConnected: false;
    }
  | { readonly kind: "pending" }
  | { readonly kind: "error"; readonly message: string };

export interface ReviewReminderPort {
  snapshot(): ReviewReminderStatus;
  subscribe(listener: () => void): () => void;
  /** Called only from an explicit learner action, never from a page-load effect. */
  enable(): Promise<void>;
  disable(): Promise<void>;
  /** Reads current state without asking for permission or creating a subscription. */
  refresh(): Promise<void>;
}

/** A common explanation shape consumed by CapabilityExplanation.tsx. */
export interface NotificationExplanation {
  readonly kind: "explanation";
  readonly title: string;
  readonly whatItDoes: string;
  readonly whyUnavailable: string;
  readonly futureSupport: string;
}
