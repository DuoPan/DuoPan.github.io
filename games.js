const sourceUrl = 'https://www.lotterywest.wa.gov.au/results/frequency-charts';
export const GAMES = Object.freeze({
  powerball: Object.freeze({
    id:'powerball', name:'Powerball', mainSize:35, mainCount:7, extraPool:'pb', extraSize:20, extraCount:1, disjoint:false,
    lowMax:17, buckets:[[1,10],[11,20],[21,30],[31,35]], zones:[[1,12],[13,24],[25,35]],
    ruleStart:'2018-04-19', ruleFirstDraw:1144, historyStart:'2018-04-19', firstDate:'2018-04-19', firstDrawNumber:1144,
    drawDay:4, dueDay:5, csvGameId:5132, dbFile:'db.js', statusFile:'data-status.json', sourceUrl,
    rulesUrl:'https://www.lotterywest.wa.gov.au/games/powerball'
  }),
  ozlotto: Object.freeze({
    id:'ozlotto', name:'Oz Lotto', mainSize:47, mainCount:7, extraPool:'supplementary', extraSize:47, extraCount:3, disjoint:true,
    lowMax:23, buckets:[[1,10],[11,20],[21,30],[31,40],[41,47]], zones:[[1,16],[17,32],[33,47]],
    ruleStart:'2022-05-17', ruleFirstDraw:1474, historyStart:'2025-01-01', firstDate:'2025-01-07', firstDrawNumber:1612,
    drawDay:2, dueDay:3, csvGameId:5130, dbFile:'db-ozlotto.js', statusFile:'data-status-ozlotto.json', sourceUrl,
    rulesUrl:'https://www.lotterywest.wa.gov.au/games/oz-lotto'
  })
});

export const getGame = (game = 'powerball') => {
  const id = typeof game === 'string' ? game : game?.id;
  if (!Object.hasOwn(GAMES,id)) throw new RangeError(`Unknown game: ${String(game)}`);
  return GAMES[id];
};
export const poolKeys = (game) => ['main', getGame(game).extraPool];
export const poolSize = (pool = 'main', game) => {
  const config = getGame(game);
  if (pool === 'main') return config.mainSize;
  if (pool === config.extraPool) return config.extraSize;
  throw new RangeError(`Unknown number pool: ${pool}`);
};
export const poolCount = (pool = 'main', game) => {
  const config = getGame(game);
  poolSize(pool, config);
  return pool === 'main' ? config.mainCount : config.extraCount;
};
export const poolRate = (pool = 'main', game) => poolCount(pool, game) / poolSize(pool, game);
export const numbersFor = (row, pool = 'main', game) => {
  const config = getGame(game);
  poolSize(pool, config);
  return (pool === 'main' ? row.slice(1, 1 + config.mainCount) : row.slice(1 + config.mainCount)).map(Number);
};
export const zoneIndex = (number, game) => getGame(game).zones.findIndex(([min,max]) => number >= min && number <= max);

/** Local noon after each draw is this project's publication buffer, not a source SLA. */
export const expectedLatestDrawISO = (now = new Date(), game = 'powerball') => {
  const config = getGame(game);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-AU', {
    timeZone:'Australia/Sydney', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', hourCycle:'h23'
  }).formatToParts(now).map(({type,value}) => [type,value]));
  const localDate = new Date(Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day)));
  let daysSinceDraw = (localDate.getUTCDay()+7-config.drawDay)%7;
  const dueOffset = (config.dueDay+7-config.drawDay)%7;
  if(daysSinceDraw<dueOffset||(daysSinceDraw===dueOffset&&Number(parts.hour)<12)) daysSinceDraw+=7;
  localDate.setUTCDate(localDate.getUTCDate()-daysSinceDraw);
  return localDate.toISOString().slice(0,10);
};
