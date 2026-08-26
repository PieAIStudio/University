/*
 * University review reminders only.
 *
 * This worker deliberately has no fetch listener, cache, or install-time
 * work. The app registers it after a learner opts in, so the existing first
 * screen and offline cache path stay untouched.
 */
const FALLBACK_URL = "/";

self.addEventListener("push", (event) => {
  event.waitUntil(showPushNotification(event.data));
});

self.addEventListener("notificationclick", (event) => {
  const url = sameOriginPathOf(event.notification.data?.url);
  event.notification.close();
  event.waitUntil(focusOrOpen(url));
});

async function showPushNotification(data) {
  const payload = await payloadOf(data);
  const title = typeof payload.title === "string" ? payload.title : "University · 复习提醒";
  const body =
    typeof payload.body === "string" && payload.body.trim()
      ? payload.body
      : "明天有复习卡到期，回来看看吧。";
  const url = sameOriginPathOf(payload.url);

  await self.registration.showNotification(title, {
    body,
    tag: "university-review-reminder",
    renotify: true,
    data: { url },
  });
}

async function payloadOf(data) {
  if (!data) return {};
  const raw = await data.text();
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : { body: raw };
  } catch {
    return { body: raw };
  }
}

function sameOriginPathOf(value) {
  if (typeof value !== "string" || !value.startsWith("/")) return FALLBACK_URL;
  return value;
}

async function focusOrOpen(path) {
  const target = new URL(path, self.location.origin).href;
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of clients) {
    if (client.url.startsWith(self.location.origin)) {
      await client.focus();
      if (client.url !== target && "navigate" in client) await client.navigate(target);
      return;
    }
  }
  await self.clients.openWindow(target);
}
