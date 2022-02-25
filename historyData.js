import db from './db.js';

const processData = () => {
    const dataElem = document.getElementById("data");

    for (let rowData of db) {
      const rowElem = document.createElement('div');
      rowElem.classList.add('row');
      rowElem.classList.add('remove');
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

export default processData;
