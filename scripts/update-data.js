import { readFile, writeFile, rename, rm } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseDrawDate, isoDate, normalizeRow, validateRows, parseDatabase, serializeDatabase } from "./data-utils.js";
import { GAMES, getGame, expectedLatestDrawISO } from "../games.js";

// Compatibility exports for existing Powerball callers.
export const SOURCE_NAME = "Lotterywest — official Powerball results";
export const SOURCE_URL = "https://www.lotterywest.wa.gov.au/results/frequency-charts";
export const CSV_URL = "https://www.lotterywest.wa.gov.au/api/games/5132/results-csv";

/** Results are due by noon on the day following the draw in Sydney local time. */
export function expectedLatestDrawDate(now = new Date(), { game = "powerball" } = {}) {
  return expectedLatestDrawISO(now, game);
}

export function assertSourceFreshness(rows, now = new Date(), { game = "powerball" } = {}) {
  const config = getGame(game);
  const expected = expectedLatestDrawDate(now, { game: config });
  const latest = rows.length ? isoDate(rows[0][0]) : null;
  if (!latest || latest < expected) {
    const dueDay = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][config.dueDay];
    throw new Error(`Official source is stale: latest ${latest || "unavailable"}; expected at least ${expected} after the Sydney ${dueDay} 12:00 publication deadline`);
  }
}

export function parseCsv(text) {
  if (typeof text !== "string") throw new Error("CSV response must be text");
  const rows = [];
  let row = [], field = "", quoted = false, closed = false;
  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') { quoted = false; closed = true; }
      else field += char;
      continue;
    }
    if (char === '"') {
      if (field || closed) throw new Error("Malformed CSV quotation");
      quoted = true;
    } else if (char === ",") { row.push(field); field = ""; closed = false; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i += 1;
      row.push(field);
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = []; field = ""; closed = false;
    } else {
      if (closed) throw new Error("Unexpected text after quoted CSV field");
      field += char;
    }
  }
  if (quoted) throw new Error("Unclosed CSV quotation");
  if (field || row.length || closed) { row.push(field); rows.push(row); }
  return rows;
}

export function parseLotterywestCsv(text, { now = new Date(), game = "powerball" } = {}) {
  const config = getGame(game);
  const [header, ...rawRows] = parseCsv(text);
  const required = ["Draw number", "Draw date", ...Array.from({ length: config.mainCount }, (_, i) => `Winning Number ${i + 1}`), ...(config.extraCount === 1 ? ["Powerball Number"] : Array.from({ length: config.extraCount }, (_, i) => `Supplementary Number ${i + 1}`))];
  if (!header || required.some((name, i) => header[i] !== name)) throw new Error("Lotterywest CSV header changed or response is not a results CSV");
  const draws = [], numbers = new Set(), dates = new Set();
  for (const cells of rawRows) {
    if (cells.length < 2) throw new Error("Incomplete CSV draw row");
    const date = parseDrawDate(cells[1]);
    if (date.toISOString().slice(0, 10) < config.historyStart) continue;
    if (cells.length < required.length) throw new Error(`Incomplete CSV draw row for ${cells[1]}`);
    if (!/^\d+$/.test(cells[0])) throw new Error("Invalid official draw number");
    const drawNumber = Number(cells[0]);
    const expectedNumber = config.firstDrawNumber + (date - new Date(`${config.firstDate}T00:00:00Z`)) / 604800000;
    if (drawNumber !== expectedNumber) throw new Error(`Draw number/date mismatch: ${drawNumber} on ${cells[1]}`);
    const row = normalizeRow(cells.slice(1, required.length), { now, game: config });
    if (numbers.has(drawNumber) || dates.has(row[0])) throw new Error(`Duplicate official draw: ${drawNumber}`);
    numbers.add(drawNumber); dates.add(row[0]);
    draws.push({ drawNumber, row });
  }
  validateRows(draws.map((draw) => draw.row), { now, game: config, requireFullHistory: true });
  return draws.sort((a, b) => b.drawNumber - a.drawNumber);
}

export function mergeDraws(existing, incoming, { now = new Date(), game = "powerball" } = {}) {
  const config = getGame(game);
  const current = existing.length ? validateRows(existing, { now, game: config, requireFullHistory: true }) : [];
  const fresh = validateRows(incoming, { now, game: config, requireFullHistory: true });
  if (current.length && parseDrawDate(fresh[0][0]) < parseDrawDate(current[0][0])) throw new Error("Source is older than the saved dataset; refusing stale replacement");
  const byDate = new Map(current.map((row) => [row[0], row]));
  for (const row of fresh) {
    const old = byDate.get(row[0]);
    if (old && JSON.stringify(old) !== JSON.stringify(row)) throw new Error(`Official result conflicts with saved draw ${row[0]}; review before correcting history`);
    byDate.set(row[0], row);
  }
  assertSourceFreshness(fresh, now, { game: config });
  return validateRows([...byDate.values()], { now, game: config, requireFullHistory: true });
}

export async function fetchOfficialDraws({ fetchImpl = fetch, now = new Date(), game = "powerball" } = {}) {
  const config = getGame(game);
  const response = await fetchImpl(`https://www.lotterywest.wa.gov.au/api/games/${config.csvGameId}/results-csv`, { headers: { Accept: "text/csv" }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Lotterywest download failed (HTTP ${response.status})`);
  const type = response.headers.get("content-type") || "";
  if (!/text\/(?:csv|plain)|application\/(?:csv|octet-stream)/i.test(type)) throw new Error(`Unexpected results content type: ${type}`);
  const text = await response.text();
  if (text.length > 5_000_000) throw new Error("Results response exceeds the expected size");
  return parseLotterywestCsv(text, { now, game: config }).map((draw) => draw.row);
}

export async function atomicWrite(path, text) {
  const temp = `${path}.${randomUUID()}.tmp`;
  try { await writeFile(temp, text, "utf8"); await rename(temp, path); }
  finally { await rm(temp, { force: true }); }
}

export async function updateData({ root = resolve(dirname(fileURLToPath(import.meta.url)), ".."), fetchImpl = fetch, now = new Date(), writeAtomic = atomicWrite, game = "powerball" } = {}) {
  const config = getGame(game);
  const dbPath = resolve(root, config.dbFile), statusPath = resolve(root, config.statusFile);
  const sourceName = `Lotterywest — official ${config.name} results`;
  const attempt = now.toISOString();
  let original, previous = {}, existing = [], wroteDatabase = false;
  try {
    try {
      original = await readFile(dbPath, "utf8");
      existing = validateRows(parseDatabase(original), { now, game: config, requireFullHistory: true });
    } catch (error) { if (error.code !== "ENOENT") throw error; }
    try {
      const loaded = JSON.parse(await readFile(statusPath, "utf8"));
      if (!loaded || typeof loaded !== "object" || Array.isArray(loaded)) throw new Error("Saved synchronization status must be an object");
      previous = loaded;
    } catch (error) { if (error.code !== "ENOENT") throw error; }
    const fetched = await fetchOfficialDraws({ fetchImpl, now, game: config });
    const rows = mergeDraws(existing, fetched, { now, game: config });
    const serialized = serializeDatabase(rows, { game: config });
    const added = rows.length - existing.length;
    const status = {
      sourceName, sourceUrl: config.sourceUrl, lastAttemptAt: attempt,
      lastSuccessAt: attempt, latestDrawDate: isoDate(rows[0][0]), status: "ok",
      message: `Verified ${rows.length} draws against official results; added ${added} draws.`, totalDraws: rows.length
    };
    if (serialized !== original) { await writeAtomic(dbPath, serialized); wroteDatabase = true; }
    await writeAtomic(statusPath, `${JSON.stringify(status, null, 2)}\n`);
    return { rows, status, changed: serialized !== original };
  } catch (error) {
    if (wroteDatabase) {
      if (original !== undefined) await writeAtomic(dbPath, original);
      else await rm(dbPath, { force: true });
    }
    const status = {
      sourceName, sourceUrl: config.sourceUrl, lastAttemptAt: attempt,
      lastSuccessAt: previous.lastSuccessAt || null,
      latestDrawDate: existing.length ? isoDate(existing[0][0]) : (previous.latestDrawDate || null),
      status: "error", message: String(error.message).slice(0, 400),
      totalDraws: existing.length || previous.totalDraws || 0
    };
    await writeAtomic(statusPath, `${JSON.stringify(status, null, 2)}\n`);
    throw error;
  }
}

// Attempt every game before failing the overall Actions job. Each game's saved
// data, status and last-success timestamp remain independent of other failures.
export async function updateAllData(options = {}) {
  const games = options.game ? [getGame(options.game)] : Object.values(GAMES);
  const results = [], errors = [];
  for (const game of games) {
    try { results.push({ game: game.id, ...await updateData({ ...options, game }) }); }
    catch (error) { errors.push(new Error(`${game.name}: ${error.message}`, { cause: error })); }
  }
  if (errors.length) {
    const failure = new AggregateError(errors, errors.map((error) => error.message).join("; "));
    failure.results = results;
    throw failure;
  }
  return results;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const gameArg = args.find((arg) => arg.startsWith("--game="));
  const options = gameArg ? { game: gameArg.slice("--game=".length) } : {};
  if (args.some((arg) => arg !== gameArg) || (gameArg && !options.game)) {
    console.error("Usage: node scripts/update-data.js [--game=powerball|ozlotto]");
    process.exitCode = 1;
  } else {
    updateAllData(options).then((results) => results.forEach(({ game, status }) => console.log(`${game}: ${status.message} Latest: ${status.latestDrawDate}`))).catch((error) => { console.error(`Update failed; saved draws retained: ${error.message}`); process.exitCode = 1; });
  }
}
