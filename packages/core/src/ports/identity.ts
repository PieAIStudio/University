/**
 * Who is using this machine, if anyone.
 *
 * This file is the type and a pair of fakes. It does not create a network
 * client, read an env file, or decide whether a product should ask for a
 * password. A shell that has SwimmerBackend credentials wraps
 * `createAuthClient` and passes the result in; a shell that does not, passes
 * `null` and the learner never hears about it.
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
  | { readonly kind: "error"; readonly message: string };

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
 * The auth surface `createAuthClient` already exposes, narrowed to what this
 * product will call. Structural: a SwimmerBackend `AuthClient` assigns here
 * without a wrapper, which is the point of copying Collapse's port rather
 * than inventing a second session type.
 */
export interface IdentityAuth {
  getSession(): Promise<IdentityAuthSession | null>;
  getAccessToken(): Promise<string | null>;
  onAuthStateChange(listener: (session: IdentityAuthSession | null) => void): {
    unsubscribe(): void;
  };
  signInAnonymously(options?: { captchaToken?: string }): Promise<IdentityAuthSession | null>;
  signInWithEmail(email: string, password: string): Promise<IdentityAuthSession | null>;
  signUpWithEmail(email: string, password: string): Promise<IdentityAuthSession | null>;
  linkEmail(email: string, password: string): Promise<IdentityAuthSession | null>;
  signOut(): Promise<void>;
}

export interface IdentityPort {
  status(): IdentityStatus;
  subscribe(listener: () => void): () => void;
  signInAnonymously(options?: { captchaToken?: string }): Promise<void>;
  signInWithEmail(email: string, password: string): Promise<void>;
  signUpWithEmail(email: string, password: string): Promise<{ confirmationRequired: boolean }>;
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

  const setStatus = (next: IdentityStatus) => {
    status = next;
    for (const listener of listeners) listener();
  };

  const applySession = (session: IdentityAuthSession | null) => setStatus(statusOf(session));

  auth.onAuthStateChange((session) => {
    applySession(session);
  });

  void auth.getSession().then(applySession, () => {
    // A stored session that cannot be read is signed-out, not a wall.
    if (!explicitOperationStarted) setStatus({ kind: "signed_out" });
  });

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
      if (anonymousSignInPromise) return anonymousSignInPromise;
      explicitOperationStarted = true;
      anonymousSignInPromise = (async () => {
        try {
          const session = await auth.signInAnonymously(options);
          applySession(session);
        } catch {
          // Anonymous auth is a persistence enhancement, not a prerequisite for
          // learning. Keep this path silent and leave the local learner usable.
          if (!hasAuthenticatedIdentity(status)) setStatus({ kind: "signed_out" });
        } finally {
          anonymousSignInPromise = null;
        }
      })();
      return anonymousSignInPromise;
    },
    async signInWithEmail(email, password) {
      explicitOperationStarted = true;
      const previous = status;
      setStatus({ kind: "pending" });
      try {
        const session = await auth.signInWithEmail(email, password);
        const next = statusOf(session);
        setStatus(next);
        if (next.kind !== "signed_in") {
          if (previous.kind === "anonymous") setStatus(previous);
          else setStatus({ kind: "error", message: "登录没有成功，邮箱或密码不对。" });
        }
      } catch {
        if (previous.kind === "anonymous") setStatus(previous);
        else setStatus({ kind: "error", message: "登录没有成功，邮箱或密码不对。" });
      }
    },
    async signUpWithEmail(email, password) {
      if (status.kind === "anonymous") {
        await linkEmail(email, password);
        return { confirmationRequired: false };
      }
      explicitOperationStarted = true;
      setStatus({ kind: "pending" });
      try {
        const session = await auth.signUpWithEmail(email, password);
        const user = userOf(session);
        if (user) {
          applySession(session);
          return { confirmationRequired: false };
        }
        setStatus({ kind: "signed_out" });
        return { confirmationRequired: true };
      } catch {
        setStatus({ kind: "error", message: "注册没有成功，换一个邮箱试试。" });
        return { confirmationRequired: false };
      }
    },
    linkEmail,
    async signOut() {
      explicitOperationStarted = true;
      try {
        await auth.signOut();
      } catch {
        // Local sign-out still has to happen: the next person at this
        // keyboard is not this session, even if the server did not hear us.
      }
      setStatus({ kind: "signed_out" });
    },
    readAccessToken: () => auth.getAccessToken(),
  };

  async function linkEmail(email: string, password: string): Promise<void> {
    if (status.kind !== "anonymous") {
      throw new Error("只有匿名账号可以绑定邮箱。");
    }
    explicitOperationStarted = true;
    const previous = status;
    try {
      const session = await configuredAuth.linkEmail(email, password);
      const next = statusOf(session);
      setStatus(next);
      if (next.kind !== "signed_in") {
        throw new Error("邮箱绑定没有完成。");
      }
    } catch (error) {
      // A taken email must not turn the anonymous document into an error
      // state. The learner must remain able to sign in to the existing user,
      // after which the progress binder merges both documents.
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
    signInAnonymously: async () => undefined,
    linkEmail: async () => undefined,
    signOut: async () => undefined,
    readAccessToken: async () => null,
  };
}

/**
 * In-memory auth for tests. Sign-in creates a user from the email; there is
 * no password store and no network. Not a stand-in for SwimmerBackend in
 * production — a production port is `createIdentityPort(createAuthClient(...))`.
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
