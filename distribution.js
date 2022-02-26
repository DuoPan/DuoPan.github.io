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
          #8
        </div>
        <div class="cell">
          #9
        </div>
        <div class="cell">
          #10
        </div>
        <div class="cell">
          #11
        </div>
        <div class="cell">
          #12
        </div>
        <div class="cell">
          #13
        </div>
        <div class="cell">
          #14
        </div>
        <div class="cell">
          #15
        </div>
        <div class="cell">
          #16
        </div>
        <div class="cell">
          #17
        </div>
        <div class="cell">
          #18
        </div>
        <div class="cell">
          #19
        </div>
        <div class="cell">
          #20
        </div>
        <div class="cell">
          #21
        </div>
        <div class="cell">
          #22
        </div>
        <div class="cell">
          #23
        </div>
        <div class="cell">
          #24
        </div>
        <div class="cell">
          #25
        </div>
        <div class="cell">
          #26
        </div>
        <div class="cell">
          #27
        </div>
        <div class="cell">
          #28
        </div>
        <div class="cell">
          #29
        </div>
        <div class="cell">
          #30
        </div>
        <div class="cell">
          #31
        </div>
        <div class="cell">
          #32
        </div>
        <div class="cell">
          #33
        </div>
        <div class="cell">
          #34
        </div>
        <div class="cell">
          #35
        </div>
        <div class="cell">
          PB#1
        </div>
        <div class="cell">
          PB#2
        </div>
        <div class="cell">
          PB#3
        </div>
        <div class="cell">
          PB#4
        </div>
        <div class="cell">
          PB#5
        </div>
        <div class="cell">
          PB#6
        </div>
        <div class="cell">
          PB#7
        </div>
        <div class="cell">
          PB#8
        </div>
        <div class="cell">
          PB#9
        </div>
        <div class="cell">
          PB#10
        </div>
        <div class="cell">
          PB#11
        </div>
        <div class="cell">
          PB#12
        </div>
        <div class="cell">
          PB#13
        </div>
        <div class="cell">
          PB#14
        </div>
        <div class="cell">
          PB#15
        </div>
        <div class="cell">
          PB#16
        </div>
        <div class="cell">
          PB#17
        </div>
        <div class="cell">
          PB#18
        </div>
        <div class="cell">
          PB#19
        </div>
        <div class="cell">
          PB#20
        </div>
      </div>
    `;
    wrapperElem.appendChild(dataElem);
    for (let rowData of db) {
      let rowDataCopy = [...rowData];
      const pb = rowDataCopy.pop();
      const rowElem = document.createElement('div');
      rowElem.classList.add('row');

      const dateElem = document.createElement('div');
      dateElem.classList.add('cell');
      dateElem.innerText = rowDataCopy[0];
      rowElem.appendChild(dateElem);

      [...Array(35).keys()].map(a => {
        const cellElem = document.createElement('div');
        cellElem.classList.add('cell');
        if (rowDataCopy.includes((a + 1).toString())) {
          const highlightElem = document.createElement('div');
          highlightElem.innerText = a + 1;
          highlightElem.style.background = '#1730e4';
          highlightElem.style.display = 'flex';
          highlightElem.style.justifyContent = 'center';
          highlightElem.style.alignItems = 'center';
          highlightElem.style.borderRadius = '50%';
          highlightElem.style.height = '27px';
          highlightElem.style.width = '27px';
          highlightElem.style.color = 'white';
          cellElem.appendChild(highlightElem);
        } else {
          cellElem.innerText = a + 1;
        }
        rowElem.appendChild(cellElem);
      });

      [...Array(20).keys()].map(a => {
        const cellElem = document.createElement('div');
        cellElem.classList.add('cell');
        if (pb === (a + 1).toString()) {
          const highlightElem = document.createElement('div');
          highlightElem.innerText = a + 1;
          highlightElem.style.background = '#1730e4';
          highlightElem.style.display = 'flex';
          highlightElem.style.justifyContent = 'center';
          highlightElem.style.alignItems = 'center';
          highlightElem.style.borderRadius = '50%';
          highlightElem.style.height = '27px';
          highlightElem.style.width = '27px';
          highlightElem.style.color = 'white';
          cellElem.appendChild(highlightElem);
        } else {
          cellElem.innerText = a + 1;
        }
        rowElem.appendChild(cellElem);
      });

      dataElem.appendChild(rowElem);
    }
};

export default processData;
