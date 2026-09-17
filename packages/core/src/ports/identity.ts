/**
 * Who is using this machine, if anyone.
 *
 * This file is the type and a pair of fakes. It does not create a network
 * client, read an env file, or decide whether a product should ask for a
 * password. A shell that has SwimmerBackend credentials wraps the shared
 * AuthKit client (`createSupabaseAuth`) and passes the result in; a shell
 * that does not, passes `null` and the learner never hears about it.
 *
 * Sign-in is optional. An unconfigured port is not an error, it is the
 * default: clone the repo, `pnpm dev`, learn a lesson. The first time a
 * missing backend became a toast, the app stopped being something you could
 * just open.
 */

export interface IdentityUser {
  readonly id: string;
  readonly email: string | null;
}

export interface IdentityAuthUser {
  readonly id: string;
  readonly email?: string | null;
  readonly is_anonymous?: boolean | null;
}

export interface IdentityAuthSession {
  readonly user: IdentityAuthUser | null;
}

export type IdentityStatus =
  | { readonly kind: "unconfigured" }
  | { readonly kind: "signed_out" }
  | { readonly kind: "pending" }
  | { readonly kind: "anonymous"; readonly user: IdentityUser }
  | { readonly kind: "signed_in"; readonly user: IdentityUser }
  | { readonly kind: "error"; readonly message: string; readonly code?: IdentityFailureCode };

/** Stable product-facing failures. Provider response bodies never become UI copy. */
export type IdentityFailureCode =
  | "sign-in-failed"
  | "sign-up-failed"
  | "magic-link-failed"
  | "link-email-failed"
  | "sign-out-failed"
  | "anonymous-link-required"
  | "anonymous-only";

export class IdentityOperationError extends Error {
  constructor(
    readonly code: IdentityFailureCode,
    message: string,
  ) {
    super(message);
    this.name = "IdentityOperationError";
  }
}

export type IdentityStatusKind = IdentityStatus["kind"];

/**
 * The registry is deliberately exhaustive. Adding an auth state without
 * adding its key here is a type error, so anonymous sessions cannot silently
 * fall through the same places as signed-out sessions.
 */
export const IDENTITY_STATUS_KIND_REGISTRY = {
  unconfigured: true,
  signed_out: true,
  pending: true,
  anonymous: true,
  signed_in: true,
  error: true,
} as const satisfies Record<IdentityStatusKind, true>;

/**
 * The auth surface the shared AuthKit already exposes, narrowed to what this
 * product will call. Structural: `createSupabaseAuth` assigns here without a
 * second controller, so progress, payment and analytics keep one identity.
 */
export interface IdentityAuth {
  getSession(): Promise<IdentityAuthSession | null>;
  getAccessToken(): Promise<string | null>;
  onAuthStateChange(listener: (session: IdentityAuthSession | null, event?: string) => void): {
    unsubscribe(): void;
  };
  signInAnonymously(options?: { captchaToken?: string }): Promise<IdentityAuthSession | null>;
  signInWithEmail(email: string, password: string): Promise<IdentityAuthSession | null>;
  signUpWithEmail(email: string, password: string): Promise<IdentityAuthSession | null>;
  requestMagicLink(email: string, redirectTo: string): Promise<void>;
  linkEmail(email: string, password: string): Promise<IdentityAuthSession | null>;
  signOut(): Promise<void>;
}

export interface IdentityPort {
  status(): IdentityStatus;
  subscribe(listener: () => void): () => void;
  signInAnonymously(options?: { captchaToken?: string }): Promise<void>;
  signInWithEmail(email: string, password: string): Promise<void>;
  signUpWithEmail(email: string, password: string): Promise<{ confirmationRequired: boolean }>;
  requestMagicLink(email: string, redirectTo: string): Promise<void>;
  linkEmail(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  readAccessToken(): Promise<string | null>;
}

function userOf(session: IdentityAuthSession | null): IdentityUser | null {
  const id = session?.user?.id;
  if (!id) return null;
  return { id, email: session?.user?.email ?? null };
}

function statusOf(session: IdentityAuthSession | null): IdentityStatus {
  const user = userOf(session);
  if (!user) return { kind: "signed_out" };
  return session?.user?.is_anonymous === true
    ? { kind: "anonymous", user }
    : { kind: "signed_in", user };
}

function hasAuthenticatedIdentity(status: IdentityStatus): boolean {
  return status.kind === "anonymous" || status.kind === "signed_in";
}

/**
 * Wrap an injected auth client, or the absence of one.
 *
 * `auth === null` is the unconfigured path: every method is a quiet no-op,
 * `status` stays `unconfigured`, and nothing is read from the network. Do not
 * log here. A missing env var is the normal case on a fresh clone.
 */
export function createIdentityPort(auth: IdentityAuth | null): IdentityPort {
  if (!auth) return createUnconfiguredIdentityPort();
  const configuredAuth = auth;

  const listeners = new Set<() => void>();
  let status: IdentityStatus = { kind: "signed_out" };
  let explicitOperationStarted = false;
  let anonymousSignInPromise: Promise<void> | null = null;
  let operationVersion = 0;
  let authEventVersion = 0;

  const setStatus = (next: IdentityStatus) => {
    status = next;
    for (const listener of listeners) listener();
  };

  const applySession = (session: IdentityAuthSession | null) => setStatus(statusOf(session));

  auth.onAuthStateChange((session) => {
    authEventVersion += 1;
    applySession(session);
  });

  void auth.getSession().then(
    (session) => {
      if (!explicitOperationStarted && authEventVersion === 0) applySession(session);
    },
    () => {
      // A stored session that cannot be read is signed-out, not a wall.
      if (!explicitOperationStarted && authEventVersion === 0) setStatus({ kind: "signed_out" });
    },
  );

  function beginOperation() {
    explicitOperationStarted = true;
    return { version: ++operationVersion, eventVersion: authEventVersion };
  }

  function responseIsCurrent(
    operation: ReturnType<typeof beginOperation>,
    session: IdentityAuthSession | null,
  ): boolean {
    if (operation.version !== operationVersion) return false;
    // A newer SDK event is authoritative. A delayed method response must not
    // repaint an earlier identity over a newer account or sign-out event.
    if (operation.eventVersion === authEventVersion) return true;
    const currentId = hasAuthenticatedIdentity(status) && "user" in status ? status.user.id : null;
    const responseId = userOf(session)?.id ?? null;
    // Two empty identities compare equal. A late null after SIGNED_OUT must
    // not count as the current response or revive the previous guest UUID.
    return currentId !== null && currentId === responseId;
  }

  const SIGN_IN_FAILED_MESSAGE = "登录没有完成，请核对输入或网络后重试。";

  function rejectSignInIfCurrent(
    operation: ReturnType<typeof beginOperation>,
    previous: IdentityStatus,
  ): void {
    if (operation.version !== operationVersion || operation.eventVersion !== authEventVersion) {
      return;
    }
    if (previous.kind === "anonymous") setStatus(previous);
    else
      setStatus({
        kind: "error",
        code: "sign-in-failed",
        message: SIGN_IN_FAILED_MESSAGE,
      });
    throw new IdentityOperationError("sign-in-failed", SIGN_IN_FAILED_MESSAGE);
  }

  return {
    status: () => status,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async signInAnonymously(options) {
      if (status.kind === "anonymous" || status.kind === "signed_in") return;
      if (status.kind === "pending") return;
      if (anonymousSignInPromise) return anonymousSignInPromise;
      const operation = beginOperation();
      anonymousSignInPromise = (async () => {
        try {
          const session = await auth.signInAnonymously(options);
          if (responseIsCurrent(operation, session)) applySession(session);
        } catch {
          // Anonymous auth is a persistence enhancement, not a prerequisite for
          // learning. Keep this path silent and leave the local learner usable.
          if (
            operation.version === operationVersion &&
            operation.eventVersion === authEventVersion &&
            !hasAuthenticatedIdentity(status)
          ) {
            setStatus({ kind: "signed_out" });
          }
        } finally {
          anonymousSignInPromise = null;
        }
      })();
      return anonymousSignInPromise;
    },
    async signInWithEmail(email, password) {
      const operation = beginOperation();
      const previous = status;
      setStatus({ kind: "pending" });
      let session: IdentityAuthSession | null;
      try {
        session = await auth.signInWithEmail(email, password);
      } catch {
        // Even a provider error with our class/code is untrusted input. Fence
        // it first and create safe copy, rather than rethrowing its raw body.
        rejectSignInIfCurrent(operation, previous);
        return;
      }
      if (!responseIsCurrent(operation, session)) return;
      const next = statusOf(session);
      if (next.kind === "signed_in") {
        setStatus(next);
        return;
      }
      rejectSignInIfCurrent(operation, previous);
    },
    async signUpWithEmail(email, password) {
      if (status.kind === "anonymous") {
        await linkEmail(email, password);
        return { confirmationRequired: false };
      }
      const operation = beginOperation();
      setStatus({ kind: "pending" });
      try {
        const session = await auth.signUpWithEmail(email, password);
        if (!responseIsCurrent(operation, session)) return { confirmationRequired: false };
        const user = userOf(session);
        if (user) {
          applySession(session);
          return { confirmationRequired: false };
        }
        setStatus({ kind: "signed_out" });
        return { confirmationRequired: true };
      } catch {
        if (operation.version === operationVersion && operation.eventVersion === authEventVersion) {
          setStatus({
            kind: "error",
            code: "sign-up-failed",
            message: "注册没有完成，请核对输入或网络后重试。",
          });
        }
        return { confirmationRequired: false };
      }
    },
    async requestMagicLink(email, redirectTo) {
      if (status.kind === "anonymous") {
        throw new IdentityOperationError(
          "anonymous-link-required",
          "匿名学习会话请用邮箱和密码绑定，这样当前进度不会丢失。",
        );
      }
      if (status.kind === "signed_in") return;
      const operation = beginOperation();
      // Requesting a link does not change the session. Keep the signed-out
      // form mounted so it can show the confirmation after the mail request
      // completes; the form owns its short-lived submit lock.
      try {
        await configuredAuth.requestMagicLink(email, redirectTo);
        if (operation.version === operationVersion && operation.eventVersion === authEventVersion)
          setStatus({ kind: "signed_out" });
      } catch {
        if (operation.version !== operationVersion) return;
        if (operation.eventVersion === authEventVersion)
          setStatus({
            kind: "error",
            code: "magic-link-failed",
            message: "登录链接没有发出去，请稍后再试。",
          });
        throw new IdentityOperationError("magic-link-failed", "登录链接没有发出去，请稍后再试。");
      }
    },
    linkEmail,
    async signOut() {
      const operation = beginOperation();
      try {
        await auth.signOut();
      } catch {
        if (operation.version !== operationVersion) return;
        // A rejected SDK sign-out may have left a persisted session intact.
        // Do not claim it is gone; the UI must offer a visible retry.
        throw new IdentityOperationError(
          "sign-out-failed",
          "退出登录没有完成，请重试后再交给其他人使用。",
        );
      }
      if (responseIsCurrent(operation, null)) setStatus({ kind: "signed_out" });
    },
    async readAccessToken() {
      if (!hasAuthenticatedIdentity(status) || !("user" in status)) return null;
      const id = status.user.id;
      const version = operationVersion;
      const token = await auth.getAccessToken();
      return version === operationVersion &&
        hasAuthenticatedIdentity(status) &&
        "user" in status &&
        status.user.id === id
        ? token
        : null;
    },
  };

  async function linkEmail(email: string, password: string): Promise<void> {
    if (status.kind !== "anonymous") {
      throw new IdentityOperationError("anonymous-only", "只有匿名账号可以绑定邮箱。");
    }
    const operation = beginOperation();
    const previous = status;
    try {
      const session = await configuredAuth.linkEmail(email, password);
      if (!responseIsCurrent(operation, session)) return;
      const next = statusOf(session);
      setStatus(next);
      if (next.kind !== "signed_in") {
        throw new IdentityOperationError("link-email-failed", "邮箱绑定没有完成。");
      }
    } catch (error) {
      // A taken email must not turn the anonymous document into an error
      // state. The learner must remain able to sign in to the existing user,
      // after which the progress binder merges both documents.
      if (operation.version === operationVersion && operation.eventVersion === authEventVersion)
        setStatus(previous);
      throw error;
    }
  }
}

function createUnconfiguredIdentityPort(): IdentityPort {
  const status: IdentityStatus = { kind: "unconfigured" };
  return {
    status: () => status,
    subscribe: () => () => undefined,
    signInWithEmail: async () => undefined,
    signUpWithEmail: async () => ({ confirmationRequired: false }),
    requestMagicLink: async () => undefined,
    signInAnonymously: async () => undefined,
    linkEmail: async () => undefined,
    signOut: async () => undefined,
    readAccessToken: async () => null,
  };
}

/**
 * In-memory auth for tests. Sign-in creates a user from the email; there is
 * no password store and no network. Not a stand-in for SwimmerBackend in
 * production — a production port is `createIdentityPort(createSupabaseAuth(...))`.
 */
export function createMemoryIdentityPort(initial?: IdentityUser): IdentityPort {
  let current: IdentityUser | null = initial ?? null;
  let anonymous = false;
  const listeners = new Set<() => void>();
  let status: IdentityStatus = current
    ? { kind: "signed_in", user: current }
    : { kind: "signed_out" };

  const setStatus = (next: IdentityStatus) => {
    status = next;
    for (const listener of listeners) listener();
  };

  return {
    status: () => status,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async signInAnonymously() {
      if (current) return;
      current = { id: "memory:anonymous", email: null };
      anonymous = true;
      setStatus({ kind: "anonymous", user: current });
    },
    async signInWithEmail(email) {
      const trimmed = email.trim();
      if (!trimmed) {
        setStatus({ kind: "error", message: "请输入邮箱。" });
        return;
      }
      anonymous = false;
      current = { id: `memory:${trimmed}`, email: trimmed };
      setStatus({ kind: "signed_in", user: current });
    },
    async signUpWithEmail(email) {
      const trimmed = email.trim();
      if (!trimmed) {
        setStatus({ kind: "error", message: "请输入邮箱。" });
        return { confirmationRequired: false };
      }
      anonymous = false;
      current = { id: `memory:${trimmed}`, email: trimmed };
      setStatus({ kind: "signed_in", user: current });
      return { confirmationRequired: false };
    },
    async requestMagicLink() {
      // The in-memory port has no mailbox. Callers only need a completed
      // action in tests; browser delivery is covered by the injected auth port.
    },
    async linkEmail(email, password) {
      if (!anonymous || !current) throw new Error("只有匿名账号可以绑定邮箱。");
      const trimmed = email.trim();
      if (!trimmed || password.length === 0) throw new Error("请输入邮箱和密码。");
      current = { ...current, email: trimmed };
      anonymous = false;
      setStatus({ kind: "signed_in", user: current });
    },
    async signOut() {
      current = null;
      anonymous = false;
      setStatus({ kind: "signed_out" });
    },
    async readAccessToken() {
      return current ? `memory-token:${current.id}` : null;
    },
  };
}
