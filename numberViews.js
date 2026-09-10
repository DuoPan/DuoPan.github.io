import { frequency, missingStats, pairStats, trendStats } from "./analytics.js";

export const NUMBER_COPY = {
  zh: {
    "numbers.number": "号码", "numbers.count": "出现次数", "numbers.rate": "出现率",
    "numbers.expected": "理论期望次数", "numbers.watch": "关注", "numbers.watching": "已关注",
    "numbers.watchAdd": "关注号码 {number}", "numbers.watchRemove": "取消关注号码 {number}",
    "numbers.detail": "查看{pool} {number} 的详情", "numbers.main": "主球", "numbers.pb": "PB",
    "numbers.sample": "当前统计 {count} 期", "numbers.reference": "单个{pool}每期的理论出现率为 {rate}。历史频率不代表下期概率。",
    "numbers.hotCaption": "{pool}出现频率", "numbers.missingCaption": "{pool}遗漏统计",
    "numbers.trendCaption": "{pool}短期出现频率比较", "numbers.pairsCaption": "主球两两共现",
    "numbers.missing": "当前遗漏", "numbers.lastDate": "上次出现", "numbers.maxMissing": "最长完整遗漏",
    "numbers.missingMeta": "截至 {date}，检查 {count} 期历史。遗漏不受当前窗口起始日期截断。",
    "numbers.missingBoundary": "≥ 表示历史中未观察到该号码，实际遗漏至少为所示期数。最长完整遗漏只统计两次出现之间的间隔，排除历史首尾未完成的间隔。",
    "numbers.notObserved": "未观察到", "numbers.noCompleteGap": "无完整间隔",
    "numbers.window": "近 {window} 期", "numbers.windowMeta": "显示“次数 / 实际期数（出现率）”；样本不足时使用实际期数。",
    "numbers.change": "最近10期 − 前10期", "numbers.delta": "{value} 个百分点",
    "numbers.comparison": "比较最近 {recent} 期与再之前 {previous} 期；两个样本均取自当前所选范围。",
    "numbers.shortSample": "比较窗口样本不足 10 期，请谨慎解释差异。",
    "numbers.noComparison": "无前窗口样本", "numbers.noData": "该范围没有开奖数据。",
    "numbers.pair": "号码对", "numbers.pairsMeta": "共有 595 种主球号码对；当前显示 {shown} 种。理论期望按每期 7/35 × 6/34 × 样本期数计算。",
    "numbers.pairsCaution": "同时出现的历史次数描述样本，不代表下一期更容易一起出现。",
    "numbers.showAll": "显示全部 595 对", "numbers.showTop": "仅显示前 30 对"
  },
  en: {
    "numbers.number": "Number", "numbers.count": "Appearances", "numbers.rate": "Draw frequency",
    "numbers.expected": "Expected appearances", "numbers.watch": "Watch", "numbers.watching": "Watching",
    "numbers.watchAdd": "Watch number {number}", "numbers.watchRemove": "Unwatch number {number}",
    "numbers.detail": "View details for {pool} {number}", "numbers.main": "main ball", "numbers.pb": "Powerball",
    "numbers.sample": "Current sample: {count} draws", "numbers.reference": "The theoretical chance of a particular {pool} appearing in each draw is {rate}. Historical frequency does not change the next draw's probability.",
    "numbers.hotCaption": "{pool} draw frequencies", "numbers.missingCaption": "{pool} omission statistics",
    "numbers.trendCaption": "{pool} short-term frequency comparison", "numbers.pairsCaption": "Main-ball pair appearances",
    "numbers.missing": "Current omission", "numbers.lastDate": "Last appeared", "numbers.maxMissing": "Longest complete gap",
    "numbers.missingMeta": "As of {date}, using {count} historical draws. Omission history extends before the selected window's start date.",
    "numbers.missingBoundary": "≥ means the number was not observed in this history, so its omission is at least the displayed count. The longest complete gap includes only intervals between two observed appearances, excluding unfinished intervals at either boundary.",
    "numbers.notObserved": "Not observed", "numbers.noCompleteGap": "No complete interval",
    "numbers.window": "Last {window} draws", "numbers.windowMeta": "Cells show count / actual draws (frequency); short samples use their actual size.",
    "numbers.change": "Latest 10 − preceding 10", "numbers.delta": "{value} pp",
    "numbers.comparison": "Comparing the latest {recent} draws with the preceding {previous}; both samples stay inside the selected range.",
    "numbers.shortSample": "At least one comparison window has fewer than 10 draws; interpret the difference cautiously.",
    "numbers.noComparison": "No preceding sample", "numbers.noData": "No draws in this range.",
    "numbers.pair": "Number pair", "numbers.pairsMeta": "There are 595 possible main-ball pairs; showing {shown}. Expected appearances are 7/35 × 6/34 × the number of sampled draws.",
    "numbers.pairsCaution": "Past co-occurrence describes this sample; it does not make a pair more likely in the next draw.",
    "numbers.showAll": "Show all 595 pairs", "numbers.showTop": "Show only the first 30 pairs"
  }
};

const percent = (rate) => `${(rate * 100).toFixed(1)}%`;
const translate = (t) => (key, values = {}) => {
  const translated = t?.(key, values);
  const text = !translated || translated === key ? NUMBER_COPY.en[key] || key : translated;
  return text.replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match);
};

const element = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined && text !== null) node.textContent = text;
  if (className) node.className = className;
  return node;
};

const createTable = (container, caption, headings) => {
  const scroll = element("div", null, "table-scroll");
  const table = element("table", null, "data-table number-table");
  table.appendChild(element("caption", caption, "sr-only"));
  const head = element("thead");
  const header = element("tr");
  headings.forEach((text) => {
    const cell = element("th", text);
    cell.scope = "col";
    header.appendChild(cell);
  });
  head.appendChild(header);
  table.appendChild(head);
  const body = element("tbody");
  table.appendChild(body);
  scroll.appendChild(table);
  container.appendChild(scroll);
  return body;
};

const sortedItems = (items, sort, fallback) => [...items].sort((a, b) => {
  if (sort === "number_asc") return a.number - b.number;
  if (sort === "number_desc") return b.number - a.number;
  const field = sort?.startsWith("missing_") ? "missing" : sort === "rate_desc" ? "rate" : sort?.startsWith("count_") ? "count" : fallback;
  const direction=sort?.endsWith('_asc')?1:-1;
  return direction*((a[field] ?? 0) - (b[field] ?? 0)) || a.number - b.number;
});

export default function renderNumberView({ view, data = [], asOfData = data, pool = "main", sort, t,
  watchlist = { main: [], pb: [] }, onNumberSelect, onWatchToggle }) {
  const wrapper = document.getElementById("wrapper");
  if (!wrapper) return null;
  const copy = translate(t);
  const section = element("section", null, `number-view number-view-${view} remove`);
  const poolLabel = copy(`numbers.${pool}`);
  const watched = {
    main: new Set((watchlist.main || []).map(Number)),
    pb: new Set((watchlist.pb || []).map(Number))
  };
  const note = (text, className = "analysis-note") => section.appendChild(element("p", text, className));
  const numberButton = (number, numberPool = pool) => {
    const button = element("button", number, "number-button");
    button.type = "button";
    button.dataset.number = String(number);
    button.dataset.pool = numberPool;
    button.classList.toggle("is-watched", watched[numberPool].has(number));
    button.setAttribute("aria-label", copy("numbers.detail", { pool: copy(`numbers.${numberPool}`), number }));
    button.addEventListener("click", () => onNumberSelect?.(number, numberPool));
    return button;
  };
  const watchButton = (number, numberPool = pool) => {
    const button = element("button", null, "watch-toggle");
    button.type = "button";
    button.dataset.number = String(number);
    button.dataset.pool = numberPool;
    const update = () => {
      const active = watched[numberPool].has(number);
      button.textContent = copy(active ? "numbers.watching" : "numbers.watch");
      button.setAttribute("aria-pressed", String(active));
      button.setAttribute("aria-label", copy(active ? "numbers.watchRemove" : "numbers.watchAdd", { number }));
    };
    update();
    button.addEventListener("click", () => {
      if (watched[numberPool].has(number)) watched[numberPool].delete(number);
      else watched[numberPool].add(number);
      update();
      onWatchToggle?.(number, numberPool);
    });
    return button;
  };
  const appendRow = (body, number, values) => {
    const row = element("tr");
    row.dataset.number = String(number);
    row.dataset.pool = pool;
    const numberCell = element("th");
    numberCell.scope = "row";
    numberCell.appendChild(numberButton(number));
    row.appendChild(numberCell);
    values.forEach((value) => row.appendChild(element("td", value)));
    const watchCell = element("td");
    watchCell.appendChild(watchButton(number));
    row.appendChild(watchCell);
    body.appendChild(row);
  };

  const rows = view === "missing" ? asOfData : data;
  if (!rows.length) {
    note(copy("numbers.noData"), "empty-state");
    wrapper.appendChild(section);
    return section;
  }

  if (view === "hot") {
    note(copy("numbers.sample", { count: data.length }));
    const baseline = pool === "pb" ? 1 / 20 : 7 / 35;
    note(copy("numbers.reference", { pool: poolLabel, rate: percent(baseline) }));
    const body = createTable(section, copy("numbers.hotCaption", { pool: poolLabel }),
      ["number", "count", "rate", "expected", "watch"].map((key) => copy(`numbers.${key}`)));
    sortedItems(frequency(data, pool), sort, "count").forEach((item) => {
      appendRow(body, item.number, [item.count, percent(item.rate), (data.length * baseline).toFixed(1)]);
    });
  } else if (view === "missing") {
    note(copy("numbers.missingMeta", { date: asOfData[0][0], count: asOfData.length }));
    note(copy("numbers.missingBoundary"));
    const body = createTable(section, copy("numbers.missingCaption", { pool: poolLabel }),
      ["number", "missing", "lastDate", "maxMissing", "watch"].map((key) => copy(`numbers.${key}`)));
    sortedItems(missingStats(asOfData, pool), sort, "missing").forEach((item) => {
      appendRow(body, item.number, [
        `${item.bounded ? "≥" : ""}${item.missing}`,
        item.lastDate || copy("numbers.notObserved"),
        item.maxMissing === null ? "—" : item.maxMissing
      ]);
      if (item.maxMissing === null) body.lastElementChild.children[3].title = copy("numbers.noCompleteGap");
    });
  } else if (view === "trend") {
    note(copy("numbers.windowMeta"));
    const comparison = trendStats(data, pool, 10);
    note(copy("numbers.comparison", { recent: comparison.recentSize, previous: comparison.previousSize }));
    if (comparison.recentSize < 10 || comparison.previousSize < 10) note(copy("numbers.shortSample"));
    const windows = [10, 20, 50].map((size) => ({ size: Math.min(size, data.length), counts: frequency(data.slice(0, size), pool) }));
    const headings = [copy("numbers.number"), ...[10, 20, 50].map((window) => copy("numbers.window", { window })), copy("numbers.change"), copy("numbers.watch")];
    const body = createTable(section, copy("numbers.trendCaption", { pool: poolLabel }), headings);
    sortedItems(comparison.items, sort, "rate").forEach((item) => {
      const values = windows.map(({ size, counts }) => `${counts[item.number - 1].count} / ${size} (${percent(counts[item.number - 1].rate)})`);
      values.push(item.delta === null ? "—" : copy("numbers.delta", { value: `${item.delta > 0 ? "+" : ""}${item.delta.toFixed(1)}` }));
      appendRow(body, item.number, values);
      if (item.delta === null) body.lastElementChild.children[4].title = copy("numbers.noComparison");
    });
  } else if (view === "pairs") {
    note(copy("numbers.sample", { count: data.length }));
    const meta = note("");
    note(copy("numbers.pairsCaution"));
    const body = createTable(section, copy("numbers.pairsCaption"), ["pair", "count", "rate", "expected"].map((key) => copy(`numbers.${key}`)));
    const items = pairStats(data).sort((a, b) => (sort === "number_asc" ? 0 : b.count - a.count) || a.a - b.a || a.b - b.b);
    let showAll = false;
    const toggle = element("button", null, "button-secondary pairs-toggle");
    toggle.type = "button";
    const paint = () => {
      body.replaceChildren();
      const visible = showAll ? items : items.slice(0, 30);
      meta.textContent = copy("numbers.pairsMeta", { shown: visible.length });
      visible.forEach((item) => {
        const row = element("tr");
        const pair = element("th", null, "pair-numbers");
        pair.scope = "row";
        pair.append(numberButton(item.a, "main"), document.createTextNode(" + "), numberButton(item.b, "main"));
        row.append(pair, element("td", item.count), element("td", percent(item.rate)), element("td", item.expected.toFixed(2)));
        body.appendChild(row);
      });
      toggle.textContent = copy(showAll ? "numbers.showTop" : "numbers.showAll");
      toggle.setAttribute("aria-expanded", String(showAll));
    };
    toggle.addEventListener("click", () => { showAll = !showAll; paint(); });
    paint();
    section.appendChild(toggle);
  }
  wrapper.appendChild(section);
  return section;
}
