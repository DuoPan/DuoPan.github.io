import test from "node:test";
import assert from "node:assert/strict";
import { parseDate, dateISO, normalizeRows, selectRange, frequency, missingStats, drawStats, trendStats, pairStats } from "../analytics.js";

const draw = (date, main = [1, 2, 3, 4, 5, 6, 7], pb = 1) => [date, ...main, pb];
const history = (count) => normalizeRows(Array.from({ length: count }, (_, index) =>
  draw(new Date(Date.UTC(2026, 0, 1) + index * 7 * 86_400_000).toISOString().slice(0, 10), index % 2 ? [8, 9, 10, 11, 12, 13, 14] : [1, 2, 3, 4, 5, 6, 7], index % 20 + 1)));

test("strict calendar dates reject overflows and ambiguous input", () => {
  assert.equal(dateISO("29/2/2024"), "2024-02-29");
  assert.equal(dateISO("2026-03-12"), "2026-03-12");
  assert.equal(dateISO("1/1/0099"), "0099-01-01");
  for (const bad of ["31/02/2026", "2026-02-29", "2026-13-01", "00/01/2026", "12/03/26", "12/03/2026extra", "", null, 123, new Date(NaN)]) {
    assert.equal(parseDate(bad), null, String(bad));
    assert.equal(dateISO(bad), "");
  }
});

test("normalization repairs chronological order and legacy years without mutating input", () => {
  const source = [draw("1/06/23", ["7", "6", "5", "4", "3", "2", "1"], "20"), draw("8/06/2023")];
  const before = JSON.stringify(source);
  const rows = normalizeRows(source);
  assert.deepEqual(rows.map((row) => row[0]), ["08/06/2023", "01/06/2023"]);
  assert.deepEqual(rows[1], draw("01/06/2023", undefined, 20));
  assert.equal(JSON.stringify(source), before);
});

test("normalization rejects bad rows, duplicate dates, repeated main balls and out-of-range values", () => {
  const bad = [
    [draw("31/02/2026")], [draw("2026-01-01"), draw("1/1/2026")],
    [draw("2026-01-01", [1, 1, 3, 4, 5, 6, 7])],
    [draw("2026-01-01", [0, 2, 3, 4, 5, 6, 7])],
    [draw("2026-01-01", [1, 2, 3, 4, 5, 6, 36])],
    [draw("2026-01-01", [1, 2, 3, 4, 5, 6, 7.1])],
    [draw("2026-01-01", ["", 2, 3, 4, 5, 6, 7])],
    [draw("2026-01-01", [true, 2, 3, 4, 5, 6, 7])],
    [draw("2026-01-01", undefined, 21)], [["2026-01-01", 1]]
  ];
  bad.forEach((rows) => assert.throws(() => normalizeRows(rows)));
  assert.throws(() => normalizeRows(null));
  assert.deepEqual(normalizeRows([]), []);
});

test("preset windows ignore custom dates and preserve full omission history", () => {
  const rows = history(25);
  const result = selectRange(rows, { window: "10", dateFrom: "invalid", dateTo: "2020-01-01" });
  assert.equal(result.data.length, 10);
  assert.equal(result.asOfData.length, 25);
  assert.equal(selectRange(rows, { window: "50" }).data.length, 25);
  assert.equal(selectRange(rows, { window: "all" }).data.length, 25);
  assert.throws(() => selectRange(rows, { window: "12" }));
});

test("custom range never includes future draws in omission or frequency history", () => {
  const rows = normalizeRows([draw("2026-01-01"), draw("2026-01-08"), draw("2026-01-15"), draw("2026-01-22")]);
  const { data, asOfData } = selectRange(rows, { window: "custom", dateFrom: "2026-01-08", dateTo: "2026-01-15" });
  assert.deepEqual(data.map((row) => row[0]), ["15/01/2026", "08/01/2026"]);
  assert.deepEqual(asOfData.map((row) => row[0]), ["15/01/2026", "08/01/2026", "01/01/2026"]);
  assert.equal(selectRange(rows, { window: "custom", dateTo: "2025-01-01" }).asOfData.length, 0);
  assert.throws(() => selectRange(rows, { window: "custom", dateFrom: "2026-01-22", dateTo: "2026-01-01" }));
  assert.throws(() => selectRange(rows, { window: "custom", dateTo: "2026-02-30" }));
});

test("frequency separates pools and divides by draws, including absent numbers", () => {
  const rows = [draw("2026-01-08", undefined, 20), draw("2026-01-01", [1, 8, 9, 10, 11, 12, 13], 20)];
  const main = frequency(rows);
  assert.equal(main.length, 35);
  assert.deepEqual(main[0], { number: 1, count: 2, rate: 1 });
  assert.equal(main[1].rate, 0.5);
  assert.equal(main[19].count, 0);
  assert.equal(main.reduce((sum, item) => sum + item.count, 0), 14);
  const pb = frequency(rows, "pb");
  assert.equal(pb.length, 20);
  assert.equal(pb[19].rate, 1);
  assert.equal(frequency([])[0].rate, 0);
  assert.throws(() => frequency([], "other"));
});

test("missing numbers use zero for the latest draw and lower bounds for unseen history", () => {
  const rows = [
    draw("2026-01-29", [2, 3, 4, 5, 6, 7, 8], 2),
    draw("2026-01-22", [1, 3, 4, 5, 6, 7, 8], 1),
    draw("2026-01-15", [2, 3, 4, 5, 6, 7, 8], 2),
    draw("2026-01-08", [2, 3, 4, 5, 6, 7, 8], 2),
    draw("2026-01-01", [1, 3, 4, 5, 6, 7, 8], 1)
  ];
  const stats = missingStats(rows);
  assert.deepEqual(stats[0], { number: 1, missing: 1, lastDate: "2026-01-22", bounded: false, maxMissing: 2 });
  assert.equal(stats[1].missing, 0);
  assert.deepEqual(stats[34], { number: 35, missing: 5, lastDate: null, bounded: true, maxMissing: null });
  assert.equal(stats[2].maxMissing, 0);
  assert.equal(missingStats(rows, "pb")[0].missing, 1);
  assert.equal(missingStats(rows, "pb")[0].maxMissing, 2);
  assert.equal(missingStats([rows[0]])[1].maxMissing, null);
  assert.equal(missingStats([])[0].bounded, true);
});

test("historical cutoff prevents later appearances from shortening omissions", () => {
  const rows = normalizeRows([
    draw("2026-01-01", [1, 2, 3, 4, 5, 6, 7]),
    draw("2026-01-08", [2, 3, 4, 5, 6, 7, 8]),
    draw("2026-01-15", [1, 2, 3, 4, 5, 6, 7])
  ]);
  const { data, asOfData } = selectRange(rows, { window: "custom", dateFrom: "2026-01-08", dateTo: "2026-01-08" });
  assert.equal(data.length, 1);
  assert.equal(missingStats(asOfData)[0].missing, 1);
  assert.equal(missingStats(asOfData)[0].lastDate, "01/01/2026");
});

test("draw statistics exclude Powerball and calculate population deviation", () => {
  const row = draw("2026-01-01", [7, 1, 6, 2, 5, 3, 4], 20);
  const stats = drawStats(row);
  assert.deepEqual(stats, { sum: 28, average: 4, odds: 4, evens: 3, low: 7, high: 0, buckets: [7, 0, 0, 0], span: 6, maxRun: 7, median: 4, sd: 2 });
  assert.equal(row[1], 7);
  assert.equal(drawStats(null), null);
});

test("trend comparisons use separate equal-sized windows and percentage-point deltas", () => {
  const rows = [
    ...Array.from({ length: 10 }, () => draw("2026-01-01")),
    ...Array.from({ length: 10 }, () => draw("2026-01-01", [8, 9, 10, 11, 12, 13, 14]))
  ];
  const result = trendStats(rows);
  assert.equal(result.recentSize, 10);
  assert.equal(result.previousSize, 10);
  assert.deepEqual(result.items[0], { number: 1, count: 10, rate: 1, previousCount: 0, previousRate: 0, delta: 100 });
  assert.equal(result.items[7].delta, -100);
  assert.equal(trendStats(rows.slice(0, 12)).previousSize, 2);
  assert.equal(trendStats(rows.slice(0, 5)).items[0].delta, null);
  assert.equal(trendStats(rows.slice(0, 5)).items[0].previousRate, null);
  assert.equal(trendStats([]).recentSize, 0);
  assert.equal(trendStats(rows, "pb").items.length, 20);
  assert.throws(() => trendStats(rows, "main", 0));
});

test("selected windows cannot leak additional draws into trend comparisons", () => {
  const { data } = selectRange(history(30), { window: "10" });
  assert.equal(trendStats(data).recentSize, 10);
  assert.equal(trendStats(data).previousSize, 0);
  assert.equal(trendStats(data, "main", 20).recentSize, 10);
  assert.equal(trendStats(data, "main", 50).recentSize, 10);
});

test("pair statistics cover all 595 combinations with without-replacement expectations", () => {
  const rows = [draw("2026-01-01"), draw("2026-01-08", [1, 2, 8, 9, 10, 11, 12])];
  const pairs = pairStats(rows);
  assert.equal(pairs.length, 595);
  assert.equal(new Set(pairs.map((item) => `${item.a},${item.b}`)).size, 595);
  assert.ok(pairs.every((item) => item.a < item.b));
  assert.equal(pairs.reduce((sum, item) => sum + item.count, 0), 42);
  assert.equal(pairs[0].count, 2);
  assert.equal(pairs[0].rate, 1);
  assert.ok(Math.abs(pairs[0].expected - (7 / 35) * (6 / 34) * 2) < 1e-12);
  assert.equal(pairStats([])[0].expected, 0);
  assert.equal(pairStats([])[0].rate, 0);
});
