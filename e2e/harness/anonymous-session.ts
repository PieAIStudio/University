import type { Page } from "@playwright/test";

/** Real AuthKit/SDK with an isolated provider. No account, email, analytics or
 * remote progress write leaves this browser. The optional hold exercises the
 * SDK event arriving during an already-started chest animation. */
export async function isolatedAnonymousSession(page: Page, hold = false) {
  const id = "bb4616b3-3370-42e4-9d0c-77051e606b13";
  const user = {
    id,
    email: "",
    aud: "authenticated",
    role: "authenticated",
    is_anonymous: true,
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  };
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: id, aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.c3ludGhldGlj`;
  let release = () => {};
  const gate = hold
    ? new Promise<void>((resolve) => {
        release = resolve;
      })
    : Promise.resolve();
  let creations = 0;
  await page.route(/https:\/\/[^/]+\.supabase\.co\//, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/auth/v1/signup")) {
      creations++;
      await gate;
      return route.fulfill({
        json: {
          access_token: token,
          refresh_token: "synthetic-refresh",
          token_type: "bearer",
          expires_in: 3600,
          user,
        },
      });
    }
    if (path.endsWith("/auth/v1/user")) return route.fulfill({ json: user });
    if (path.includes("/rest/v1/rpc/")) return route.fulfill({ json: null });
    if (path.includes("/rest/v1/")) return route.fulfill({ json: [] });
    return route.fulfill({
      status: 503,
      json: { message: "Isolated provider: unsupported request" },
    });
  });
  await page.route(/https:\/\/[^/]*posthog\.com\//, (route) => route.abort());
  await page.routeWebSocket(/supabase\.co/, (socket) => socket.close());
  return { id, release, creations: () => creations };
}
