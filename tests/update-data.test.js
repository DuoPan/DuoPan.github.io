import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseDrawDate, normalizeRow, validateRows, serializeDatabase, parseDatabase } from "../scripts/data-utils.js";
import { parseCsv, parseLotterywestCsv, mergeDraws, fetchOfficialDraws, updateData, expectedLatestDrawDate, assertSourceFreshness, atomicWrite } from "../scripts/update-data.js";

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
