import db from "./db.js";
import { applyI18n, setLanguage, t, getLanguage } from "./i18n.js";
import { applyFilters, buildFrequencyMap, formatDate, getOverviewStats } from "./data.js";
import renderHistory from "./historyData.js";
import renderBallBlock from "./ballBlock.js";
import renderDistribution from "./distribution.js";
import renderHotNumbers from "./hotNumbers.js";
import renderMissingNumbers from "./missingNumbers.js";
import renderTrendNumbers from "./trendNumbers.js";
import renderCharts from "./charts.js";
import renderContinuous from "./continousNumber.js";
import renderStatistics from "./statistics.js";
import renderPb from "./pbPrevious.js";
import { removeData, setActiveMenu } from "./utils.js";

const views = {
  history: { render: renderHistory, titleKey: "view.history" },
  block: { render: renderBallBlock, titleKey: "view.block" },
  distribution: { render: renderDistribution, titleKey: "view.distribution" },
  hot: { render: renderHotNumbers, titleKey: "view.hot" },
  missing: { render: renderMissingNumbers, titleKey: "view.missing" },
  trend: { render: renderTrendNumbers, titleKey: "view.trend" },
  charts: { render: renderCharts, titleKey: "view.charts" },
  continuous: { render: renderContinuous, titleKey: "view.continuous" },
  statistics: { render: renderStatistics, titleKey: "view.statistics" },
  pb: { render: renderPb, titleKey: "view.pb" }
};

const filters = {
  dateFrom: "",
  dateTo: "",
  numMin: "1",
  numMax: "35",
  minFreq: "0",
  minRun: "0"
};

let currentView = "history";
let heatWindow = 100;
let historyIndex = 0;
let chartWindow = 100;
const pageSize = 50;
const pagedViews = new Set(["history", "block", "distribution", "continuous", "statistics", "pb"]);
const paginationState = {};

const buildDrawStats = (row) => {
  if (!row) return null;
  const nums = row.slice(1, 8).map(Number);
  const sum = nums.reduce((acc, n) => acc + n, 0);
  const average = sum / nums.length;
  const odds = nums.filter((n) => n % 2 === 1).length;
  const evens = nums.length - odds;
  const low = nums.filter((n) => n <= 17).length;
  const high = nums.length - low;
  const buckets = [
    nums.filter((n) => n >= 1 && n <= 10).length,
    nums.filter((n) => n >= 11 && n <= 20).length,
    nums.filter((n) => n >= 21 && n <= 30).length,
    nums.filter((n) => n >= 31 && n <= 35).length
  ];
  return { sum, average, odds, evens, low, high, buckets };
};

const getFiltersFromUI = () => {
  const dateFrom = document.getElementById("filterDateFrom");
  const dateTo = document.getElementById("filterDateTo");
  const numMin = document.getElementById("filterNumMin");
  const numMax = document.getElementById("filterNumMax");
  const minFreq = document.getElementById("filterFreqMin");
  const minRun = document.getElementById("filterRunMin");
  if (!dateFrom || !dateTo || !numMin || !numMax || !minFreq || !minRun) {
    return;
  }
  filters.dateFrom = dateFrom.value;
  filters.dateTo = dateTo.value;
  filters.numMin = numMin.value;
  filters.numMax = numMax.value;
  filters.minFreq = minFreq.value;
  filters.minRun = minRun.value;
};

const updateOverview = (data) => {
  const overview = document.getElementById("overview");
  const overviewExtra = document.getElementById("overviewExtra");
  const stats = getOverviewStats(data);
  overview.innerHTML = `
    <div class="overview-card">
      <div class="overview-label">${t("overview.total")}</div>
      <div class="overview-value">${stats.totalDraws}</div>
    </div>
    <div class="overview-card">
      <div class="overview-label">${t("overview.range")}</div>
      <div class="overview-value">${formatDate(stats.minDate)} - ${formatDate(stats.maxDate)}</div>
    </div>
    <div class="overview-card">
      <div class="overview-label">${t("overview.latest")}</div>
      <div class="overview-value">${formatDate(stats.latestDate)}</div>
    </div>
  `;
  if (overviewExtra) {
    overviewExtra.innerHTML = "";
  }
};

const updateOverviewExtra = (viewKey, data) => {
  const overviewExtra = document.getElementById("overviewExtra");
  if (!overviewExtra) return;
  overviewExtra.innerHTML = "";
  if (viewKey === "history") {
    const rows = data || [];
    const safeIndex = Math.min(Math.max(historyIndex, 0), Math.max(rows.length - 1, 0));
    const selectedRow = rows[safeIndex];
    const stats = buildDrawStats(selectedRow);
    const options = rows.slice(0, 50).map((row, index) => {
      const label = row ? row[0] : "";
      return `<option value="${index}">${label}</option>`;
    }).join("");
    overviewExtra.innerHTML = `
      <div class="overview-card">
        <div class="overview-label">${t("overview.structure")}</div>
        <select id="historySelect" class="legend-select">
          ${options}
        </select>
        <div class="legend-desc">${t("overview.structureDesc")}</div>
        ${stats ? `
          <div class="mini-grid">
            <div class="mini-item">
              <div class="mini-label">${t("structure.sum")}</div>
              <div class="mini-value">${stats.sum}</div>
            </div>
            <div class="mini-item">
              <div class="mini-label">${t("structure.avg")}</div>
              <div class="mini-value">${stats.average.toFixed(1)}</div>
            </div>
            <div class="mini-item">
              <div class="mini-label">${t("structure.oddEven")}</div>
              <div class="mini-value">${stats.odds}/${stats.evens}</div>
            </div>
            <div class="mini-item">
              <div class="mini-label">${t("structure.lowHigh")}</div>
              <div class="mini-value">${stats.low}/${stats.high}</div>
            </div>
          </div>
          <div class="mini-bars">
            <div class="mini-bar">
              <span>1-10</span>
              <span>${stats.buckets[0]}</span>
            </div>
            <div class="mini-bar">
              <span>11-20</span>
              <span>${stats.buckets[1]}</span>
            </div>
            <div class="mini-bar">
              <span>21-30</span>
              <span>${stats.buckets[2]}</span>
            </div>
            <div class="mini-bar">
              <span>31-35</span>
              <span>${stats.buckets[3]}</span>
            </div>
          </div>
        ` : ""}
      </div>
    `;
    const select = document.getElementById("historySelect");
    if (select) {
      select.value = String(safeIndex);
      select.addEventListener("change", () => {
        historyIndex = Number(select.value);
        updateOverviewExtra("history", data);
      });
    }
    return;
  }
  if (viewKey === "block") {
    overviewExtra.innerHTML = `
      <div class="overview-card">
        <div class="overview-label">${t("overview.legend")}</div>
        <div class="legend">
          <div class="legend-item">
            <span class="legend-swatch" style="background: rgba(32, 199, 166, 0.25); border-color: rgba(32, 199, 166, 0.4);"></span>
            <div class="legend-text">
              <div class="legend-title">${t("legend.small")}</div>
              <div class="legend-desc">${t("legend.smallDesc")}</div>
            </div>
          </div>
          <div class="legend-item">
            <span class="legend-swatch" style="background: rgba(80, 180, 255, 0.25); border-color: rgba(80, 180, 255, 0.4);"></span>
            <div class="legend-text">
              <div class="legend-title">${t("legend.medium")}</div>
              <div class="legend-desc">${t("legend.mediumDesc")}</div>
            </div>
          </div>
          <div class="legend-item">
            <span class="legend-swatch" style="background: rgba(255, 179, 71, 0.25); border-color: rgba(255, 179, 71, 0.45);"></span>
            <div class="legend-text">
              <div class="legend-title">${t("legend.large")}</div>
              <div class="legend-desc">${t("legend.largeDesc")}</div>
            </div>
          </div>
        </div>
      </div>
    `;
    return;
  }
  if (viewKey === "distribution") {
    overviewExtra.innerHTML = `
      <div class="overview-card">
        <div class="overview-label">${t("overview.heatLegend")}</div>
        <div class="legend">
          <div class="legend-item">
            <div class="legend-text">
              <div class="legend-title">${t("overview.heatWindow")}</div>
              <div class="legend-desc">${t("overview.heatWindowDesc")}</div>
            </div>
          </div>
        </div>
        <select id="heatWindowSelect" class="legend-select">
          <option value="50">50</option>
          <option value="100">100</option>
          <option value="300">300</option>
          <option value="9999">${t("overview.heatAll")}</option>
        </select>
        <div class="legend">
          <div class="legend-item">
            <span class="legend-swatch" style="background: rgba(239, 83, 80, 0.25); border-color: rgba(239, 83, 80, 0.45);"></span>
            <div class="legend-text">
              <div class="legend-title">${t("legend.hot")}</div>
              <div class="legend-desc">${t("legend.hotDesc")}</div>
            </div>
          </div>
          <div class="legend-item">
            <span class="legend-swatch" style="background: rgba(91, 184, 255, 0.25); border-color: rgba(91, 184, 255, 0.45);"></span>
            <div class="legend-text">
              <div class="legend-title">${t("legend.cool")}</div>
              <div class="legend-desc">${t("legend.coolDesc")}</div>
            </div>
          </div>
        </div>
      </div>
    `;
    const select = document.getElementById("heatWindowSelect");
    if (select) {
      select.value = String(heatWindow);
      select.addEventListener("change", () => {
        heatWindow = Number(select.value);
        renderView("distribution");
      });
    }
    return;
  }
  if (viewKey === "charts") {
    overviewExtra.innerHTML = `
      <div class="overview-card">
        <div class="overview-label">${t("overview.chartWindow")}</div>
        <select id="chartWindowSelect" class="legend-select">
          <option value="50">50</option>
          <option value="100">100</option>
          <option value="300">300</option>
          <option value="9999">${t("overview.heatAll")}</option>
        </select>
        <div class="legend-desc">${t("overview.chartWindowDesc")}</div>
      </div>
      <div class="overview-card">
        <div class="overview-label">${t("overview.explain")}</div>
        <div class="legend">
          <div class="legend-item">
            <div class="legend-text">
              <div class="legend-title">${t("view.charts")}</div>
              <div class="legend-desc">${t("view.chartsDesc")}</div>
            </div>
          </div>
        </div>
      </div>
    `;
    const select = document.getElementById("chartWindowSelect");
    if (select) {
      select.value = String(chartWindow);
      select.addEventListener("change", () => {
        chartWindow = Number(select.value);
        renderView("charts");
      });
    }
    return;
  }
  if (viewKey === "missing") {
    overviewExtra.innerHTML = `
      <div class="overview-card">
        <div class="overview-label">${t("overview.missingSort")}</div>
        <select id="missingSortSelect" class="legend-select">
          <option value="missing_desc">${t("sort.missingDesc")}</option>
          <option value="missing_asc">${t("sort.missingAsc")}</option>
          <option value="number_asc">${t("sort.numberAsc")}</option>
          <option value="number_desc">${t("sort.numberDesc")}</option>
        </select>
        <div class="legend-desc">${t("overview.missingSortDesc")}</div>
      </div>
      <div class="overview-card">
        <div class="overview-label">${t("overview.explain")}</div>
        <div class="legend">
          <div class="legend-item">
            <div class="legend-text">
              <div class="legend-title">${t("view.missing")}</div>
              <div class="legend-desc">${t("view.missingDesc")}</div>
            </div>
          </div>
        </div>
      </div>
    `;
    const select = document.getElementById("missingSortSelect");
    if (select) {
      const saved = localStorage.getItem("missingSort") || "missing_desc";
      select.value = saved;
      select.addEventListener("change", () => {
        localStorage.setItem("missingSort", select.value);
        renderView("missing");
      });
    }
    return;
  }
  if (viewKey === "hot") {
    overviewExtra.innerHTML = `
      <div class="overview-card">
        <div class="overview-label">${t("overview.hotSort")}</div>
        <select id="hotSortSelect" class="legend-select">
          <option value="count_desc">${t("sort.countDesc")}</option>
          <option value="count_asc">${t("sort.countAsc")}</option>
          <option value="number_asc">${t("sort.numberAsc")}</option>
          <option value="number_desc">${t("sort.numberDesc")}</option>
        </select>
        <div class="legend-desc">${t("overview.hotSortDesc")}</div>
      </div>
      <div class="overview-card">
        <div class="overview-label">${t("overview.explain")}</div>
        <div class="legend">
          <div class="legend-item">
            <div class="legend-text">
              <div class="legend-title">${t("view.hot")}</div>
              <div class="legend-desc">${t("view.hotDesc")}</div>
            </div>
          </div>
        </div>
      </div>
    `;
    const select = document.getElementById("hotSortSelect");
    if (select) {
      const saved = localStorage.getItem("hotSort") || "count_desc";
      select.value = saved;
      select.addEventListener("change", () => {
        localStorage.setItem("hotSort", select.value);
        renderView("hot");
      });
    }
    return;
  }
  overviewExtra.innerHTML = `
    <div class="overview-card">
      <div class="overview-label">${t("overview.explain")}</div>
      <div class="legend">
        <div class="legend-item">
          <div class="legend-text">
            <div class="legend-title">${t(`view.${viewKey}`)}</div>
            <div class="legend-desc">${t(`view.${viewKey}Desc`)}</div>
          </div>
        </div>
      </div>
    </div>
  `;
};

const renderView = (viewKey) => {
  if (!views[viewKey]) return;
  currentView = viewKey;
  getFiltersFromUI();
  const filtered = applyFilters(db, filters);
  const frequency = buildFrequencyMap(filtered);
  let heatFrequency = frequency;
  if (viewKey === "distribution") {
    const windowSize = Number(heatWindow) || filtered.length;
    const heatData = filtered.slice(0, windowSize);
    heatFrequency = buildFrequencyMap(heatData);
  }
  removeData();
  let displayData = filtered;
  let page = paginationState[viewKey] || 1;
  let totalPages = 1;
  if (pagedViews.has(viewKey)) {
    totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    page = Math.min(Math.max(page, 1), totalPages);
    paginationState[viewKey] = page;
    const start = (page - 1) * pageSize;
    const end = Math.min(start + pageSize, filtered.length);
    displayData = filtered.slice(start, end);
  }
  document.getElementById("viewTitle").textContent = t(views[viewKey].titleKey);
  views[viewKey].render({ data: displayData, t, filters, frequency: heatFrequency, heatWindow, chartWindow });
  updateOverview(filtered);
  updateOverviewExtra(viewKey, filtered);
  setActiveMenu(viewKey);
  if (pagedViews.has(viewKey)) {
    renderPagination(viewKey, filtered.length, page, totalPages);
  }
  const wrapper = document.getElementById("wrapper");
  if (wrapper) {
    wrapper.scrollTop = 0;
    wrapper.scrollLeft = 0;
  }
};

const renderPagination = (viewKey, total, page, totalPages) => {
  if (total <= pageSize || totalPages <= 1) return;
  const wrapper = document.getElementById("wrapper");
  if (!wrapper) return;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const pagination = document.createElement("div");
  pagination.classList.add("pagination", "remove");
  pagination.innerHTML = `
    <button class="page-btn" data-dir="prev" ${page === 1 ? "disabled" : ""}>${t("pagination.prev")}</button>
    <div class="page-info">
      <div>${t("pagination.page")} ${page} / ${totalPages}</div>
      <div>${t("pagination.range")} ${start}-${end} / ${total}</div>
    </div>
    <button class="page-btn" data-dir="next" ${page === totalPages ? "disabled" : ""}>${t("pagination.next")}</button>
  `;
  pagination.querySelectorAll(".page-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dir = btn.getAttribute("data-dir");
      const nextPage = dir === "prev" ? page - 1 : page + 1;
      paginationState[viewKey] = Math.min(Math.max(nextPage, 1), totalPages);
      renderView(viewKey);
    });
  });
  wrapper.appendChild(pagination);
};

const bindMenu = () => {
  document.querySelectorAll(".menuBtn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const viewKey = btn.dataset.view;
      renderView(viewKey);
    });
  });
};

const bindLanguageToggle = () => {
  document.querySelectorAll("[data-lang]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lang = btn.dataset.lang;
      setLanguage(lang);
      document.documentElement.lang = lang;
      document.querySelectorAll("[data-lang]").forEach((node) => {
        node.classList.toggle("is-active", node.dataset.lang === lang);
      });
      applyI18n();
      renderView(currentView);
    });
  });
};

const bootstrap = () => {
  setLanguage(getLanguage());
  applyI18n();
  bindMenu();
  bindLanguageToggle();
  renderView(currentView);
};

bootstrap();
