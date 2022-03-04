import db from './db.js';

const processData = () => {
    const wrapperElem = document.getElementById("wrapper");
    const dataElem = document.createElement('div');
    dataElem.classList.add('table');
    dataElem.classList.add('remove');
    dataElem.innerHTML = `
      <div class="row header green">
        <div class="cell">
          Date
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
          PB
        </div>
      </div>
    `;
    wrapperElem.appendChild(dataElem);

    for (let rowData of db) {
      const rowElem = document.createElement('div');
      rowElem.classList.add('row');
      const isPbDup = (rowData.slice(1, 8)).includes(rowData[8]) ? "medium" : "";
      let ith = null;
      if (isPbDup) {
        ith = rowData.indexOf(rowData[8]);
      }
      rowElem.innerHTML = `
          <div class="cell ${isPbDup}">
            ${rowData[0]}
          </div>
          <div class="cell ${ith == 1 ? "large" : isPbDup}">
            ${rowData[1]}
          </div>
          <div class="cell ${ith == 2 ? "large" : isPbDup}">
            ${rowData[2]}
          </div>
          <div class="cell ${ith == 3 ? "large" : isPbDup}">
            ${rowData[3]}
          </div>
          <div class="cell ${ith == 4 ? "large" : isPbDup}">
            ${rowData[4]}
          </div>
          <div class="cell ${ith == 5 ? "large" : isPbDup}">
            ${rowData[5]}
          </div>
          <div class="cell ${ith == 6 ? "large" : isPbDup}">
            ${rowData[6]}
          </div>
          <div class="cell ${ith == 7 ? "large" : isPbDup}">
            ${rowData[7]}
          </div>
          <div class="cell ${isPbDup ? "large" : isPbDup}">
            ${rowData[8]}
          </div>
      `;
      dataElem.appendChild(rowElem);
    }
};

export default processData;
