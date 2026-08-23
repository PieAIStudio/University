import { chromium } from "@playwright/test";
const OUT = process.argv[2];
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message));
await page.goto("http://127.0.0.1:9999/", { waitUntil: "networkidle" });
await page.waitForTimeout(4000);
for (const b of await page.getByRole("button", { name: /收起/ }).all()) { try { await b.click({timeout:1200}); } catch {} }
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/07-local-world.png` });
console.log("labels:", await page.locator(".label").count(), "errors:", errors.slice(0,5));
await browser.close();
