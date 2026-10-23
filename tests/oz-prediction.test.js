import test from 'node:test';
import assert from 'node:assert/strict';
import { MODEL_VERSION, getPredictionContext, generatePrediction, evaluatePrediction } from '../oz-prediction.js';
import { dateISO } from '../analytics.js';

const WEEK = 7 * 86_400_000;
const history = (count = 94, latestDate = '2026-10-20') => Array.from({ length: count }, (_, index) => {
  const date = new Date(Date.parse(latestDate) - index * WEEK).toISOString().slice(0, 10);
  const balls = Array.from({ length: 10 }, (_, position) => ((index * 11 + position * 5) % 47) + 1);
  return [date, ...balls];
});
const options = { now: new Date('2026-10-24T04:00:00Z'), seed: 'test-seed', id: 'test-id' };
const draw = (date = '2026-10-27', main = [1, 2, 3, 4, 5, 6, 7], supplementary = [8, 9, 10]) => [date, ...main, ...supplementary];
const testRecord = (numbers = [1, 2, 3, 4, 5, 6, 7]) => ({
  id: 'fixture', schemaVersion: 1, modelVersion: MODEL_VERSION, createdAt: '2026-10-24T04:00:00.000Z',
  targetDate: '2026-10-27', targetDrawNumber: 1706,
  source: { latestDate: '2026-10-20', latestDrawNumber: 1705, sampleSize: 94, dataFingerprint: 'fixture' },
  seed: 'fixture', groups: [{ id: 'test', numbers }]
});

test('context normalizes without mutation and identifies the next Tuesday draw number', () => {
  const input = history().reverse();
  const before = JSON.stringify(input);
  const context = getPredictionContext(input, options);
  assert.equal(context.ready, true, context.reason);
  assert.equal(context.reason, '');
  assert.equal(context.sampleSize, 94);
  assert.equal(context.latestDate, '2026-10-20');
  assert.equal(context.latestDrawNumber, 1705);
  assert.equal(context.targetDate, '2026-10-27');
  assert.equal(context.targetDrawNumber, 1706);
  assert.equal(context.expectedLatestDate, '2026-10-20');
  assert.equal(dateISO(context.rows[0][0]), '2026-10-20');
  assert.match(context.dataFingerprint, /^oz-[a-f0-9]{32}$/);
  assert.equal(JSON.stringify(input), before);
});

test('refuses insufficient, invalid, off-calendar, missing-week, stale and future data', () => {
  assert.match(getPredictionContext(history(29), options).reason, /30/);
  const gap = history();
  gap.splice(40, 1);
  assert.match(getPredictionContext(gap, options).reason, /缺周/);
  const duplicate = history();
  duplicate.push([...duplicate[0]]);
  assert.match(getPredictionContext(duplicate, options).reason, /格式/);
  assert.match(getPredictionContext(history(94, '2026-10-19'), options).reason, /周二/);
  assert.match(getPredictionContext(history(94, '2026-10-13'), options).reason, /尚未更新/);
  assert.match(getPredictionContext(history(94, '2026-10-27'), options).reason, /未来/);
  assert.throws(() => generatePrediction(gap, options), /缺周/);
  assert.throws(() => getPredictionContext(history(), { now: new Date(NaN) }), /Invalid/);
});

test('freshness closes at Sydney 19:00 before the publication buffer and reopens after data refresh', () => {
  const old = history(93, '2026-10-13');
  assert.equal(getPredictionContext(old, { now: new Date('2026-10-20T07:59:59Z') }).ready, true);
  const closed = getPredictionContext(old, { now: new Date('2026-10-20T08:00:00Z') });
  assert.equal(closed.ready, false);
  assert.match(closed.reason, /19:00/);
  assert.equal(getPredictionContext(old, { now: new Date('2026-10-20T12:00:00Z') }).ready, false);
  assert.equal(getPredictionContext(old, { now: new Date('2026-10-21T00:59:00Z') }).ready, false);
  assert.equal(getPredictionContext(history(), { now: new Date('2026-10-20T08:05:00Z') }).ready, true);
  assert.equal(getPredictionContext(history(), { now: new Date('2026-10-20T07:59:00Z') }).ready, false);
  assert.match(getPredictionContext(old, { now: new Date('2026-10-21T01:00:00Z') }).reason, /尚未更新/);
});

test('Sydney cutoff observes daylight saving changes in April and October', () => {
  // April 7 is AEST (UTC+10); October 6 is AEDT (UTC+11).
  const autumn = history(50, '2026-03-31');
  assert.equal(getPredictionContext(autumn, { now: new Date('2026-04-07T08:59:59Z') }).ready, true);
  assert.equal(getPredictionContext(autumn, { now: new Date('2026-04-07T09:00:00Z') }).ready, false);
  const spring = history(90, '2026-09-29');
  assert.equal(getPredictionContext(spring, { now: new Date('2026-10-06T07:59:59Z') }).ready, true);
  assert.equal(getPredictionContext(spring, { now: new Date('2026-10-06T08:00:00Z') }).ready, false);
});

test('fingerprint includes all history and supplementary data and is insensitive to ordering', () => {
  const input = history();
  const original = getPredictionContext(input, options).dataFingerprint;
  assert.equal(getPredictionContext([...input].reverse(), options).dataFingerprint, original);
  const old = structuredClone(input);
  const used = old[80].slice(1);
  old[80][10] = Array.from({ length: 47 }, (_, index) => index + 1).find((number) => !used.includes(number));
  assert.notEqual(getPredictionContext(old, options).dataFingerprint, original);
});

test('generation is deterministic, JSON serializable and deeply immutable without touching source data', () => {
  const input = history();
  const before = JSON.stringify(input);
  const record = generatePrediction(input, options);
  assert.deepEqual(record, generatePrediction([...input].reverse(), options));
  assert.deepEqual(record, JSON.parse(JSON.stringify(record)));
  assert.equal(record.schemaVersion, 1);
  assert.equal(record.modelVersion, MODEL_VERSION);
  assert.equal(record.createdAt, options.now.toISOString());
  assert.equal(record.source.sampleSize, 94);
  assert.equal(record.source.latestDate, '2026-10-20');
  assert.equal(record.groups.length, 4);
  assert.equal(Object.isFrozen(record.groups[0].metrics.zones), true);
  assert.throws(() => { record.groups[0].numbers[0] = 47; }, TypeError);
  assert.equal(JSON.stringify(input), before);
});

test('every seed produces valid seven-number groups with accurate metrics and limited overlap', () => {
  const unique = new Set();
  for (let run = 0; run < 25; run += 1) {
    const record = generatePrediction(history(), { ...options, seed: `seed-${run}` });
    unique.add(record.groups[0].numbers.join(','));
    for (const [index, group] of record.groups.entries()) {
      const numbers = group.numbers;
      assert.equal(numbers.length, 7);
      assert.equal(new Set(numbers).size, 7);
      assert.deepEqual(numbers, [...numbers].sort((a, b) => a - b));
      assert(numbers.every((number) => Number.isInteger(number) && number >= 1 && number <= 47));
      assert.equal(group.metrics.sum, numbers.reduce((total, number) => total + number, 0));
      assert.equal(group.metrics.odds, numbers.filter((number) => number % 2).length);
      assert.equal(group.metrics.evens, 7 - group.metrics.odds);
      assert.equal(group.metrics.low, numbers.filter((number) => number <= 23).length);
      assert.equal(group.metrics.high, 7 - group.metrics.low);
      assert.equal(group.metrics.span, numbers[6] - numbers[0]);
      assert.deepEqual(group.metrics.zones, [[1, 16], [17, 32], [33, 47]].map(([min, max]) => numbers.filter((number) => number >= min && number <= max).length));
      assert.equal(group.reasons.length, 3);
      assert(group.reasons.every((reason) => typeof reason === 'string' && reason.length > 12));
      for (const previous of record.groups.slice(0, index)) assert(numbers.filter((number) => previous.numbers.includes(number)).length <= 3);
    }
  }
  assert(unique.size > 20, 'seed changes must affect selection rather than always hard-selecting top seven');
});

test('explanations use observed main counts rather than supplementary appearances', () => {
  const input = history(40).map((row) => [row[0], 1, 2, 3, 4, 5, 6, 7, 45, 46, 47]);
  const record = generatePrediction(input, options);
  for (const number of record.groups[0].numbers) {
    assert(record.groups[0].reasons[0].includes(`${String(number).padStart(2, '0')}号${number <= 7 ? 30 : 0}次`));
  }
  assert.match(record.groups[2].reasons[2], /遗漏不等于/);
  assert(record.groups[2].reasons[0].includes('至少40期'));
});

test('default tokens are unique ASCII values and invalid user-provided tokens are refused', () => {
  const first = generatePrediction(history(), { now: options.now });
  const second = generatePrediction(history(), { now: options.now });
  assert.match(first.seed, /^[A-Za-z0-9_-]{1,128}$/);
  assert.match(first.id, /^[A-Za-z0-9_-]{1,128}$/);
  assert.notEqual(first.id, second.id);
  assert.notEqual(first.seed, second.seed);
  assert.throws(() => generatePrediction(history(), { ...options, seed: '<script>' }), /ASCII/);
  assert.throws(() => generatePrediction(history(), { ...options, id: '' }), /ASCII/);
  for (const prefix of ['_', '-']) {
    assert.throws(() => generatePrediction(history(), { ...options, seed: `${prefix}seed` }), /ASCII/);
    assert.throws(() => generatePrediction(history(), { ...options, id: `${prefix}id` }), /ASCII/);
  }
});

test('future results only evaluate the saved target and never regenerate the saved prediction', () => {
  const record = generatePrediction(history(), options);
  const original = JSON.stringify(record);
  assert.equal(evaluatePrediction(record, history()).status, 'pending');
  assert.equal(evaluatePrediction(record, [draw('2026-11-03'), ...history()]).status, 'pending');
  const result = evaluatePrediction(record, [draw('2026-11-03', [11, 12, 13, 14, 15, 16, 17]), draw(), ...history()]);
  assert.equal(result.status, 'drawn');
  assert.equal(result.drawDate, '2026-10-27');
  assert.deepEqual(result.mainNumbers, [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(result.supplementaryNumbers, [8, 9, 10]);
  assert.equal(JSON.stringify(record), original);
  assert.throws(() => generatePrediction([draw(), ...history()], options), /未来/);
});

test('all seven official Oz Lotto divisions and non-winning combinations are classified separately', () => {
  const cases = [
    [[1, 2, 3, 4, 5, 6, 7], 1], [[1, 2, 3, 4, 5, 6, 8], 2],
    [[1, 2, 3, 4, 5, 6, 11], 3], [[1, 2, 3, 4, 5, 8, 9], 4],
    [[1, 2, 3, 4, 5, 11, 12], 5], [[1, 2, 3, 4, 8, 9, 10], 6],
    [[1, 2, 3, 8, 9, 10, 11], 7], [[1, 2, 3, 11, 12, 13, 14], null],
    [[1, 2, 8, 9, 10, 11, 12], null]
  ];
  for (const [numbers, expected] of cases) {
    const result = evaluatePrediction(testRecord(numbers), [draw()]);
    assert.equal(result.status, 'drawn');
    assert.equal(result.groups[0].division, expected, numbers.join(','));
    assert.deepEqual(result.groups[0].mainHits, numbers.filter((number) => number <= 7));
    assert.deepEqual(result.groups[0].supplementaryHits, numbers.filter((number) => number >= 8 && number <= 10));
  }
});

test('late or leaking imported predictions are unverifiable, including exact DST-aware deadline', () => {
  const record = testRecord();
  assert.equal(evaluatePrediction({ ...record, createdAt: '2026-10-27T07:59:59Z' }, [draw()]).status, 'drawn');
  assert.equal(evaluatePrediction({ ...record, createdAt: '2026-10-27T08:00:00Z' }, [draw()]).status, 'unverifiable');
  assert.equal(evaluatePrediction({ ...record, createdAt: '2026-10-28T00:00:00Z' }, [draw()]).status, 'unverifiable');
  assert.equal(evaluatePrediction({ ...record, createdAt: '2026-10-19T12:59:59Z' }, [draw()]).status, 'unverifiable');
  assert.equal(evaluatePrediction({ ...record, source: { ...record.source, latestDate: record.targetDate } }, [draw()]).status, 'unverifiable');
  assert.equal(evaluatePrediction({ ...record, createdAt: 'invalid' }, [draw()]).status, 'unverifiable');
  assert.equal(evaluatePrediction(testRecord([1, 1, 2, 3, 4, 5, 6]), [draw()]).status, 'unverifiable');
  assert.equal(evaluatePrediction(record, [draw(), draw()]).status, 'unverifiable');
});
