const renderPb = ({ data, t }) => {
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

    for (let rowData of data) {
      const rowElem = document.createElement('div');
      rowElem.classList.add('row');
      const isPbDup = (rowData.slice(1, 8)).includes(rowData[8]);
      let ith = null;
      if (isPbDup) {
        ith = rowData.indexOf(rowData[8]);
      }
      rowElem.innerHTML = `
          <div class="cell">
            ${rowData[0]}
          </div>
          <div class="cell ${ith == 1 ? "large" : ""}">
            ${rowData[1]}
          </div>
          <div class="cell ${ith == 2 ? "large" : ""}">
            ${rowData[2]}
          </div>
          <div class="cell ${ith == 3 ? "large" : ""}">
            ${rowData[3]}
          </div>
          <div class="cell ${ith == 4 ? "large" : ""}">
            ${rowData[4]}
          </div>
          <div class="cell ${ith == 5 ? "large" : ""}">
            ${rowData[5]}
          </div>
          <div class="cell ${ith == 6 ? "large" : ""}">
            ${rowData[6]}
          </div>
          <div class="cell ${ith == 7 ? "large" : ""}">
            ${rowData[7]}
          </div>
          <div class="cell ${isPbDup ? "large" : ""}">
            ${rowData[8]}
          </div>
      `;
      dataElem.appendChild(rowElem);
    }
};

export default renderPb;
