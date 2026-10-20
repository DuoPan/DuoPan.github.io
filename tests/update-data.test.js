import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseDrawDate, normalizeRow, validateRows, serializeDatabase, parseDatabase } from "../scripts/data-utils.js";
import { parseCsv, parseLotterywestCsv, mergeDraws, fetchOfficialDraws, updateData, updateAllData, expectedLatestDrawDate, assertSourceFreshness, atomicWrite } from "../scripts/update-data.js";

const now = new Date("2018-05-10T15:00:00Z");
const first = ["19/04/2018", 4, 5, 9, 13, 25, 32, 33, 7];
const second = ["26/04/2018", 9, 14, 15, 19, 24, 34, 35, 12];
const third = ["03/05/2018", 1, 3, 6, 16, 19, 20, 24, 13];
const header = ["Draw number", "Draw date", ...Array.from({ length: 7 }, (_, i) => `Winning Number ${i + 1}`), "Powerball Number", "Division 1 winners"].join(",");
const csv = (rows = [first, second, third]) => `${header}\r\n${rows.map((row) => [1144 + (parseDrawDate(row[0]) - parseDrawDate(first[0])) / 604800000, ...row, 0].join(",")).join("\r\n")}\r\n`;
const response = (body = csv(), status = 200, type = "text/csv") => new Response(body, { status, headers: { "content-type": type } });

test("CSV parser supports BOM, quoted commas, escaped quotes and CRLF", () => {
  assert.deepEqual(parseCsv('\uFEFFname,note\r\n"a,b","said ""yes"""\r\n'), [["name", "note"], ["a,b", 'said "yes"']]);
  assert.throws(() => parseCsv('a,"unfinished'), /Unclosed/);
  assert.throws(() => parseCsv('"a"unexpected,b'), /Unexpected/);
});

test("official CSV parsing checks schema and draw numbers and sorts main balls", () => {
  const unsorted = [first[0], ...first.slice(1, 8).reverse(), first[8]];
  assert.deepEqual(parseLotterywestCsv(csv([unsorted]), { now }), [{ drawNumber: 1144, row: first }]);
  assert.throws(() => parseLotterywestCsv("<html>unavailable</html>", { now }), /header changed/);
  assert.throws(() => parseLotterywestCsv(csv().replace("1145,", "1149,"), { now }), /mismatch/);
  assert.throws(() => parseLotterywestCsv(csv([first, first]), { now }), /Duplicate official/);
  assert.throws(() => parseLotterywestCsv(`${header}\n`, { now }), /must not be empty/);
});

test("CSV omits older rule formats without interpreting their five or six balls", () => {
  const old = "1143,12/04/2018,1,2,3,4,5,6,,20";
  assert.deepEqual(parseLotterywestCsv(`${csv([first])}${old}\n`, { now }).map((draw) => draw.row), [first]);
});

test("validation normalizes legacy dates but rejects invalid dates and ball values", () => {
  assert.deepEqual(normalizeRow(["19/4/18", ...first.slice(1).map(String)], { now }), first);
  assert.throws(() => parseDrawDate("31/02/2026"), /Invalid calendar/);
  assert.throws(() => normalizeRow(["20/04/2018", ...first.slice(1)], { now }), /not Thursday/);
  assert.throws(() => normalizeRow(["17/05/2018", ...first.slice(1)], { now }), /Future/);
  assert.throws(() => normalizeRow([first[0], 4, 4, 9, 13, 25, 32, 33, 7], { now }), /Duplicate main/);
  assert.throws(() => normalizeRow([first[0], 36, ...first.slice(2)], { now }), /between 1 and 35/);
  assert.throws(() => normalizeRow([...first.slice(0, 8), 21], { now }), /between 1 and 20/);
  assert.throws(() => normalizeRow([first[0], "", ...first.slice(2)], { now }), /integer/);
  assert.throws(() => normalizeRow(first.slice(0, 8), { now }), /seven main/);
});

test("weekly gaps, duplicate dates, missing start and noncanonical exports fail validation", () => {
  assert.throws(() => validateRows([third, first], { now }), /Missing weekly/);
  assert.throws(() => validateRows([first, first], { now }), /Duplicate draw date/);
  assert.throws(() => validateRows([third, second], { now, requireFullHistory: true }), /first current-rule/);
  assert.throws(() => validateRows([first, second], { now, requireCanonical: true }), /newest-first/);
  assert.deepEqual(validateRows([second, first], { now, requireCanonical: true, requireFullHistory: true }), [second, first]);
});

test("incremental merge is idempotent and refuses conflicts and stale source", () => {
  const rows = mergeDraws([second, first], [third, second, first], { now });
  assert.deepEqual(rows, [third, second, first]);
  assert.deepEqual(mergeDraws(rows, [third, second, first], { now }), rows);
  assert.throws(() => mergeDraws([second, first], [second, [...first.slice(0, 8), 8]], { now }), /conflicts/);
  assert.throws(() => mergeDraws([second, first], [first], { now }), /older/);
});

test("Thursday and Friday before noon allow the previous Thursday; Friday noon requires this week's draw", () => {
  const cases = [
    ["2026-09-09T14:00:00Z", "2026-09-03"], // Thursday 00:00 AEST
    ["2026-09-10T13:59:59Z", "2026-09-03"], // Thursday 23:59 AEST
    ["2026-09-11T01:59:59Z", "2026-09-03"], // Friday 11:59:59 AEST
    ["2026-09-11T02:00:00Z", "2026-09-10"], // Friday 12:00 AEST
    ["2026-09-12T02:00:00Z", "2026-09-10"]
  ];
  for (const [time, expected] of cases) assert.equal(expectedLatestDrawDate(new Date(time)), expected, time);
});

test("publication deadline follows Sydney daylight saving rather than a fixed UTC offset", () => {
  const cases = [
    ["2026-10-09T00:59:59Z", "2026-10-01"], // Friday 11:59:59 AEDT
    ["2026-10-09T01:00:00Z", "2026-10-08"], // Friday 12:00 AEDT
    ["2026-10-03T15:59:59Z", "2026-10-01"], // Before the spring clock change
    ["2026-10-03T16:00:00Z", "2026-10-01"], // After the spring clock change
    ["2026-04-03T01:00:00Z", "2026-04-02"], // Friday noon before autumn clock change
    ["2026-04-04T15:59:59Z", "2026-04-02"],
    ["2026-04-04T16:00:00Z", "2026-04-02"],
    ["2026-04-10T01:59:59Z", "2026-04-02"], // Friday 11:59:59 AEST
    ["2026-04-10T02:00:00Z", "2026-04-09"] // Friday 12:00 AEST
  ];
  for (const [time, expected] of cases) assert.equal(expectedLatestDrawDate(new Date(time)), expected, time);
});

test("unchanged but overdue source fails even when it matches the local dataset", () => {
  const rows = [third, second, first];
  assert.doesNotThrow(() => assertSourceFreshness(rows, new Date("2018-05-11T01:59:59Z")));
  assert.throws(() => mergeDraws(rows, rows, { now: new Date("2018-05-11T02:00:00Z") }), /source is stale/);
  assert.throws(() => mergeDraws(rows, rows, { now: new Date("2018-06-01T02:00:00Z") }), /source is stale/);
});

test("database reader only accepts an array export and does not execute JavaScript", () => {
  assert.deepEqual(parseDatabase(serializeDatabase([first])), [first]);
  assert.deepEqual(parseDatabase('// old export\nexport default [["19/04/18","4","5","9","13","25","32","33","7"],];'), [["19/04/18", "4", "5", "9", "13", "25", "32", "33", "7"]]);
  assert.throws(() => parseDatabase("export default (() => process.exit())();"), /default array/);
});

test("download errors, HTML responses and incomplete histories fail closed", async () => {
  await assert.rejects(fetchOfficialDraws({ fetchImpl: async () => response("Unavailable", 503), now }), /HTTP 503/);
  await assert.rejects(fetchOfficialDraws({ fetchImpl: async () => response("<html>", 200, "text/html"), now }), /content type/);
  await assert.rejects(fetchOfficialDraws({ fetchImpl: async () => response(csv([first, third])), now }), /Missing weekly/);
});

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "powerball-update-test-"));
  t.after(async () => { await rm(root, { recursive: true, force: true }); });
  const original = serializeDatabase([second, first]);
  await writeFile(join(root, "db.js"), original);
  await writeFile(join(root, "data-status.json"), JSON.stringify({ lastSuccessAt: "2018-04-27T00:00:00.000Z", latestDrawDate: "2018-04-26", totalDraws: 2, status: "ok" }));
  return { root, original };
}

test("successful update writes a matching status and a second run leaves database unchanged", async (t) => {
  const { root } = await fixture(t);
  const result = await updateData({ root, fetchImpl: async () => response(), now });
  assert.equal(result.changed, true);
  assert.equal(result.status.totalDraws, 3);
  assert.equal(result.status.latestDrawDate, "2018-05-03");
  assert.equal(result.status.status, "ok");
  const saved = await readFile(join(root, "db.js"), "utf8");
  assert.deepEqual(parseDatabase(saved), [third, second, first]);
  const repeated = await updateData({ root, fetchImpl: async () => response(), now });
  assert.equal(repeated.changed, false);
  assert.equal(await readFile(join(root, "db.js"), "utf8"), saved);
});

for (const failure of [
  { name: "network failure", fetchImpl: async () => { throw new Error("Network unavailable"); } },
  { name: "overlap conflict", fetchImpl: async () => response(csv([first, [...second.slice(0, 8), 1], third])) },
  { name: "empty data", fetchImpl: async () => response(`${header}\n`) }
]) {
  test(`${failure.name} preserves database bytes and last success while recording failure`, async (t) => {
    const { root, original } = await fixture(t);
    await assert.rejects(updateData({ root, fetchImpl: failure.fetchImpl, now }));
    assert.equal(await readFile(join(root, "db.js"), "utf8"), original);
    const status = JSON.parse(await readFile(join(root, "data-status.json"), "utf8"));
    assert.equal(status.status, "error");
    assert.equal(status.lastAttemptAt, now.toISOString());
    assert.equal(status.lastSuccessAt, "2018-04-27T00:00:00.000Z");
    assert.equal(status.latestDrawDate, "2018-04-26");
    assert.equal(status.totalDraws, 2);
  });
}

test("malformed previous status records an error without touching saved results", async (t) => {
  const { root, original } = await fixture(t);
  await writeFile(join(root, "data-status.json"), "not json");
  await assert.rejects(updateData({ root, fetchImpl: async () => response(), now }));
  assert.equal(await readFile(join(root, "db.js"), "utf8"), original);
  const status = JSON.parse(await readFile(join(root, "data-status.json"), "utf8"));
  assert.equal(status.status, "error");
  assert.equal(status.totalDraws, 2);
  assert.equal(status.latestDrawDate, "2018-04-26");
});

test("overdue unchanged source preserves database and last success while recording the missed deadline", async (t) => {
  const { root, original } = await fixture(t);
  await assert.rejects(updateData({ root, fetchImpl: async () => response(csv([first, second])), now }), /source is stale/);
  assert.equal(await readFile(join(root, "db.js"), "utf8"), original);
  const status = JSON.parse(await readFile(join(root, "data-status.json"), "utf8"));
  assert.equal(status.status, "error");
  assert.equal(status.lastSuccessAt, "2018-04-27T00:00:00.000Z");
  assert.match(status.message, /expected at least 2018-05-03/);
});

test("status write failure after replacing the database rolls its bytes back before recording the error", async (t) => {
  const { root, original } = await fixture(t);
  let failed = false;
  const writeAtomic = async (path, text) => {
    if (path.endsWith("data-status.json") && !failed) { failed = true; throw new Error("Simulated status write failure"); }
    await atomicWrite(path, text);
  };
  await assert.rejects(updateData({ root, fetchImpl: async () => response(), now, writeAtomic }), /status write failure/);
  assert.equal(await readFile(join(root, "db.js"), "utf8"), original);
  const status = JSON.parse(await readFile(join(root, "data-status.json"), "utf8"));
  assert.equal(status.status, "error");
  assert.equal(status.totalDraws, 2);
  assert.equal(status.lastSuccessAt, "2018-04-27T00:00:00.000Z");
});

const ozNow = new Date("2025-01-21T00:00:00Z");
const ozFirst = ["07/01/2025", 1, 2, 3, 4, 5, 6, 47, 8, 9, 10];
const ozSecond = ["14/01/2025", 1, 3, 5, 7, 11, 19, 46, 2, 8, 47];
const ozThird = ["21/01/2025", 1, 2, 3, 4, 5, 6, 7, 8, 9, 47];
const ozHeader = ["Draw number", "Draw date", ...Array.from({ length: 7 }, (_, i) => `Winning Number ${i + 1}`), ...Array.from({ length: 3 }, (_, i) => `Supplementary Number ${i + 1}`)].join(",");
const ozCsv = (rows = [ozFirst, ozSecond]) => `${ozHeader}\n${rows.map((row) => [1612 + (parseDrawDate(row[0]) - parseDrawDate(ozFirst[0])) / 604800000, ...row].join(",")).join("\n")}\n`;

test("Oz Lotto supports 47 and sorts all three supplementary balls independently", () => {
  const row = [ozFirst[0], ...ozFirst.slice(1, 8).reverse(), 10, 8, 9];
  assert.deepEqual(normalizeRow(row, { game: "ozlotto", now: ozNow }), ozFirst);
  assert.deepEqual(parseLotterywestCsv(ozCsv([row, ozSecond]), { game: "ozlotto", now: ozNow }).map(({ row: value }) => value), [ozSecond, ozFirst]);
  assert.throws(() => normalizeRow([ozFirst[0], 48, ...ozFirst.slice(2)], { game: "ozlotto", now: ozNow }), /between 1 and 47/);
  assert.throws(() => normalizeRow([...ozFirst.slice(0, 8), 8, 8, 10], { game: "ozlotto", now: ozNow }), /Duplicate supplementary/);
  assert.throws(() => normalizeRow([...ozFirst.slice(0, 8), 1, 8, 10], { game: "ozlotto", now: ozNow }), /overlap/);
  assert.throws(() => normalizeRow(["09/01/2025", ...ozFirst.slice(1)], { game: "ozlotto", now: ozNow }), /not Tuesday/);
});

test("Oz Lotto import fixes the collection start and enforces draw numbers and gap-free weeks", () => {
  const options = { game: "ozlotto", now: ozNow };
  const older = "1611,31/12/2024,1,2,3,4,5,6,7,8,9,10\n";
  assert.equal(parseLotterywestCsv(ozCsv() + older, options).length, 2);
  assert.throws(() => parseLotterywestCsv(ozCsv().replace("1613,", "1614,"), options), /mismatch/);
  assert.throws(() => parseLotterywestCsv(ozCsv([ozFirst, ozThird]), options), /Missing weekly/);
  assert.throws(() => parseLotterywestCsv(ozCsv([ozSecond]), options), /first collected draw on 2025-01-07/);
  assert.throws(() => parseLotterywestCsv(ozCsv([ozFirst, ozFirst]), options), /Duplicate official/);
});

test("Oz Lotto Wednesday noon deadline follows Sydney daylight saving", () => {
  const cases = [
    ["2026-09-08T00:00:00Z", "2026-09-01"], // Tuesday
    ["2026-09-09T01:59:59Z", "2026-09-01"], // Wednesday before noon AEST
    ["2026-09-09T02:00:00Z", "2026-09-08"],
    ["2026-10-07T00:59:59Z", "2026-09-29"], // Wednesday before noon AEDT
    ["2026-10-07T01:00:00Z", "2026-10-06"],
    ["2026-10-03T15:59:59Z", "2026-09-29"],
    ["2026-10-03T16:00:00Z", "2026-09-29"],
    ["2026-04-01T01:00:00Z", "2026-03-31"],
    ["2026-04-08T01:59:59Z", "2026-03-31"],
    ["2026-04-08T02:00:00Z", "2026-04-07"]
  ];
  for (const [time, expected] of cases) assert.equal(expectedLatestDrawDate(new Date(time), { game: "ozlotto" }), expected, time);
  assert.doesNotThrow(() => assertSourceFreshness([ozSecond, ozFirst], new Date("2025-01-22T00:59:59Z"), { game: "ozlotto" }));
  assert.throws(() => assertSourceFreshness([ozSecond, ozFirst], new Date("2025-01-22T01:00:00Z"), { game: "ozlotto" }), /Wednesday 12:00/);
});

async function emptyFixture(t) {
  const root = await mkdtemp(join(tmpdir(), "lottery-bootstrap-test-"));
  t.after(async () => { await rm(root, { recursive: true, force: true }); });
  return root;
}

test("first Oz Lotto import creates its database and status without a saved dataset", async (t) => {
  const root = await emptyFixture(t);
  let requested;
  const result = await updateData({ root, game: "ozlotto", now: ozNow, fetchImpl: async (url) => { requested = url; return response(ozCsv()); } });
  assert.match(requested, /\/5130\/results-csv$/);
  assert.deepEqual(result.rows, [ozSecond, ozFirst]);
  assert.equal(result.status.totalDraws, 2);
  assert.match(result.status.sourceName, /Oz Lotto/);
  assert.deepEqual(parseDatabase(await readFile(join(root, "db-ozlotto.js"), "utf8")), result.rows);
  assert.equal(JSON.parse(await readFile(join(root, "data-status-ozlotto.json"), "utf8")).latestDrawDate, "2025-01-14");
  await assert.rejects(readFile(join(root, "db.js")), { code: "ENOENT" });
});

test("failed initial import never creates a partial database", async (t) => {
  const root = await emptyFixture(t);
  await assert.rejects(updateData({ root, game: "ozlotto", now: ozNow, fetchImpl: async () => response(ozCsv([ozSecond])) }), /first collected/);
  await assert.rejects(readFile(join(root, "db-ozlotto.js")), { code: "ENOENT" });
  const status = JSON.parse(await readFile(join(root, "data-status-ozlotto.json"), "utf8"));
  assert.equal(status.status, "error");
  assert.equal(status.lastSuccessAt, null);
  assert.equal(status.totalDraws, 0);
});

test("failed bootstrap status write restores the database's original absence", async (t) => {
  const root = await emptyFixture(t);
  let failed = false;
  const writeAtomic = async (path, text) => {
    if (path.endsWith("data-status-ozlotto.json") && !failed) { failed = true; throw new Error("Simulated status write failure"); }
    await atomicWrite(path, text);
  };
  await assert.rejects(updateData({ root, game: "ozlotto", now: ozNow, fetchImpl: async () => response(ozCsv()), writeAtomic }), /status write failure/);
  await assert.rejects(readFile(join(root, "db-ozlotto.js")), { code: "ENOENT" });
  assert.equal(JSON.parse(await readFile(join(root, "data-status-ozlotto.json"), "utf8")).status, "error");
});

test("a Powerball failure still updates Oz Lotto and reports the combined job failure", async (t) => {
  const { root, original } = await fixture(t);
  const requested = [];
  const fetchImpl = async (url) => {
    requested.push(url);
    if (url.includes("/5132/")) throw new Error("Powerball unavailable");
    return response(ozCsv());
  };
  await assert.rejects(updateAllData({ root, now: ozNow, fetchImpl }), (error) => {
    assert.ok(error instanceof AggregateError);
    assert.match(error.message, /Powerball unavailable/);
    assert.equal(error.results[0].game, "ozlotto");
    return true;
  });
  assert.equal(requested.length, 2);
  assert.equal(await readFile(join(root, "db.js"), "utf8"), original);
  assert.equal(JSON.parse(await readFile(join(root, "data-status.json"), "utf8")).lastSuccessAt, "2018-04-27T00:00:00.000Z");
  assert.equal(JSON.parse(await readFile(join(root, "data-status-ozlotto.json"), "utf8")).status, "ok");
});

test("an Oz Lotto failure retains its history after Powerball updates successfully", async (t) => {
  const root = await emptyFixture(t);
  const ozOriginal = serializeDatabase([ozSecond, ozFirst], { game: "ozlotto" });
  await writeFile(join(root, "db-ozlotto.js"), ozOriginal);
  await writeFile(join(root, "data-status-ozlotto.json"), JSON.stringify({ lastSuccessAt: "2025-01-15T02:00:00.000Z" }));
  const pbRows = [];
  for (let date = parseDrawDate(first[0]); date <= new Date("2025-01-16T00:00:00Z"); date.setUTCDate(date.getUTCDate() + 7)) {
    pbRows.push([`${String(date.getUTCDate()).padStart(2, "0")}/${String(date.getUTCMonth() + 1).padStart(2, "0")}/${date.getUTCFullYear()}`, ...first.slice(1)]);
  }
  const fetchImpl = async (url) => {
    if (url.includes("/5130/")) throw new Error("Oz Lotto unavailable");
    return response(csv(pbRows));
  };
  await assert.rejects(updateAllData({ root, now: ozNow, fetchImpl }), /Oz Lotto unavailable/);
  assert.equal(JSON.parse(await readFile(join(root, "data-status.json"), "utf8")).latestDrawDate, "2025-01-16");
  assert.equal(await readFile(join(root, "db-ozlotto.js"), "utf8"), ozOriginal);
  const status = JSON.parse(await readFile(join(root, "data-status-ozlotto.json"), "utf8"));
  assert.equal(status.status, "error");
  assert.equal(status.lastSuccessAt, "2025-01-15T02:00:00.000Z");
});
