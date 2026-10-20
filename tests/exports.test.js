import test from "node:test";
import assert from "node:assert/strict";
import { buildExport, csvCell } from "../exports.js";
import { normalizeRows, selectRange } from "../analytics.js";

const draw = (date, main = [1, 2, 3, 4, 5, 6, 7], pb = 1) => [date, ...main, pb];
// App exports contain normalized numbers and dates; quote behavior is checked separately below.
const parseExport = (csv) => {
  const [header, ...lines] = csv.replace(/^\uFEFF/, "").trimEnd().split("\r\n");
  const columns = header.split(",");
  return { columns, rows: lines.map((line) => Object.fromEntries(line.split(",").map((value, index) => [columns[index], value]))) };
};

test("history export includes the entire range, structure and self-contained date metadata", () => {
  const data = normalizeRows(Array.from({ length: 75 }, (_, index) => draw(new Date(Date.UTC(2024, 0, 4 + index * 7)).toISOString().slice(0, 10), undefined, 20)));
  const before = JSON.stringify(data);
  const result = buildExport({ view: "history", data });
  assert.ok(result.csv.startsWith("\uFEFF"));
  assert.equal(result.filename, "powerball-history-all-2025-06-05.csv");
  assert.equal(buildExport({view:'history',data,pool:'pb'}).filename,result.filename);
  const { rows } = parseExport(result.csv);
  assert.equal(rows.length, 75);
  assert.equal(rows[0].date, "2025-06-05");
  assert.equal(rows[0].powerball, "20");
  assert.equal(rows[0].sum, "28");
  assert.equal(rows[0].median, "4");
  assert.equal(rows[0].population_sd, "2");
  assert.equal(rows[0].range_start, "2024-01-04");
  assert.equal(rows[0].range_end, "2025-06-05");
  assert.equal(rows[0].range_draws, "75");
  assert.equal(rows[0].as_of_draws, "75");
  assert.equal(rows.at(-1).date, "2024-01-04");
  assert.equal(JSON.stringify(data), before);
});

test("main and PB frequency exports include absent numbers and use draw denominators", () => {
  const data = [draw("12/03/2026", undefined, 20), draw("05/03/2026", [1, 8, 9, 10, 11, 12, 13], 20)];
  const main = parseExport(buildExport({ view: "hot", data }).csv).rows;
  const pb = parseExport(buildExport({ view: "hot", data, pool: "pb" }).csv).rows;
  assert.equal(main.length, 35);
  assert.equal(pb.length, 20);
  assert.equal(main[0].count, "2");
  assert.equal(main[0].rate_fraction, "1");
  assert.equal(main[1].rate_fraction, "0.5");
  assert.equal(main[19].count, "0");
  assert.equal(main[0].theoretical_rate_fraction, "0.2");
  assert.equal(pb[19].rate_fraction, "1");
  assert.equal(pb[19].sample_draws, "2");
  assert.equal(pb[19].theoretical_rate_fraction, "0.05");
});

test("omission export uses cutoff history beyond the selected range without future leakage", () => {
  const source = normalizeRows([
    draw("2026-01-01", undefined, 1),
    draw("2026-01-08", [2, 3, 4, 5, 6, 7, 8], 2),
    draw("2026-01-15", [2, 3, 4, 5, 6, 7, 8], 2),
    draw("2026-01-22", undefined, 1)
  ]);
  const range = selectRange(source, { window: "custom", dateFrom: "2026-01-15", dateTo: "2026-01-15" });
  for (const pool of ["main", "pb"]) {
    const { rows } = parseExport(buildExport({ view: "missing", ...range, pool }).csv);
    assert.equal(rows[0].current_missing_draws, "2");
    assert.equal(rows[0].last_seen_date, "2026-01-01");
    assert.equal(rows[0].missing_is_lower_bound, "false");
    assert.equal(rows[0].max_completed_gap_draws, "");
    assert.equal(rows[0].range_draws, "1");
    assert.equal(rows[0].as_of_draws, "3");
    assert.equal(rows[0].as_of_date, "2026-01-15");
    assert.equal(rows.at(-1).missing_is_lower_bound, "true");
    assert.equal(rows.at(-1).current_missing_draws, "3");
    assert.equal(rows.at(-1).last_seen_date, "");
  }
});

test("trend export reports partial-window sizes and keeps negative deltas numeric", () => {
  const data = [
    ...Array.from({ length: 10 }, () => draw("12/03/2026", [2, 3, 4, 5, 6, 7, 8])),
    ...Array.from({ length: 2 }, () => draw("05/03/2026"))
  ];
  const { rows } = parseExport(buildExport({ view: "trend", data }).csv);
  assert.equal(rows[0].last_10_sample_draws, "10");
  assert.equal(rows[0].previous_10_sample_draws, "2");
  assert.equal(rows[0].previous_10_rate_fraction, "1");
  assert.equal(rows[0].change_percentage_points, "-100");
  assert.equal(rows[0].last_20_sample_draws, "12");
  assert.equal(Number(rows[0].last_20_rate_fraction), 2 / 12);
  assert.equal(rows[0].last_50_sample_draws, "12");
  const insufficient = parseExport(buildExport({ view: "trend", data: data.slice(0, 3), pool: "pb" }).csv).rows;
  assert.equal(insufficient.length, 20);
  assert.equal(insufficient[0].last_10_sample_draws, "3");
  assert.equal(insufficient[0].previous_10_rate_fraction, "");
  assert.equal(insufficient[0].change_percentage_points, "");
});

test("pair export contains all 595 unique combinations and expected joint occurrences", () => {
  const data = [draw("12/03/2026")];
  const { rows } = parseExport(buildExport({ view: "pairs", data }).csv);
  assert.equal(rows.length, 595);
  assert.equal(new Set(rows.map((row) => `${row.number_a},${row.number_b}`)).size, 595);
  assert.equal(rows.reduce((count, row) => count + Number(row.count), 0), 21);
  assert.equal(rows[0].rate_fraction, "1");
  assert.ok(Math.abs(Number(rows[0].expected_count) - (7 / 35) * (6 / 34)) < 1e-12);
  assert.equal(rows.at(-1).count, "0");
});

test("empty exports preserve headers and never output non-finite statistics", () => {
  for (const view of ["history", "block", "distribution", "charts", "continuous", "statistics", "pb", "contact", "hot", "missing", "trend", "pairs"]) {
    const result = buildExport({ view, data: [] });
    const { columns, rows } = parseExport(result.csv);
    const poolLabel=['hot','missing','trend','pairs'].includes(view)?'main':'all';
    assert.equal(result.filename, `powerball-${view}-${poolLabel}-empty.csv`);
    assert.ok(columns.includes("range_draws"));
    assert.doesNotMatch(result.csv, /NaN|Infinity/);
    if (["hot", "missing", "trend"].includes(view)) assert.equal(rows.length, 35);
    else if (view === "pairs") assert.equal(rows.length, 595);
    else assert.equal(rows.length, 0);
  }
});

test("CSV cells escape commas, quotes and line breaks and block spreadsheet formulas", () => {
  assert.equal(csvCell('a,"b"\nc'), '"a,""b""\nc"');
  for (const formula of ["=1+1", "+SUM(A1)", "-1+2", "@SUM(A1)", "  =1+1", "\t=1+1"]) assert.equal(csvCell(formula), `'${formula}`);
  assert.equal(csvCell("\n=1+1"), '"\'\n=1+1"');
  assert.equal(csvCell(-3.5), "-3.5");
  assert.equal(csvCell(0), "0");
  assert.equal(csvCell(false), "false");
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(NaN), "");
  assert.equal(csvCell(Infinity), "");
  assert.throws(() => buildExport({ pool: "../main" }));
  assert.throws(() => buildExport({ view: "../history" }));
});

const ozDraw = (date, main = [1, 2, 3, 4, 5, 6, 47], supplementary = [8, 9, 10]) => [date, ...main, ...supplementary];

test("Oz Lotto history export includes three supplementary numbers and game-specific structure columns", () => {
  const data = normalizeRows([ozDraw("2025-01-07", [1, 10, 11, 23, 24, 40, 47], [2, 3, 4])], "ozlotto");
  const result = buildExport({ data, game: "ozlotto" });
  const { columns, rows } = parseExport(result.csv);
  assert.equal(result.filename, "ozlotto-history-all-2025-01-07.csv");
  assert.ok(columns.includes("supplementary_1"));
  assert.ok(columns.includes("supplementary_2"));
  assert.ok(columns.includes("supplementary_3"));
  assert.ok(!columns.includes("powerball"));
  assert.equal(rows[0].ball_7, "47");
  assert.equal(rows[0].supplementary_1, "2");
  assert.equal(rows[0].supplementary_2, "3");
  assert.equal(rows[0].supplementary_3, "4");
  assert.equal(rows[0].low_1_23, "4");
  assert.equal(rows[0].high_24_47, "3");
  assert.equal(rows[0].sum, "156");
  assert.equal(rows[0].game, "ozlotto");
  assert.equal(rows[0].range_start, "2025-01-07");
  // Preserve the existing complete PB header for consumers of the original export.
  assert.deepEqual(parseExport(buildExport({}).csv).columns, ["date", "ball_1", "ball_2", "ball_3", "ball_4", "ball_5", "ball_6", "ball_7", "powerball", "sum", "average", "odd", "even", "low_1_17", "high_18_35", "span", "max_run", "median", "population_sd", "analysis_view", "range_start", "range_end", "range_draws", "as_of_date", "as_of_draws"]);
});

test("Oz Lotto frequency export uses independent main and supplementary theoretical rates", () => {
  const data = [ozDraw("2025-01-14"), ozDraw("2025-01-07", [2, 3, 4, 5, 6, 7, 8], [1, 9, 47])];
  for (const [pool, expected] of [["main", 7 / 47], ["supplementary", 3 / 47]]) {
    const result = buildExport({ view: "hot", data, pool, game: "ozlotto" });
    const { rows } = parseExport(result.csv);
    assert.equal(result.filename, `ozlotto-hot-${pool}-2025-01-14.csv`);
    assert.equal(rows.length, 47);
    assert.equal(rows[46].count, "1");
    assert.equal(rows[46].rate_fraction, "0.5");
    assert.equal(Number(rows[46].theoretical_rate_fraction), expected);
    assert.equal(rows[46].pool, pool);
    assert.equal(rows[46].game, "ozlotto");
  }
  assert.throws(() => buildExport({ game: "ozlotto", pool: "pb" }));
});

test("Oz Lotto omission and trend exports use all three supplementary positions", () => {
  const data = [ozDraw("2025-01-14"), ozDraw("2025-01-07", [1, 2, 3, 4, 5, 6, 7], [8, 9, 47])];
  const missing = parseExport(buildExport({ view: "missing", data: [data[0]], asOfData: data, pool: "supplementary", game: "ozlotto" }).csv).rows;
  assert.equal(missing[46].current_missing_draws, "1");
  assert.equal(missing[46].last_seen_date, "2025-01-07");
  assert.equal(missing[46].missing_is_lower_bound, "false");
  assert.equal(missing[45].current_missing_draws, "2");
  assert.equal(missing[45].missing_is_lower_bound, "true");
  const trendData = [...Array.from({ length: 10 }, () => data[0]), data[1]];
  const trend = parseExport(buildExport({ view: "trend", data: trendData, pool: "supplementary", game: "ozlotto" }).csv).rows;
  assert.equal(trend.length, 47);
  assert.equal(trend[46].last_10_count, "0");
  assert.equal(trend[46].previous_10_count, "1");
  assert.equal(trend[46].change_percentage_points, "-100");
  assert.equal(Number(trend[46].last_20_rate_fraction), 1 / 11);
});

test("Oz Lotto pair export covers 1081 main pairs with 47-ball expectations", () => {
  const data = [ozDraw("2025-01-07")];
  const result = buildExport({ view: "pairs", data, pool: "supplementary", game: "ozlotto" });
  const { rows } = parseExport(result.csv);
  assert.equal(result.filename, "ozlotto-pairs-main-2025-01-07.csv");
  assert.equal(rows.length, 1081);
  assert.equal(rows.reduce((total, row) => total + Number(row.count), 0), 21);
  assert.equal(Number(rows[0].expected_count), (7 / 47) * (6 / 46));
  assert.ok(rows.every((row) => row.pool === "main" && row.game === "ozlotto"));
  assert.equal(rows.find((row) => row.number_a === "8" && row.number_b === "9").count, "0");
});

test("empty Oz Lotto exports preserve full game headers and finite values", () => {
  for (const view of ["history", "hot", "missing", "trend", "pairs"]) {
    const result = buildExport({ view, game: "ozlotto", pool: "supplementary" });
    const { columns, rows } = parseExport(result.csv);
    assert.ok(columns.includes("game"));
    assert.doesNotMatch(result.csv, /NaN|Infinity/);
    assert.ok(result.filename.startsWith("ozlotto-"));
    assert.equal(rows.length, view === "history" ? 0 : view === "pairs" ? 1081 : 47);
    if (view === "history") assert.ok(columns.includes("supplementary_3"));
  }
});
