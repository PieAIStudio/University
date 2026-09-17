import { test, expect } from "@playwright/test";
import { ONLINE_ORIGIN } from "./ports.js";
import { watchConsole } from "./harness/console.js";

test("console guard accepts only the exact synthetic HTTP rejection; other errors still fail", async ({
  page,
}) => {
  const expectedUrl = `${ONLINE_ORIGIN}/synthetic-console-check/expected`;
  const unexpectedUrl = `${ONLINE_ORIGIN}/synthetic-console-check/unexpected`;
  await page.route(`${ONLINE_ORIGIN}/synthetic-console-check/page`, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Console contract</title>",
    }),
  );
  await page.route(`${ONLINE_ORIGIN}/synthetic-console-check/expected`, (route) =>
    route.fulfill({ status: 400, json: { synthetic: true } }),
  );
  await page.route(`${ONLINE_ORIGIN}/synthetic-console-check/unexpected`, (route) =>
    route.fulfill({ status: 400, json: { synthetic: true } }),
  );
  await page.goto(`${ONLINE_ORIGIN}/synthetic-console-check/page`);
  const normal = watchConsole(page);
  const scoped = watchConsole(page, {
    expectedHttpErrors: [{ status: 400, matchesUrl: (url) => url === expectedUrl }],
  });
  await page.evaluate((url) => fetch(url), expectedUrl);
  await expect.poll(() => normal.errors().length).toBe(1);
  expect(() => normal.assertClean()).toThrow("400");
  scoped.assertClean();
  // Even a second response from the same URL is not the one expected failure.
  await page.evaluate((url) => fetch(url), expectedUrl);
  await expect.poll(() => scoped.errors().length).toBe(1);
  expect(() => scoped.assertClean()).toThrow("400");
  await page.evaluate((url) => fetch(url), unexpectedUrl);
  await expect.poll(() => scoped.errors().length).toBe(2);
  expect(() => scoped.assertClean()).toThrow("400");
  await page.evaluate(() =>
    setTimeout(() => {
      throw Error("synthetic-script-regression");
    }, 0),
  );
  await expect.poll(() => scoped.errors().length).toBe(3);
  expect(() => scoped.assertClean()).toThrow("synthetic-script-regression");
});
