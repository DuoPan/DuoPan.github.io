import { getHeatColor } from "./data.js";

const countInWindow = (data, windowSize) => {
  const counts = {};
  for (let i = 1; i <= 35; i += 1) {
    counts[i] = 0;
  }
  data.slice(0, windowSize).forEach((row) => {
    row.slice(1, 8).forEach((value) => {
      const num = Number(value);
      counts[num] = (counts[num] || 0) + 1;
    });
  });
  return counts;
};

const maxCount = (counts) => Math.max(...Object.values(counts), 1);

const renderTrendNumbers = ({ data, t }) => {
  const wrapperElem = document.getElementById("wrapper");
  const dataElem = document.createElement("div");
  dataElem.classList.add("table");
  dataElem.classList.add("remove");

  const windows = [10, 20, 50];
  const counts10 = countInWindow(data, windows[0]);
  const counts20 = countInWindow(data, windows[1]);
  const counts50 = countInWindow(data, windows[2]);
  const max10 = maxCount(counts10);
  const max20 = maxCount(counts20);
  const max50 = maxCount(counts50);

  dataElem.innerHTML = `
    <div class="row header">
      <div class="cell">${t("table.number")}</div>
      <div class="cell">${t("table.last10")}</div>
      <div class="cell">${t("table.last20")}</div>
      <div class="cell">${t("table.last50")}</div>
    </div>
  `;

  for (let i = 1; i <= 35; i += 1) {
    const row = document.createElement("div");
    row.classList.add("row");
    row.innerHTML = `
      <div class="cell">${i}</div>
      <div class="cell heat" style="background:${getHeatColor(counts10[i] / max10)}; border-color: rgba(45, 160, 210, 0.18);">${counts10[i]}</div>
      <div class="cell heat" style="background:${getHeatColor(counts20[i] / max20)}; border-color: rgba(45, 160, 210, 0.18);">${counts20[i]}</div>
      <div class="cell heat" style="background:${getHeatColor(counts50[i] / max50)}; border-color: rgba(45, 160, 210, 0.18);">${counts50[i]}</div>
    `;
    dataElem.appendChild(row);
  }

  wrapperElem.appendChild(dataElem);
};

export default renderTrendNumbers;
