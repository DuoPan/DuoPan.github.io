import { getHeatColor } from "./data.js";

const getHotSort = () => {
  return localStorage.getItem("hotSort") || "count_desc";
};

const renderHotNumbers = ({ data, t, frequency, sortOverride }) => {
  const wrapperElem = document.getElementById("wrapper");
  const dataElem = document.createElement("div");
  dataElem.classList.add("table");
  dataElem.classList.add("remove");

  const hotSort = sortOverride || getHotSort();
  const maxMain = frequency?.maxMain || 1;
  const maxPb = frequency?.maxPb || 1;

  const buildRows = (limit, maxValue, title) => {
    const section = document.createElement("div");
    section.classList.add("table");
    section.innerHTML = `
      <div class="row header">
        <div class="cell">${title}</div>
        <div class="cell">${t("table.number")}</div>
        <div class="cell">${t("table.count")}</div>
      </div>
    `;

    const items = [];
    for (let i = 1; i <= limit; i += 1) {
      items.push({ num: i, count: maxValue[i] || 0 });
    }

    items.sort((a, b) => {
      switch (hotSort) {
        case "count_asc":
          return a.count - b.count;
        case "number_desc":
          return b.num - a.num;
        case "number_asc":
          return a.num - b.num;
        default:
          return b.count - a.count;
      }
    });

    items.forEach((item) => {
      const count = item.count;
      const row = document.createElement("div");
      row.classList.add("row");
      const heat = getHeatColor(count / (limit === 35 ? maxMain : maxPb));
      row.innerHTML = `
        <div class="cell"></div>
        <div class="cell">${item.num}</div>
        <div class="cell heat" style="background:${heat}; border-color: rgba(45, 160, 210, 0.18);">${count}</div>
      `;
      section.appendChild(row);
    });
    return section;
  };

  dataElem.appendChild(buildRows(35, frequency?.main || {}, t("section.main")));
  dataElem.appendChild(buildRows(20, frequency?.pb || {}, t("section.pb")));

  wrapperElem.appendChild(dataElem);
};

export default renderHotNumbers;
