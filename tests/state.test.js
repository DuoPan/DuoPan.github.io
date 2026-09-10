import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_STATE, VIEWS, WINDOWS, sanitizeState, stateFromHash, stateToHash, sanitizeWatchlist, sanitizePresets, readStorage, writeStorage } from "../state.js";
import { selectRange } from "../analytics.js";

test("share links round-trip every view, window, pool, language and pagination state", () => {
  for (const view of VIEWS) for (const window of WINDOWS) {
    const state = sanitizeState({ view, window, pool: "pb", lang: "en", sort: "number_asc", page: 3, dateFrom: "2024-02-29", dateTo: "2026-09-03" });
    assert.deepEqual(stateFromHash(stateToHash(state)), state);
  }
  assert.equal(new URLSearchParams(stateToHash(DEFAULT_STATE).slice(1)).has("page"), false);
});

test("unknown hash fields cannot enter application state and unrelated anchors are ignored", () => {
  assert.equal(stateFromHash("#contact"), null);
  assert.equal(stateFromHash(""), null);
  const state = stateFromHash("#view=unknown&window=999&pool=other&lang=other&page=-3&sort=random&secret=discard");
  assert.deepEqual(state, DEFAULT_STATE);
  assert.equal(Object.hasOwn(state, "secret"), false);
});

test("saved state validates calendar dates rather than accepting JavaScript date overflow", () => {
  for (const bad of ["2026-02-30", "2025-02-29", "2026-13-01", "2026-01-00", "03/09/2026", "2026-9-3", "not-a-date"]) {
    const state = sanitizeState({ dateFrom: bad, dateTo: bad });
    assert.notEqual(state.dateFrom, bad);
    assert.notEqual(state.dateTo, bad);
  }
  const leap = sanitizeState({ dateFrom: "2024-02-29", dateTo: "2024-03-01" });
  assert.equal(leap.dateFrom, "2024-02-29");
  assert.equal(leap.dateTo, "2024-03-01");
});

test("reversed custom range remains invalid through a share-link round trip", () => {
  const state = stateFromHash(stateToHash({ window: "custom", dateFrom: "2026-09-03", dateTo: "2026-08-01" }));
  assert.throws(() => selectRange([], state), /Start date must not be after end date/);
});

test("corrupt shared calendar dates fail visibly rather than expanding a custom sample", () => {
  const state=stateFromHash('#view=hot&window=custom&dateFrom=2026-02-30');
  assert.throws(()=>selectRange([['03/09/2026',1,2,3,4,5,6,7,1]],state),/Invalid date range/);
  assert.throws(()=>selectRange([],stateFromHash(stateToHash(state))),/Invalid date range/);
});

test("duplicate saved identifiers cannot cause deleting one preset to delete another", () => {
  const presets=sanitizePresets([{id:'same',name:'first'},{id:'same',name:'second'},{id:'same-1',name:'third'}]);
  assert.equal(new Set(presets.map(p=>p.id)).size,3);
  assert.equal(presets.filter(p=>p.id!==presets[0].id).length,2);
});

test("page values are bounded and malformed stored primitives recover safely", () => {
  assert.equal(sanitizeState({ page: "4" }).page, 4);
  assert.equal(sanitizeState({ page: "Infinity" }).page, 1);
  assert.equal(sanitizeState({ page: 1.5 }).page, 1);
  assert.equal(sanitizeState({ page: -1 }).page, 1);
  assert.equal(sanitizeState({ page: 10 ** 9 }).page, 100000);
  assert.deepEqual(sanitizeState(null), DEFAULT_STATE);
  assert.deepEqual(sanitizeState("corrupt stored value"), DEFAULT_STATE);
  assert.equal(sanitizeState({ window: 50 }).window, "50");
});

test("watchlist normalizes duplicates independently for each pool without mutating input", () => {
  const input = Object.freeze({ main: Object.freeze([35, 1, 1, 0, 36, 2.5, "2", null]), pb: Object.freeze([20, 1, 1, 21, -1]) });
  assert.deepEqual(sanitizeWatchlist(input), { main: [1, 35], pb: [1, 20] });
  assert.deepEqual(sanitizeWatchlist(null), { main: [], pb: [] });
  assert.deepEqual(sanitizeWatchlist({ main: "1,2", pb: {} }), { main: [], pb: [] });
  assert.equal(input.main.length, 8);
});

test("presets discard unusable entries, bound storage size, and sanitize saved analysis conditions", () => {
  const entries = [null, { name: " " }, { name: 123 }, ...Array.from({ length: 14 }, (_, index) => ({ id: `preset-${index}`, name: `Analysis ${index}`, state: { view: "charts", window: "all", pool: "pb", lang: "en", page: -3 } }))];
  const presets = sanitizePresets(entries);
  assert.equal(presets.length, 10);
  assert.equal(presets[0].name, "Analysis 0");
  assert.equal(presets[0].state.view, "charts");
  assert.equal(presets[0].state.window, "all");
  assert.equal(presets[0].state.page, 1);
  assert.equal(sanitizePresets([{ name: "x".repeat(70), state: null }])[0].name.length, 40);
  assert.deepEqual(sanitizePresets("invalid"), []);
  assert.equal(entries.length, 17);
});

test("storage failures return recoverable fallbacks and never block viewing the site", (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  t.after(() => { if (previous) Object.defineProperty(globalThis, "localStorage", previous); else delete globalThis.localStorage; });
  const values = new Map();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value)
  } });
  assert.equal(writeStorage("state", { view: "charts" }), true);
  assert.deepEqual(readStorage("state", {}), { view: "charts" });
  values.set("state", "broken json");
  assert.deepEqual(readStorage("state", DEFAULT_STATE), DEFAULT_STATE);
  assert.deepEqual(readStorage("absent", DEFAULT_STATE), DEFAULT_STATE);
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem() { throw new Error("Storage blocked"); },
    setItem() { throw new Error("Quota exceeded"); }
  } });
  assert.deepEqual(readStorage("state", DEFAULT_STATE), DEFAULT_STATE);
  assert.equal(writeStorage("state", DEFAULT_STATE), false);
});
