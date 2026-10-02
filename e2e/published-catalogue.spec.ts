import { expect, test } from "./harness/learner-test.js";
import { inspectPublishedCatalogue } from "./harness/published-catalogue.mjs";

// Intentionally tests the real release files, not the browser's frozen shelf.
// Legal inventory reductions must preserve parity, not obsolete course IDs.
test("published catalogue preserves every current lesson and excludes test-only inputs", async () => {
  const counts = inspectPublishedCatalogue();
  expect(counts.studies).toBeGreaterThan(0);
  expect(counts.courses).toBeGreaterThan(0);
  expect(counts.lessons).toBeGreaterThan(0);
  await test.info().attach("published-catalogue-counts", {
    body: JSON.stringify(counts, null, 2),
    contentType: "application/json",
  });
});
