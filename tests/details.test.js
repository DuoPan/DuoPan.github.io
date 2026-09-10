import test from "node:test";
import assert from "node:assert/strict";
import { rollingFrequency } from "../details.js";
import { normalizeRows, selectRange } from "../analytics.js";

const rowsFor = (hits, pb = false) => normalizeRows(hits.map((hit, index) => {
  const date = new Date(Date.UTC(2026, 0, 1) + index * 7 * 86_400_000).toISOString().slice(0, 10);
  return [date, ...(pb || hit ? [1, 2, 3, 4, 5, 6, 7] : [2, 3, 4, 5, 6, 7, 8]), pb && !hit ? 2 : 1];
}));

test("rolling frequencies start with actual sample sizes, not artificial ten-draw denominators", () => {
  const rows = rowsFor([true, false, true]);
  const points = rollingFrequency(rows, 1);
  assert.deepEqual(points, [
    { date: "01/01/2026", count: 1, sampleSize: 1, rate: 1 },
    { date: "08/01/2026", count: 1, sampleSize: 2, rate: 0.5 },
    { date: "15/01/2026", count: 2, sampleSize: 3, rate: 2 / 3 }
  ]);
  assert.equal(rows[0][0], "15/01/2026");
});

test("rolling windows drop the oldest observation exactly when the window is full", () => {
  const points = rollingFrequency(rowsFor([true, ...Array(10).fill(false), true]), 1);
  assert.equal(points[9].sampleSize, 10);
  assert.equal(points[9].count, 1);
  assert.equal(points[10].count, 0);
  assert.equal(points[11].count, 1);
  assert.equal(points[11].sampleSize, 10);
  assert.equal(points[11].rate, 0.1);
});

test("future appearances cannot change earlier historical points", () => {
  const initial = rowsFor([false, false, true]);
  const extended = rowsFor([false, false, true, true, true]);
  assert.deepEqual(rollingFrequency(extended, 1).slice(0, initial.length), rollingFrequency(initial, 1));
});

test("date ranges cannot leak future or pre-start observations into rolling samples", () => {
  const rows = rowsFor([true, false, false, true, true]);
  const { data } = selectRange(rows, { window: "custom", dateFrom: "2026-01-08", dateTo: "2026-01-22" });
  const points = rollingFrequency(data, 1);
  assert.deepEqual(points.map((point) => point.sampleSize), [1, 2, 3]);
  assert.deepEqual(points.map((point) => point.count), [0, 0, 1]);
  assert.equal(points.at(-1).date, "22/01/2026");
});

test("Powerball rolling frequencies use the separate ball pool", () => {
  const rows = rowsFor([false, true, false], true);
  assert.equal(rollingFrequency(rows, 1, "main").at(-1).rate, 1);
  assert.equal(rollingFrequency(rows, 1, "pb").at(-1).rate, 1 / 3);
  assert.equal(rollingFrequency(rows, 2, "pb").at(-1).rate, 2 / 3);
});

test("empty, single-draw and all-absent histories remain finite", () => {
  assert.deepEqual(rollingFrequency([], 1), []);
  assert.equal(rollingFrequency(rowsFor([true]), 1)[0].rate, 1);
  assert.ok(rollingFrequency(rowsFor([false, false, false]), 1).every((point) => point.rate === 0));
});

test("alternate rolling windows honor their own denominators", () => {
  const points = rollingFrequency(rowsFor([true, false, false, true]), 1, "main", 2);
  assert.deepEqual(points.map((point) => point.sampleSize), [1, 2, 2, 2]);
  assert.deepEqual(points.map((point) => point.rate), [1, 0.5, 0, 0.5]);
});

test("invalid pools, ball numbers and rolling-window sizes fail explicitly", () => {
  assert.throws(() => rollingFrequency([], 0));
  assert.throws(() => rollingFrequency([], 36));
  assert.throws(() => rollingFrequency([], 21, "pb"));
  assert.throws(() => rollingFrequency([], 1.5));
  assert.throws(() => rollingFrequency([], 1, "other"));
  assert.throws(() => rollingFrequency([], 1, "main", 0));
  assert.throws(() => rollingFrequency([], 1, "main", 2.5));
});
