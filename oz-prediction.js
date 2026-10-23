import { dateISO, normalizeRows, frequency, missingStats } from './analytics.js';
import { getGame, expectedLatestDrawISO } from './games.js';

export const MODEL_VERSION = 'oz-heuristics-v1';
const GAME = getGame('ozlotto');
const DAY = 86_400_000;
const WEEK = DAY * 7;
const TOKEN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const sydneyFormatter = new Intl.DateTimeFormat('en-AU', {
  timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});

const localTime = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError('Invalid prediction time.');
  const parts = Object.fromEntries(sydneyFormatter.formatToParts(date).map(({ type, value: text }) => [type, text]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour), minute: Number(parts.minute) };
};
const addWeek = (iso) => new Date(Date.parse(iso) + WEEK).toISOString().slice(0, 10);
const drawNumber = (iso) => GAME.firstDrawNumber + (Date.parse(iso) - Date.parse(GAME.firstDate)) / WEEK;
const atOrAfterCutoff = (time, targetDate) => time.date > targetDate || (time.date === targetDate && time.hour >= 19);

/** A stable change detector over every normalized row, including supplementary numbers. It is not a signature. */
const fingerprint = (rows) => {
  const input = JSON.stringify(rows);
  return 'oz-' + [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35].map((initial) => {
    let hash = initial;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }).join('');
};

/** The only eligible target is the next weekly draw after a complete, up-to-date source history. */
export const getPredictionContext = (rawRows, { now = new Date() } = {}) => {
  const clock = localTime(now);
  const expectedLatestDate = expectedLatestDrawISO(now, 'ozlotto');
  let rows = [];
  let invalidReason = '';
  try { rows = normalizeRows(rawRows, 'ozlotto'); }
  catch (error) { invalidReason = `开奖数据格式不正确：${error.message}`; }
  const latestDate = rows.length ? dateISO(rows[0][0]) : '';
  const targetDate = latestDate ? addWeek(latestDate) : '';
  const context = {
    rows, sampleSize: rows.length, latestDate,
    latestDrawNumber: latestDate ? drawNumber(latestDate) : null,
    targetDate, targetDrawNumber: targetDate ? drawNumber(targetDate) : null,
    expectedLatestDate, ready: false, reason: '', dataFingerprint: fingerprint(rows)
  };
  let reason = invalidReason;
  if (!reason && rows.length < 30) reason = `至少需要30期完整开奖数据，当前只有${rows.length}期。`;
  if (!reason && rows.some((row) => dateISO(row[0]) < GAME.ruleStart || !Number.isInteger(drawNumber(dateISO(row[0]))))) {
    reason = '历史日期不符合现行Oz Lotto规则下的周二开奖安排。';
  }
  if (!reason && rows.some((row, index) => index > 0 && Date.parse(dateISO(rows[index - 1][0])) - Date.parse(dateISO(row[0])) !== WEEK)) {
    reason = '历史开奖数据存在缺周，请先补齐数据后再预测。';
  }
  if (!reason && (latestDate > clock.date || (latestDate === clock.date && clock.hour < 19))) {
    reason = '数据包含尚未开奖的日期，不能将未来结果用于预测。';
  }
  if (!reason && latestDate < expectedLatestDate) {
    reason = `开奖数据尚未更新：目前最新为${latestDate}，至少应更新至${expectedLatestDate}。`;
  }
  if (!reason && atOrAfterCutoff(clock, targetDate)) {
    reason = `${targetDate}期已到悉尼时间19:00预测截止时间，请等待本期结果更新后预测下一期。`;
  }
  context.ready = !reason;
  context.reason = reason;
  return context;
};

const randomToken = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (globalThis.crypto?.getRandomValues) return Array.from(globalThis.crypto.getRandomValues(new Uint32Array(4)), (item) => item.toString(16).padStart(8, '0')).join('');
  throw new Error('当前环境不支持安全随机数，请使用现代浏览器。');
};
const seededRandom = (seed) => {
  let state = 0x811c9dc5;
  for (const character of seed) state = Math.imul(state ^ character.charCodeAt(0), 0x01000193);
  return () => {
    state |= 0;
    state = state + 0x6d2b79f5 | 0;
    let value = Math.imul(state ^ state >>> 15, 1 | state);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
};
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const half = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[half] : (sorted[half - 1] + sorted[half]) / 2;
};
const metricsFor = (numbers) => {
  const odds = numbers.filter((number) => number % 2).length;
  const low = numbers.filter((number) => number <= GAME.lowMax).length;
  return {
    sum: numbers.reduce((total, number) => total + number, 0), odds, evens: 7 - odds,
    low, high: 7 - low, span: numbers[6] - numbers[0],
    zones: GAME.zones.map(([min, max]) => numbers.filter((number) => number >= min && number <= max).length)
  };
};
const weightedSample = (weights, random) => {
  const remaining = weights.map((weight, index) => ({ number: index + 1, weight }));
  const selected = [];
  for (let count = 0; count < GAME.mainCount; count += 1) {
    const total = remaining.reduce((sum, item) => sum + item.weight, 0);
    let cursor = random() * total;
    let selectedIndex = remaining.length - 1;
    for (let index = 0; index < remaining.length; index += 1) {
      cursor -= remaining[index].weight;
      if (cursor < 0) { selectedIndex = index; break; }
    }
    selected.push(remaining.splice(selectedIndex, 1)[0].number);
  }
  return selected.sort((a, b) => a - b);
};
const overlap = (first, second) => first.filter((number) => second.includes(number)).length;
const structureScore = (metrics, historicalMedian) => {
  const sumFit = 1 / (1 + Math.abs(metrics.sum - historicalMedian) / 35);
  const balance = 1 - (Math.abs(metrics.odds - 3.5) + Math.abs(metrics.low - 3.5)) / 7;
  const zonesFit = 1 - metrics.zones.reduce((total, count) => total + Math.abs(count - 7 / 3), 0) / 10;
  return sumFit * 0.45 + balance * 0.3 + zonesFit * 0.25;
};
const chooseGroup = (weights, random, previousGroups, historicalMedian) => {
  let best = null;
  for (let attempt = 0; attempt < 240; attempt += 1) {
    const numbers = weightedSample(weights, random);
    const overlaps = previousGroups.map((group) => overlap(numbers, group.numbers));
    if (overlaps.some((count) => count > 3)) continue;
    const metrics = metricsFor(numbers);
    const score = structureScore(metrics, historicalMedian) + random() * 0.28 - overlaps.reduce((total, count) => total + count, 0) * 0.045;
    if (!best || score > best.score) best = { numbers, metrics, score };
  }
  // Bounded weights and a 47-number pool make this extremely unlikely; fail visibly instead of relaxing the rule.
  if (!best) throw new Error('未找到符合组间分散条件的组合，请重新开始预测。');
  return { numbers: best.numbers, metrics: best.metrics };
};
const ball = (number) => String(number).padStart(2, '0');
const structureReason = (metrics) => `本组和值${metrics.sum}，奇偶${metrics.odds}:${metrics.evens}，大小${metrics.low}:${metrics.high}（小号1–23），三区分布${metrics.zones.join(':')}（1–16／17–32／33–47）。`;
const deepFreeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

/** Manual generation only. Seeded weighted sampling expresses a historical preference, never a probability estimate. */
export const generatePrediction = (rawRows, { now = new Date(), seed = randomToken(), id = randomToken() } = {}) => {
  if (typeof seed !== 'string' || !TOKEN.test(seed) || typeof id !== 'string' || !TOKEN.test(id)) throw new TypeError('Prediction seed and id must be ASCII tokens of 1–128 characters.');
  const context = getPredictionContext(rawRows, { now });
  if (!context.ready) throw new Error(context.reason);
  const rows = context.rows;
  const recent = rows.slice(0, 30);
  const recentCounts = frequency(recent, 'main', 'ozlotto');
  const currentCounts = frequency(rows.slice(0, 10), 'main', 'ozlotto');
  const previousCounts = frequency(rows.slice(10, 20), 'main', 'ozlotto');
  const omissions = missingStats(rows, 'main', 'ozlotto');
  const historicalMedian = median(recent.map((row) => row.slice(1, 8).reduce((sum, number) => sum + number, 0)));
  const random = seededRandom(`${MODEL_VERSION}:${context.dataFingerprint}:${seed}`);
  const strategies = [
    { id: 'frequency', title: '近期频率', description: '近30期主号出现次数较多的号码获得温和抽样偏好。',
      weights: recentCounts.map(({ count }) => 0.8 + count / 3),
      details: (numbers) => `近30期主号出现次数：${numbers.map((number) => `${ball(number)}号${recentCounts[number - 1].count}次`).join('、')}。`,
      caveat: '频率仅记录历史；加权抽样和结构筛选不代表中奖概率提高。' },
    { id: 'trend', title: '趋势观察', description: '比较最近10期与之前10期，温和偏向主号频次上升者。',
      weights: currentCounts.map(({ count }, index) => Math.max(0.6, 1.8 + (count - previousCounts[index].count) * 0.22)),
      details: (numbers) => `主号出现次数（最近10期／之前10期）：${numbers.map((number) => `${ball(number)}号${currentCounts[number - 1].count}/${previousCounts[number - 1].count}`).join('、')}。`,
      caveat: '短期上升可能只是随机波动，趋势观察不代表下一期更容易出现。' },
    { id: 'omission', title: '遗漏观察', description: '适度纳入近期未出现的主号，遗漏权重设有上限。',
      weights: omissions.map(({ missing }) => 0.9 + Math.min(missing, 20) / 12),
      details: (numbers) => `距最新一期的主号遗漏：${numbers.map((number) => `${ball(number)}号${omissions[number - 1].bounded ? '至少' : ''}${omissions[number - 1].missing}期`).join('、')}（0表示最新一期已出现）。`,
      caveat: '遗漏不等于“该出了”；独立开奖不会补偿此前的缺席。' },
    { id: 'balanced', title: '分散均衡', description: '从均匀抽样开始，温和考虑结构及组间分散程度。',
      weights: Array.from({ length: GAME.mainSize }, () => 1),
      details: () => `近30期开奖主号和值中位数为${historicalMedian}；结构评分围绕历史中心作软筛选，不设硬性和值或奇偶规则。`,
      caveat: '分散结构用于组织备选号码；每个合法7号码组合的理论中奖机会相同。' }
  ];
  const groups = [];
  for (const strategy of strategies) {
    const selected = chooseGroup(strategy.weights, random, groups, historicalMedian);
    groups.push({
      id: strategy.id, title: strategy.title, description: strategy.description,
      numbers: selected.numbers,
      reasons: [strategy.details(selected.numbers), structureReason(selected.metrics), strategy.caveat],
      metrics: selected.metrics
    });
  }
  return deepFreeze({
    id, schemaVersion: 1, modelVersion: MODEL_VERSION, createdAt: new Date(now).toISOString(),
    targetDate: context.targetDate, targetDrawNumber: context.targetDrawNumber,
    source: { latestDate: context.latestDate, latestDrawNumber: context.latestDrawNumber, sampleSize: context.sampleSize, dataFingerprint: context.dataFingerprint },
    seed, groups
  });
};

// Official standard-game divisions: https://www.lotterywest.wa.gov.au/games/oz-lotto
const divisionFor = (main, supplementary) => {
  if (main === 7) return 1;
  if (main === 6) return supplementary >= 1 ? 2 : 3;
  if (main === 5) return supplementary >= 1 ? 4 : 5;
  if (main === 4) return 6;
  if (main === 3 && supplementary >= 1) return 7;
  return null;
};

/** Evaluate exactly the saved target draw. Later results never regenerate or mutate a saved record. */
export const evaluatePrediction = (record, rawRows) => {
  const empty = (status) => ({ status, drawDate: record?.targetDate || '', mainNumbers: [], supplementaryNumbers: [], groups: [] });
  try {
    if (!record || record.schemaVersion !== 1 || !dateISO(record.targetDate) || !dateISO(record.source?.latestDate) || !Array.isArray(record.groups)) return empty('unverifiable');
    const created = localTime(record.createdAt);
    if (record.source.latestDate >= record.targetDate || addWeek(record.source.latestDate) !== record.targetDate || created.date < record.source.latestDate || atOrAfterCutoff(created, record.targetDate)) return empty('unverifiable');
    if (record.groups.some((group) => !Array.isArray(group.numbers) || group.numbers.length !== 7 || new Set(group.numbers).size !== 7 || group.numbers.some((number) => !Number.isInteger(number) || number < 1 || number > 47))) return empty('unverifiable');
    const rows = normalizeRows(rawRows, 'ozlotto');
    const row = rows.find((item) => dateISO(item[0]) === record.targetDate);
    if (!row) return empty('pending');
    const mainNumbers = row.slice(1, 8);
    const supplementaryNumbers = row.slice(8, 11);
    return {
      status: 'drawn', drawDate: record.targetDate, mainNumbers, supplementaryNumbers,
      groups: record.groups.map((group) => {
        const mainHits = group.numbers.filter((number) => mainNumbers.includes(number));
        const supplementaryHits = group.numbers.filter((number) => supplementaryNumbers.includes(number));
        return { id: group.id, mainHits, supplementaryHits, division: divisionFor(mainHits.length, supplementaryHits.length) };
      })
    };
  } catch { return empty('unverifiable'); }
};
