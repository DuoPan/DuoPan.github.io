import rawRows from './db.js';
import {normalizeRows,selectRange,dateISO,parseDate} from './analytics.js';
import {setLanguage,t,applyI18n,registerTranslations} from './i18n.js';
import {UI_COPY} from './ui-copy.js';
import renderNumberView,{NUMBER_COPY} from './numberViews.js';
import renderCharts,{CHART_COPY} from './charts.js';
import {renderDrawDetail,renderNumberDetail,DETAIL_COPY} from './details.js';
import renderDrawTable,{ballMarkup,escapeHTML} from './drawTable.js';
import renderContact from './contact.js';
import {buildExport} from './exports.js';
import {DEFAULT_STATE,WINDOWS,sanitizeState,stateFromHash,stateToHash,readStorage,writeStorage,sanitizeWatchlist,sanitizePresets} from './state.js';

[UI_COPY,NUMBER_COPY,CHART_COPY,DETAIL_COPY].forEach(registerTranslations);
const $ = id=>document.getElementById(id);
const groups={history:['history','block','distribution','continuous','statistics','pb'],numbers:['hot','missing','trend','pairs'],charts:['charts'],more:['contact']};
const pageSize=50;
let rows=[];
let state=stateFromHash(location.hash)||sanitizeState(readStorage('powerball.state',DEFAULT_STATE));
let watchlist=sanitizeWatchlist(readStorage('powerball.watchlist',{}));
let presets=sanitizePresets(readStorage('powerball.presets',[]));
let selection={data:[],asOfData:[]};
let updateStatus=null;
let statusReadFailed=false;
let detail=null;
let detailOpener=null;
let toastTimer;
let dataError=false;
try {rows=normalizeRows(rawRows);} catch(error) {dataError=true;console.error(error);}

function notify(message) {
  $('notification').textContent=message;
  $('notification').classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>$('notification').classList.remove('is-visible'),3500);
}
function save(key,value) {if(!writeStorage(key,value)) notify(t('app.storageError'));}
function syncLocation(replace=false) {
  const hash=stateToHash(state);
  if(location.hash!==hash) window.history[replace?'replaceState':'pushState'](null,'',hash);
  save('powerball.state',state);
}
function changeState(change,{replace=false}={}) {
  state=sanitizeState({...state,...change});
  render();
  syncLocation(replace);
}
function openDialog() {
  if(!$('detailDialog').open) {detailOpener=document.activeElement;$('detailDialog').showModal();}
  $('detailDialog').scrollTop=0;
  $('detailTitle').tabIndex=-1;
  $('detailTitle').focus({preventScroll:true});
}
function openDraw(row) {detail={type:'draw',row};paintDetail();openDialog();}
function openNumber(number,pool='main') {detail={type:'number',number,pool};paintDetail();openDialog();}
function paintDetail() {
  if(!detail) return;
  if(detail.type==='draw') renderDrawDetail({row:detail.row,t,watchlist,onNumberSelect:openNumber});
  else renderNumberDetail({...detail,...selection,t,watchlist,onDrawSelect:openDraw,onWatchToggle:toggleWatch});
}
function toggleWatch(number,pool) {
  const current=new Set(watchlist[pool]);
  if(current.has(number)) current.delete(number);else current.add(number);
  watchlist=sanitizeWatchlist({...watchlist,[pool]:[...current]});
  save('powerball.watchlist',watchlist);
  const scrolls=[...document.querySelectorAll('.table-scroll')].map(el=>({top:el.scrollTop,left:el.scrollLeft}));
  const inDialog=$('detailDialog').open;
  const dialogScroll=$('detailDialog').scrollTop;
  render();
  $('detailDialog').scrollTop=dialogScroll;
  document.querySelectorAll('.table-scroll').forEach((el,i)=>{el.scrollTop=scrolls[i]?.top||0;el.scrollLeft=scrolls[i]?.left||0;});
  const scope=inDialog?$('detailBody'):$('wrapper');
  scope.querySelector(`.watch-toggle[data-number="${number}"][data-pool="${pool}"]`)?.focus({preventScroll:true});
}
function paintStatus() {
  const latest=rows[0];
  const stale=latest && Date.now()-parseDate(latest[0]).getTime()>8*86400000;
  let key=updateStatus?.status==='ok'?'app.syncCurrent':'app.syncUnknown';
  if(stale) key='app.syncStale';
  if(updateStatus?.status==='error') key='app.syncFailed';
  if(!updateStatus&&!statusReadFailed) key='app.syncLoading';
  $('sourceSummary').textContent=t(key);
  $('sourceSummary').className=stale||updateStatus?.status==='error'?'status-warning':'status-ok';
  const source=typeof updateStatus?.sourceUrl==='string'&&/^https:\/\//.test(updateStatus.sourceUrl)?updateStatus.sourceUrl:'';
  const timestamp=value=>{
    if(!value||!Number.isFinite(Date.parse(value))) return t('app.unknown');
    return new Intl.DateTimeFormat(state.lang==='zh'?'zh-CN':'en-AU',{dateStyle:'medium',timeStyle:'short',timeZone:'Australia/Sydney'}).format(new Date(value))+' (Sydney)';
  };
  $('sourceDetails').innerHTML=`<dl class="source-list"><dt>${t('app.source')}</dt><dd>${source?`<a href="${escapeHTML(source)}" target="_blank" rel="noopener noreferrer">${escapeHTML(updateStatus.sourceName||source)} ↗</a>`:t('app.unknown')}</dd><dt>${t('app.dataCutoff')}</dt><dd>${latest?.[0]||'—'}</dd><dt>${t('app.lastSuccess')}</dt><dd>${timestamp(updateStatus?.lastSuccessAt)}</dd><dt>${t('app.lastAttempt')}</dt><dd>${timestamp(updateStatus?.lastAttemptAt)}</dd><dt>${t('app.coverage')}</dt><dd>${rows.at(-1)?.[0]||'—'} — ${latest?.[0]||'—'}</dd></dl>${stale?`<p>${t('app.staleNote')}</p>`:''}${statusReadFailed?`<p>${t('app.syncUnavailable')}</p>`:''}${updateStatus?.status==='error'?`<p>${escapeHTML(updateStatus.message||t('app.syncFailed'))}</p>`:''}`;
}
function paintWatchlist() {
  $('watchlist').replaceChildren();
  for(const pool of ['main','pb']) {
    if(!watchlist[pool].length) continue;
    const group=document.createElement('div');group.className='watch-group';
    group.innerHTML=`<h3>${t(pool==='main'?'section.main':'section.pb')}</h3><div class="balls">${watchlist[pool].map(number=>ballMarkup(number,pool,watchlist)).join('')}</div>`;
    group.addEventListener('click',event=>{const ball=event.target.closest('[data-number]');if(ball) openNumber(Number(ball.dataset.number),ball.dataset.pool);});
    $('watchlist').appendChild(group);
  }
  if(!watchlist.main.length&&!watchlist.pb.length) $('watchlist').innerHTML=`<p class="muted">${t('app.watchEmpty')}</p>`;
}
function paintPresets() {
  $('presetList').replaceChildren();
  if(!presets.length) $('presetList').innerHTML=`<p class="muted">${t('app.noPresets')}</p>`;
  presets.forEach(preset=>{
    const row=document.createElement('div');row.className='preset-item';
    const load=document.createElement('button');load.type='button';load.className='preset-load';load.textContent=preset.name;load.title=t('app.load');
    load.addEventListener('click',()=>changeState(preset.state));
    const remove=document.createElement('button');remove.type='button';remove.className='icon-button';remove.textContent='×';remove.setAttribute('aria-label',`${t('app.remove')} ${preset.name}`);
    remove.addEventListener('click',()=>{presets=presets.filter(item=>item.id!==preset.id);save('powerball.presets',presets);paintPresets();});
    row.append(load,remove);$('presetList').appendChild(row);
  });
}
function paintControls() {
  $('viewControls').replaceChildren();
  if(!['hot','missing','trend','pairs'].includes(state.view)) return;
  if(state.view!=='pairs') {
    const label=document.createElement('label');label.className='field';
    label.innerHTML=`<span>${t('app.pool')}</span><select id="poolSelect"><option value="main">${t('section.main')}</option><option value="pb">${t('section.pb')}</option></select>`;
    label.querySelector('select').value=state.pool;
    label.querySelector('select').addEventListener('change',event=>changeState({pool:event.target.value,page:1}));
    $('viewControls').appendChild(label);
  }
  const sortOptions=state.view==='missing'?[['missing_desc','sort.missingDesc'],['missing_asc','sort.missingAsc'],['number_asc','sort.numberAsc'],['number_desc','sort.numberDesc']]:state.view==='trend'?[['rate_desc','sort.rateDesc'],['number_asc','sort.numberAsc'],['number_desc','sort.numberDesc']]:state.view==='pairs'?[['count_desc','sort.countDesc'],['number_asc','sort.numberAsc']]:[['count_desc','sort.countDesc'],['count_asc','sort.countAsc'],['number_asc','sort.numberAsc'],['number_desc','sort.numberDesc']];
  const actualSort=sortOptions.some(([value])=>value===state.sort)?state.sort:sortOptions[0][0];
  state.sort=actualSort;
  const label=document.createElement('label');label.className='field';
  label.innerHTML=`<span>${t('table.sort')}</span><select id="sortSelect">${sortOptions.map(([value,key])=>`<option value="${value}">${t(key)}</option>`).join('')}</select>`;
  label.querySelector('select').value=actualSort;
  label.querySelector('select').addEventListener('change',event=>changeState({sort:event.target.value}));
  $('viewControls').appendChild(label);
}
function paintPagination(total) {
  const root=$('pagination');root.replaceChildren();
  if(!groups.history.includes(state.view)||total<=pageSize) return;
  const pages=Math.ceil(total/pageSize);
  root.innerHTML=`<button class="button" type="button" data-dir="prev" ${state.page===1?'disabled':''}>${t('pagination.prev')}</button><div class="page-info"><span>${t('app.page',{page:state.page,total:pages})}</span><small>${t('app.pageRange',{from:(state.page-1)*pageSize+1,to:Math.min(total,state.page*pageSize),n:total})}</small></div><label class="page-jump"><span class="sr-only">${t('app.jump')}</span><select aria-label="${t('app.jump')}" id="pageJump">${Array.from({length:pages},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('')}</select></label><button class="button" type="button" data-dir="next" ${state.page===pages?'disabled':''}>${t('pagination.next')}</button>`;
  $('pageJump').value=String(state.page);
  $('pageJump').addEventListener('change',event=>changeState({page:Number(event.target.value)}));
  root.querySelectorAll('[data-dir]').forEach(button=>button.addEventListener('click',()=>changeState({page:state.page+(button.dataset.dir==='prev'?-1:1)})));
}
function render() {
  setLanguage(state.lang);document.documentElement.lang=state.lang;document.title=t('title');applyI18n();
  $('closeDetail').setAttribute('aria-label',t('app.close'));
  document.querySelectorAll('[data-lang]').forEach(button=>{button.classList.toggle('is-active',button.dataset.lang===state.lang);button.setAttribute('aria-pressed',String(button.dataset.lang===state.lang));});
  $('latestDate').textContent=rows[0]?.[0]||'—';
  $('latestBalls').innerHTML=rows[0]?rows[0].slice(1).map((number,i)=>`${i===7?'<span class="pb-label">PB</span>':''}${ballMarkup(number,i===7?'pb':'main',watchlist)}`).join(''):'';
  $('archiveSummary').textContent=t('app.archive',{n:rows.length});
  paintStatus();paintWatchlist();paintPresets();
  const group=Object.keys(groups).find(key=>groups[key].includes(state.view));
  document.querySelectorAll('[data-group]').forEach(button=>{button.classList.toggle('is-active',button.dataset.group===group);button.setAttribute('aria-current',button.dataset.group===group?'page':'false');});
  $('subnav').innerHTML=groups[group].length>1?groups[group].map(view=>`<button type="button" data-view="${view}" class="${state.view===view?'is-active':''}" aria-current="${state.view===view?'page':'false'}">${t(`view.${view}`)}</button>`).join(''):'';
  $('subnav').hidden=groups[group].length===1;
  $('rangeWindow').innerHTML=WINDOWS.map(value=>`<option value="${value}">${value==='all'?t('app.all'):value==='custom'?t('app.custom'):t('app.lastN',{n:value})}</option>`).join('');
  $('rangeWindow').value=state.window;
  $('customDates').hidden=state.window!=='custom';
  $('dateFrom').value=parseDate(state.dateFrom)?state.dateFrom:'';$('dateTo').value=parseDate(state.dateTo)?state.dateTo:'';
  $('rangeError').hidden=true;
  try {selection=selectRange(rows,state);} catch {selection={data:[],asOfData:[]};$('rangeError').textContent=t('app.invalidRange');$('rangeError').hidden=false;}
  const {data,asOfData}=selection;
  $('viewTitle').textContent=t(`view.${state.view}`);
  $('sampleSummary').textContent=t('app.sample',{n:data.length,from:data.at(-1)?.[0]||'—',to:data[0]?.[0]||'—'});
  $('sampleSummary').hidden=state.view==='contact';
  $('rangeForm').hidden=state.view==='contact';
  const explanation={history:'app.historyNote',block:'app.blockNote',distribution:'app.heatNote',continuous:'app.continuousNote',statistics:'app.statisticsNote',pb:'app.pbNote',trend:'app.trendNote',charts:'app.chartsNote'};
  $('viewExplanation').textContent=state.view==='missing'?t('app.asOf',{date:asOfData[0]?.[0]||'—',n:asOfData.length}):explanation[state.view]?t(explanation[state.view]):'';
  $('viewExplanation').hidden=!$('viewExplanation').textContent;
  paintControls();$('wrapper').replaceChildren();
  state.page=Math.min(state.page,Math.max(1,Math.ceil(data.length/pageSize)));
  const common={data,asOfData,t,watchlist,pool:state.pool,sort:state.sort,onNumberSelect:openNumber,onDrawSelect:openDraw,onWatchToggle:toggleWatch};
  if(dataError) $('wrapper').innerHTML=`<p class="empty-state" role="alert">${t('app.dataError')}</p>`;
  else if(state.view==='contact') renderContact({t});
  else if(!data.length&&!(state.view==='missing'&&asOfData.length)) {
    $('wrapper').innerHTML=`<div class="empty-state"><h3>${t('app.empty')}</h3><p>${t('app.emptyHelp')}</p><button class="button" id="resetRange">${t('app.reset')}</button></div>`;
    $('resetRange').addEventListener('click',()=>changeState({window:'all',dateFrom:'',dateTo:'',page:1}));
  } else if(groups.history.includes(state.view)) renderDrawTable({...common,allData:data,data:data.slice((state.page-1)*pageSize,state.page*pageSize),view:state.view});
  else if(state.view==='charts') renderCharts(common);
  else renderNumberView({...common,view:state.view});
  $('wrapper').querySelectorAll('.number-button[data-number]').forEach(button=>button.classList.toggle('is-watched',watchlist[button.dataset.pool||'main'].includes(Number(button.dataset.number))));
  paintPagination(data.length);
  $('exportCsv').disabled=state.view==='contact'||dataError||(state.view==='missing'?!asOfData.length:!data.length);
  if($('detailDialog').open) paintDetail();
}

$('latestBalls').addEventListener('click',event=>{const button=event.target.closest('[data-number]');if(button) openNumber(Number(button.dataset.number),button.dataset.pool);});
document.querySelector('.skip-link').addEventListener('click',event=>{event.preventDefault();$('mainContent').focus();$('mainContent').scrollIntoView({block:'start'});});
document.querySelectorAll('[data-group]').forEach(button=>button.addEventListener('click',()=>changeState({view:groups[button.dataset.group][0],page:1})));
$('subnav').addEventListener('click',event=>{const button=event.target.closest('[data-view]');if(button) changeState({view:button.dataset.view,page:1});});
document.querySelectorAll('[data-lang]').forEach(button=>button.addEventListener('click',()=>changeState({lang:button.dataset.lang},{replace:true})));
$('rangeWindow').addEventListener('change',event=>{
  const change={window:event.target.value,page:1};
  if(change.window==='custom') {change.dateFrom=state.dateFrom||dateISO(selection.data.at(-1)?.[0]);change.dateTo=state.dateTo||dateISO(rows[0]?.[0]);}
  changeState(change);
});
$('rangeForm').addEventListener('submit',event=>{
  event.preventDefault();const dateFrom=$('dateFrom').value;const dateTo=$('dateTo').value;
  if((dateFrom&&!parseDate(dateFrom))||(dateTo&&!parseDate(dateTo))||(dateFrom&&dateTo&&dateFrom>dateTo)) {$('rangeError').textContent=t('app.invalidRange');$('rangeError').hidden=false;return;}
  changeState({window:'custom',dateFrom,dateTo,page:1});
});
$('presetForm').addEventListener('submit',event=>{
  event.preventDefault();const name=$('presetName').value.trim();if(!name) return;
  const existing=presets.find(preset=>preset.name===name);
  if(!existing&&presets.length>=10) {notify(t('app.presetLimit'));return;}
  const preset={id:existing?.id||crypto.randomUUID(),name,state:{...state}};
  presets=existing?presets.map(item=>item.id===existing.id?preset:item):[...presets,preset];
  save('powerball.presets',presets);paintPresets();$('presetName').value='';notify(t('app.presetSaved'));
});
$('shareView').addEventListener('click',async()=>{
  syncLocation(true);
  try {await navigator.clipboard.writeText(location.href);notify(t('app.shareCopied'));}
  catch {detail=null;$('detailTitle').textContent=t('app.shareFallback');$('detailBody').innerHTML=`<input class="share-input" readonly aria-label="${t('app.shareFallback')}" value="${escapeHTML(location.href)}">`;openDialog();$('detailBody').querySelector('input').select();}
});
$('exportCsv').addEventListener('click',()=>{
  const {csv,filename}=buildExport({view:state.view,...selection,pool:state.pool});
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
  const link=document.createElement('a');link.href=url;link.download=filename;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);notify(t('app.exported'));
});
$('closeDetail').addEventListener('click',()=>$('detailDialog').close());
$('detailDialog').addEventListener('click',event=>{if(event.target===$('detailDialog')) {const rect=$('detailDialog').getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom) $('detailDialog').close();}});
$('detailDialog').addEventListener('close',()=>{
  detail=null;
  let target=detailOpener;
  if(!target?.isConnected&&target?.dataset.number) target=document.querySelector(`#wrapper .number-button[data-number="${target.dataset.number}"][data-pool="${target.dataset.pool}"]`);
  if(!target?.isConnected&&detailOpener?.dataset.draw) target=document.querySelector(`[data-draw="${detailOpener.dataset.draw}"]`);
  if(!target?.isConnected) target=document.querySelector('.primary-nav .is-active');
  target?.focus({preventScroll:true});
});
function restoreLocation() {
  const next=stateFromHash(location.hash)||{...DEFAULT_STATE};
  if(stateToHash(next)===stateToHash(state)) return;
  state=next;render();save('powerball.state',state);
}
window.addEventListener('popstate',restoreLocation);
window.addEventListener('hashchange',restoreLocation);
render();syncLocation(true);
fetch('./data-status.json',{cache:'no-store'}).then(response=>{if(!response.ok) throw new Error('status unavailable');return response.json();}).then(status=>{
  if(!status||typeof status!=='object'||!['ok','error','unknown'].includes(status.status)) throw new Error('invalid update status');
  updateStatus=status;paintStatus();
}).catch(()=>{statusReadFailed=true;paintStatus();});
