import db from './db.js';

const isContinous = (nums, index) => {
  // index -> [1, 7]
  if (index > 1 && index < 7 && 
      (Number(nums[index]) + 1 === Number(nums[index + 1]) ||
        Number(nums[index]) - 1 === Number(nums[index - 1])
      )
  ) {
    return "medium";
  } else if (index === 7 && Number(nums[index]) - 1 === Number(nums[index - 1])) {
    return "medium";
  } else if (index === 1 && Number(nums[index]) + 1 === Number(nums[index + 1])) {
    return "medium";
  } else {
    return "";
  }
};

const getContinousColors = (nums) => {
  let colors = {};
  let useFirstColor = false;
  if (nums[0] + 1 === nums[1]) {
    colors[nums[0]] = "medium";
    useFirstColor = true;
  } else {
    colors[nums[0]] = "";
  }
  for (let i = 1; i < 6; ++ i) {
    if (nums[i] - 1 === nums[i-1]) {
      colors[nums[i]] = colors[nums[i-1]];
    } else if (nums[i] + 1 === nums[i+1]) {
      useFirstColor = !useFirstColor;
      colors[nums[i]] = useFirstColor ? "medium" : "large";
    } else {
      colors[nums[i]] = "";
    }
  }
  if (nums[6] - 1 === nums[5]) {
    colors[nums[6]] = colors[nums[5]];
  } else {
    colors[nums[6]] = "";
  }
  return colors;
};

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
      const colors = getContinousColors([Number(rowData[1]), Number(rowData[2]), Number(rowData[3]), 
        Number(rowData[4]), Number(rowData[5]), Number(rowData[6]), Number(rowData[7])]);
      rowElem.innerHTML = `
          <div class="cell">
            ${rowData[0]}
          </div>
          <div class="cell ${colors[rowData[1]]}">
            ${rowData[1]}
          </div>
          <div class="cell ${colors[rowData[2]]}">
            ${rowData[2]}
          </div>
          <div class="cell ${colors[rowData[3]]}">
            ${rowData[3]}
          </div>
          <div class="cell ${colors[rowData[4]]}">
            ${rowData[4]}
          </div>
          <div class="cell ${colors[rowData[5]]}">
            ${rowData[5]}
          </div>
          <div class="cell ${colors[rowData[6]]}">
            ${rowData[6]}
          </div>
          <div class="cell ${colors[rowData[7]]}">
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
