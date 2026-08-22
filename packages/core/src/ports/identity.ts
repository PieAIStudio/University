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

export type IdentityStatus =
  | { readonly kind: "unconfigured" }
  | { readonly kind: "signed_out" }
  | { readonly kind: "pending" }
  | { readonly kind: "signed_in"; readonly user: IdentityUser }
  | { readonly kind: "error"; readonly message: string };

/**
 * The auth surface `createAuthClient` already exposes, narrowed to what this
 * product will call. Structural: a SwimmerBackend `AuthClient` assigns here
 * without a wrapper, which is the point of copying Collapse's port rather
 * than inventing a second session type.
 */
export interface IdentityAuth {
  getSession(): Promise<{ user: { id: string; email?: string | null } | null } | null>;
  getAccessToken(): Promise<string | null>;
  onAuthStateChange(
    listener: (session: { user: { id: string; email?: string | null } | null } | null) => void,
  ): { unsubscribe(): void };
  signInWithEmail(
    email: string,
    password: string,
  ): Promise<{ user: { id: string; email?: string | null } | null } | null>;
  signUpWithEmail(
    email: string,
    password: string,
  ): Promise<{ user: { id: string; email?: string | null } | null } | null>;
  signOut(): Promise<void>;
}

export interface IdentityPort {
  status(): IdentityStatus;
  subscribe(listener: () => void): () => void;
  signInWithEmail(email: string, password: string): Promise<void>;
  signUpWithEmail(email: string, password: string): Promise<{ confirmationRequired: boolean }>;
  signOut(): Promise<void>;
  readAccessToken(): Promise<string | null>;
}

function userOf(
  session: { user: { id: string; email?: string | null } | null } | null,
): IdentityUser | null {
  const id = session?.user?.id;
  if (!id) return null;
  return { id, email: session?.user?.email ?? null };
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

  const listeners = new Set<() => void>();
  let status: IdentityStatus = { kind: "signed_out" };

  const setStatus = (next: IdentityStatus) => {
    status = next;
    for (const listener of listeners) listener();
  };

  const applySession = (session: { user: { id: string; email?: string | null } | null } | null) => {
    const user = userOf(session);
    setStatus(user ? { kind: "signed_in", user } : { kind: "signed_out" });
  };

  auth.onAuthStateChange((session) => {
    applySession(session);
  });

  void auth.getSession().then(applySession, () => {
    // A stored session that cannot be read is signed-out, not a wall.
    setStatus({ kind: "signed_out" });
  });

  return {
    status: () => status,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    async signInWithEmail(email, password) {
      setStatus({ kind: "pending" });
      try {
        const session = await auth.signInWithEmail(email, password);
        applySession(session);
        if (!userOf(session)) {
          setStatus({ kind: "error", message: "登录没有成功，邮箱或密码不对。" });
        }
      } catch {
        setStatus({ kind: "error", message: "登录没有成功，邮箱或密码不对。" });
      }
    },
    async signUpWithEmail(email, password) {
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
    async signOut() {
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
}

function createUnconfiguredIdentityPort(): IdentityPort {
  const status: IdentityStatus = { kind: "unconfigured" };
  return {
    status: () => status,
    subscribe: () => () => undefined,
    signInWithEmail: async () => undefined,
    signUpWithEmail: async () => ({ confirmationRequired: false }),
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
    async signInWithEmail(email) {
      const trimmed = email.trim();
      if (!trimmed) {
        setStatus({ kind: "error", message: "请输入邮箱。" });
        return;
      }
      current = { id: `memory:${trimmed}`, email: trimmed };
      setStatus({ kind: "signed_in", user: current });
    },
    async signUpWithEmail(email) {
      const trimmed = email.trim();
      if (!trimmed) {
        setStatus({ kind: "error", message: "请输入邮箱。" });
        return { confirmationRequired: false };
      }
      current = { id: `memory:${trimmed}`, email: trimmed };
      setStatus({ kind: "signed_in", user: current });
      return { confirmationRequired: false };
    },
    async signOut() {
      current = null;
      setStatus({ kind: "signed_out" });
    },
    async readAccessToken() {
      return current ? `memory-token:${current.id}` : null;
    },
  };
}
