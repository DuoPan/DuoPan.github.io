import test from "node:test";
import assert from "node:assert/strict";
import { buildSumTrend, summarizeCharts } from "../charts.js";

const draw = (date, main = [1, 3, 5, 7, 9, 11, 13], pb = 1) => [date, ...main, pb];

test("chart totals separate main balls and PB, including a 100% odd sample", () => {
  const stats = summarizeCharts([draw("12/03/2026")]);
  assert.equal(stats.mainTotal, 7);
  assert.equal(stats.odd, 7);
  assert.equal(stats.even, 0);
  assert.equal(stats.low, 7);
  assert.equal(stats.high, 0);
  assert.equal(stats.pbOdd, 1);
  assert.equal(stats.pbEven, 0);
  assert.deepEqual(stats.buckets, [5, 2, 0, 0]);
  assert.deepEqual(stats.expectedBuckets, [2, 2, 2, 1]);
});

test("each number counted once reproduces the unequal main-pool baselines", () => {
  const rows = Array.from({ length: 5 }, (_, group) => draw(`${group + 1}/03/2026`, Array.from({ length: 7 }, (_, index) => group * 7 + index + 1), group + 1));
  const stats = summarizeCharts(rows);
  assert.equal(stats.odd, 18);
  assert.equal(stats.even, 17);
  assert.equal(stats.low, 17);
  assert.equal(stats.high, 18);
  assert.deepEqual(stats.buckets, [10, 10, 10, 5]);
  assert.deepEqual(stats.expectedBuckets, stats.buckets);
  assert.equal(stats.pbOdd + stats.pbEven, rows.length);
});

test("trend uses real elapsed dates and leaves source ordering intact", () => {
  const latest = Object.freeze(draw("26/03/2026"));
  const earliest = Object.freeze(draw("05/03/2026"));
  const middle = Object.freeze(draw("12/03/2026"));
  const input = Object.freeze([latest, earliest, middle]);
  const series = buildSumTrend(input);
  assert.deepEqual(series.rows.map((row) => row[0]), ["05/03/2026", "12/03/2026", "26/03/2026"]);
  const [first, second, third] = series.points;
  assert.ok(Math.abs((third.x - second.x) / (second.x - first.x) - 2) < 1e-10);
  assert.deepEqual(input, [latest, earliest, middle]);
  assert.equal(series.ticks[0].row, earliest);
  assert.equal(series.ticks.at(-1).row, latest);
});

test("empty, one-draw and constant-sum trends have finite geometry", () => {
  assert.deepEqual(buildSumTrend([]).points, []);
  assert.deepEqual(summarizeCharts([]).expectedBuckets, [0, 0, 0, 0]);
  const main = [12, 14, 16, 18, 20, 22, 24];
  for (const rows of [[draw("12/03/2026", main)], [draw("19/03/2026", main), draw("12/03/2026", main)]]) {
    const series = buildSumTrend(rows);
    assert.ok(series.max > series.min);
    assert.ok(Number.isFinite(series.referenceY));
    for (const point of series.points) {
      assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
      assert.ok(point.x >= series.left && point.x <= series.right);
      assert.ok(point.y >= series.top && point.y <= series.bottom);
      assert.equal(point.sum, 126);
      assert.equal(point.y, series.referenceY);
    }
    if (rows.length === 1) assert.equal(series.points[0].x, (series.left + series.right) / 2);
  }
});

test("the complete selected range is retained beyond the former 100-draw limit", () => {
  const rows = Array.from({ length: 135 }, (_, index) => {
    const date = new Date(Date.UTC(2023, 0, 5 + index * 7));
    return draw(`${date.getUTCDate()}/${date.getUTCMonth() + 1}/${date.getUTCFullYear()}`);
  }).reverse();
  const summary = summarizeCharts(rows);
  const series = buildSumTrend(rows);
  assert.equal(summary.draws, 135);
  assert.equal(summary.mainTotal, 945);
  assert.equal(summary.pbOdd, 135);
  assert.equal(series.points.length, 135);
  assert.equal(series.points[0].row, rows.at(-1));
  assert.equal(series.points.at(-1).row, rows[0]);
});
