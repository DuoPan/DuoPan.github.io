import test from "node:test";
import assert from "node:assert/strict";
import { rollingFrequency } from "../details.js";
import { normalizeRows, selectRange } from "../analytics.js";
import renderDrawTable from "../drawTable.js";

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

test("Oz Lotto rolling frequencies accept 47 and inspect every supplementary position", () => {
  const rows = normalizeRows([
    ["06/10/2026", 1, 2, 3, 4, 5, 6, 47, 8, 9, 10],
    ["13/10/2026", 1, 2, 3, 4, 5, 6, 7, 8, 9, 47],
    ["20/10/2026", 1, 2, 3, 4, 5, 6, 7, 9, 46, 47]
  ], "ozlotto");
  assert.deepEqual(rollingFrequency(rows, 47, "main", 10, "ozlotto").map((point) => point.count), [1, 1, 1]);
  const extras = rollingFrequency(rows, 47, "supplementary", 10, "ozlotto");
  assert.deepEqual(extras.map((point) => point.count), [0, 1, 2]);
  assert.equal(extras.at(-1).rate, 2 / 3);
  assert.deepEqual(rollingFrequency(rows, 9, "supplementary", 2, "ozlotto").map((point) => point.rate), [1, 1, 1]);
  assert.throws(() => rollingFrequency([], 48, "main", 10, "ozlotto"));
  assert.throws(() => rollingFrequency([], 48, "supplementary", 10, "ozlotto"));
  assert.throws(() => rollingFrequency([], 1, "pb", 10, "ozlotto"));
  assert.throws(() => rollingFrequency([], 1, "supplementary"));
});

test("Oz Lotto history renders every supplementary ball and limits heat highlighting to the top three", () => {
  const originalDocument = globalThis.document;
  const makeNode = (tag) => ({
    tag, children: [], dataset: {}, innerHTML: "",
    appendChild(child) { this.children.push(child); return child; },
    setAttribute() {}, addEventListener() {},
    querySelector(selector) {
      if (selector === "tbody") return this.body ||= makeNode("tbody");
      return null;
    }
  });
  const wrapper = makeNode("div");
  globalThis.document = { getElementById: () => wrapper, createElement: makeNode };
  try {
    const row = (extra) => ["13/10/2026", 10, 11, 12, 13, 14, 15, 16, ...extra];
    const allData = [...Array.from({ length: 5 }, () => row([1, 2, 3])), row([1, 2, 4]), row([1, 2, 4]), row([1, 4, 5])];
    renderDrawTable({ data: [allData.at(-1)], allData, view: "distribution", game: "ozlotto", t: (key) => key, watchlist: { supplementary: [4] } });
    const table = wrapper.children[0].children[0];
    const markup = table.body.children[0].innerHTML;
    assert.equal((markup.match(/data-pool="supplementary"/g) || []).length, 3);
    assert.match(markup, /class="[^"]*heat-hot[^"]*" data-number="1" data-pool="supplementary"/);
    assert.match(markup, /class="[^"]*is-watched[^"]*" data-number="4" data-pool="supplementary"/);
    assert.doesNotMatch(markup, /class="[^"]*heat-hot[^"]*" data-number="4" data-pool="supplementary"/);
    assert.doesNotMatch(markup, /class="[^"]*powerball[^"]*" data-number="[145]" data-pool="supplementary"/);
    assert.match(table.innerHTML, /section.supplementary #3/);
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});
