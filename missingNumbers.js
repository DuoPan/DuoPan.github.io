import { getHeatColor } from "./data.js";

const getMissingSort = () => {
  return localStorage.getItem("missingSort") || "missing_desc";
};

const setMissingSort = (value) => {
  localStorage.setItem("missingSort", value);
};

const computeMissing = (data, maxNumber) => {
  const missing = {};
  for (let i = 1; i <= maxNumber; i += 1) {
    missing[i] = data.length;
  }
  data.forEach((row, index) => {
    const nums = row.slice(1, 8).map(Number);
    nums.forEach((num) => {
      if (missing[num] === data.length) {
        missing[num] = index;
      }
    });
  });
  return missing;
};

const renderMissingNumbers = ({ data, t, sortOverride }) => {
  const wrapperElem = document.getElementById("wrapper");
  const dataElem = document.createElement("div");
  dataElem.classList.add("table");
  dataElem.classList.add("remove");

  const missingSort = sortOverride || getMissingSort();
  const missing = computeMissing(data, 35);
  const maxMissing = Math.max(...Object.values(missing), 1);

  const headerRow = document.createElement("div");
  headerRow.classList.add("row", "header");
  headerRow.innerHTML = `
    <div class="cell">${t("table.number")}</div>
    <div class="cell">${t("table.missing")}</div>
  `;
  dataElem.appendChild(headerRow);

  const items = [];
  for (let i = 1; i <= 35; i += 1) {
    items.push({ num: i, missing: missing[i] });
  }

  items.sort((a, b) => {
    switch (missingSort) {
      case "missing_asc":
        return a.missing - b.missing;
      case "missing_desc":
        return b.missing - a.missing;
      case "number_desc":
        return b.num - a.num;
      default:
        return a.num - b.num;
    }
  });

  items.forEach((item) => {
    const value = item.missing;
    const heat = getHeatColor(value / maxMissing);
    const row = document.createElement("div");
    row.classList.add("row");
    row.innerHTML = `
      <div class="cell">${item.num}</div>
      <div class="cell heat" style="background:${heat}; border-color: rgba(45, 160, 210, 0.18);">${value}</div>
    `;
    dataElem.appendChild(row);
  });

  wrapperElem.appendChild(dataElem);
};

export default renderMissingNumbers;
