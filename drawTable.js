import { drawStats, frequency, dateISO } from './analytics.js';
import { t as translate } from './i18n.js';
import { getGame, zoneIndex } from './games.js';

export const escapeHTML = (value) => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const ballMarkup = (number, pool, watchlist, game = 'powerball', extra = '') => {
  getGame(game);
  return `<button type="button" class="number-button ${pool==='pb'?'powerball':''} ${(watchlist?.[pool]||[]).includes(number)?'is-watched':''} ${extra}" data-number="${number}" data-pool="${pool}" aria-label="${translate(`section.${pool}`)} ${number}">${number}</button>`;
};

const heatSets = (rows, pool, game) => {
  const items = frequency(rows,pool,game).sort((a,b)=>b.count-a.count);
  const threshold = pool==='main'?5:3;
  const top = items[threshold-1].count;
  const bottom = items[items.length-threshold].count;
  return {hot:new Set(items.filter(item=>item.count>=top&&item.count>bottom).map(item=>item.number)),cold:new Set(items.filter(item=>item.count<=bottom&&item.count<top).map(item=>item.number))};
};
export default function renderDrawTable({data,allData,view,t,watchlist,onNumberSelect,onDrawSelect,game='powerball'}) {
  const config=getGame(game);
  const wrapper=document.getElementById('wrapper');
  const scroll=document.createElement('div');
  scroll.className='table-scroll';
  scroll.tabIndex=0;
  scroll.setAttribute('aria-label',t(`view.${view}`));
  const table=document.createElement('table');
  table.className=`data-table history-table ${view==='statistics'?'statistics-table':''}`;
  const mainHeat=heatSets(allData,'main',config);
  const extraHeat=heatSets(allData,config.extraPool,config);
  const headers=view==='statistics'?
    ['table.date','table.max','table.min','structure.sum','table.average','table.median','table.sd','structure.oddEven','structure.lowHigh','detail.span','detail.run'].map(key=>t(key)):
    [t('table.date'),...Array.from({length:config.mainCount},(_,i)=>`#${i+1}`),...Array.from({length:config.extraCount},(_,i)=>config.extraCount===1?t('table.pb'):`${t('section.supplementary')} #${i+1}`),t('structure.sum')];
  table.innerHTML=`<caption class="sr-only">${t(`view.${view}`)}</caption><thead><tr>${headers.map(h=>`<th scope="col">${escapeHTML(h)}</th>`).join('')}</tr></thead><tbody></tbody>`;
  const body=table.querySelector('tbody');
  data.forEach(row=>{
    const tr=document.createElement('tr');
    tr.dataset.date=dateISO(row[0]);
    const stats=drawStats(row,config);
    let cells;
    if(view==='statistics') {
      cells=[row[config.mainCount],row[1],stats.sum,stats.average.toFixed(1),stats.median,stats.sd.toFixed(2),`${stats.odds}/${stats.evens}`,`${stats.low}/${stats.high}`,stats.span,stats.maxRun].map(n=>`<td>${n}</td>`).join('');
    } else {
      const main=row.slice(1,1+config.mainCount);
      let runGroup=0;
      const runClasses=new Map();
      for(let i=0;i<main.length;i++) {
        if(i>0&&main[i]===main[i-1]+1) runClasses.set(main[i],`run-${runGroup%3}`);
        else if(main[i+1]===main[i]+1) {runGroup++;runClasses.set(main[i],`run-${runGroup%3}`);}
      }
      cells=row.slice(1).map((number,index)=>{
        const pool=index>=config.mainCount?config.extraPool:'main';
        let style='';
        if(view==='block'&&pool==='main') style=['zone-low','zone-middle','zone-high'][zoneIndex(number,config)]||'';
        if(view==='distribution') {const heat=pool==='main'?mainHeat:extraHeat;style=heat.hot.has(number)?'heat-hot':heat.cold.has(number)?'heat-cold':'';}
        if(view==='continuous'&&pool==='main') style=runClasses.get(number)||'';
        if(view==='pb'&&config.extraPool==='pb'&&main.includes(row[8])&&number===row[8]) style='overlap';
        return `<td>${ballMarkup(number,pool,watchlist,config,style)}</td>`;
      }).join('')+`<td class="sum-cell">${stats.sum}</td>`;
    }
    tr.innerHTML=`<th scope="row"><button type="button" class="date-button" data-draw="${dateISO(row[0])}">${row[0]}</button></th>${cells}`;
    tr.addEventListener('click',event=>{
      const ball=event.target.closest('[data-number]');
      if(ball) onNumberSelect(Number(ball.dataset.number),ball.dataset.pool);
      else onDrawSelect(row);
    });
    body.appendChild(tr);
  });
  scroll.appendChild(table);wrapper.appendChild(scroll);
}
