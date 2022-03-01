import db from './db.js';

var arr = {	
	max: function(array) {
		return Math.max.apply(null, array);
	},
	
	min: function(array) {
		return Math.min.apply(null, array);
	},
	
	range: function(array) {
		return arr.max(array) - arr.min(array);
	},
	
	midrange: function(array) {
		return arr.range(array) / 2;
	},

	sum: function(array) {
		var num = 0;
		for (var i = 0, l = array.length; i < l; i++) num += array[i];
		return num;
	},
	
	mean: function(array) {
		return arr.sum(array) / array.length;
	},
	
	median: function(array) {
		array.sort(function(a, b) {
			return a - b;
		});
		var mid = array.length / 2;
		return mid % 1 ? array[mid - 0.5] : (array[mid - 1] + array[mid]) / 2;
	},
	
	modes: function(array) {
		if (!array.length) return [];
		var modeMap = {},
			maxCount = 0,
			modes = [];

		array.forEach(function(val) {
			if (!modeMap[val]) modeMap[val] = 1;
			else modeMap[val]++;

			if (modeMap[val] > maxCount) {
				modes = [val];
				maxCount = modeMap[val];
			}
			else if (modeMap[val] === maxCount) {
				modes.push(val);
				maxCount = modeMap[val];
			}
		});
		return modes;
	},
	
	variance: function(array) {
		var mean = arr.mean(array);
		return arr.mean(array.map(function(num) {
			return Math.pow(num - mean, 2);
		}));
	},
	
	standardDeviation: function(array) {
		return Math.sqrt(arr.variance(array));
	},
	
	meanAbsoluteDeviation: function(array) {
		var mean = arr.mean(array);
		return arr.mean(array.map(function(num) {
			return Math.abs(num - mean);
		}));
	},
	
	zScores: function(array) {
		var mean = arr.mean(array);
		var standardDeviation = arr.standardDeviation(array);
		return array.map(function(num) {
			return (num - mean) / standardDeviation;
		});
	}
};

// Function aliases:
arr.average = arr.mean;

const getStatistics = (nums) => {
    let results = [nums[0]];
    const array = [Number(nums[1]), Number(nums[2]), Number(nums[3]), Number(nums[4]), 
      Number(nums[5]), Number(nums[6]), Number(nums[7])];
    
    results.push(arr.max(array));
    results.push(arr.min(array));
    results.push(arr.mean(array).toFixed(3));
    results.push(nums[4]);
    results.push(arr.standardDeviation(array).toFixed(3));

    return results;
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
          Max
        </div>
        <div class="cell">
          Min
        </div>
        <div class="cell">
          Avgrage
        </div>
        <div class="cell">
          Median
        </div>
        <div class="cell">
          SD
        </div>
      </div>
    `;
    wrapperElem.appendChild(dataElem);

    for (let rowData of db) {
      const data = getStatistics(rowData);
      const rowElem = document.createElement('div');
      rowElem.classList.add('row');
      rowElem.innerHTML = `
          <div class="cell">
            ${data[0]}
          </div>
          <div class="cell">
            ${data[1]}
          </div>
          <div class="cell">
            ${data[2]}
          </div>
          <div class="cell">
            ${data[3]}
          </div>
          <div class="cell">
            ${data[4]}
          </div>
          <div class="cell">
            ${data[5]}
          </div>
      `;
      dataElem.appendChild(rowElem);
    }
};

export default processData;
