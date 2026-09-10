import { dateISO, drawStats, frequency, missingStats, pairStats, trendStats } from "./analytics.js";

/** Preserve numeric negatives while preventing text cells from becoming spreadsheet formulas. */
export const csvCell = (value) => {
  if (value == null) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  let text = String(value);
  if (/^\s*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const extent = (rows) => {
  const dates = rows.map((row) => dateISO(row[0])).filter(Boolean).sort();
  return { start: dates[0] || "", end: dates.at(-1) || "" };
};

const drawColumns = ["date", "ball_1", "ball_2", "ball_3", "ball_4", "ball_5", "ball_6", "ball_7", "powerball", "sum", "average", "odd", "even", "low_1_17", "high_18_35", "span", "max_run", "median", "population_sd"];
const drawRecord = (row) => {
  const stats = drawStats(row);
  return [dateISO(row[0]), ...row.slice(1, 9).map(Number), stats.sum, stats.average, stats.odds, stats.evens, stats.low, stats.high, stats.span, stats.maxRun, stats.median, stats.sd];
};

/** Export the full selected sample, never the current UI page. Rates use fractions. */
export const buildExport = ({ view = "history", data = [], asOfData = data, pool = "main" } = {}) => {
  if (!["main", "pb"].includes(pool)) throw new RangeError("Unknown number pool.");
  if (!/^[a-z][a-z0-9_-]*$/i.test(view)) throw new RangeError("Invalid analysis view.");
  const range = extent(data);
  const history = extent(asOfData);
  const metaColumns = ["analysis_view", "range_start", "range_end", "range_draws", "as_of_date", "as_of_draws"];
  const metaValues = [view, range.start, range.end, data.length, history.end, asOfData.length];
  let columns;
  let records;

  if (view === "hot") {
    columns = ["number", "pool", "count", "rate_fraction", "sample_draws", "theoretical_rate_fraction"];
    records = frequency(data, pool).map((item) => [item.number, pool, item.count, item.rate, data.length, pool === "main" ? 7 / 35 : 1 / 20]);
  } else if (view === "missing") {
    columns = ["number", "pool", "current_missing_draws", "missing_is_lower_bound", "last_seen_date", "max_completed_gap_draws", "history_start", "history_draws"];
    records = missingStats(asOfData, pool).map((item) => [item.number, pool, item.missing, item.bounded, dateISO(item.lastDate), item.maxMissing, history.start, asOfData.length]);
  } else if (view === "trend") {
    columns = ["number", "pool", "last_10_count", "last_10_rate_fraction", "last_10_sample_draws", "previous_10_count", "previous_10_rate_fraction", "previous_10_sample_draws", "change_percentage_points", "last_20_count", "last_20_rate_fraction", "last_20_sample_draws", "last_50_count", "last_50_rate_fraction", "last_50_sample_draws"];
    const comparison = trendStats(data, pool, 10);
    const last20 = frequency(data.slice(0, 20), pool);
    const last50 = frequency(data.slice(0, 50), pool);
    records = comparison.items.map((item, index) => [
      item.number, pool, item.count, item.rate, comparison.recentSize,
      item.previousCount, item.previousRate, comparison.previousSize, item.delta,
      last20[index].count, last20[index].rate, Math.min(data.length, 20),
      last50[index].count, last50[index].rate, Math.min(data.length, 50)
    ]);
  } else if (view === "pairs") {
    columns = ["number_a", "number_b", "pool", "count", "rate_fraction", "expected_count", "sample_draws"];
    records = pairStats(data).map((item) => [item.a, item.b, "main", item.count, item.rate, item.expected, data.length]);
  } else {
    columns = drawColumns;
    records = data.map(drawRecord);
  }

  const lines = [[...columns, ...metaColumns].map(csvCell).join(",")];
  records.forEach((record) => { lines.push([...record, ...metaValues].map(csvCell).join(",")); });
  return {
    csv: `\uFEFF${lines.join("\r\n")}\r\n`,
    filename: `powerball-${view}-${["hot","missing","trend"].includes(view)?pool:view==="pairs"?"main":"all"}-${range.end || history.end || "empty"}.csv`
  };
};
