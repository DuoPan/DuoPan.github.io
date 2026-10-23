import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STORAGE_KEY, MAX_RECORDS, MAX_BYTES, validatePredictionRecord,
  loadPredictions, savePrediction, exportPredictions, importPredictions
} from '../oz-prediction-store.js';

const metrics = (numbers) => {
  const odds = numbers.filter((number) => number % 2).length;
  const low = numbers.filter((number) => number <= 23).length;
  return { sum: numbers.reduce((total, number) => total + number, 0), odds, evens: 7 - odds, low, high: 7 - low,
    span: numbers.at(-1) - numbers[0], zones: [[1, 16], [17, 32], [33, 47]].map(([min, max]) => numbers.filter((number) => number >= min && number <= max).length) };
};
const fixture = (id = 'prediction-1') => ({
  id, schemaVersion: 1, modelVersion: 'oz-heuristics-v1', createdAt: '2026-10-14T00:00:00.000Z',
  targetDate: '2026-10-20', targetDrawNumber: 1705,
  source: { latestDate: '2026-10-13', latestDrawNumber: 1704, sampleSize: 93, dataFingerprint: 'oz-123abc' }, seed: 'test-seed',
  groups: Array.from({ length: 4 }, (_, index) => {
    const numbers = [1 + index, 8 + index, 17 + index, 23 + index, 31 + index, 38 + index, 44 + index];
    return { id: `group-${index}`, title: '推荐号码', description: '根据历史主号生成的实验组合。', numbers,
      reasons: ['展示号码的历史频率。', '组合结构在合理范围。'], metrics: metrics(numbers) };
  })
});
const memory = (initial = null) => ({
  value: initial, writes: 0,
  getItem(key) { assert.equal(key, STORAGE_KEY); return this.value; },
  setItem(key, value) { assert.equal(key, STORAGE_KEY); this.writes += 1; this.value = value; }
});
const rawEnvelope = (records) => JSON.stringify({ format: 'oz-lotto-predictions', schemaVersion: 1, exportedAt: '2026-10-24T00:00:00.000Z', records });

test('canonical records are copied without changing fields; older model versions remain readable', () => {
  const source = fixture();
  source.modelVersion = 'old-model-v0';
  const result = validatePredictionRecord(source);
  assert.deepEqual(result, source);
  assert.notEqual(result, source);
  assert.notEqual(result.groups[0].numbers, source.groups[0].numbers);
  result.groups[0].numbers[0] = 47;
  assert.equal(source.groups[0].numbers[0], 1);
});

test('missing data loads empty; saves preserve versions and the same record is idempotent', () => {
  const storage = memory();
  assert.deepEqual(loadPredictions(storage), []);
  const first = fixture();
  assert.deepEqual(savePrediction(first, storage), [first]);
  const firstRaw = storage.value;
  assert.deepEqual(savePrediction(first, storage), [first]);
  assert.equal(storage.value, firstRaw);
  assert.equal(storage.writes, 1);
  const second = fixture('prediction-2');
  second.modelVersion = 'oz-heuristics-v2';
  assert.deepEqual(savePrediction(second, storage), [first, second]);
  assert.deepEqual(loadPredictions(storage), [first, second]);
});

test('export and import round trip, merging identical ids and preserving history', () => {
  const first = fixture();
  const second = fixture('prediction-2');
  const exported = exportPredictions([first, second]);
  const envelope = JSON.parse(exported);
  assert.equal(envelope.format, 'oz-lotto-predictions');
  assert.equal(envelope.schemaVersion, 1);
  assert.equal(new Date(envelope.exportedAt).toISOString(), envelope.exportedAt);
  const storage = memory();
  savePrediction(first, storage);
  assert.deepEqual(importPredictions(exported, storage), [first, second]);
  const writes = storage.writes;
  assert.deepEqual(importPredictions(exported, storage), [first, second]);
  assert.equal(storage.writes, writes);
});

test('conflicting ids reject an entire import without a partial write', () => {
  const first = fixture();
  const conflict = fixture();
  conflict.seed = 'different-seed';
  const second = fixture('prediction-2');
  const storage = memory();
  savePrediction(first, storage);
  const previous = storage.value;
  assert.throws(() => savePrediction(conflict, storage), /冲突/);
  assert.throws(() => importPredictions(rawEnvelope([second, conflict]), storage), /冲突/);
  assert.equal(storage.value, previous);
  assert.equal(storage.writes, 1);
  assert.throws(() => importPredictions(rawEnvelope([first, conflict]), storage), /冲突/);
  assert.equal(storage.value, previous);
});

test('record cap preserves all old records and still permits idempotent saves', () => {
  const records = Array.from({ length: MAX_RECORDS }, (_, index) => fixture(`record-${index}`));
  const storage = memory(exportPredictions(records));
  const previous = storage.value;
  assert.equal(savePrediction(records[0], storage).length, MAX_RECORDS);
  assert.equal(importPredictions(exportPredictions(records), storage).length, MAX_RECORDS);
  assert.throws(() => savePrediction(fixture('record-over-limit'), storage), /最多1000份/);
  assert.equal(storage.value, previous);
  assert.equal(storage.writes, 0);
});

test('corrupt and unsupported local data are never silently overwritten', () => {
  for (const broken of ['', '{broken', '[]', '{}', rawEnvelope([{}]), JSON.stringify({ format: 'wrong', schemaVersion: 1, exportedAt: '2026-10-24T00:00:00.000Z', records: [] })]) {
    const storage = memory(broken);
    assert.throws(() => loadPredictions(storage), /预测记录无效/);
    assert.throws(() => savePrediction(fixture(), storage), /预测记录无效/);
    assert.throws(() => importPredictions(exportPredictions([fixture()]), storage), /预测记录无效/);
    assert.equal(storage.value, broken);
    assert.equal(storage.writes, 0);
  }
});

test('unavailable storage, read rejection and quota errors produce actionable errors', () => {
  assert.throws(() => loadPredictions(null), /本地存储不可用或被禁用/);
  assert.throws(() => loadPredictions({}), /本地存储不可用或被禁用/);
  const blocked = { getItem() { throw new DOMException('blocked', 'SecurityError'); }, setItem() {} };
  assert.throws(() => loadPredictions(blocked), /读取失败/);
  assert.throws(() => savePrediction(fixture(), blocked), /读取失败/);
  const storage = memory();
  storage.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
  assert.throws(() => savePrediction(fixture(), storage), /存储空间不足/);
  assert.equal(storage.value, null);
  const previous = exportPredictions([fixture()]);
  storage.value = previous;
  assert.throws(() => importPredictions(exportPredictions([fixture('prediction-2')]), storage), /存储空间不足/);
  assert.equal(storage.value, previous);
  assert.deepEqual(savePrediction(fixture(), storage), [fixture()]);
});

test('default storage access catches disabled localStorage getters', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new DOMException('blocked', 'SecurityError'); } });
    assert.throws(() => loadPredictions(), /读取失败/);
    assert.throws(() => savePrediction(fixture()), /读取失败/);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
});

test('strict calendars, weekly draw numbering, source bounds and timestamps are validated', () => {
  const cases = [
    (r) => { r.targetDate = '2026-02-30'; },
    (r) => { r.targetDate = '20/10/2026'; },
    (r) => { r.targetDate = '2026-10-21'; },
    (r) => { r.targetDate = '2026-10-27'; r.targetDrawNumber += 1; },
    (r) => { r.source.latestDate = '2026-10-12'; },
    (r) => { r.source.latestDrawNumber += 1; r.targetDrawNumber += 1; },
    (r) => { r.targetDrawNumber += 1; },
    (r) => { r.source.sampleSize = 29; },
    (r) => { r.source.sampleSize = 1000; },
    (r) => { r.createdAt = '2026-02-30T00:00:00.000Z'; },
    (r) => { r.createdAt = '2026-10-14'; },
    (r) => { r.createdAt = '2026-10-12T12:59:59.999Z'; },
    (r) => { r.createdAt = '2026-10-20T08:00:00.000Z'; }
  ];
  for (const change of cases) {
    const record = fixture(); change(record);
    assert.throws(() => validatePredictionRecord(record), /预测记录无效/);
  }
  const sameDay = fixture();
  sameDay.createdAt = '2026-10-13T09:00:00.000Z'; // Source day, Sydney 20:00.
  assert.doesNotThrow(() => validatePredictionRecord(sameDay));
  const lastMoment = fixture();
  lastMoment.createdAt = '2026-10-20T07:59:59.999Z';
  assert.doesNotThrow(() => validatePredictionRecord(lastMoment));
  const winter = fixture();
  winter.source.latestDate = '2026-06-02'; winter.source.latestDrawNumber = 1685;
  winter.targetDate = '2026-06-09'; winter.targetDrawNumber = 1686;
  winter.createdAt = '2026-06-09T08:59:59.999Z';
  assert.doesNotThrow(() => validatePredictionRecord(winter));
  winter.createdAt = '2026-06-09T09:00:00.000Z';
  assert.throws(() => validatePredictionRecord(winter), /生成时间/);
});

test('invalid groups, numbers and fabricated metrics are rejected', () => {
  const cases = [
    (r) => { r.groups.pop(); },
    (r) => { r.groups[1].id = r.groups[0].id; },
    (r) => { r.groups[1] = { ...r.groups[0], id: 'other' }; },
    (r) => { r.groups[0].numbers[0] = 0; },
    (r) => { r.groups[0].numbers[6] = 48; },
    (r) => { r.groups[0].numbers[0] = '1'; },
    (r) => { r.groups[0].numbers[0] = 1.5; },
    (r) => { r.groups[0].numbers[0] = r.groups[0].numbers[1]; },
    (r) => { r.groups[0].numbers.reverse(); },
    (r) => { delete r.groups[0].numbers[0]; },
    (r) => { r.groups[0].metrics.sum += 1; },
    (r) => { r.groups[0].metrics.odds += 1; },
    (r) => { r.groups[0].metrics.low += 1; },
    (r) => { r.groups[0].metrics.span += 1; },
    (r) => { r.groups[0].metrics.zones[0] += 1; },
    (r) => { r.groups[0].reasons = ['只有一个说明']; }
  ];
  for (const change of cases) {
    const record = fixture(); change(record);
    assert.throws(() => validatePredictionRecord(record), /预测记录无效/);
  }
});

test('unknown properties, unsafe strings, excessive input and invalid envelopes fail atomically', () => {
  const cases = [
    (r) => { r.groups[0].title = '<img src=x onerror=alert(1)>'; },
    (r) => { r.groups[0].description = 'hello\u0000world'; },
    (r) => { r.groups[0].reasons[0] = 'x'.repeat(601); },
    (r) => { r.id = 'x'.repeat(161); },
    (r) => { r.seed = 'unsafe seed'; },
    (r) => { r.schemaVersion = 2; },
    (r) => { r.unexpected = true; },
    (r) => { r.source.unexpected = true; },
    (r) => { r.groups[0].metrics.unexpected = true; }
  ];
  const storage = memory(exportPredictions([fixture()]));
  const previous = storage.value;
  for (const change of cases) {
    const record = fixture('bad-record'); change(record);
    assert.throws(() => importPredictions(rawEnvelope([fixture('good-record'), record]), storage), /预测记录无效/);
    assert.equal(storage.value, previous);
  }
  assert.throws(() => importPredictions(' '.repeat(MAX_BYTES + 1), storage), /5MB/);
  assert.throws(() => importPredictions('中'.repeat(Math.floor(MAX_BYTES / 2)), storage), /5MB/);
  const tooMany = Array.from({ length: MAX_RECORDS + 1 }, (_, index) => fixture(`record-${index}`));
  assert.throws(() => exportPredictions(tooMany), /最多1000份/);
  const wrongTime = JSON.parse(rawEnvelope([])); wrongTime.exportedAt = 'today';
  assert.throws(() => importPredictions(JSON.stringify(wrongTime), storage), /备份时间/);
  const proto = JSON.parse(rawEnvelope([fixture('bad-record')]).replace('"schemaVersion":1,"modelVersion"', '"__proto__":{},"schemaVersion":1,"modelVersion"'));
  assert.throws(() => importPredictions(JSON.stringify(proto), storage), /未知字段/);
  assert.equal(storage.value, previous);
  assert.equal(storage.writes, 0);
  assert.equal({}.polluted, undefined);
});
