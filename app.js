import db from "./db.js";
import { applyI18n, setLanguage, t, getLanguage } from "./i18n.js";
import { applyFilters, buildFrequencyMap, formatDate, getOverviewStats } from "./data.js";
import renderHistory from "./historyData.js";
import renderBallBlock from "./ballBlock.js";
import renderDistribution from "./distribution.js";
import renderHotNumbers from "./hotNumbers.js";
import renderMissingNumbers from "./missingNumbers.js";
import renderTrendNumbers from "./trendNumbers.js";
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

const updateOverviewExtra = (viewKey) => {
  const overviewExtra = document.getElementById("overviewExtra");
  if (!overviewExtra) return;
  overviewExtra.innerHTML = "";
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
  document.getElementById("viewTitle").textContent = t(views[viewKey].titleKey);
  views[viewKey].render({ data: filtered, t, filters, frequency: heatFrequency, heatWindow });
  updateOverview(filtered);
  updateOverviewExtra(viewKey);
  setActiveMenu(viewKey);
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
