import { test, expect } from "@playwright/test";
import { ONLINE_ORIGIN } from "./ports.js";
const origin = process.env.ACCOUNT_FLOW_ORIGIN ?? ONLINE_ORIGIN;

test("Z the actual University app uses shared account forms and returns to a published course", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const user = {
    id: "0bb6eb08-4ca1-4616-8e04-9d5a97035a0b",
    email: "synthetic-app@example.test",
    aud: "authenticated",
    role: "authenticated",
    is_anonymous: false,
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  };
  const encoded = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encoded({ alg: "HS256", typ: "JWT" })}.${encoded({ sub: user.id, aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 })}.c3ludGhldGljLW5vdC1hLXJlYWwtc2lnbmF0dXJl`;
  let signIns = 0;
  let realProviderPassThrough = 0;
  // A real SDK and the real app, but explicitly synthetic provider responses.
  // No auth request, credential, account creation or data write reaches a server.
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname.endsWith("supabase.co")) {
      if (url.pathname.endsWith("/auth/v1/token")) {
        signIns++;
        if (signIns === 1)
          return route.fulfill({
            status: 400,
            json: { code: "invalid_credentials", msg: "synthetic-private-provider-body" },
          });
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
      if (url.pathname.endsWith("/auth/v1/user")) return route.fulfill({ json: user });
      if (url.pathname.includes("/rest/v1/rpc/")) return route.fulfill({ json: null });
      if (url.pathname.includes("/rest/v1/")) return route.fulfill({ json: [] });
      if (url.pathname.includes("/auth/v1/")) return route.fulfill({ json: {} });
      realProviderPassThrough++;
      return route.abort();
    }
    if (url.hostname.endsWith("posthog.com")) return route.abort();
    return route.continue();
  });
  await page.routeWebSocket(/supabase\.co/, (socket) => socket.close());
  const coursePath = "/ai-literacy/understanding-ai";
  await page.goto(origin + coursePath + "?lang=en");
  await expect(page.locator("button.avatar-chip--button").first()).toHaveAccessibleName(
    "Sign in to personalize your avatar",
  );
  await page.locator("button.avatar-chip--button").first().click();
  await expect(page).toHaveURL(/\/me(?:[?#]|$)/);
  const panel = page.locator(".account-panel");
  await expect(panel.locator(".swimmer-auth")).toBeVisible();
  const email = panel.locator("input[type=email]");
  const password = panel.locator("input[type=password]");
  await email.fill(user.email);
  await password.fill("synthetic-password12");
  await panel.locator("button[type=submit]").click();
  await expect(panel.getByRole("alert")).toBeVisible();
  await expect(panel).not.toContainText("synthetic-private-provider-body");
  await expect(email).toHaveValue(user.email);
  await expect(password).toHaveValue("");
  await password.fill("synthetic-password12");
  await panel.locator("button[type=submit]").click();
  await expect(panel.locator(".account-panel__signed-in")).toContainText(user.email);
  await expect(panel.locator(".account-panel__password")).not.toHaveAttribute("open");
  await page.screenshot({ path: info.outputPath("actual-app-account.png") });
  await panel.getByRole("button", { name: "Continue learning", exact: true }).click();
  await expect(page).toHaveURL(/\/ai-literacy\/understanding-ai(?:[?#]|$)/);
  await expect(page.locator("button.label--icon").first()).toBeVisible();
  expect(signIns).toBe(2);
  expect(realProviderPassThrough).toBe(0);
  await page.screenshot({ path: info.outputPath("actual-app-continued-course.png") });
});
