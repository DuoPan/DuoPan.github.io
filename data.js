export const parseDateFromRow = (dateStr) => {
  if (!dateStr) return null;
  const parts = dateStr.split("/");
  if (parts.length !== 3) return null;
  const day = Number(parts[0]);
  const month = Number(parts[1]);
  let year = Number(parts[2]);
  if (year < 100) {
    year += 2000;
  }
  if (!day || !month || !year) return null;
  return new Date(Date.UTC(year, month - 1, day));
};

const parseIsoDate = (dateStr) => {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day));
};

export const formatDate = (date) => {
  if (!date) return "--";
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = String(date.getUTCFullYear());
  return `${day}/${month}/${year}`;
};

const rowMatchesNumberRange = (row, min, max) => {
  if (!min && !max) return true;
  const minVal = Number(min);
  const maxVal = Number(max);
  if (!minVal && !maxVal) return true;
  const lo = Math.min(minVal || 1, maxVal || 35);
  const hi = Math.max(minVal || 1, maxVal || 35);
  const nums = row.slice(1, 8).map(Number);
  const pb = Number(row[8]);
  return nums.some((n) => n >= lo && n <= hi) || (pb >= lo && pb <= hi);
};

const maxRunLength = (nums) => {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  let maxRun = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i] === sorted[i - 1] + 1) {
      current += 1;
    } else {
      current = 1;
    }
    maxRun = Math.max(maxRun, current);
  }
  return maxRun;
};

export const applyFilters = (data, filters) => {
  if (!filters) return data;
  const start = parseIsoDate(filters.dateFrom);
  const end = parseIsoDate(filters.dateTo);
  const minRun = Number(filters.minRun || 0);

  let filtered = data.filter((row) => {
    const date = parseDateFromRow(row[0]);
    if (start && date && date < start) return false;
    if (end && date && date > end) return false;
    if (!rowMatchesNumberRange(row, filters.numMin, filters.numMax)) return false;
    if (minRun > 0) {
      const run = maxRunLength(row.slice(1, 8).map(Number));
      if (run < minRun) return false;
    }
    return true;
  });

  const frequency = buildFrequencyMap(filtered);
  const minFreq = Number(filters.minFreq || 0);
  if (minFreq > 0) {
    filtered = filtered.filter((row) => {
      const nums = row.slice(1, 8).map(Number);
      return nums.some((n) => (frequency.main[n] || 0) >= minFreq);
    });
  }
  return filtered;
};

export const buildFrequencyMap = (data) => {
  const main = {};
  const pb = {};
  let maxMain = 0;
  let maxPb = 0;
  data.forEach((row) => {
    row.slice(1, 8).forEach((value) => {
      const num = Number(value);
      main[num] = (main[num] || 0) + 1;
      maxMain = Math.max(maxMain, main[num]);
    });
    const pbNum = Number(row[8]);
    pb[pbNum] = (pb[pbNum] || 0) + 1;
    maxPb = Math.max(maxPb, pb[pbNum]);
  });
  return { main, pb, maxMain, maxPb };
};

export const getOverviewStats = (data) => {
  const totalDraws = data.length;
  let minDate = null;
  let maxDate = null;
  const numberSet = new Set();

  data.forEach((row) => {
    const date = parseDateFromRow(row[0]);
    if (date) {
      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;
    }
    row.slice(1, 8).forEach((value) => numberSet.add(Number(value)));
  });

  return {
    totalDraws,
    minDate,
    maxDate,
    latestDate: maxDate,
    uniqueNumbers: numberSet.size
  };
};

const lerp = (a, b, t) => Math.round(a + (b - a) * t);
const mixColor = (from, to, t) => {
  const r = lerp(from[0], to[0], t);
  const g = lerp(from[1], to[1], t);
  const b = lerp(from[2], to[2], t);
  return `rgb(${r}, ${g}, ${b})`;
};

export const getHeatColor = (value) => {
  const t = Math.min(Math.max(value, 0), 1);
  const stops = [
    { pos: 0, color: [214, 235, 255] },
    { pos: 0.5, color: [255, 224, 130] },
    { pos: 0.8, color: [255, 183, 77] },
    { pos: 1, color: [239, 83, 80] }
  ];

  for (let i = 1; i < stops.length; i += 1) {
    if (t <= stops[i].pos) {
      const localT = (t - stops[i - 1].pos) / (stops[i].pos - stops[i - 1].pos);
      return mixColor(stops[i - 1].color, stops[i].color, localT);
    }
  }
  return mixColor(stops[stops.length - 2].color, stops[stops.length - 1].color, 1);
};
