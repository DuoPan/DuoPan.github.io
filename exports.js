import { dateISO, drawStats, frequency, missingStats, pairStats, trendStats } from "./analytics.js";
import { getGame, poolSize, poolRate } from "./games.js";

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

const drawColumns = (game) => [
  "date", ...Array.from({ length: game.mainCount }, (_, index) => `ball_${index + 1}`),
  ...(game.id === "powerball" ? ["powerball"] : Array.from({ length: game.extraCount }, (_, index) => `supplementary_${index + 1}`)),
  "sum", "average", "odd", "even", `low_1_${game.lowMax}`, `high_${game.lowMax + 1}_${game.mainSize}`, "span", "max_run", "median", "population_sd"
];
const drawRecord = (row, game) => {
  const stats = drawStats(row, game);
  return [dateISO(row[0]), ...row.slice(1, 1 + game.mainCount + game.extraCount).map(Number), stats.sum, stats.average, stats.odds, stats.evens, stats.low, stats.high, stats.span, stats.maxRun, stats.median, stats.sd];
};

/** Export the full selected sample, never the current UI page. Rates use fractions. */
export const buildExport = ({ view = "history", data = [], asOfData = data, pool = "main", game = "powerball" } = {}) => {
  const config = getGame(game);
  poolSize(pool, config);
  if (!/^[a-z][a-z0-9_-]*$/i.test(view)) throw new RangeError("Invalid analysis view.");
  const range = extent(data);
  const history = extent(asOfData);
  const metaColumns = ["analysis_view", "range_start", "range_end", "range_draws", "as_of_date", "as_of_draws"];
  const metaValues = [view, range.start, range.end, data.length, history.end, asOfData.length];
  if (config.id !== "powerball") {
    metaColumns.push("game");
    metaValues.push(config.id);
  }
  let columns;
  let records;

  if (view === "hot") {
    columns = ["number", "pool", "count", "rate_fraction", "sample_draws", "theoretical_rate_fraction"];
    records = frequency(data, pool, config).map((item) => [item.number, pool, item.count, item.rate, data.length, poolRate(pool, config)]);
  } else if (view === "missing") {
    columns = ["number", "pool", "current_missing_draws", "missing_is_lower_bound", "last_seen_date", "max_completed_gap_draws", "history_start", "history_draws"];
    records = missingStats(asOfData, pool, config).map((item) => [item.number, pool, item.missing, item.bounded, dateISO(item.lastDate), item.maxMissing, history.start, asOfData.length]);
  } else if (view === "trend") {
    columns = ["number", "pool", "last_10_count", "last_10_rate_fraction", "last_10_sample_draws", "previous_10_count", "previous_10_rate_fraction", "previous_10_sample_draws", "change_percentage_points", "last_20_count", "last_20_rate_fraction", "last_20_sample_draws", "last_50_count", "last_50_rate_fraction", "last_50_sample_draws"];
    const comparison = trendStats(data, pool, 10, config);
    const last20 = frequency(data.slice(0, 20), pool, config);
    const last50 = frequency(data.slice(0, 50), pool, config);
    records = comparison.items.map((item, index) => [
      item.number, pool, item.count, item.rate, comparison.recentSize,
      item.previousCount, item.previousRate, comparison.previousSize, item.delta,
      last20[index].count, last20[index].rate, Math.min(data.length, 20),
      last50[index].count, last50[index].rate, Math.min(data.length, 50)
    ]);
  } else if (view === "pairs") {
    columns = ["number_a", "number_b", "pool", "count", "rate_fraction", "expected_count", "sample_draws"];
    records = pairStats(data, config).map((item) => [item.a, item.b, "main", item.count, item.rate, item.expected, data.length]);
  } else {
    columns = drawColumns(config);
    records = data.map((row) => drawRecord(row, config));
  }

  const lines = [[...columns, ...metaColumns].map(csvCell).join(",")];
  records.forEach((record) => { lines.push([...record, ...metaValues].map(csvCell).join(",")); });
  return {
    csv: `\uFEFF${lines.join("\r\n")}\r\n`,
    filename: `${config.id}-${view}-${["hot","missing","trend"].includes(view)?pool:view==="pairs"?"main":"all"}-${range.end || history.end || "empty"}.csv`
  };
};
