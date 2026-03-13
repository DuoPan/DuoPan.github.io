const toPercent = (value, total) => {
  if (!total) return 0;
  return Math.round((value / total) * 100);
};

const buildPie = (primaryCount, secondaryCount, primaryLabel) => {
  const total = primaryCount + secondaryCount;
  const primaryAngle = total ? (primaryCount / total) * 360 : 0;
  const largeArc = primaryAngle > 180 ? 1 : 0;
  const radius = 52;
  const center = 60;
  const rad = (deg) => (deg - 90) * (Math.PI / 180);
  const x = center + radius * Math.cos(rad(primaryAngle));
  const y = center + radius * Math.sin(rad(primaryAngle));

  return `
    <svg viewBox="0 0 120 120" class="chart-svg pie">
      <circle cx="${center}" cy="${center}" r="${radius}" fill="#e9f4ff"></circle>
      <path d="M ${center} ${center - radius} A ${radius} ${radius} 0 ${largeArc} 1 ${x} ${y} L ${center} ${center} Z"
        fill="#ffb347"></path>
      <circle cx="${center}" cy="${center}" r="${radius - 22}" fill="#ffffff"></circle>
      <text x="${center}" y="${center - 4}" text-anchor="middle" class="chart-number">${toPercent(primaryCount, total)}%</text>
      <text x="${center}" y="${center + 16}" text-anchor="middle" class="chart-label">${primaryLabel}</text>
    </svg>
  `;
};

const buildBars = (buckets) => {
  const total = buckets.reduce((acc, v) => acc + v, 0);
  const labels = ["1-10", "11-20", "21-30", "31-35"];
  return labels
    .map((label, i) => {
      const percent = toPercent(buckets[i], total);
      return `
        <div class="bar-row">
          <span>${label}</span>
          <div class="bar-track">
            <div class="bar-fill" style="width:${percent}%"></div>
          </div>
          <span>${buckets[i]}</span>
        </div>
      `;
    })
    .join("");
};

const buildLine = (values) => {
  if (!values.length) return "";
  const width = 900;
  const height = 180;
  const padding = 24;
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  const range = maxVal - minVal || 1;
  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1 || 1)) * (width - padding * 2);
    const y = height - padding - ((v - minVal) / range) * (height - padding * 2);
    return `${x},${y}`;
  }).join(" ");

  return `
    <svg viewBox="0 0 ${width} ${height}" class="chart-svg line">
      <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" class="chart-axis"></line>
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" class="chart-axis"></line>
      <line x1="${padding}" y1="${padding}" x2="${width - padding}" y2="${padding}" class="chart-tick"></line>
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" class="chart-tick"></line>
      <text x="4" y="${padding + 4}" class="chart-axis-label">${maxVal}</text>
      <text x="4" y="${height - padding}" class="chart-axis-label">${minVal}</text>
      <text x="${width - padding}" y="${height - 6}" text-anchor="end" class="chart-axis-label">${values.length} draws</text>
      <polyline points="${points}" fill="none" stroke="#20c7a6" stroke-width="3" />
    </svg>
  `;
};

const renderCharts = ({ data, t, chartWindow }) => {
  const wrapperElem = document.getElementById("wrapper");
  const dataElem = document.createElement("div");
  dataElem.classList.add("table");
  dataElem.classList.add("remove");

  const windowSize = Number(chartWindow) || 100;
  const rows = data.slice(0, windowSize);
  const nums = rows.flatMap((row) => row.slice(1, 8).map(Number));
  const oddCount = nums.filter((n) => n % 2 === 1).length;
  const evenCount = nums.length - oddCount;
  const lowCount = nums.filter((n) => n <= 17).length;
  const highCount = nums.length - lowCount;
  const pbNums = rows.map((row) => Number(row[8]));
  const pbOdd = pbNums.filter((n) => n % 2 === 1).length;
  const pbEven = pbNums.length - pbOdd;
  const buckets = [
    nums.filter((n) => n >= 1 && n <= 10).length,
    nums.filter((n) => n >= 11 && n <= 20).length,
    nums.filter((n) => n >= 21 && n <= 30).length,
    nums.filter((n) => n >= 31 && n <= 35).length
  ];

  const sums = rows.map((row) => row.slice(1, 8).reduce((acc, v) => acc + Number(v), 0)).reverse();

  dataElem.innerHTML = `
    <div class="chart-grid pies">
      <div class="chart-card">
        <div class="chart-title">${t("chart.oddEven")}</div>
        ${buildPie(oddCount, evenCount, t("chart.odd"))}
        <div class="chart-meta">${t("chart.oddEvenMeta")} ${oddCount}/${evenCount}</div>
      </div>
      <div class="chart-card">
        <div class="chart-title">${t("chart.lowHigh")}</div>
        ${buildPie(lowCount, highCount, t("chart.low"))}
        <div class="chart-meta">${t("chart.lowHighMeta")} ${lowCount}/${highCount}</div>
      </div>
      <div class="chart-card">
        <div class="chart-title">${t("chart.pbOddEven")}</div>
        ${buildPie(pbOdd, pbEven, t("chart.pbOdd"))}
        <div class="chart-meta">${t("chart.oddEvenMeta")} ${pbOdd}/${pbEven}</div>
      </div>
    </div>
    <div class="chart-grid">
      <div class="chart-card">
        <div class="chart-title">${t("chart.range")}</div>
        ${buildBars(buckets)}
      </div>
      <div class="chart-card chart-wide">
        <div class="chart-title">${t("chart.sumTrend")}</div>
        ${buildLine(sums)}
        <div class="chart-meta">${t("chart.sumMeta")}</div>
      </div>
    </div>
  `;

  wrapperElem.appendChild(dataElem);
};

export default renderCharts;
