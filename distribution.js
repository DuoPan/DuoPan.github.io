import { getHeatColor } from "./data.js";

const renderDistribution = ({ data, t, frequency }) => {
    const wrapperElem = document.getElementById("wrapper");
    const dataElem = document.createElement('div');
    dataElem.classList.add('table');
    dataElem.classList.add('remove');
    dataElem.innerHTML = `
      <div class="row header">
        <div class="cell">
          ${t("table.date")}
        </div>
        <div class="cell">
          #1
        </div>
        <div class="cell">
          #2
        </div>
        <div class="cell">
          #3
        </div>
        <div class="cell">
          #4
        </div>
        <div class="cell">
          #5
        </div>
        <div class="cell">
          #6
        </div>
        <div class="cell">
          #7
        </div>
        <div class="cell">
          ${t("table.pb")}
        </div>
      </div>
    `;
    wrapperElem.appendChild(dataElem);
    const maxMain = frequency?.maxMain || 1;
    const maxPb = frequency?.maxPb || 1;

    const renderBall = (value, intensityStyle) => {
      const ball = document.createElement("span");
      ball.classList.add("ball");
      if (intensityStyle) {
        ball.style.background = intensityStyle.background;
        ball.style.borderColor = intensityStyle.borderColor;
        ball.style.color = intensityStyle.color;
        ball.style.boxShadow = intensityStyle.boxShadow;
      }
      ball.textContent = value;
      return ball;
    };

    const buildHotCoolSets = (counts, maxNumber, topN) => {
      const items = [];
      for (let i = 1; i <= maxNumber; i += 1) {
        items.push({ num: i, count: counts[i] || 0 });
      }
      const sorted = [...items].sort((a, b) => b.count - a.count);
      const hotThreshold = sorted[Math.min(topN - 1, sorted.length - 1)]?.count ?? 0;
      const coolThreshold = [...sorted].reverse()[Math.min(topN - 1, sorted.length - 1)]?.count ?? 0;
      const hotSet = new Set(items.filter((x) => x.count > 0 && x.count >= hotThreshold).map((x) => x.num));
      const coolSet = new Set(items.filter((x) => x.count > 0 && x.count <= coolThreshold).map((x) => x.num));
      return { hotSet, coolSet };
    };

    const topNMain = 5;
    const topNPb = 3;
    const { hotSet: hotMain, coolSet: coolMain } = buildHotCoolSets(frequency?.main || {}, 35, topNMain);
    const { hotSet: hotPb, coolSet: coolPb } = buildHotCoolSets(frequency?.pb || {}, 20, topNPb);

    for (let rowData of data) {
      let rowDataCopy = [...rowData];
      const pb = rowDataCopy.pop();
      const rowElem = document.createElement('div');
      rowElem.classList.add('row');

      const dateElem = document.createElement('div');
      dateElem.classList.add('cell');
      dateElem.innerText = rowDataCopy[0];
      rowElem.appendChild(dateElem);

      rowDataCopy.slice(1).forEach((value) => {
        const cellElem = document.createElement('div');
        cellElem.classList.add('cell');
        const num = Number(value);
        const count = frequency?.main?.[num] || 0;
        if (count > 0 && (hotMain.has(num) || coolMain.has(num))) {
          const ratio = maxMain ? count / maxMain : 0;
          const color = hotMain.has(num) ? "rgba(239, 83, 80, 0.22)" : "rgba(91, 184, 255, 0.22)";
          cellElem.appendChild(renderBall(num, {
            background: color,
            borderColor: hotMain.has(num) ? "rgba(239, 83, 80, 0.6)" : "rgba(91, 184, 255, 0.6)",
            color: "#132235",
            boxShadow: hotMain.has(num)
              ? "0 6px 12px rgba(239, 83, 80, 0.2)"
              : "0 6px 12px rgba(91, 184, 255, 0.2)"
          }));
        } else {
          cellElem.innerText = value;
        }
        rowElem.appendChild(cellElem);
      });

      const pbCell = document.createElement('div');
      pbCell.classList.add('cell');
      const pbNum = Number(pb);
      const pbCount = frequency?.pb?.[pbNum] || 0;
      if (pbCount > 0 && (hotPb.has(pbNum) || coolPb.has(pbNum))) {
        const color = hotPb.has(pbNum) ? "rgba(239, 83, 80, 0.22)" : "rgba(91, 184, 255, 0.22)";
        pbCell.appendChild(renderBall(pbNum, {
          background: color,
          borderColor: hotPb.has(pbNum) ? "rgba(239, 83, 80, 0.6)" : "rgba(91, 184, 255, 0.6)",
          color: "#132235",
          boxShadow: hotPb.has(pbNum)
            ? "0 6px 12px rgba(239, 83, 80, 0.2)"
            : "0 6px 12px rgba(91, 184, 255, 0.2)"
        }));
      } else {
        pbCell.innerText = pb;
      }
      rowElem.appendChild(pbCell);

      dataElem.appendChild(rowElem);
    }
};

export default renderDistribution;
