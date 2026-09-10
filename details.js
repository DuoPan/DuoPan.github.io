import { drawStats, frequency, missingStats } from "./analytics.js";

export const DETAIL_COPY = {
  zh: {
    "detailView.drawTitle": "{date} 开奖详情", "detailView.numberTitle": "{pool} {number}",
    "detailView.main": "主球", "detailView.pb": "PB", "detailView.mainBalls": "7 个主球",
    "detailView.numberAction": "查看{pool} {number} 的详情", "detailView.drawAction": "查看 {date} 开奖详情",
    "detailView.watched": "已关注", "detailView.watch": "关注号码", "detailView.unwatch": "取消关注",
    "detailView.watchAction": "关注{pool} {number}", "detailView.unwatchAction": "取消关注{pool} {number}",
    "detailView.sum": "和值", "detailView.average": "平均值", "detailView.oddEven": "奇数 / 偶数",
    "detailView.lowHigh": "小号 / 大号", "detailView.span": "跨度", "detailView.maxRun": "最长连号",
    "detailView.median": "中位数", "detailView.sd": "标准差", "detailView.structure": "本期主球结构",
    "detailView.structureNote": "结构指标只计算主球。小号为 1–17，大号为 18–35；标准差按本期全部 7 个主球计算。",
    "detailView.buckets": "号码区间分布", "detailView.bucketCount": "{count} 个",
    "detailView.sampleTitle": "所选范围内的表现", "detailView.sampleRange": "{from} 至 {to}，共 {count} 期",
    "detailView.count": "出现次数", "detailView.rate": "出现率", "detailView.sample": "样本期数",
    "detailView.baseline": "理论出现率", "detailView.historyTitle": "截至所选截止期的遗漏",
    "detailView.asOf": "截至 {date}，使用 {count} 期完整可用历史。",
    "detailView.missing": "当前遗漏", "detailView.lastDate": "上次出现", "detailView.maxMissing": "最长完整遗漏",
    "detailView.unseen": "未观察到", "detailView.noData": "该范围没有开奖数据。", "detailView.noHistory": "截止期之前没有可用历史。",
    "detailView.omissionNote": "遗漏从截止期向前统计，允许早于所选范围起始日期。≥ 为观察下限；最长完整遗漏只统计两次已知出现之间的间隔，不含历史首尾未完成的间隔。",
    "detailView.chartTitle": "滚动 10 期出现率", "detailView.chartNote": "每个点仅使用该期及之前最多 9 期；所选范围开头不足 10 期时，按实际样本数计算。",
    "detailView.chartDescription": "{pool} {number} 的历史滚动出现率，共 {count} 个观测点，理论参考线为 {rate}。",
    "detailView.observed": "历史出现率", "detailView.reference": "理论参考 {rate}",
    "detailView.point": "{date}：{count}/{sample} 期，{rate}",
    "detailView.timelineTitle": "最近 {count} 期命中轨迹", "detailView.timelineNote": "从旧到新排列。● 表示出现，— 表示未出现；点击任意一期查看开奖。",
    "detailView.hit": "出现", "detailView.miss": "未出现", "detailView.timelineAction": "{date}，{status}，查看开奖详情",
    "detailView.appearancesTitle": "所选范围内的全部出现日期（{count}）", "detailView.noAppearances": "该号码未在所选范围内出现。",
    "detailView.randomNote": "历史频率和遗漏描述已有记录，不改变公平独立开奖中下一期的理论概率。"
  },
  en: {
    "detailView.drawTitle": "Draw details · {date}", "detailView.numberTitle": "{pool} {number}",
    "detailView.main": "Main ball", "detailView.pb": "Powerball", "detailView.mainBalls": "7 main balls",
    "detailView.numberAction": "View details for {pool} {number}", "detailView.drawAction": "View the {date} draw",
    "detailView.watched": "Watching", "detailView.watch": "Watch number", "detailView.unwatch": "Unwatch",
    "detailView.watchAction": "Watch {pool} {number}", "detailView.unwatchAction": "Unwatch {pool} {number}",
    "detailView.sum": "Sum", "detailView.average": "Average", "detailView.oddEven": "Odd / even",
    "detailView.lowHigh": "Low / high", "detailView.span": "Span", "detailView.maxRun": "Longest consecutive run",
    "detailView.median": "Median", "detailView.sd": "Standard deviation", "detailView.structure": "Main-ball structure",
    "detailView.structureNote": "Structure statistics use main balls only. Low means 1–17; high means 18–35. Standard deviation uses all seven main balls in this draw.",
    "detailView.buckets": "Number-range distribution", "detailView.bucketCount": "{count} numbers",
    "detailView.sampleTitle": "Within the selected range", "detailView.sampleRange": "{from} to {to}, {count} draws",
    "detailView.count": "Appearances", "detailView.rate": "Draw frequency", "detailView.sample": "Sampled draws",
    "detailView.baseline": "Theoretical frequency", "detailView.historyTitle": "Omission at the selected cutoff",
    "detailView.asOf": "As of {date}, using all {count} available historical draws.",
    "detailView.missing": "Current omission", "detailView.lastDate": "Last appeared", "detailView.maxMissing": "Longest complete gap",
    "detailView.unseen": "Not observed", "detailView.noData": "No draws in this range.", "detailView.noHistory": "No available history before this cutoff.",
    "detailView.omissionNote": "Omission is measured backwards from the cutoff and can extend before the selected range. ≥ is an observation lower bound. The longest complete gap includes only intervals between two known appearances, excluding unfinished intervals at either boundary.",
    "detailView.chartTitle": "Rolling 10-draw frequency", "detailView.chartNote": "Each point uses that draw and up to nine earlier draws. At the start of the selected range, fewer than ten draws are available, so the actual sample size is used.",
    "detailView.chartDescription": "Rolling historical frequency for {pool} {number}, with {count} observations and a theoretical reference line at {rate}.",
    "detailView.observed": "Historical frequency", "detailView.reference": "Theoretical reference: {rate}",
    "detailView.point": "{date}: {count}/{sample} draws, {rate}",
    "detailView.timelineTitle": "Appearance trail: latest {count} draws", "detailView.timelineNote": "Oldest to newest. ● means appeared; — means absent. Select any draw to see its numbers.",
    "detailView.hit": "Appeared", "detailView.miss": "Absent", "detailView.timelineAction": "{date}, {status}, view draw details",
    "detailView.appearancesTitle": "All appearance dates in the selected range ({count})", "detailView.noAppearances": "This number did not appear in the selected range.",
    "detailView.randomNote": "Historical frequency and omission describe past records; they do not change the next draw's theoretical probability in a fair, independent lottery."
  }
};

const percent = (rate) => `${(rate * 100).toFixed(1)}%`;
const hasNumber = (row, number, pool) => (pool === "pb" ? [row[8]] : row.slice(1, 8)).some((value) => Number(value) === number);
const checkNumber = (number, pool) => {
  if (!["main", "pb"].includes(pool)) throw new RangeError("Unknown number pool.");
  if (!Number.isInteger(number) || number < 1 || number > (pool === "pb" ? 20 : 35)) throw new RangeError("Number is outside the selected pool.");
};

/** Newest-first input; chronological output; each point uses no later observations. */
export const rollingFrequency = (rows, number, pool = "main", windowSize = 10) => {
  checkNumber(number, pool);
  if (!Number.isInteger(windowSize) || windowSize < 1) throw new RangeError("Rolling window must be a positive integer.");
  const chronological = [...rows].reverse();
  const hits = chronological.map((row) => Number(hasNumber(row, number, pool)));
  let count = 0;
  return chronological.map((row, index) => {
    count += hits[index];
    if (index >= windowSize) count -= hits[index - windowSize];
    const sampleSize = Math.min(index + 1, windowSize);
    return { date: row[0], count, sampleSize, rate: count / sampleSize };
  });
};

const translate = (t) => (key, values = {}) => {
  const translated = t?.(key, values);
  const text = !translated || translated === key ? DETAIL_COPY.en[key] || key : translated;
  return text.replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match);
};

const element = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined && text !== null) node.textContent = text;
  if (className) node.className = className;
  return node;
};

const prepare = (title) => {
  const titleNode = document.getElementById("detailTitle");
  const body = document.getElementById("detailBody");
  if (!titleNode || !body) return null;
  titleNode.textContent = title;
  body.replaceChildren();
  return body;
};

const section = (body, title) => {
  const node = element("section", null, "detail-section");
  node.appendChild(element("h3", title));
  body.appendChild(node);
  return node;
};

const metrics = (container, entries) => {
  const list = element("dl", null, "detail-metrics");
  entries.forEach(([label, value]) => {
    const item = element("div", null, "detail-metric");
    item.append(element("dt", label), element("dd", value));
    list.appendChild(item);
  });
  container.appendChild(list);
};

const numberButton = (number, pool, copy, watchlist, onSelect) => {
  const button = element("button", number, "number-button");
  const watched = (watchlist?.[pool] || []).map(Number).includes(number);
  button.type = "button";
  button.dataset.number = String(number);
  button.dataset.pool = pool;
  button.classList.toggle("is-watched", watched);
  button.setAttribute("aria-label", `${copy("detailView.numberAction", { pool: copy(`detailView.${pool}`), number })}${watched ? ` · ${copy("detailView.watched")}` : ""}`);
  button.addEventListener("click", () => onSelect?.(number, pool));
  return button;
};

export const renderDrawDetail = ({ row, t, onNumberSelect, watchlist }) => {
  const copy = translate(t);
  const body = prepare(copy("detailView.drawTitle", { date: row?.[0] || "—" }));
  if (!body) return null;
  if (!row) {
    body.appendChild(element("p", copy("detailView.noData"), "detail-note"));
    return body;
  }
  const main = section(body, copy("detailView.mainBalls"));
  const balls = element("div", null, "detail-balls");
  row.slice(1, 8).forEach((number) => balls.appendChild(numberButton(Number(number), "main", copy, watchlist, onNumberSelect)));
  main.appendChild(balls);
  const pb = section(body, copy("detailView.pb"));
  const pbBalls = element("div", null, "detail-balls");
  pbBalls.appendChild(numberButton(Number(row[8]), "pb", copy, watchlist, onNumberSelect));
  pb.appendChild(pbBalls);
  const stats = drawStats(row);
  const structure = section(body, copy("detailView.structure"));
  metrics(structure, [
    [copy("detailView.sum"), stats.sum], [copy("detailView.average"), stats.average.toFixed(2)],
    [copy("detailView.oddEven"), `${stats.odds} / ${stats.evens}`], [copy("detailView.lowHigh"), `${stats.low} / ${stats.high}`],
    [copy("detailView.span"), stats.span], [copy("detailView.maxRun"), stats.maxRun],
    [copy("detailView.median"), stats.median], [copy("detailView.sd"), stats.sd.toFixed(2)]
  ]);
  structure.appendChild(element("p", copy("detailView.structureNote"), "detail-note"));
  const buckets = section(body, copy("detailView.buckets"));
  metrics(buckets, ["1–10", "11–20", "21–30", "31–35"].map((label, index) => [label, copy("detailView.bucketCount", { count: stats.buckets[index] })]));
  return body;
};

const svgNode = (tag, attrs = {}, text) => {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([name, value]) => node.setAttribute(name, String(value)));
  if (text !== undefined) node.textContent = text;
  return node;
};

const frequencyChart = (points, baseline, number, pool, copy) => {
  const figure = element("figure", null, "detail-chart");
  const width = 760;
  const height = 220;
  const left = 48;
  const right = 24;
  const top = 24;
  const bottom = 44;
  const innerWidth = width - left - right;
  const innerHeight = height - top - bottom;
  const x = (index) => points.length === 1 ? left + innerWidth / 2 : left + index / (points.length - 1) * innerWidth;
  const y = (rate) => top + (1 - rate) * innerHeight;
  const svg = svgNode("svg", { viewBox: `0 0 ${width} ${height}`, role: "img", "aria-labelledby": "detail-frequency-title detail-frequency-description" });
  svg.append(
    svgNode("title", { id: "detail-frequency-title" }, copy("detailView.chartTitle")),
    svgNode("desc", { id: "detail-frequency-description" }, copy("detailView.chartDescription", { pool: copy(`detailView.${pool}`), number, count: points.length, rate: percent(baseline) }))
  );
  [0, 0.5, 1].forEach((rate) => {
    svg.append(svgNode("line", { x1: left, y1: y(rate), x2: width - right, y2: y(rate), stroke: "#dce5e6", "stroke-width": 1 }),
      svgNode("text", { x: left - 8, y: y(rate) + 4, "text-anchor": "end", "font-size": 11, fill: "#596a6b" }, `${rate * 100}%`));
  });
  svg.appendChild(svgNode("line", { x1: left, y1: y(baseline), x2: width - right, y2: y(baseline), stroke: "#aa742e", "stroke-width": 2, "stroke-dasharray": "6 5" }));
  svg.appendChild(svgNode("polyline", { points: points.map((point, index) => `${x(index)},${y(point.rate)}`).join(" "), fill: "none", stroke: "#177a6b", "stroke-width": 2.5, "stroke-linejoin": "round" }));
  points.forEach((point, index) => {
    const dot = svgNode("circle", { cx: x(index), cy: y(point.rate), r: points.length === 1 ? 4 : 2.5, fill: "#177a6b" });
    dot.appendChild(svgNode("title", {}, copy("detailView.point", { date: point.date, count: point.count, sample: point.sampleSize, rate: percent(point.rate) })));
    svg.appendChild(dot);
  });
  svg.appendChild(svgNode("text", { x: left, y: height - 14, "font-size": 11, fill: "#596a6b" }, points[0].date));
  if (points.length > 1) svg.appendChild(svgNode("text", { x: width - right, y: height - 14, "text-anchor": "end", "font-size": 11, fill: "#596a6b" }, points.at(-1).date));
  figure.appendChild(svg);
  const legend = element("figcaption", null, "detail-chart-legend");
  legend.append(element("span", copy("detailView.observed")), element("span", copy("detailView.reference", { rate: percent(baseline) })));
  figure.appendChild(legend);
  return figure;
};

export const renderNumberDetail = ({ number, pool = "main", data = [], asOfData = data, t, watchlist,
  onDrawSelect, onWatchToggle }) => {
  number = Number(number);
  checkNumber(number, pool);
  const copy = translate(t);
  const poolLabel = copy(`detailView.${pool}`);
  const body = prepare(copy("detailView.numberTitle", { pool: poolLabel, number }));
  if (!body) return null;
  const baseline = pool === "pb" ? 1 / 20 : 7 / 35;
  const watched = (watchlist?.[pool] || []).map(Number).includes(number);
  const watch = element("button", copy(watched ? "detailView.unwatch" : "detailView.watch"), "watch-toggle");
  watch.type = "button";
  watch.dataset.number = String(number);
  watch.dataset.pool = pool;
  watch.setAttribute("aria-pressed", String(watched));
  watch.setAttribute("aria-label", copy(watched ? "detailView.unwatchAction" : "detailView.watchAction", { pool: poolLabel, number }));
  watch.addEventListener("click", () => onWatchToggle?.(number, pool));
  body.appendChild(watch);

  const current = section(body, copy("detailView.sampleTitle"));
  if (data.length) current.appendChild(element("p", copy("detailView.sampleRange", { from: data.at(-1)[0], to: data[0][0], count: data.length }), "detail-note"));
  else current.appendChild(element("p", copy("detailView.noData"), "detail-note"));
  const item = frequency(data, pool)[number - 1];
  metrics(current, [[copy("detailView.count"), item.count], [copy("detailView.rate"), data.length ? percent(item.rate) : "—"], [copy("detailView.sample"), data.length], [copy("detailView.baseline"), percent(baseline)]]);

  const omission = section(body, copy("detailView.historyTitle"));
  if (asOfData.length) {
    const missing = missingStats(asOfData, pool)[number - 1];
    omission.appendChild(element("p", copy("detailView.asOf", { date: asOfData[0][0], count: asOfData.length }), "detail-note"));
    metrics(omission, [[copy("detailView.missing"), `${missing.bounded ? "≥" : ""}${missing.missing}`], [copy("detailView.lastDate"), missing.lastDate || copy("detailView.unseen")], [copy("detailView.maxMissing"), missing.maxMissing === null ? "—" : missing.maxMissing]]);
    omission.appendChild(element("p", copy("detailView.omissionNote"), "detail-note"));
  } else omission.appendChild(element("p", copy("detailView.noHistory"), "detail-note"));

  if (data.length) {
    const chart = section(body, copy("detailView.chartTitle"));
    chart.appendChild(frequencyChart(rollingFrequency(data, number, pool), baseline, number, pool, copy));
    chart.appendChild(element("p", copy("detailView.chartNote"), "detail-note"));
    const recent = data.slice(0, 50).reverse();
    const trail = section(body, copy("detailView.timelineTitle", { count: recent.length }));
    trail.appendChild(element("p", copy("detailView.timelineNote"), "detail-note"));
    const timeline = element("div", null, "timeline");
    recent.forEach((row) => {
      const hit = hasNumber(row, number, pool);
      const button = element("button", hit ? "●" : "—", `timeline-cell${hit ? " is-hit" : ""}`);
      const label = copy("detailView.timelineAction", { date: row[0], status: copy(hit ? "detailView.hit" : "detailView.miss") });
      button.type = "button";
      button.dataset.date = row[0];
      button.title = label;
      button.setAttribute("aria-label", label);
      button.addEventListener("click", () => onDrawSelect?.(row));
      timeline.appendChild(button);
    });
    trail.appendChild(timeline);
  }

  const appeared = data.filter((row) => hasNumber(row, number, pool));
  const appearances = section(body, copy("detailView.appearancesTitle", { count: appeared.length }));
  if (!appeared.length) appearances.appendChild(element("p", copy("detailView.noAppearances"), "detail-note"));
  else {
    const dates = element("div", null, "appearance-list");
    appeared.forEach((row) => {
      const button = element("button", row[0]);
      button.type = "button";
      button.setAttribute("aria-label", copy("detailView.drawAction", { date: row[0] }));
      button.addEventListener("click", () => onDrawSelect?.(row));
      dates.appendChild(button);
    });
    appearances.appendChild(dates);
  }
  body.appendChild(element("p", copy("detailView.randomNote"), "detail-note"));
  return body;
};
