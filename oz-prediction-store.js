import { parseDate } from './analytics.js';
import { GAMES } from './games.js';

export const STORAGE_KEY = 'oz-lotto-predictions:v1';
export const MAX_RECORDS = 1000;
export const MAX_BYTES = 5 * 1024 * 1024;

const FORMAT = 'oz-lotto-predictions';
const WEEK = 7 * 86_400_000;
const game = GAMES.ozlotto;
const anchor = parseDate(game.firstDate).getTime();
const sydney = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
});

const invalid = (message) => { throw new Error(`预测记录无效：${message}`); };

const object = (value, keys, label) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid(`${label}必须是普通对象。`);
  const own = Object.getOwnPropertyNames(value);
  if (own.length !== keys.length || own.some((key) => !keys.includes(key))
      || keys.some((key) => !Object.hasOwn(value, key) || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'))
      || Object.getOwnPropertySymbols(value).length) invalid(`${label}字段不完整或含有未知字段。`);
};

const text = (value, max, label) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[<>\u0000-\u001f\u007f]/u.test(value)) {
    invalid(`${label}必须是1～${max}字的纯文本，不能含HTML或控制字符。`);
  }
  return value;
};

const token = (value, max, label) => {
  if (typeof value !== 'string' || value.length > max || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value)) {
    invalid(`${label}格式错误或超过${max}个字符。`);
  }
  return value;
};

const integer = (value, min, max, label) => {
  if (!Number.isSafeInteger(value) || value < min || value > max) invalid(`${label}超出有效整数范围。`);
  return value;
};

const calendarDate = (value, label) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) invalid(`${label}必须是完整ISO日期。`);
  const date = parseDate(value);
  if (!date || date.getUTCDay() !== game.drawDay || value < game.ruleStart) invalid(`${label}必须是现行规则期间的有效周二日期。`);
  return date;
};

const timestamp = (value, label) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) invalid(`${label}必须是完整UTC时间。`);
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) invalid(`${label}不是有效时间。`);
  return date;
};

const localParts = (date) => Object.fromEntries(sydney.formatToParts(date).map(({ type, value }) => [type, value]));

const canonicalGroup = (group, index) => {
  const label = `第${index + 1}组`;
  object(group, ['id', 'title', 'description', 'numbers', 'reasons', 'metrics'], label);
  const id = token(group.id, 64, `${label}标识`);
  const title = text(group.title, 120, `${label}标题`);
  const description = text(group.description, 1200, `${label}说明`);
  if (!Array.isArray(group.numbers) || group.numbers.length !== game.mainCount) invalid(`${label}必须有7个主号。`);
  const numbers = Array.from(group.numbers, (value) => integer(value, 1, game.mainSize, `${label}号码`));
  if (numbers.some((number, position) => position && number <= numbers[position - 1])) invalid(`${label}号码必须升序且不重复。`);
  if (!Array.isArray(group.reasons) || group.reasons.length < 2 || group.reasons.length > 12) invalid(`${label}必须有2～12条解释。`);
  const reasons = Array.from(group.reasons, (reason) => text(reason, 600, `${label}解释`));
  object(group.metrics, ['sum', 'odds', 'evens', 'low', 'high', 'span', 'zones'], `${label}结构指标`);
  const odds = numbers.filter((number) => number % 2 === 1).length;
  const low = numbers.filter((number) => number <= game.lowMax).length;
  const expected = {
    sum: numbers.reduce((total, number) => total + number, 0),
    odds, evens: game.mainCount - odds, low, high: game.mainCount - low,
    span: numbers.at(-1) - numbers[0],
    zones: game.zones.map(([min, max]) => numbers.filter((number) => number >= min && number <= max).length)
  };
  for (const key of ['sum', 'odds', 'evens', 'low', 'high', 'span']) {
    if (group.metrics[key] !== expected[key]) invalid(`${label}的${key}指标与号码不符。`);
  }
  if (!Array.isArray(group.metrics.zones) || group.metrics.zones.length !== expected.zones.length
      || expected.zones.some((count, position) => group.metrics.zones[position] !== count)) invalid(`${label}区间指标与号码不符。`);
  return { id, title, description, numbers, reasons, metrics: expected };
};

/** Validate imported JSON as data and reconstruct every object in a fixed order. */
export const validatePredictionRecord = (record) => {
  object(record, ['id', 'schemaVersion', 'modelVersion', 'createdAt', 'targetDate', 'targetDrawNumber', 'source', 'seed', 'groups'], '记录');
  const id = token(record.id, 160, '记录标识');
  if (record.schemaVersion !== 1) invalid('不支持此记录版本。');
  const modelVersion = token(record.modelVersion, 100, '模型版本');
  const createdAt = timestamp(record.createdAt, '生成时间');
  const target = calendarDate(record.targetDate, '目标日期');
  object(record.source, ['latestDate', 'latestDrawNumber', 'sampleSize', 'dataFingerprint'], '数据来源');
  const latest = calendarDate(record.source.latestDate, '来源最新日期');
  const expectedDraw = game.firstDrawNumber + (latest.getTime() - anchor) / WEEK;
  const latestDrawNumber = integer(record.source.latestDrawNumber, game.ruleFirstDraw, 1_000_000, '来源期号');
  if (latestDrawNumber !== expectedDraw) invalid('来源期号与开奖周次不符。');
  const targetDrawNumber = integer(record.targetDrawNumber, game.ruleFirstDraw + 1, 1_000_000, '目标期号');
  if (target.getTime() - latest.getTime() !== WEEK || targetDrawNumber !== latestDrawNumber + 1) invalid('目标必须是来源最新一期的下周及下一期。');
  const sampleSize = integer(record.source.sampleSize, 30, latestDrawNumber - game.ruleFirstDraw + 1, '样本期数');
  const dataFingerprint = token(record.source.dataFingerprint, 256, '数据指纹');
  const local = localParts(createdAt);
  const localDate = `${local.year}-${local.month}-${local.day}`;
  if (localDate < record.source.latestDate || localDate > record.targetDate
      || (localDate === record.targetDate && Number(local.hour) >= 19)) invalid('生成时间必须在来源日期开始后、目标日期悉尼时间19:00之前。');
  const seed = token(record.seed, 256, '随机种子');
  if (!Array.isArray(record.groups) || record.groups.length !== 4) invalid('每份预测必须有4组推荐号码。');
  const groups = Array.from(record.groups, canonicalGroup);
  if (new Set(groups.map((group) => group.id)).size !== groups.length) invalid('组标识不能重复。');
  if (new Set(groups.map((group) => group.numbers.join(','))).size !== groups.length) invalid('推荐组的号码组合不能重复。');
  return {
    id, schemaVersion: 1, modelVersion, createdAt: createdAt.toISOString(),
    targetDate: record.targetDate, targetDrawNumber,
    source: { latestDate: record.source.latestDate, latestDrawNumber, sampleSize, dataFingerprint }, seed, groups
  };
};

const canonicalRecords = (records) => {
  if (!Array.isArray(records)) invalid('记录必须为数组。');
  const result = [];
  const byId = new Map();
  for (const record of records) {
    const canonical = validatePredictionRecord(record);
    const encoded = JSON.stringify(canonical);
    if (byId.has(canonical.id)) {
      if (byId.get(canonical.id) !== encoded) invalid(`记录标识 ${canonical.id} 冲突，原有记录已保留。`);
    } else {
      if (result.length >= MAX_RECORDS) invalid(`最多${MAX_RECORDS}份记录；请先导出备份，系统不会自动删除旧记录。`);
      byId.set(canonical.id, encoded);
      result.push(canonical);
    }
  }
  return result;
};

const checkSize = (json) => {
  if (typeof json !== 'string') invalid('备份必须是JSON文本。');
  if (json.length > MAX_BYTES || new TextEncoder().encode(json).length > MAX_BYTES) invalid('记录超过5MB限制；原有记录已保留，请先导出备份。');
};

const parseEnvelope = (json) => {
  checkSize(json);
  let envelope;
  try { envelope = JSON.parse(json); }
  catch { invalid('JSON内容损坏；请导出原始存储内容并检查，不能覆盖现有数据。'); }
  object(envelope, ['format', 'schemaVersion', 'exportedAt', 'records'], '备份');
  if (envelope.format !== FORMAT || envelope.schemaVersion !== 1) invalid('备份格式或版本不受支持。');
  timestamp(envelope.exportedAt, '备份时间');
  return canonicalRecords(envelope.records);
};

const storageFailure = (error, operation) => {
  if (error?.name === 'QuotaExceededError' || error?.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
    return new Error('保存失败：浏览器存储空间不足。原有记录已保留，请先导出备份。');
  }
  return new Error(`${operation}失败：浏览器本地存储不可用或被禁用。请允许本站保存数据后重试。`);
};

const resolveStorage = (storage) => {
  try {
    const resolved = storage === undefined ? globalThis.localStorage : storage;
    if (!resolved || typeof resolved.getItem !== 'function' || typeof resolved.setItem !== 'function') throw new Error('Storage unavailable');
    return resolved;
  } catch (error) { throw storageFailure(error, '读取'); }
};

/** Missing data is empty; unreadable or corrupt data always remains an error. */
export const loadPredictions = (storage) => {
  const resolved = resolveStorage(storage);
  let json;
  try { json = resolved.getItem(STORAGE_KEY); }
  catch (error) { throw storageFailure(error, '读取'); }
  return json === null ? [] : parseEnvelope(json);
};

export const exportPredictions = (records) => {
  const json = JSON.stringify({ format: FORMAT, schemaVersion: 1, exportedAt: new Date().toISOString(), records: canonicalRecords(records) });
  checkSize(json);
  return json;
};

const mergeAndWrite = (incoming, storage) => {
  const resolved = resolveStorage(storage);
  const previous = loadPredictions(resolved);
  const merged = canonicalRecords([...previous, ...incoming]);
  // A repeated save/import is idempotent, including when writes are disabled.
  if (JSON.stringify(merged) === JSON.stringify(previous)) return merged;
  const json = exportPredictions(merged);
  try { resolved.setItem(STORAGE_KEY, json); }
  catch (error) { throw storageFailure(error, '保存'); }
  return merged;
};

export const savePrediction = (record, storage) => mergeAndWrite([validatePredictionRecord(record)], storage);

/** Validate the entire backup before attempting a single atomic storage write. */
export const importPredictions = (json, storage) => mergeAndWrite(parseEnvelope(json), storage);
