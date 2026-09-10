export const VIEWS = ['history', 'block', 'distribution', 'continuous', 'statistics', 'pb', 'hot', 'missing', 'trend', 'pairs', 'charts', 'contact'];
export const WINDOWS = ['10', '20', '50', '100', '300', 'all', 'custom'];
export const DEFAULT_STATE = Object.freeze({view:'history', window:'100', dateFrom:'', dateTo:'', pool:'main', sort:'count_desc', page:1, lang:'zh'});
const SORTS = ['count_desc', 'count_asc', 'number_asc', 'number_desc', 'missing_desc', 'missing_asc', 'rate_desc'];
export const sanitizeState = (input = {}) => {
  const value = input && typeof input === 'object' ? input : {};
  // Preserve an invalid marker so corrupt shared ranges cannot silently broaden the sample.
  const iso = (date) => date === undefined || date === null || date === '' ? '' : typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0,10) === date ? date : 'invalid';
  return {view:VIEWS.includes(value.view)?value.view:DEFAULT_STATE.view, window:WINDOWS.includes(String(value.window))?String(value.window):DEFAULT_STATE.window,
    dateFrom:iso(value.dateFrom), dateTo:iso(value.dateTo), pool:value.pool==='pb'?'pb':'main', sort:SORTS.includes(value.sort)?value.sort:'count_desc',
    page:Number.isInteger(Number(value.page))?Math.min(100000,Math.max(1,Number(value.page))):1, lang:value.lang==='en'?'en':'zh'};
};
export const stateFromHash = (hash) => {
  const params = new URLSearchParams(hash.replace(/^#/,''));
  return params.has('view') ? sanitizeState(Object.fromEntries(params)) : null;
};
export const stateToHash = (state) => `#${new URLSearchParams(Object.entries(sanitizeState(state)).filter(([key,value]) => value !== '' && !(key==='page' && value===1))).toString()}`;
export const readStorage = (key, fallback) => {
  try { const value=localStorage.getItem(key); return value===null?fallback:JSON.parse(value); } catch { return fallback; }
};
export const writeStorage = (key, value) => {
  try { localStorage.setItem(key,JSON.stringify(value)); return true; } catch { return false; }
};
export const sanitizeWatchlist = (value) => Object.fromEntries(['main','pb'].map(pool=>[pool,[...new Set((Array.isArray(value?.[pool])?value[pool]:[]).filter(n=>Number.isInteger(n)&&n>=1&&n<=(pool==='main'?35:20)))].sort((a,b)=>a-b)]));
export const sanitizePresets = (value) => {
  const ids=new Set();
  return (Array.isArray(value)?value:[]).filter(p=>p&&typeof p.name==='string'&&p.name.trim()).slice(0,10).map((p,i)=>{
    let id=typeof p.id==='string'&&p.id?p.id:String(i);
    while(ids.has(id)) id=`${id}-${i}`;
    ids.add(id);
    return {id,name:p.name.slice(0,40),state:sanitizeState(p.state)};
  });
};
