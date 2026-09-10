const POOL_SIZE = { main: 35, pb: 20 };

const poolSize = (pool) => {
  if (!Object.hasOwn(POOL_SIZE, pool)) throw new RangeError(`Unknown number pool: ${pool}`);
  return POOL_SIZE[pool];
};

const numbersFor = (row, pool) => pool === "pb" ? [Number(row[8])] : row.slice(1, 8).map(Number);

/** Parse a calendar date without accepting JavaScript's overflow-date coercion. */
export const parseDate = (value) => {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime()) || value.getUTCFullYear() < 1 || value.getUTCFullYear() > 9999) return null;
    const result = new Date(0);
    result.setUTCFullYear(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
    result.setUTCHours(0, 0, 0, 0);
    return result;
  }
  if (typeof value !== "string") return null;
  const text = value.trim();
  let year;
  let month;
  let day;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (iso) [, year, month, day] = iso.map(Number);
  else if (slash) [, day, month, year] = slash.map(Number);
  else return null;
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const result = new Date(0);
  result.setUTCFullYear(year, month - 1, day);
  result.setUTCHours(0, 0, 0, 0);
  if (result.getUTCFullYear() !== year || result.getUTCMonth() !== month - 1 || result.getUTCDate() !== day) return null;
  return result;
};

export const dateISO = (value) => {
  const date = parseDate(value);
  return date ? date.toISOString().slice(0, 10) : "";
};

const displayDate = (date) => `${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${String(date.getUTCFullYear()).padStart(4, "0")}`;

/** Legacy two-digit years are accepted only at this import boundary. */
export const normalizeRows = (rows) => {
  if (!Array.isArray(rows)) throw new TypeError("Draw data must be an array.");
  const dates = new Set();
  const normalized = rows.map((row, index) => {
    const fail = (message) => { throw new Error(`Draw ${index + 1}: ${message}`); };
    if (!Array.isArray(row) || row.length !== 9) fail("expected a date, seven main numbers and one Powerball.");
    let dateText = row[0];
    if (typeof dateText === "string") dateText = dateText.trim().replace(/^(\d{1,2}\/\d{1,2}\/)(\d{2})$/, (_, prefix, year) => `${prefix}20${year}`);
    const date = parseDate(dateText);
    if (!date) fail("invalid calendar date.");
    const iso = dateISO(date);
    if (dates.has(iso)) fail(`duplicate draw date ${iso}.`);
    dates.add(iso);
    const balls = row.slice(1).map((value, position) => {
      if (typeof value !== "number" && (typeof value !== "string" || !/^\d+$/.test(value.trim()))) fail("numbers must be integers.");
      const number = Number(value);
      const limit = position === 7 ? 20 : 35;
      if (!Number.isInteger(number) || number < 1 || number > limit) fail(`number outside 1–${limit}.`);
      return number;
    });
    const main = balls.slice(0, 7);
    if (new Set(main).size !== 7) fail("main numbers must be unique.");
    main.sort((a, b) => a - b);
    return { time: date.getTime(), row: [displayDate(date), ...main, balls[7]] };
  });
  return normalized.sort((a, b) => b.time - a.time).map(({ row }) => row);
};

/** Inputs are normalized, newest first. Omission history extends to the cutoff. */
export const selectRange = (rows, options = {}) => {
  const { window = "100", dateFrom = "", dateTo = "" } = options;
  if (window !== "custom") {
    if (window === "all") return { data: [...rows], asOfData: [...rows] };
    if (!["10", "20", "50", "100", "300"].includes(String(window))) throw new RangeError("Unsupported draw window.");
    return { data: rows.slice(0, Number(window)), asOfData: [...rows] };
  }
  const from = dateFrom ? parseDate(dateFrom) : null;
  const to = dateTo ? parseDate(dateTo) : null;
  if ((dateFrom && !from) || (dateTo && !to)) throw new RangeError("Invalid date range.");
  if (from && to && from > to) throw new RangeError("Start date must not be after end date.");
  const asOfData = rows.filter((row) => !to || parseDate(row[0]) <= to);
  return { data: asOfData.filter((row) => !from || parseDate(row[0]) >= from), asOfData };
};

export const frequency = (rows, pool = "main") => {
  const items = Array.from({ length: poolSize(pool) }, (_, index) => ({ number: index + 1, count: 0, rate: 0 }));
  rows.forEach((row) => numbersFor(row, pool).forEach((number) => { items[number - 1].count += 1; }));
  items.forEach((item) => { item.rate = rows.length ? item.count / rows.length : 0; });
  return items;
};

export const missingStats = (rows, pool = "main") => {
  const positions = Array.from({ length: poolSize(pool) }, () => []);
  rows.forEach((row, index) => numbersFor(row, pool).forEach((number) => positions[number - 1].push(index)));
  return positions.map((seen, index) => {
    let maxMissing = null;
    for (let i = 1; i < seen.length; i += 1) maxMissing = Math.max(maxMissing ?? 0, seen[i] - seen[i - 1] - 1);
    return {
      number: index + 1,
      missing: seen.length ? seen[0] : rows.length,
      lastDate: seen.length ? rows[seen[0]][0] : null,
      bounded: seen.length === 0,
      maxMissing
    };
  });
};

export const drawStats = (row) => {
  if (!row) return null;
  const numbers = row.slice(1, 8).map(Number).sort((a, b) => a - b);
  const sum = numbers.reduce((total, number) => total + number, 0);
  const average = sum / numbers.length;
  const odds = numbers.filter((number) => number % 2 === 1).length;
  const low = numbers.filter((number) => number <= 17).length;
  const buckets = [0, 0, 0, 0];
  let maxRun = 1;
  let run = 1;
  numbers.forEach((number, index) => {
    buckets[Math.min(Math.floor((number - 1) / 10), 3)] += 1;
    if (index) run = number === numbers[index - 1] + 1 ? run + 1 : 1;
    maxRun = Math.max(maxRun, run);
  });
  return {
    sum, average, odds, evens: numbers.length - odds, low, high: numbers.length - low,
    buckets, span: numbers.at(-1) - numbers[0], maxRun,
    median: numbers[Math.floor(numbers.length / 2)],
    sd: Math.sqrt(numbers.reduce((total, number) => total + (number - average) ** 2, 0) / numbers.length)
  };
};

/** Rates are fractions; delta is percentage points and needs two nonempty samples. */
export const trendStats = (rows, pool = "main", windowSize = 10) => {
  if (!Number.isInteger(windowSize) || windowSize < 1) throw new RangeError("Trend window must be a positive integer.");
  const recent = rows.slice(0, windowSize);
  const previous = rows.slice(windowSize, windowSize * 2);
  const currentCounts = frequency(recent, pool);
  const previousCounts = frequency(previous, pool);
  return {
    windowSize, recentSize: recent.length, previousSize: previous.length,
    items: currentCounts.map((item, index) => ({
      ...item,
      previousCount: previousCounts[index].count,
      previousRate: previous.length ? previousCounts[index].rate : null,
      delta: recent.length && previous.length ? (item.rate - previousCounts[index].rate) * 100 : null
    }))
  };
};

export const pairStats = (rows) => {
  const expected = (7 * 6 / (35 * 34)) * rows.length;
  const items = [];
  const lookup = new Map();
  for (let a = 1; a <= 35; a += 1) {
    for (let b = a + 1; b <= 35; b += 1) {
      const item = { a, b, count: 0, rate: 0, expected };
      lookup.set(`${a},${b}`, item);
      items.push(item);
    }
  }
  rows.forEach((row) => {
    const numbers = row.slice(1, 8).map(Number).sort((a, b) => a - b);
    for (let i = 0; i < numbers.length; i += 1) {
      for (let j = i + 1; j < numbers.length; j += 1) lookup.get(`${numbers[i]},${numbers[j]}`).count += 1;
    }
  });
  items.forEach((item) => { item.rate = rows.length ? item.count / rows.length : 0; });
  return items;
};
