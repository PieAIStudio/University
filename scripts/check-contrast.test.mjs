import assert from "node:assert/strict";
import test from "node:test";

import { runContrastCheck } from "./check-contrast.mjs";

const options = {
  root: "/fixture/repository",
  kitBin: "/fixture/swimmer-ui-check.mjs",
  targets: ["packages/ui/src"],
};

function runWith(childResult) {
  const messages = [];
  const result = runContrastCheck({
    ...options,
    runChild() {
      if (childResult instanceof Error) throw childResult;
      return childResult;
    },
    logError(message) {
      messages.push(message);
    },
  });
  return { result, messages };
}

function childFailure({ status, stderr }) {
  return Object.assign(new Error("fixture child failed"), {
    status,
    stdout: "",
    stderr,
  });
}

test("a clean child exit with no adopted findings is green", () => {
  const { result, messages } = runWith(
    "swimmer-ui-check: 0 raw color literals in component rules. Clean.\n",
  );

  assert.equal(result.ok, true);
  assert.equal(result.findings.length, 0);
  assert.equal(result.incompleteTrees.length, 0);
  assert.deepEqual(messages, []);
});

test("adopted contrast and token findings are red and printed", () => {
  const belowAa =
    "packages/ui/src/bad.css:4: --game-ui-accent-ink on --game-ui-accent is 1.48:1 — below AA (4.5:1)";
  const missingToken =
    "packages/ui/src/bad.css:8: --game-ui-border is not a token this kit defines — the var() fallback is doing all the work";
  const { result, messages } = runWith(`${belowAa}\n${missingToken}\n`);

  assert.equal(result.ok, false);
  assert.deepEqual(result.findings, [belowAa, missingToken]);
  assert.equal(result.contrastProblems, 1);
  assert.equal(result.undefinedTokens, 1);
  assert.equal(result.incompleteTrees.length, 0);
  assert.ok(messages.includes(belowAa));
  assert.ok(messages.includes(missingToken));
  assert.ok(messages.some((message) => message.includes("contrast problem(s)")));
  assert.ok(!messages.some((message) => message.includes("did not complete")));
});

test("a status 1 that carries adopted findings is reported as a finding, not a crash", () => {
  const belowAa =
    "packages/ui/src/bad.css:4: --game-ui-accent-ink on --game-ui-accent is 1.48:1 — below AA (4.5:1)";
  const { result, messages } = runWith(childFailure({ status: 1, stderr: `${belowAa}\n` }));
  const report = messages.join("\n");

  assert.equal(result.ok, false);
  assert.equal(result.incompleteTrees.length, 0);
  assert.equal(result.contrastProblems, 1);
  assert.match(report, /found 1 contrast problem/);
  assert.doesNotMatch(report, /contrast check did not complete/);
});

test("a failed child is red even when it emitted no adopted finding", () => {
  const { result, messages } = runWith(
    childFailure({
      status: 2,
      stderr: 'swimmer-ui-check: cannot read "/fixture/repository/packages/ui/src"\n',
    }),
  );
  const report = messages.join("\n");

  assert.equal(result.ok, false);
  assert.equal(result.findings.length, 0);
  assert.equal(result.incompleteTrees.length, 1);
  assert.match(report, /contrast check did not complete/);
  assert.match(report, /status 2/);
  assert.match(report, /cannot read/);
  assert.doesNotMatch(report, /found .* contrast problem/);
});

test("a child that says contrast was not checked is red even with exit 0", () => {
  const signal =
    "swimmer-ui-check: could not read this package's theme tokens, so contrast was NOT checked. Raw-colour linting below still ran.";
  const { result, messages } = runWith(`${signal}\n`);
  const report = messages.join("\n");

  assert.equal(result.ok, false);
  assert.equal(result.incompleteTrees.length, 1);
  assert.match(report, /contrast was NOT checked/);
  assert.match(report, /contrast check did not complete/);
  assert.match(report, /result is not trusted/);
});

test("raw-colour output is not adopted as a contrast finding", () => {
  const { result, messages } = runWith(
    'packages/ui/src/legacy.css:2: raw color literal "#123456" — use var(--game-ui-*) instead\n',
  );

  assert.equal(result.ok, true);
  assert.equal(result.findings.length, 0);
  assert.deepEqual(messages, []);
});

test("a raw-colour-only child failure still fails closed without importing that rule", () => {
  const { result, messages } = runWith(
    childFailure({
      status: 1,
      stderr:
        'packages/ui/src/legacy.css:2: raw color literal "#123456" — use var(--game-ui-*) instead\n' +
        "swimmer-ui-check: 1 raw color literal(s) in 1 file(s).\n",
    }),
  );
  const report = messages.join("\n");

  assert.equal(result.ok, false);
  assert.equal(result.findings.length, 0);
  assert.equal(result.contrastProblems, 0);
  assert.equal(result.undefinedTokens, 0);
  assert.match(report, /status 1/);
  assert.match(report, /separate raw-colour rule/);
  assert.doesNotMatch(report, /raw color literal "#123456"/);
});
