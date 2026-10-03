import assert from "node:assert/strict";
import test from "node:test";
import { calibratedPanGain, measureIslandPan } from "./harness/island-pan-gain.ts";

const canvas = { x: 100, y: 50, width: 1000, height: 600 };
const label = (id, x, y = 350) => ({ id, box: { x: x - 10, y: y - 10, width: 20, height: 20 } });

test("one edge label changing side cannot reverse the median pan measurement", () => {
  const before = [label("edge", 1050), label("middle", 620), label("left", 420)];
  const after = [label("middle", 660), label("edge", 990), label("left", 460)];
  const original = JSON.stringify({ before, after });
  const result = measureIslandPan(before, after, 20, canvas, "edge");
  assert.equal(result.method, "median");
  assert.deepEqual(
    result.common.map((item) => item.displacement),
    [-60, 40, 40],
  );
  assert.deepEqual(result.used, ["edge", "middle", "left"]);
  assert.equal(result.displacement, 40);
  assert.equal(result.gain, 2);
  assert.equal(JSON.stringify({ before, after }), original);
});

test("the median includes only common visible labels and averages the even middle pair", () => {
  const before = [
    label("edge", 1050),
    label("b", 800),
    label("c", 600),
    label("d", 400),
    label("gone", 250),
  ];
  const after = [
    label("new", 200),
    label("d", 460),
    label("c", 640),
    label("b", 820),
    label("edge", 990),
  ];
  const result = measureIslandPan(before, after, 10, canvas, "edge");
  assert.deepEqual(result.used, ["edge", "b", "c", "d"]);
  assert.equal(result.displacement, 30);
  assert.equal(result.gain, 3);
});

test("fewer than three common labels uses the one nearest the offset canvas center", () => {
  const before = [label("a", 480), label("b", 610), label("edge", 1050)];
  const after = [label("a", 450), label("b", 650)];
  const result = measureIslandPan(before, after, 20, canvas, "edge");
  assert.equal(result.method, "nearest-center");
  assert.deepEqual(result.used, ["b"]);
  assert.equal(result.gain, 2);
});

test("the small-sample fallback never uses the edge target even when it is nearer", () => {
  const result = measureIslandPan(
    [label("edge", 605), label("safe", 400)],
    [label("edge", 550), label("safe", 440)],
    20,
    canvas,
    "edge",
  );
  assert.deepEqual(result.used, ["safe"]);
  assert.equal(result.gain, 2);
});

test("no shared safe label cannot be passed off as a valid pan", () => {
  for (const after of [[], [label("edge", 1080)]]) {
    const result = measureIslandPan([label("edge", 1050)], after, 20, canvas, "edge");
    assert.deepEqual(result.used, []);
    assert.equal(result.gain, null);
  }
});

test("a stationary or reversed map still yields a non-positive gain", () => {
  const before = [label("edge", 1000), label("b", 700), label("c", 500)];
  for (const dx of [20, -20]) {
    const still = measureIslandPan(before, before, dx, canvas, "edge");
    assert.ok(still.gain <= 0);
    const reversed = before.map((item) => ({ ...item, box: { ...item.box, x: item.box.x - dx } }));
    assert.equal(measureIslandPan(before, reversed, dx, canvas, "edge").gain, -1);
    const forward = before.map((item) => ({ ...item, box: { ...item.box, x: item.box.x + dx } }));
    assert.equal(measureIslandPan(before, forward, dx, canvas, "edge").gain, 1);
  }
});

test("a lone moving edge name preserves the last independent calibration, not a fabricated measurement", () => {
  const result = measureIslandPan(
    [label("search-your-own-photos", 1237.2615966796875)],
    [label("search-your-own-photos", 1318.04541015625)],
    50,
    canvas,
    "search-your-own-photos",
  );
  assert.deepEqual(result.used, []);
  assert.equal(result.gain, null);
  assert.equal(calibratedPanGain(result.gain, 1.6131689453125), 1.6131689453125);
});

test("missing initial calibration and actual non-positive measurements still fail closed", () => {
  assert.throws(() => calibratedPanGain(null, null));
  for (const previous of [0, -1, NaN, Infinity])
    assert.throws(() => calibratedPanGain(null, previous));
  for (const measured of [0, -1])
    assert.throws(() => calibratedPanGain(measured, 2), /真实拖动没有把课程岛向预期方向平移/);
  for (const measured of [NaN, Infinity]) assert.throws(() => calibratedPanGain(measured, 2));
  assert.equal(calibratedPanGain(1.5, 2), 1.5);
});

test("zero and non-finite pointer displacement are rejected, not used as calibration", () => {
  for (const dx of [0, NaN, Infinity])
    assert.throws(() => measureIslandPan([], [], dx, canvas, "edge"));
});
