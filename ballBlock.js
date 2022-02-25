import db from './db.js';

const calcBallBlock = (num) => {
    if (num <= 12) {
      return "small";
    } else if (num >= 25) {
      return "large";
    } else {
      return "medium";
    }
};

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
          <div class="cell ${calcBallBlock(rowData[1])}">
            ${rowData[1]}
          </div>
          <div class="cell ${calcBallBlock(rowData[2])}">
            ${rowData[2]}
          </div>
          <div class="cell ${calcBallBlock(rowData[3])}">
            ${rowData[3]}
          </div>
          <div class="cell ${calcBallBlock(rowData[4])}">
            ${rowData[4]}
          </div>
          <div class="cell ${calcBallBlock(rowData[5])}">
            ${rowData[5]}
          </div>
          <div class="cell ${calcBallBlock(rowData[6])}">
            ${rowData[6]}
          </div>
          <div class="cell ${calcBallBlock(rowData[7])}">
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
