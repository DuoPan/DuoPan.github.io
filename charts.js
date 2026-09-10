import { parseDate, drawStats } from "./analytics.js";

export const CHART_COPY = {
  zh: {
    "chart.oddEven": "主球奇偶比例", "chart.lowHigh": "主球大小比例", "chart.pbOddEven": "PB 奇偶比例",
    "chart.range": "主球区间分布", "chart.sumTrend": "和值走势", "chart.odd": "奇数", "chart.even": "偶数",
    "chart.low": "小号 1–17", "chart.high": "大号 18–35", "chart.actual": "实际", "chart.expected": "理论期望",
    "chart.count": "次", "chart.samples": "样本期数",
    "chart.referenceNote": "竖线表示理论比例；历史偏差不代表下一期概率变化。",
    "chart.rangeNote": "期望次数按每组号码数量计算：10、10、10、5。",
    "chart.trendHelp": "悬停或聚焦查看数据；左右方向键切换，点击或回车打开单期详情。手机可横向滑动。",
    "chart.sumReference": "理论平均和值 126", "chart.drawPicker": "查看某期", "chart.openDraw": "打开单期详情",
    "chart.mainNumbers": "主球", "chart.empty": "当前范围没有开奖记录，请调整时间范围。", "chart.sum": "和值"
  },
  en: {
    "chart.oddEven": "Main ball parity", "chart.lowHigh": "Main ball low / high", "chart.pbOddEven": "Powerball parity",
    "chart.range": "Main ball ranges", "chart.sumTrend": "Sum over time", "chart.odd": "Odd", "chart.even": "Even",
    "chart.low": "Low 1–17", "chart.high": "High 18–35", "chart.actual": "Observed", "chart.expected": "Expected",
    "chart.count": "occurrences", "chart.samples": "Draws in sample",
    "chart.referenceNote": "Markers show theoretical shares. Historical deviations do not change next-draw probabilities.",
    "chart.rangeNote": "Expected counts use each range’s size: 10, 10, 10 and 5 numbers.",
    "chart.trendHelp": "Hover or focus to inspect; use arrow keys to move and click or Enter for draw details. Swipe horizontally on mobile.",
    "chart.sumReference": "Expected mean sum 126", "chart.drawPicker": "Inspect a draw", "chart.openDraw": "Open draw details",
    "chart.mainNumbers": "Main balls", "chart.empty": "No draws in this range. Adjust the date range to continue.", "chart.sum": "Sum"
  }
};

const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[character]));
const percent = (value) => `${(value * 100).toFixed(1)}%`;
const expectedCount = (value) => Number.isInteger(value) ? String(value) : value.toFixed(1);

/** Main-ball counts are appearances, so their denominator is seven times the draw count. */
export const summarizeCharts = (data) => {
  const summary = { draws: data.length, mainTotal: data.length * 7, odd: 0, even: 0, low: 0, high: 0, pbOdd: 0, pbEven: 0, buckets: [0, 0, 0, 0] };
  data.forEach((row) => {
    const stats = drawStats(row);
    summary.odd += stats.odds;
    summary.even += stats.evens;
    summary.low += stats.low;
    summary.high += stats.high;
    stats.buckets.forEach((count, index) => { summary.buckets[index] += count; });
    summary[Number(row[8]) % 2 ? "pbOdd" : "pbEven"] += 1;
  });
  summary.expectedBuckets = [10, 10, 10, 5].map((size) => summary.mainTotal * size / 35);
  return summary;
};

/** Place points on a real time axis, preserving longer gaps between draw dates. */
export const buildSumTrend = (data) => {
  const rows = [...data].sort((a, b) => Number(parseDate(a[0])) - Number(parseDate(b[0])));
  // Keep an overview of the entire selected period, including the full archive.
  // The draw picker and keyboard navigation make dense observations accessible.
  const width = Math.max(640, Math.min(960, (rows.length - 1) * 12 + 100));
  const height = 280;
  const left = 52;
  const right = width - 32;
  const top = 28;
  const bottom = height - 50;
  if (!rows.length) return { rows, points: [], ticks: [], width, height, left, right, top, bottom, min: 0, max: 0 };
  const sums = rows.map((row) => drawStats(row).sum);
  // Include the theoretical mean (7 × 18) so every range has a visible reference.
  const min = Math.floor((Math.min(126, ...sums) - 5) / 10) * 10;
  const max = Math.ceil((Math.max(126, ...sums) + 5) / 10) * 10;
  const firstDate = Number(parseDate(rows[0][0]));
  const lastDate = Number(parseDate(rows.at(-1)[0]));
  const y = (value) => bottom - (value - min) / (max - min) * (bottom - top);
  const points = rows.map((row, index) => ({
    row, sum: sums[index],
    x: lastDate === firstDate ? (left + right) / 2 : left + (Number(parseDate(row[0])) - firstDate) / (lastDate - firstDate) * (right - left),
    y: y(sums[index])
  }));
  // Date labels follow sampled real draws rather than synthetic draw indexes.
  const tickCount = Math.min(rows.length, Math.max(2, Math.floor(width / 170)));
  const tickIndexes = new Set(Array.from({ length: tickCount }, (_, index) => Math.round(index * (rows.length - 1) / Math.max(1, tickCount - 1))));
  return { rows, points, ticks: [...tickIndexes].map((index) => points[index]), width, height, left, right, top, bottom, min, max, referenceY: y(126) };
};

const sampleText = (rows, t) => `${t("chart.samples")}: ${rows.length}${rows.length ? ` · ${rows[0][0]} — ${rows.at(-1)[0]}` : ""}`;

const buildComparison = (label, count, total, theoretical, t) => {
  const share = total ? count / total : 0;
  return `<div class="chart-ratio-row">
    <div class="chart-ratio-heading"><span>${escapeHTML(label)}</span><strong>${count} ${escapeHTML(t("chart.count"))} · ${percent(share)}</strong></div>
    <div class="bar-track chart-ratio" role="img" aria-label="${escapeHTML(`${label}: ${t("chart.actual")} ${percent(share)}, ${t("chart.expected")} ${percent(theoretical)}`)}">
      <div class="bar-fill" style="width:${share * 100}%"></div>
      <span class="chart-reference" style="left:${theoretical * 100}%" aria-hidden="true"></span>
    </div>
    <div class="chart-meta">${escapeHTML(t("chart.expected"))}: ${expectedCount(total * theoretical)} ${escapeHTML(t("chart.count"))} · ${percent(theoretical)}</div>
  </div>`;
};

const buildLine = (series, t) => {
  const { points, ticks, width, height, left, right, top, bottom, min, max, referenceY } = series;
  const description = `${t("chart.samples")}: ${points.length}; ${points[0].row[0]} — ${points.at(-1).row[0]}; ${t("chart.sumReference")}. ${t("chart.trendHelp")}`;
  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const value = min + (max - min) * index / 4;
    const y = bottom - (bottom - top) * index / 4;
    return `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" class="chart-tick"></line><text x="${left - 10}" y="${y + 4}" text-anchor="end" class="chart-axis-label">${Number(value.toFixed(1))}</text>`;
  }).join("");
  return `<div class="chart-scroll" tabindex="0" role="region" aria-label="${escapeHTML(t("chart.sumTrend"))}">
    <svg viewBox="0 0 ${width} ${height}" class="chart-svg line" style="min-width:${width}px" role="img" aria-labelledby="sumChartTitle sumChartDescription">
      <title id="sumChartTitle">${escapeHTML(t("chart.sumTrend"))}</title>
      <desc id="sumChartDescription">${escapeHTML(description)}</desc>
      ${yTicks}
      <line x1="${left}" y1="${top}" x2="${left}" y2="${bottom}" class="chart-axis"></line>
      <line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" class="chart-axis"></line>
      <line x1="${left}" y1="${referenceY}" x2="${right}" y2="${referenceY}" class="chart-mean-line" stroke="#947047" stroke-dasharray="6 5"></line>
      <text x="${left}" y="16" class="chart-axis-label">${escapeHTML(t("chart.sum"))}</text>
      ${ticks.map((point, index) => `<text x="${point.x}" y="${bottom + 24}" text-anchor="${ticks.length === 1 ? "middle" : index === 0 ? "start" : index === ticks.length - 1 ? "end" : "middle"}" class="chart-axis-label">${escapeHTML(point.row[0])}</text>`).join("")}
      <polyline points="${points.map(({ x, y }) => `${x},${y}`).join(" ")}" fill="none" stroke="#168574" stroke-width="2"></polyline>
      ${points.map((point, index) => `<g class="chart-point${index === points.length - 1 ? " is-selected" : ""}" data-chart-index="${index}" tabindex="${index === points.length - 1 ? "0" : "-1"}" role="button" aria-label="${escapeHTML(`${point.row[0]}, ${t("chart.mainNumbers")} ${point.row.slice(1, 8).join(", ")}, PB ${point.row[8]}, ${t("chart.sum")} ${point.sum}, ${t("chart.openDraw")}`)}">
        <title>${escapeHTML(`${point.row[0]} · ${t("chart.sum")}: ${point.sum}`)}</title>
        <circle cx="${point.x}" cy="${point.y}" r="10" fill="transparent"></circle>
        <circle class="chart-dot" cx="${point.x}" cy="${point.y}" r="4" fill="#168574" stroke="#ffffff" stroke-width="1.5"></circle>
      </g>`).join("")}
    </svg>
  </div>`;
};

const renderCharts = ({ data, t, onDrawSelect }) => {
  const wrapper = document.getElementById("wrapper");
  const container = document.createElement("div");
  container.className = "table remove charts-view";
  if (!data.length) {
    container.innerHTML = `<p class="empty-state">${escapeHTML(t("chart.empty"))}</p>`;
    wrapper.appendChild(container);
    return;
  }
  const summary = summarizeCharts(data);
  const series = buildSumTrend(data);
  const sample = escapeHTML(sampleText(series.rows, t));
  const ratioCard = (title, comparisons) => `<section class="chart-card"><h3 class="chart-title">${escapeHTML(t(title))}</h3><p class="chart-meta">${sample}</p>${comparisons}</section>`;
  container.innerHTML = `
    <p class="chart-summary">${escapeHTML(t("chart.referenceNote"))}</p>
    <div class="chart-grid pies">
      ${ratioCard("chart.oddEven", buildComparison(t("chart.odd"), summary.odd, summary.mainTotal, 18 / 35, t) + buildComparison(t("chart.even"), summary.even, summary.mainTotal, 17 / 35, t))}
      ${ratioCard("chart.lowHigh", buildComparison(t("chart.low"), summary.low, summary.mainTotal, 17 / 35, t) + buildComparison(t("chart.high"), summary.high, summary.mainTotal, 18 / 35, t))}
      ${ratioCard("chart.pbOddEven", buildComparison(t("chart.odd"), summary.pbOdd, summary.draws, 0.5, t) + buildComparison(t("chart.even"), summary.pbEven, summary.draws, 0.5, t))}
    </div>
    <div class="chart-grid">
      <section class="chart-card chart-wide"><h3 class="chart-title">${escapeHTML(t("chart.range"))}</h3><p class="chart-meta">${sample}</p>
        <div class="chart-buckets">${["1–10", "11–20", "21–30", "31–35"].map((label, index) => buildComparison(label, summary.buckets[index], summary.mainTotal, [10, 10, 10, 5][index] / 35, t)).join("")}</div>
        <p class="chart-meta">${escapeHTML(t("chart.rangeNote"))}</p>
      </section>
      <section class="chart-card chart-wide"><h3 class="chart-title">${escapeHTML(t("chart.sumTrend"))}</h3><p class="chart-meta">${sample}</p>
        <p class="chart-meta">${escapeHTML(t("chart.trendHelp"))}</p>
        ${buildLine(series, t)}
        <p class="chart-meta chart-mean-caption">${escapeHTML(t("chart.sumReference"))}</p>
        <div class="chart-inspector">
          <label for="chartDrawSelect">${escapeHTML(t("chart.drawPicker"))}</label>
          <select id="chartDrawSelect" class="legend-select">${series.rows.map((row, index) => `<option value="${index}">${escapeHTML(row[0])}</option>`).reverse().join("")}</select>
          ${onDrawSelect ? `<button type="button" class="page-btn chart-open-draw">${escapeHTML(t("chart.openDraw"))}</button>` : ""}
        </div>
        <p class="chart-observation" aria-live="polite" aria-atomic="true"></p>
      </section>
    </div>`;
  wrapper.appendChild(container);

  const pointElements = [...container.querySelectorAll(".chart-point")];
  const select = container.querySelector("#chartDrawSelect");
  const observation = container.querySelector(".chart-observation");
  let selectedIndex = series.points.length - 1;
  const inspect = (index) => {
    selectedIndex = index;
    const { row, sum } = series.points[index];
    select.value = String(index);
    observation.textContent = `${row[0]} · ${t("chart.mainNumbers")}: ${row.slice(1, 8).join(" · ")} · PB: ${row[8]} · ${t("chart.sum")}: ${sum}`;
    pointElements.forEach((point, pointIndex) => {
      point.classList.toggle("is-selected", pointIndex === index);
      point.setAttribute("tabindex", pointIndex === index ? "0" : "-1");
    });
  };
  const focusPoint = (index) => {
    inspect(index);
    pointElements[index].focus({ preventScroll: true });
    pointElements[index].scrollIntoView({ block: "nearest", inline: "center" });
  };
  pointElements.forEach((point, index) => {
    point.addEventListener("pointerenter", () => inspect(index));
    point.addEventListener("focus", () => inspect(index));
    point.addEventListener("click", () => { inspect(index); onDrawSelect?.(series.rows[index]); });
    point.addEventListener("keydown", (event) => {
      const directions = { ArrowLeft: Math.max(0, index - 1), ArrowRight: Math.min(pointElements.length - 1, index + 1), Home: 0, End: pointElements.length - 1 };
      if (event.key in directions) {
        event.preventDefault();
        focusPoint(directions[event.key]);
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onDrawSelect?.(series.rows[index]);
      }
    });
  });
  select.addEventListener("change", () => {
    inspect(Number(select.value));
    pointElements[selectedIndex].scrollIntoView({ block: "nearest", inline: "center" });
  });
  container.querySelector(".chart-open-draw")?.addEventListener("click", () => onDrawSelect(series.rows[selectedIndex]));
  inspect(selectedIndex);
};

export default renderCharts;
