const renderHistory = ({ data, t }) => {
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
      rowElem.innerHTML = `
      <div class="cell">
        ${rowData[0]}
      </div>
      <div class="cell">
        ${rowData[1]}
      </div>
      <div class="cell">
        ${rowData[2]}
      </div>
      <div class="cell">
        ${rowData[3]}
      </div>
      <div class="cell">
        ${rowData[4]}
      </div>
      <div class="cell">
        ${rowData[5]}
      </div>
      <div class="cell">
        ${rowData[6]}
      </div>
      <div class="cell">
        ${rowData[7]}
      </div>
      <div class="cell">
        ${rowData[8]}
      </div>
      `;
      dataElem.appendChild(rowElem);
    }
};

export default renderHistory;
