// Powerball's current seven-from-35 format started with draw 1144.
export const RULE_START = "2018-04-19";
export const FIRST_DRAW_NUMBER = 1144;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function parseDrawDate(value) {
  if (typeof value !== "string" || !/^\d{1,2}\/\d{1,2}\/(?:\d{2}|\d{4})$/.test(value)) {
    throw new Error(`Invalid draw date: ${String(value)}`);
  }
  let [day, month, year] = value.split("/").map(Number);
  if (year < 100) year += 2000;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`Invalid calendar date: ${value}`);
  }
  return date;
}

export const isoDate = (value) => parseDrawDate(value).toISOString().slice(0, 10);
export const displayDate = (date) => `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`;

function numberInRange(value, min, max, label) {
  if ((typeof value !== "number" && typeof value !== "string") || !/^\d+$/.test(String(value))) {
    throw new Error(`${label} must be an integer`);
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) {
    throw new Error(`${label} must be between ${min} and ${max}`);
  }
  return number;
}

export function normalizeRow(row, { now = new Date() } = {}) {
  if (!Array.isArray(row) || row.length !== 9) throw new Error("Each draw must contain a date, seven main numbers and one Powerball");
  const date = parseDrawDate(row[0]);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const iso = date.toISOString().slice(0, 10);
  if (iso < RULE_START) throw new Error(`Draw ${row[0]} predates the current Powerball rules`);
  if (iso > today) throw new Error(`Future draw date: ${row[0]}`);
  if (date.getUTCDay() !== 4) throw new Error(`Draw date is not Thursday: ${row[0]}`);
  const main = row.slice(1, 8).map((n) => numberInRange(n, 1, 35, "Main number")).sort((a, b) => a - b);
  if (new Set(main).size !== 7) throw new Error(`Duplicate main number in draw ${row[0]}`);
  const pb = numberInRange(row[8], 1, 20, "Powerball");
  return [displayDate(date), ...main, pb];
}

export function validateRows(data, { now = new Date(), requireCanonical = false, requireFullHistory = false } = {}) {
  if (!Array.isArray(data) || data.length === 0) throw new Error("Draw dataset must not be empty");
  const rows = data.map((row) => normalizeRow(row, { now }));
  const dates = new Set();
  for (const row of rows) {
    if (dates.has(row[0])) throw new Error(`Duplicate draw date: ${row[0]}`);
    dates.add(row[0]);
  }
  rows.sort((a, b) => parseDrawDate(b[0]) - parseDrawDate(a[0]));
  for (let i = 1; i < rows.length; i += 1) {
    if (parseDrawDate(rows[i - 1][0]) - parseDrawDate(rows[i][0]) !== WEEK_MS) {
      throw new Error(`Missing weekly draw between ${rows[i][0]} and ${rows[i - 1][0]}`);
    }
  }
  if (requireFullHistory && isoDate(rows.at(-1)[0]) !== RULE_START) throw new Error(`History must include the first current-rule draw on ${RULE_START}`);
  if (requireCanonical && JSON.stringify(data) !== JSON.stringify(rows)) throw new Error("Dataset must use DD/MM/YYYY, numeric values, ascending main numbers and newest-first rows");
  return rows;
}

export function serializeDatabase(rows) {
  return `// Australian Powerball: current rules from ${RULE_START}.\n// Official results: https://www.lotterywest.wa.gov.au/results/frequency-charts\nexport default [\n${rows.map((row) => `  ${JSON.stringify(row)}`).join(",\n")}\n];\n`;
}

// Read the data literal without evaluating JavaScript from a file or network.
export function parseDatabase(source) {
  const literal = source.replace(/^\s*\/\/[^\n]*(?:\n|$)/gm, "").trim();
  const match = literal.match(/^export\s+default\s+(\[[\s\S]*\])\s*;?$/);
  if (!match) throw new Error("Expected a db.js default array export");
  return JSON.parse(match[1].replace(/,\s*\]/g, "]"));
}
