import rawRows from './db-ozlotto.js';
import { getPredictionContext, generatePrediction, evaluatePrediction } from './oz-prediction.js';
import { STORAGE_KEY, MAX_BYTES, loadPredictions, exportPredictions, importPredictions } from './oz-prediction-store.js';

const $ = (id) => document.getElementById(id);
const node = (tag, className, value) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (value !== undefined) element.textContent = value;
  return element;
};
const displayDate = (iso) => iso ? `${iso.slice(0,4)}年${Number(iso.slice(5,7))}月${Number(iso.slice(8,10))}日` : '—';
const displayTime = (value) => new Intl.DateTimeFormat('zh-CN', {
  timeZone:'Australia/Sydney', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23'
}).format(new Date(value));
const ordered = (items) => [...items].sort((a,b) => b.targetDate.localeCompare(a.targetDate) || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
let records = [];
let savedIds = new Set();
let selectedId = '';
let visibleCount = 12;
let busy = false;
let context;

function message(id, text = '', error = false) {
  const element = $(id);
  element.textContent = text;
  element.hidden = !text;
  element.classList.toggle('error', error);
}
const feedback = (text = '', error = false) => message('feedback', text, error);
const versionOf = (record) => ordered(records.filter((item) => item.targetDate === record.targetDate)).reverse().findIndex((item) => item.id === record.id) + 1;
const withStorageLock = (work) => navigator.locks?.request ? navigator.locks.request(STORAGE_KEY, work) : work();

function updateContext() {
  context = getPredictionContext(rawRows);
  $('targetContext').textContent = context.targetDate ? `${displayDate(context.targetDate)} · 第 ${context.targetDrawNumber} 期` : '数据暂不可用';
  $('sourceContext').textContent = context.latestDate ? `截至 ${displayDate(context.latestDate)} · ${context.sampleSize} 期` : '请先更新开奖数据';
  const alreadySaved = records.some((record) => record.targetDate === context.targetDate);
  $('startPrediction').textContent = busy ? '正在生成…' : alreadySaved ? '再生成一版' : '开始预测';
  $('startPrediction').disabled = busy || !context.ready;
  $('actionHelp').textContent = alreadySaved ? '新增本期版本，之前的预测会保留' : '点击后生成并保存本期预测';
  message('dataMessage', context.ready ? '' : `${context.reason} 请更新网站数据后刷新本页。`);
}

function renderGroup(group, index) {
  const card = node('article', 'prediction-group');
  const title = node('h3', '', `${String(index+1).padStart(2,'0')} · ${group.title}`);
  card.append(title, node('p', 'strategy-description', group.description));
  const balls = node('ol', 'prediction-balls');
  balls.setAttribute('aria-label', `${group.title}推荐主号`);
  group.numbers.forEach((number) => balls.append(node('li', 'prediction-ball', String(number).padStart(2,'0'))));
  card.append(balls, node('p', 'prediction-reason', group.reasons[0]));
  const details = node('details');
  details.append(node('summary', '', '查看完整依据'));
  group.reasons.slice(1).forEach((reason) => details.append(node('p','',reason)));
  card.append(details);
  const metrics = node('div', 'prediction-metrics');
  metrics.append(node('span','',`和值 ${group.metrics.sum}`), node('span','',`奇偶 ${group.metrics.odds}:${group.metrics.evens}`), node('span','',`三区 ${group.metrics.zones.join('·')}`));
  card.append(metrics);
  return card;
}

function renderEvaluation(record) {
  const result = evaluatePrediction(record, rawRows);
  const container = $('evaluation');
  container.replaceChildren();
  container.classList.toggle('pending',result.status === 'pending');
  container.hidden = false;
  if (result.status === 'pending') {
    container.append(node('h3','','等待开奖核对'), node('p','',`收录 ${displayDate(record.targetDate)} 的开奖后，本页将核对这份记录，无需重新生成。`));
  } else if (result.status === 'unverifiable') {
    container.append(node('h3','','这份记录无法核对'), node('p','','记录的日期或生成时间不满足事前预测条件，请检查备份。'));
  } else {
    container.append(node('h3','',`${displayDate(result.drawDate)} · 开奖核对`));
    container.append(node('p','',`主号 ${result.mainNumbers.map((n)=>String(n).padStart(2,'0')).join('  ')}　补充号 ${result.supplementaryNumbers.map((n)=>String(n).padStart(2,'0')).join('  ')}`));
    const list = node('ul');
    result.groups.forEach((group) => {
      const title = record.groups.find((item)=>item.id===group.id)?.title || group.id;
      list.append(node('li','',`${title}：主号命中 ${group.mainHits.length} 个${group.mainHits.length ? `（${group.mainHits.join('、')}）` : ''}，补充号命中 ${group.supplementaryHits.length} 个${group.supplementaryHits.length ? `（${group.supplementaryHits.join('、')}）` : ''} · ${group.division ? `第 ${group.division} 奖级` : '未达奖级'}`));
    });
    container.append(list, node('p','','按单组 7 个主号的标准玩法核对；本页没有实际奖金数据。'));
  }
}

function renderSelected() {
  const record = records.find((item)=>item.id===selectedId);
  if (!record) {
    $('resultsHeading').textContent = '本期推荐';
    $('recordContext').textContent = '尚未生成预测';
    const empty = node('div','prediction-empty');
    empty.append(node('p','','让这一次选择，有迹可循。'),node('span','','点击“开始预测”，查看四组号码及各自的历史依据。打开页面不会自动生成。'));
    $('predictionGroups').replaceChildren(empty);
    for (const id of ['recordActions','snapshotNote','evaluation']) $(id).hidden=true;
    return;
  }
  $('resultsHeading').textContent = record.targetDate === context.targetDate ? '本期推荐' : '历史预测';
  $('recordContext').textContent = `第 ${record.targetDrawNumber} 期 · ${displayDate(record.targetDate)} · 第 ${versionOf(record)} 版 · ${savedIds.has(record.id) ? '已保存' : '未保存'} · ${displayTime(record.createdAt)}（悉尼）`;
  $('predictionGroups').replaceChildren(...record.groups.map(renderGroup));
  $('recordActions').hidden = false;
  $('snapshotNote').hidden = false;
  $('snapshotNote').textContent = `本版依据截至 ${displayDate(record.source.latestDate)} 的 ${record.source.sampleSize} 期历史生成。选号说明随此版保存，不随后续开奖改变。`;
  renderEvaluation(record);
}

function archiveStatus(record) {
  if (!savedIds.has(record.id)) return '未保存';
  const result = evaluatePrediction(record, rawRows);
  if (result.status === 'pending') return '待开奖';
  if (result.status === 'unverifiable') return '无法核对';
  const divisions = result.groups.map((group)=>group.division).filter(Boolean);
  return divisions.length ? `最高第 ${Math.min(...divisions)} 奖级` : '已核对';
}

function renderArchive() {
  $('exportAll').disabled = !records.length || busy;
  const periods = new Set(records.map((record)=>record.targetDate)).size;
  const unsaved = records.filter((record)=>!savedIds.has(record.id)).length;
  $('archiveCount').textContent = records.length ? `${periods} 期 · ${records.length} 份记录${unsaved ? ` · ${unsaved} 份未保存` : ''}` : '还没有保存的记录';
  const tbody = $('archiveRows');
  tbody.replaceChildren();
  if (!records.length) {
    const row=node('tr'); const cell=node('td','archive-empty','开始预测后，记录会按期数保留在这里。'); cell.colSpan=4; row.append(cell); tbody.append(row);
  }
  ordered(records).slice(0,visibleCount).forEach((record)=>{
    const row=node('tr',record.id===selectedId?'selected':'');
    row.append(node('td','',`第 ${record.targetDrawNumber} 期 · ${record.targetDate.replaceAll('-','.')}`),node('td','',displayTime(record.createdAt)),node('td',savedIds.has(record.id)?'':'unsaved',`v${versionOf(record)} · ${archiveStatus(record)}`));
    const cell=node('td'); const button=node('button','archive-view',record.id===selectedId?'正在查看':'查看'); button.type='button';
    button.setAttribute('aria-label',`查看第${record.targetDrawNumber}期第${versionOf(record)}版`);
    button.setAttribute('aria-pressed',String(record.id===selectedId));
    button.addEventListener('click',()=>{selectedId=record.id;renderSelected();renderArchive();$('resultsSection').scrollIntoView({block:'start',behavior:'smooth'});});
    cell.append(button);row.append(cell);tbody.append(row);
  });
  $('showMore').hidden = records.length<=visibleCount;
}

function render() { updateContext(); renderSelected(); renderArchive(); }

function download(json, filename) {
  const url=URL.createObjectURL(new Blob([json],{type:'application/json;charset=utf-8'}));
  const link=node('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

$('startPrediction').addEventListener('click',async()=>{
  if (busy) return;
  updateContext();
  if (!context.ready) return;
  busy=true;updateContext();$('resultsSection').setAttribute('aria-busy','true');feedback('正在分析历史数据，生成四组号码…');
  // Yield a frame so the progress state is visible; no generation happens before this click.
  await new Promise((resolve)=>requestAnimationFrame(()=>setTimeout(resolve,0)));
  try {
    const record=generatePrediction(rawRows);
    const combined=[...records,record];
    try {
      const saved=await withStorageLock(()=>importPredictions(exportPredictions(combined)));
      records=saved;savedIds=new Set(saved.map((item)=>item.id));message('storageMessage');
      feedback('四组号码已生成，并保存为本期的一个新版本。');
    } catch(error) {
      records=combined;
      message('storageMessage',`${error.message} 本次预测未保存，请立即使用“导出此版”或“导出备份”留存。`,true);
      feedback('号码已生成，但未保存。',true);
    }
    selectedId=record.id;
  } catch(error) { feedback(`生成失败：${error.message}`,true); }
  finally {busy=false;$('resultsSection').setAttribute('aria-busy','false');render();}
});

$('copyPrediction').addEventListener('click',async()=>{
  const record=records.find((item)=>item.id===selectedId);
  if (!record) return;
  const text=`Oz Lotto 第${record.targetDrawNumber}期 ${record.targetDate}\n`+record.groups.map((group)=>`${group.title}：${group.numbers.map((n)=>String(n).padStart(2,'0')).join(' ')}`).join('\n');
  try {await navigator.clipboard.writeText(text);feedback('四组号码已复制。');}
  catch {feedback('浏览器未允许复制，请直接选择号码，或导出此版。',true);}
});
$('exportSelected').addEventListener('click',()=>{
  const record=records.find((item)=>item.id===selectedId);if(!record)return;
  try {download(exportPredictions([record]),`oz-lotto-${record.targetDrawNumber}-v${versionOf(record)}.json`);feedback('已导出当前版本，请保管好备份文件。');}
  catch(error){feedback(`导出失败：${error.message}`,true);}
});
$('exportAll').addEventListener('click',()=>{
  const localDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  try {download(exportPredictions(records),`oz-lotto-predictions-${localDate}.json`);feedback(`已导出 ${records.length} 份记录，包含当前会话中未保存的版本。`);}
  catch(error){feedback(`导出失败：${error.message}`,true);}
});
$('importBackup').addEventListener('click',()=>$('backupFile').click());
$('backupFile').addEventListener('change',async(event)=>{
  const file=event.target.files[0];if(!file)return;
  $('importBackup').disabled=true;
  try {
    if(file.size>MAX_BYTES)throw new Error('备份超过5MB限制。');
    const json=await file.text();
    const before=records.length;
    // Include any unsaved session records in the same atomic merge.
    const merged=await withStorageLock(()=>{
      const snapshotStorage={value:exportPredictions(records),getItem(){return this.value;},setItem(key,value){this.value=value;}};
      const combined=importPredictions(json,snapshotStorage);
      return importPredictions(exportPredictions(combined));
    });
    records=merged;savedIds=new Set(merged.map((item)=>item.id));
    if(!selectedId||!records.some((item)=>item.id===selectedId))selectedId=ordered(records)[0]?.id||'';
    message('storageMessage');feedback(`备份已合并，新增 ${records.length-before} 份记录；已有版本已保留。`);render();
  }catch(error){feedback(`导入失败：${error.message} 原有记录未被覆盖。`,true);}
  finally{$('importBackup').disabled=false;event.target.value='';}
});
$('showMore').addEventListener('click',()=>{visibleCount+=12;renderArchive();});

window.addEventListener('storage',(event)=>{
  if(event.key!==STORAGE_KEY&&event.key!==null)return;
  try {
    const loaded=loadPredictions();
    const unsaved=records.filter((record)=>!savedIds.has(record.id));
    records=[...loaded,...unsaved.filter((record)=>!loaded.some((item)=>item.id===record.id))];
    savedIds=new Set(loaded.map((record)=>record.id));
    if(!records.some((record)=>record.id===selectedId))selectedId=ordered(records)[0]?.id||'';
    render();feedback('已同步本浏览器其他标签页的预测记录。');
  }catch(error){message('storageMessage',error.message,true);}
});
window.addEventListener('focus',()=>{if(!busy)updateContext();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!busy)updateContext();});

try {records=loadPredictions();savedIds=new Set(records.map((record)=>record.id));}
catch(error){message('storageMessage',`${error.message} 当前会话仍可生成号码，请导出备份留存。`,true);}
selectedId=ordered(records)[0]?.id||'';
render();
