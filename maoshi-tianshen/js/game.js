(function(){
'use strict';
const TILE=56, COLS=39, ROWS=19, W=COLS*TILE, H=ROWS*TILE;
const READY_MS=1500, HERO_STEP=900, HESITATE=2400, DEAD_PAUSE=1900, RETRY=800;
const ROCK_FALL=450, PLANK_BUILD=400, RESUME=300, MUD_SLOW=700;
const START=1500, BUBBLE_HOLD=600;

const LEVELS=[
  {
    name:'第 1 关 · 岔路迷宫',
    short:'01',
    map:[
      '#######################################',
      '#E#.........#.....#.......#o#.........#',
      '#.#.#.#####.#.###.#.###.#.#.#.#####.#.#',
      '#.#.#.....#S#...#...#m..#...#...#...#.#',
      '#.#######.#####.#####.#.#######.#.###.#',
      '#.......#.#.......#o#.#.#...#...#.#o..#',
      '#######.#.#.#####.#.#.###.#.#.###.#####',
      '#.......#...#...#...#...#.#.#x..#.....#',
      '#.###########.#.#######.#.#.###.#####.#',
      '#.#...........#.........#.#...#.#.....#',
      '#.#####.###############.#.###.#.#.#####',
      '#.....#...........#...#.#...#...#.....#',
      '#####.#.#####.###.#.#.#.###.#########.#',
      '#o..#m#.#...#.#...#.#.#..~#.........#.#',
      '###.#.###.#.#.#.###.#.#######.#######.#',
      '#...#...#.#.#.#..~..#.........#...#^..#',
      '#.#####.#.#.###################.#.#.#.#',
      '#.........#.....................#...#.#',
      '#######################################'
    ],
    prefs:{"11,3":["up","down","left","right"],"11,1":["left","up","down","right"],"9,1":["left","up","down","right"],"7,1":["left","up","down","right"],"5,1":["down","up","left","right"],"5,3":["right","up","down","left"],"7,3":["right","up","down","left"],"9,3":["down","up","left","right"],"9,5":["down","up","left","right"],"9,7":["right","up","down","left"],"11,7":["up","down","left","right"],"11,5":["right","up","down","left"],"13,5":["right","up","down","left"],"15,5":["right","up","down","left"],"15,3":["left","up","down","right"],"13,3":["up","down","left","right"],"13,1":["right","up","down","left"],"15,1":["right","up","down","left"],"17,1":["down","up","left","right"],"17,3":["right","up","down","left"],"19,3":["up","down","left","right"],"19,1":["right","up","down","left"],"21,1":["right","up","down","left"],"23,1":["right","down","up","left"],"23,3":["left","up","down","right"],"21,3":["down","up","left","right"],"21,5":["down","up","left","right"],"21,7":["right","up","down","left"],"23,7":["down","up","left","right"],"23,9":["down","left","up","right"],"21,9":["left","up","down","right"],"19,9":["left","up","down","right"],"17,9":["left","up","down","right"],"15,9":["up","down","left","right"],"15,7":["left","up","down","right"],"13,7":["down","up","left","right"],"13,9":["left","up","down","right"],"11,9":["left","up","down","right"],"9,9":["left","up","down","right"],"7,9":["down","up","left","right"],"7,11":["right","up","down","left"],"9,11":["right","up","down","left"],"11,11":["right","up","down","left"],"13,11":["right","up","down","left"],"15,11":["right","up","down","left"],"17,11":["down","up","left","right"],"17,13":["left","up","down","right"],"15,13":["down","up","left","right"],"15,15":["right","up","down","left"],"17,15":["right","up","down","left"],"19,15":["up","down","left","right"],"19,13":["up","down","left","right"],"19,11":["right","up","down","left"],"21,11":["down","up","left","right"],"21,13":["down","up","left","right"],"21,15":["right","up","down","left"],"23,15":["right","up","down","left"],"25,15":["right","up","down","left"],"27,15":["right","up","down","left"],"29,15":["up","down","left","right"],"29,13":["left","up","down","right"],"27,13":["up","down","left","right"],"27,11":["left","up","down","right"],"25,11":["up","down","left","right"],"25,9":["up","down","left","right"],"25,7":["up","down","left","right"],"25,5":["right","up","down","left"],"27,5":["down","up","left","right"],"27,7":["down","up","left","right"],"27,9":["right","up","down","left"],"29,9":["down","up","left","right"],"29,11":["right","up","down","left"],"31,11":["up","down","left","right"],"31,9":["up","down","left","right"],"31,7":["left","up","down","right"],"29,7":["up","down","left","right"],"29,5":["right","up","down","left"],"31,5":["up","down","left","right"],"31,3":["left","up","down","right"],"29,3":["up","down","left","right"],"29,1":["right","up","down","left"],"31,1":["right","up","down","left"],"33,1":["right","up","down","left"],"35,1":["right","down","up","left"],"35,3":["left","up","down","right"],"33,3":["down","up","left","right"],"33,5":["down","up","left","right"],"33,7":["right","up","down","left"],"35,7":["right","up","down","left"],"37,7":["down","up","left","right"],"37,9":["left","up","down","right"],"35,9":["left","up","down","right"],"33,9":["down","up","left","right"],"33,11":["right","up","down","left"],"35,11":["right","up","down","left"],"37,11":["down","up","left","right"],"37,13":["down","up","left","right"],"37,15":["left","up","down","right"],"35,15":["down","up","left","right"],"35,17":["left","up","down","right"],"33,17":["up","down","left","right"],"33,15":["left","up","down","right"],"31,15":["down","up","left","right"],"31,17":["left","up","down","right"],"29,17":["left","up","down","right"],"27,17":["left","up","down","right"],"25,17":["left","up","down","right"],"23,17":["left","up","down","right"],"21,17":["left","up","down","right"],"19,17":["left","up","down","right"],"17,17":["left","up","down","right"],"15,17":["left","up","down","right"],"13,17":["left","up","down","right"],"11,17":["up","down","left","right"],"11,15":["up","down","left","right"],"11,13":["left","up","down","right"],"9,13":["down","up","left","right"],"9,15":["down","up","left","right"],"9,17":["left","up","down","right"],"7,17":["left","up","down","right"],"7,15":["left","up","down","right"],"5,15":["up","down","left","right"],"5,13":["up","down","left","right"],"5,11":["left","up","down","right"],"3,11":["left","up","down","right"],"1,11":["up","down","left","right"],"1,9":["up","down","left","right"],"1,7":["right","up","down","left"],"3,7":["right","up","down","left"],"5,7":["right","up","down","left"],"7,7":["up","down","left","right"],"7,5":["left","up","down","right"],"5,5":["left","up","down","right"],"3,5":["left","up","down","right"],"1,5":["up","down","left","right"],"1,3":["up","down","left","right"]},
    forks:{"15,5":"right","23,1":"right","23,9":"down","35,1":"right","7,17":"left"},
    mobs:[{x:9,y:11,axis:'x',min:7,max:17,speed:1400,dir:1}],
    rock:7, plank:5, light:2, bomb:0,
    monsterStep:990, headStart:9000, heroStep:950,
    target:'他头顶的箭头，就是他下一步的方向。',
    failHint:'封住他要拐的那条岔路。'
  }
];

const C={
  floor:'#F3E8CF', floor2:'#EDDFC0', wall:'#2C5A51', wallTop:'#3B7268', wallEdge:'#1B3B35',
  ink:'#20302D', water:'#7FC8D8', waterDeep:'#4C9DAF', lava:'#F2793C', lavaDeep:'#C9501F',
  gold:'#F0C578', green:'#3E8C82', greenDark:'#2E6B63', purple:'#6E5AA8', coral:'#E4674A',
  paper:'#FBF5E6', skin:'#F7CEA3', steel:'#95A2AC', brown:'#B57B44', stone:'#8D8A80'
};
const DIRS={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
const OPP={up:'down',down:'up',left:'right',right:'left'};

const canvas=document.getElementById('stage');
const ctx=canvas.getContext('2d');
const mini=document.getElementById('minimap');
const mctx=mini.getContext('2d');
const dpr=Math.min(window.devicePixelRatio||1,2);
const MM=3;
mini.width=COLS*MM*dpr; mini.height=ROWS*MM*dpr;
mini.style.width=(COLS*MM)+'px'; mini.style.height=(ROWS*MM)+'px';

/* 39×19 的迷宫塞进竖屏会小到点不准，所以只显示勇者附近一段，镜头跟着他走。 */
const view={w:0,h:0,scale:1};
const cam={x:0,y:0,ready:false};
let VIGNETTE=null;

function measure(){
  const box=canvas.parentElement;
  const w=Math.max(1,box.clientWidth), h=Math.max(1,box.clientHeight);
  view.w=w; view.h=h;
  canvas.width=Math.round(w*dpr); canvas.height=Math.round(h*dpr);
  view.scale=clamp(Math.min(w/10,h/14),30,54)/TILE;
  makeVignette();
}
function makeVignette(){
  VIGNETTE=ctx.createRadialGradient(view.w/2,view.h*.44,Math.min(view.w,view.h)*.34,view.w/2,view.h*.52,Math.max(view.w,view.h)*.74);
  VIGNETTE.addColorStop(0,'rgba(10,24,21,0)');
  VIGNETTE.addColorStop(1,'rgba(10,24,21,.45)');
}
function clampCam(){
  const vw=view.w/view.scale, vh=view.h/view.scale;
  cam.x=vw>=W?(W-vw)/2:clamp(cam.x,0,W-vw);
  cam.y=vh>=H?(H-vh)/2:clamp(cam.y,0,H-vh);
}
/* 镜头朝他前进的方向多探两格，岔口才来得及出现在画面里。 */
function followCam(dt,snap){
  const h=G.hero, dir=DIRS[h.prevDir||'right'];
  const vw=view.w/view.scale, vh=view.h/view.scale;
  const tx=(h.vx+dir[0]*2)*TILE+TILE/2-vw/2;
  const ty=(h.vy+dir[1]*1.2)*TILE+TILE/2-vh/2;
  if(snap||!cam.ready){cam.x=tx;cam.y=ty;cam.ready=true;}
  else{
    const k=1-Math.exp(-dt/240);
    cam.x+=(tx-cam.x)*k; cam.y+=(ty-cam.y)*k;
  }
  clampCam();
}
function worldTransform(){
  const s=view.scale;
  let sx=0,sy=0;
  if(G.shake>0.2){sx=(Math.random()-.5)*G.shake;sy=(Math.random()-.5)*G.shake;}
  ctx.setTransform(dpr*s,0,0,dpr*s,(-cam.x*s+sx)*dpr,(-cam.y*s+sy)*dpr);
}
function screenTransform(){ctx.setTransform(dpr,0,0,dpr,0,0);}

const el={
  lvlName:document.getElementById('lvlName'), time:document.getElementById('timeVal'),
  rockCnt:document.getElementById('rockCnt'), plankCnt:document.getElementById('plankCnt'), lightCnt:document.getElementById('lightCnt'),
  rockBtn:document.getElementById('toolRock'), plankBtn:document.getElementById('toolPlank'), lightBtn:document.getElementById('toolLight'),
  bombBtn:document.getElementById('toolBomb'), bombCnt:document.getElementById('bombCnt'),
  gapTxt:document.getElementById('gapTxt'), gapFill:document.getElementById('gapFill'),
  pause:document.getElementById('btnPause'), restart:document.getElementById('btnRestart'),
  hint:document.getElementById('hint'), hintText:document.getElementById('hintText'),
  ov:document.getElementById('ov'), ovEyebrow:document.getElementById('ovEyebrow'),
  ovTitle:document.getElementById('ovTitle'), ovDesc:document.getElementById('ovDesc'),
  ovStats:document.getElementById('ovStats'), ovPrimary:document.getElementById('ovRetry'),
  ovSecondary:document.getElementById('ovNext')
};

const G={
  level:null, levelIndex:0, map:[], start:{x:1,y:1}, exit:null,
  phase:'idle', paused:false, t:0, startAt:START, overlayOpen:false, overlayTimer:0,
  hero:{x:1,y:1,vx:1,vy:1,prevDir:null,from:{x:0,y:0},mode:'walk',nextAt:0,waitUntil:0,deadPending:null},
  trail:[], monster:{index:0,vx:1,vy:1,nextAt:0},
  rocks:new Set(), planks:new Map(), rockFx:new Map(),
  dug:new Set(), blasts:new Map(),
  items:{rock:0,plank:0,light:0,bomb:0}, tool:'rock',
  hover:null, shake:0, shakeCell:null, seen:new Set(),
  flags:{backtrack:0,waitMs:0},
  hintBase:'', hintTimer:0,
  bubble:{kind:null,at:0},
  lastPlace:0,
  filled:new Set(), mobs:[], poofs:new Map(), lightFx:-1e9, caughtBy:'', blastFx:-1e9
};

function key(x,y){return x+','+y;}
function inb(x,y){return x>=0&&y>=0&&x<COLS&&y<ROWS;}
function cellAt(x,y){
  if(!inb(x,y)) return '#';
  const ch=G.map[y][x];
  if(ch==='#'&&G.dug.has(key(x,y))) return '.';
  return ch;
}
function isHazard(ch){return ch==='~'||ch==='^'||ch==='x';}
function isWall(x,y){return cellAt(x,y)==='#';}
function plankReady(x,y,now){const v=G.planks.get(key(x,y));return v!==undefined&&now>=v;}
function mobAt(x,y){return G.mobs.find(m=>m.alive&&m.x===x&&m.y===y)||null;}
function heroStepOpen(x,y,t){
  const ch=cellAt(x,y);
  if(ch==='o'&&!G.filled.has(key(x,y))) return false;
  if(isHazard(ch)&&!plankReady(x,y,t)) return false;
  if(mobAt(x,y)) return false;
  return true;
}
function heroStepDelay(t){
  const h=G.hero;
  return (G.level.heroStep||HERO_STEP)+(cellAt(h.x,h.y)==='m'&&!plankReady(h.x,h.y,t)?MUD_SLOW:0);
}
function monsterPos(){return G.trail[Math.min(G.monster.index,G.trail.length-1)]||G.start;}
function gap(){
  const m=monsterPos(), h=G.hero;
  if(!m||!h) return 0;
  if(m.x===h.x&&m.y===h.y) return 0;
  const seen=new Set([key(m.x,m.y)]);
  const q=[{x:m.x,y:m.y,d:0}];
  while(q.length){
    const cur=q.shift();
    for(const dir in DIRS){
      const nx=cur.x+DIRS[dir][0], ny=cur.y+DIRS[dir][1];
      if(!inb(nx,ny)||isWall(nx,ny)) continue;
      if(nx===h.x&&ny===h.y) return cur.d+1;
      const k=key(nx,ny);
      if(seen.has(k)) continue;
      seen.add(k);
      q.push({x:nx,y:ny,d:cur.d+1});
    }
  }
  return 99;
}

function parseMap(rows){
  G.map=rows.map(r=>r.split(''));
  G.start={x:1,y:1}; G.exit=null;
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
    const c=G.map[y][x];
    if(c==='S')G.start={x,y};
    if(c==='E')G.exit={x,y};
  }
}

function startLevel(i){
  G.levelIndex=i; G.level=LEVELS[i];
  parseMap(G.level.map);
  G.phase='ready'; G.paused=false;
  G.t=0; G.startAt=START;
  G.hero={x:G.start.x,y:G.start.y,vx:G.start.x,vy:G.start.y,prevDir:null,from:{x:G.start.x,y:G.start.y},mode:'walk',nextAt:START+250,waitUntil:0,deadPending:null};
  G.trail=[{x:G.start.x,y:G.start.y}];
  G.monster={index:0,vx:G.start.x,vy:G.start.y,nextAt:START+G.level.headStart,stunUntil:0};
  G.rocks=new Set(); G.planks=new Map(); G.rockFx=new Map();
  G.dug=new Set(); G.blasts=new Map(); G.blastFx=-1e9;
  G.filled=new Set(); G.poofs=new Map(); G.lightFx=-1e9; G.caughtBy='';
  G.mobs=(G.level.mobs||[]).map(m=>({x:m.x,y:m.y,axis:m.axis,min:m.min,max:m.max,speed:m.speed,dir:m.dir||1,alive:true,nextAt:START+250}));
  G.items={rock:G.level.rock,plank:G.level.plank,light:G.level.light||0,bomb:G.level.bomb||0};
  G.tool=G.items.rock>0?'rock':(G.items.plank>0?'plank':'rock');
  G.hover=null; G.shake=0; G.shakeCell=null; G.seen=new Set();
  G.flags={backtrack:0,waitMs:0};
  G.hintBase='盯住他头顶的箭头'; G.hintTimer=0;
  G.bubble={kind:null,at:0};
  G.lastPlace=0;
  el.lvlName.textContent=G.level.name.split('·')[1].trim();
  updateTools(); updateHud(); say(G.hintBase,false);
  cam.ready=false; followCam(0,true);
  buildMini();
  showOverlay({eyebrow:'LEVEL '+G.level.short,title:G.level.name.split('·')[1].trim(),desc:G.level.target,stats:'',primary:null,secondary:null});
  G.overlayOpen=true;
  G.overlayTimer=setTimeout(()=>{hideOverlay();G.overlayOpen=false;},READY_MS);
}

function beginPlay(){
  G.phase='playing';
  G.hero.nextAt=G.t+300;
  G.monster.nextAt=G.t+G.level.headStart;
  G.hintBase=G.level.target;
  say('勇者出发了。',false);
}

function updateTools(){
  el.rockCnt.textContent=G.items.rock;
  el.plankCnt.textContent=G.items.plank;
  el.lightCnt.textContent=G.items.light;
  if(el.bombCnt) el.bombCnt.textContent=G.items.bomb;
  if(el.bombBtn) el.bombBtn.hidden=G.items.bomb<=0;
  el.rockBtn.classList.toggle('on',G.tool==='rock');
  el.plankBtn.classList.toggle('on',G.tool==='plank');
  if(el.bombBtn) el.bombBtn.classList.toggle('on',G.tool==='bomb');
  el.rockBtn.classList.toggle('empty',G.items.rock<=0);
  el.plankBtn.classList.toggle('empty',G.items.plank<=0);
  el.lightBtn.classList.toggle('empty',G.items.light<=0);
  if(el.bombBtn) el.bombBtn.classList.toggle('empty',G.items.bomb<=0);
  if(G.items.rock<=0&&G.tool==='rock'&&G.items.plank>0)G.tool='plank';
  if(G.items.plank<=0&&G.tool==='plank'&&G.items.rock>0)G.tool='rock';
  el.rockBtn.classList.toggle('on',G.tool==='rock');
  el.plankBtn.classList.toggle('on',G.tool==='plank');
}

function updateHud(){
  const secs=Math.max(0,(G.t-G.startAt)/1000);
  el.time.textContent=secs.toFixed(1)+'s';
  const ready=G.phase==='ready';
  const g=ready?0:gap();
  el.gapTxt.textContent=ready?'—':g+' 格';
  el.gapTxt.classList.toggle('warn',!ready&&g<=2);
  const ratio=ready?0:Math.min(1,g/8);
  el.gapFill.style.width=(ratio*100)+'%';
  el.gapFill.classList.toggle('warn',!ready&&g<=4&&g>2);
  el.gapFill.classList.toggle('danger',!ready&&g<=2);
  el.pause.textContent=G.paused?'▶':'Ⅱ';
}

function say(text,isErr){
  el.hintText.textContent=text;
  el.hint.classList.toggle('err',!!isErr);
  clearTimeout(G.hintTimer);
  if(isErr){
    G.hintTimer=setTimeout(()=>{
      el.hint.classList.remove('err');
      el.hintText.textContent=G.hintBase;
    },2600);
  }
}

function showOverlay(o){
  el.ovEyebrow.textContent=o.eyebrow;
  el.ovTitle.textContent=o.title;
  el.ovDesc.textContent=o.desc;
  el.ovStats.innerHTML=o.stats||'';
  const setBtn=(btn,cfg)=>{
    if(!cfg){btn.hidden=true;return;}
    btn.hidden=false;
    btn.textContent=cfg.label;
    btn.onclick=cfg.fn;
  };
  setBtn(el.ovPrimary,o.primary);
  setBtn(el.ovSecondary,o.secondary);
  el.ov.classList.add('show');
}
function hideOverlay(){el.ov.classList.remove('show');}
function optionsAt(x,y){
  const out=[];
  for(const d in DIRS){
    const nx=x+DIRS[d][0], ny=y+DIRS[d][1];
    if(!inb(nx,ny)||isWall(nx,ny)) continue;
    if(G.rocks.has(key(nx,ny))) continue;
    out.push({dir:d,x:nx,y:ny});
  }
  return out;
}

function prefOrder(x,y){
  return (G.level.prefs&&G.level.prefs[key(x,y)])||['down','right','up','left'];
}

function byPref(list,x,y){
  const order=prefOrder(x,y);
  return list.slice().sort((a,b)=>{
    const ia=order.indexOf(a.dir)<0?9:order.indexOf(a.dir);
    const ib=order.indexOf(b.dir)<0?9:order.indexOf(b.dir);
    return ia-ib;
  });
}

/* 勇者只认自己眼前的偏好：最想走的那条闭着，他就站着等；走进死胡同才原路退回。 */
function pickOption(opts){
  const h=G.hero;
  const notBack=opts.filter(o=>!(o.x===h.from.x&&o.y===h.from.y));
  const pool=notBack.length?notBack:opts;
  return byPref(pool,h.x,h.y)[0]||null;
}

function heroIntent(){
  const opts=optionsAt(G.hero.x,G.hero.y);
  if(!opts.length) return {dir:null,kind:'lost'};
  const p=pickOption(opts);
  if(!p) return {dir:null,kind:'lost'};
  if(!heroStepOpen(p.x,p.y,G.t)) return {dir:p.dir,kind:'fear'};
  return {dir:p.dir,kind:'dir'};
}

function moveHero(o){
  const h=G.hero;
  h.from={x:h.x,y:h.y};
  h.prevDir=o.dir;
  h.x=o.x; h.y=o.y;
  G.trail.push({x:o.x,y:o.y});
  if(G.exit&&o.x===G.exit.x&&o.y===G.exit.y) win();
}

function heroTick(){
  if(G.phase!=='playing') return;
  const h=G.hero, t=G.t;
  if(t<h.waitUntil||t<h.nextAt) return;
  if(h.deadPending){
    const o=h.deadPending; h.deadPending=null;
    moveHero(o); h.mode='walk'; h.nextAt=t+heroStepDelay(t); h.waitUntil=0;
    return;
  }
  const opts=optionsAt(h.x,h.y);
  if(!opts.length){
    h.mode='blocked'; h.waitUntil=t+RETRY; G.flags.waitMs+=RETRY;
    return;
  }
  const k=key(h.x,h.y);
  /* 只在「岔口、且那条死路还开着」时犹豫：给玩家一个封路的窗口。 */
  const forkDir=G.level.forks&&G.level.forks[k];
  if(forkDir&&!G.seen.has(k)&&opts.some(o=>o.dir===forkDir)){
    G.seen.add(k);
    h.mode='hesitate'; h.waitUntil=t+HESITATE;
    return;
  }
  const p=pickOption(opts);
  if(!p){
    h.mode='blocked'; h.waitUntil=t+RETRY; G.flags.waitMs+=RETRY;
    return;
  }
  if(!heroStepOpen(p.x,p.y,t)){
    h.mode='blocked'; h.waitUntil=t+400; G.flags.waitMs+=400;
    return;
  }
  if(p.x===h.from.x&&p.y===h.from.y){
    h.mode='dead'; h.deadPending=p; h.waitUntil=t+DEAD_PAUSE;
    G.flags.backtrack++;
    return;
  }
  moveHero(p);
  h.mode='walk'; h.nextAt=t+heroStepDelay(t); h.waitUntil=0;
}

function monsterTick(){
  if(G.phase!=='playing') return;
  const t=G.t;
  if(t<G.monster.stunUntil) return;
  if(t<G.startAt+G.level.headStart) return;
  if(t<G.monster.nextAt) return;
  G.monster.nextAt=t+G.level.monsterStep;
  if(G.monster.index<G.trail.length-1){
    G.monster.index++;
    if(G.monster.index>=G.trail.length-1){G.caughtBy='big';caught();}
  }
}

function mobsTick(){
  if(G.phase!=='playing') return;
  const t=G.t, h=G.hero;
  for(const m of G.mobs){
    if(!m.alive||t<m.nextAt) continue;
    m.nextAt=t+m.speed;
    const d=m.axis==='x'?[m.dir,0]:[0,m.dir];
    let nx=m.x+d[0], ny=m.y+d[1];
    const outside=nx<Math.min(m.min,m.max)||nx>Math.max(m.min,m.max);
    if(outside||isWall(nx,ny)||G.rocks.has(key(nx,ny))||cellAt(nx,ny)==='o'){
      m.dir*=-1;
      const d2=m.axis==='x'?[m.dir,0]:[0,m.dir];
      nx=m.x+d2[0]; ny=m.y+d2[1];
      if(nx<Math.min(m.min,m.max)||nx>Math.max(m.min,m.max)||isWall(nx,ny)||G.rocks.has(key(nx,ny))||cellAt(nx,ny)==='o') continue;
    }
    m.x=nx; m.y=ny;
    if(m.x===h.x&&m.y===h.y){G.caughtBy='mob';caught();return;}
  }
}

function checkContact(){
  if(G.phase!=='playing') return;
  if(G.t<G.startAt+G.level.headStart) return;
  const m=monsterPos(), h=G.hero;
  if(m.x===h.x&&m.y===h.y){G.caughtBy='big';caught();}
}

function win(){
  if(G.phase!=='playing') return;
  G.phase='won'; G.hero.mode='done';
  hideOverlay(); G.overlayOpen=true;
  say('他安全抵达了！',false);
  const secs=((G.t-G.startAt)/1000).toFixed(1);
  setTimeout(()=>{
    showOverlay({
      eyebrow:'LEVEL CLEAR',
      title:'抵达终点',
      desc:'勇者安全走进了光里。',
      stats:'<div><b>'+secs+'s</b>用时</div><div><b>'+G.items.rock+'</b>剩余落石</div><div><b>'+G.items.plank+'</b>剩余木板</div><div><b>'+G.items.light+'</b>剩余圣光</div>',
      primary:{label:'再走一次',fn:()=>{hideOverlay();startLevel(G.levelIndex);}},
      secondary:null
    });
  },600);
}

function caught(){
  if(G.phase!=='playing') return;
  G.phase='lost'; G.hero.mode='caught'; G.shake=9;
  hideOverlay(); G.overlayOpen=true;
  say(G.caughtBy==='mob'?'被小怪扑倒了！':'被抓住了！',true);
  setTimeout(()=>{
    let title='被追上了',desc='怪物贴得太近了。';
    if(G.caughtBy==='mob'){
      title='小怪拦住了他';
      desc='他一头撞进了巡逻线。';
    }else if(G.flags.backtrack>0){
      title='走错路了';
      desc='他绕进死路折返，被从背后追上。';
    }else if(G.flags.waitMs>=3000){
      title='耽搁太久';
      desc='他在危险地形前停得太久。';
    }
    const secs=((G.t-G.startAt)/1000).toFixed(1);
    showOverlay({
      eyebrow:'LEVEL FAILED',
      title:title,
      desc:desc+G.level.failHint,
      stats:'<div><b>'+secs+'s</b>坚持了</div><div><b>'+gap()+' 格</b>最后距离</div>',
      primary:{label:'重试本关',fn:()=>{hideOverlay();startLevel(G.levelIndex);}},
      secondary:null
    });
  },800);
}

function canPlace(x,y){
  if(!inb(x,y)) return {ok:false,reason:'不在地图里'};
  if(G.phase!=='playing'||G.paused) return {ok:false,reason:'现在不能放置'};
  const k=key(x,y), ch=cellAt(x,y);
  if(G.tool==='rock'){
    if(G.items.rock<=0) return {ok:false,reason:'落石用完了'};
    if(ch==='#') return {ok:false,reason:'墙面上放不住石头'};
    if(G.rocks.has(k)||G.planks.has(k)) return {ok:false,reason:'这里已经有东西了'};
    if(ch==='~'||ch==='^') return {ok:false,reason:'石头会沉下去，那里要用木板'};
    if(ch==='m') return {ok:false,reason:'石头会陷进泥里，用木板铺平它'};
    if(ch==='x') return {ok:false,reason:'尖刺会顶开落石，换木板盖住它'};
    if(ch==='=') return {ok:false,reason:'这里是必经之路，堵住他会困死'};
    if(ch==='S'||ch==='E') return {ok:false,reason:'关键位置不能堵'};
    if(ch==='o'&&G.filled.has(k)) return {ok:false,reason:'这个坑已经填好了'};
    if(G.hero.x===x&&G.hero.y===y) return {ok:false,reason:'不能砸到他'};
    const m=monsterPos();
    if(m.x===x&&m.y===y) return {ok:false,reason:'大怪物挡住了落点'};
    return {ok:true};
  }
  if(G.tool==='bomb'){
    if(G.items.bomb<=0) return {ok:false,reason:'炸弹用完了'};
    if(ch!=='#') return {ok:false,reason:'炸弹只能放在墙上'};
    if(x===0||y===0||x===COLS-1||y===ROWS-1) return {ok:false,reason:'边界墙炸不开'};
    return {ok:true};
  }
  if(G.items.plank<=0) return {ok:false,reason:'木板用完了'};
  if(ch!=='~'&&ch!=='^'&&ch!=='x'&&ch!=='m') return {ok:false,reason:'木板只能架在水面、熔岩、尖刺或泥沼上'};
  if(G.planks.has(k)) return {ok:false,reason:'这里已经铺好了'};
  return {ok:true};
}

function place(x,y){
  if(G.overlayOpen) return;
  const t=G.t;
  if(t-G.lastPlace<150) return;
  const v=canPlace(x,y);
  if(!v.ok){
    G.shakeCell={x,y,until:t+420}; G.shake=3; say(v.reason,true);
    return;
  }
  G.lastPlace=t;
  const k=key(x,y), ch=cellAt(x,y);
  if(G.tool==='bomb'){
    G.items.bomb--;
    G.dug.add(k); G.blasts.set(k,{x,y,at:t}); G.blastFx=t;
    G.shake=7; G.shakeCell=null;
    buildMini();
    if(Math.abs(G.hero.x-x)+Math.abs(G.hero.y-y)<=1){G.hero.deadPending=null;G.hero.waitUntil=0;}
    say('轰！墙被炸开了一条新路。',false);
  }else if(G.tool==='rock'){
    G.items.rock--;
    const mob=mobAt(x,y);
    if(mob){
      mob.alive=false; G.poofs.set(k,{x,y,at:t}); G.shake=4; G.shakeCell=null;
      say('落石砸中了小怪，路通了。',false);
    }else if(ch==='o'){
      G.filled.add(k); G.shake=3; G.shakeCell=null;
      say('落石填平了坑，他能踩过去了。',false);
    }else{
      G.rocks.add(k); G.rockFx.set(k,t); G.shake=5; G.shakeCell=null;
      say('落石落下，这条路关上了。',false);
    }
  }else{
    G.items.plank--;
    const built=t+PLANK_BUILD;
    G.planks.set(k,built);
    if(Math.abs(G.hero.x-x)+Math.abs(G.hero.y-y)<=1) G.hero.waitUntil=Math.max(G.hero.waitUntil,built+RESUME);
    say(ch==='x'?'木板盖住了尖刺。':ch==='m'?'木板铺平了泥沼。':'木板铺好了。',false);
  }
  updateTools(); updateHud();
}

function canvasCell(ev){
  const r=canvas.getBoundingClientRect();
  const wx=(ev.clientX-r.left)/r.width*view.w/view.scale+cam.x;
  const wy=(ev.clientY-r.top)/r.height*view.h/view.scale+cam.y;
  return {x:Math.floor(wx/TILE),y:Math.floor(wy/TILE)};
}

function setTool(tool){
  if(G.paused||G.phase!=='playing') return;
  if(tool==='rock'&&G.items.rock<=0){say('落石用完了',true);return;}
  if(tool==='plank'&&G.items.plank<=0){say('木板用完了',true);return;}
  if(tool==='bomb'&&G.items.bomb<=0){say('炸弹用完了',true);return;}
  G.tool=tool; updateTools();
}

function castLight(){
  if(G.phase!=='playing'||G.paused||G.overlayOpen) return;
  if(G.items.light<=0){say('圣光已经用完了',true);return;}
  G.items.light--;
  G.monster.stunUntil=G.t+3000;
  G.lightFx=G.t;
  updateTools(); updateHud();
  say('圣光落下，大怪物被钉在原地 3 秒。',false);
}

function togglePause(){
  if(G.phase!=='playing') return;
  G.paused=!G.paused;
  if(G.paused){
    G.overlayOpen=true;
    showOverlay({
      eyebrow:'PAUSED',title:'暂停',desc:'箭头是他下一步的方向；石头封错路，木板过险地，圣光定住怪物。',
      stats:'',
      primary:{label:'继续游戏',fn:()=>{G.paused=false;G.overlayOpen=false;hideOverlay();updateHud();}},
      secondary:{label:'重开本关',fn:()=>{G.paused=false;G.overlayOpen=false;hideOverlay();startLevel(G.levelIndex);}}
    });
  }else{
    G.overlayOpen=false; hideOverlay();
  }
  updateHud();
}

el.rockBtn.onclick=()=>setTool('rock');
el.plankBtn.onclick=()=>setTool('plank');
el.lightBtn.onclick=castLight;
el.bombBtn.onclick=()=>setTool('bomb');
el.pause.onclick=()=>{ if(G.phase==='playing'&&!G.overlayOpen) togglePause(); };
el.ov.addEventListener('click',()=>{
  if(G.phase==='ready'){clearTimeout(G.overlayTimer);hideOverlay();G.overlayOpen=false;beginPlay();}
});
el.restart.onclick=()=>{ clearTimeout(G.overlayTimer); hideOverlay(); G.overlayOpen=false; G.paused=false; startLevel(G.levelIndex); };

canvas.addEventListener('pointermove',e=>{
  if(e.pointerType==='touch') return;
  G.hover=canvasCell(e);
});
canvas.addEventListener('pointerleave',()=>{G.hover=null;});
canvas.addEventListener('pointerdown',e=>{
  if(e.pointerType==='touch') G.hover=null;
  if(G.overlayOpen||G.paused) return;
  const c=canvasCell(e);
  place(c.x,c.y);
});

document.addEventListener('keydown',e=>{
  if(e.key==='1'){setTool('rock');return;}
  if(e.key==='2'){setTool('plank');return;}
  if(e.key==='3'){castLight();return;}
  if(e.key==='4'){setTool('bomb');return;}
  if(e.key===' '||e.key==='Escape'){e.preventDefault();togglePause();return;}
  if(e.key==='r'||e.key==='R'){clearTimeout(G.overlayTimer);hideOverlay();G.overlayOpen=false;G.paused=false;startLevel(G.levelIndex);return;}
  if(!G.overlayOpen&&G.phase==='playing'){
    if(e.key==='ArrowUp'||e.key==='ArrowDown'||e.key==='ArrowLeft'||e.key==='ArrowRight'){
      const d={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'}[e.key];
      const cur=G.hover||{x:G.hero.x,y:G.hero.y};
      G.hover={x:Math.max(0,Math.min(COLS-1,cur.x+DIRS[d][0])),y:Math.max(0,Math.min(ROWS-1,cur.y+DIRS[d][1]))};
      e.preventDefault();
    }
    if(e.key==='Enter'&&G.hover){place(G.hover.x,G.hover.y);e.preventDefault();}
  }
});

document.addEventListener('visibilitychange',()=>{
  if(document.hidden&&G.phase==='playing'&&!G.paused) togglePause();
});
window.addEventListener('blur',()=>{
  if(G.phase==='playing'&&!G.paused&&!G.overlayOpen) togglePause();
});

/* ---------- canvas drawing ---------- */
function rr(x,y,w,h,r){
  const rad=Math.max(0,Math.min(r,w/2,h/2));
  ctx.beginPath();
  ctx.moveTo(x+rad,y);
  ctx.lineTo(x+w-rad,y);
  ctx.arcTo(x+w,y,x+w,y+rad,rad);
  ctx.lineTo(x+w,y+h-rad);
  ctx.arcTo(x+w,y+h,x+w-rad,y+h,rad);
  ctx.lineTo(x+rad,y+h);
  ctx.arcTo(x,y+h,x,y+h-rad,rad);
  ctx.lineTo(x,y+rad);
  ctx.arcTo(x,y,x+rad,y,rad);
  ctx.closePath();
}
function fillRR(x,y,w,h,r,fill){
  rr(x,y,w,h,r); ctx.fillStyle=fill; ctx.fill();
}
function strokeRR(x,y,w,h,r,color,lw){
  rr(x,y,w,h,r); ctx.strokeStyle=color; ctx.lineWidth=lw; ctx.stroke();
}
function approach(cur,target,dt){
  return cur+(target-cur)*(1-Math.exp(-dt/210));
}
function easeOut(p){return 1-Math.pow(1-p,3);}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function star(cx,cy,r,color){
  ctx.beginPath();
  ctx.moveTo(cx,cy-r);
  ctx.quadraticCurveTo(cx+r*.18,cy-r*.18,cx+r,cy);
  ctx.quadraticCurveTo(cx+r*.18,cy+r*.18,cx,cy+r);
  ctx.quadraticCurveTo(cx-r*.18,cy+r*.18,cx-r,cy);
  ctx.quadraticCurveTo(cx-r*.18,cy-r*.18,cx,cy-r);
  ctx.closePath();
  ctx.fillStyle=color; ctx.fill();
}

function drawWater(px,py,t){
  const g=ctx.createLinearGradient(px,py,px,py+TILE);
  g.addColorStop(0,'#8FD3DF'); g.addColorStop(1,C.waterDeep);
  fillRR(px+1,py+1,TILE-2,TILE-2,6,g);
  ctx.save();
  rr(px+2,py+2,TILE-4,TILE-4,5); ctx.clip();
  ctx.strokeStyle='rgba(255,255,255,.55)'; ctx.lineWidth=2; ctx.lineCap='round';
  for(let i=0;i<3;i++){
    const yy=py+15+i*13+Math.sin(t/640+i*1.6+px*.08)*2;
    ctx.beginPath();
    ctx.moveTo(px+7,yy);
    ctx.quadraticCurveTo(px+20,yy-5,px+31,yy);
    ctx.quadraticCurveTo(px+42,yy+5,px+52,yy);
    ctx.stroke();
  }
  ctx.restore();
}

function drawLava(px,py,t){
  const pulse=.5+.5*Math.sin(t/420+px*.12);
  const g=ctx.createLinearGradient(px,py,px,py+TILE);
  g.addColorStop(0,'#FFA85F'); g.addColorStop(1,C.lavaDeep);
  fillRR(px+1,py+1,TILE-2,TILE-2,6,g);
  ctx.save();
  rr(px+2,py+2,TILE-4,TILE-4,5); ctx.clip();
  ctx.fillStyle='rgba(96,28,8,.32)';
  const crust=[[10,12,13,7],[33,20,16,8],[16,39,18,7]];
  crust.forEach(c=>{ctx.beginPath();ctx.ellipse(px+c[0],py+c[1],c[2],c[3],0,0,Math.PI*2);ctx.fill();});
  for(let i=0;i<3;i++){
    const bx=px+14+i*15+Math.sin(t/700+i*2)*4;
    const by=py+44-((t/38+i*19)%26);
    ctx.fillStyle='rgba(255,240,180,.9)';
    ctx.beginPath(); ctx.arc(bx,by,2.2+((i%2)?.6:0),0,Math.PI*2); ctx.fill();
  }
  ctx.restore();
  strokeRR(px+1.5,py+1.5,TILE-3,TILE-3,6,'rgba(255,224,150,'+(.28+pulse*.45)+')',2);
}

function drawPit(px,py,x,y){
  const cx=px+TILE/2, cy=py+TILE/2;
  if(G.filled.has(key(x,y))){
    fillRR(px+5,py+7,TILE-10,TILE-14,8,'#A9A496');
    strokeRR(px+5,py+7,TILE-10,TILE-14,8,C.ink,2.2);
    ctx.strokeStyle='rgba(70,66,58,.6)'; ctx.lineWidth=1.6;
    ctx.beginPath();
    ctx.moveTo(px+12,py+22); ctx.lineTo(px+25,py+28); ctx.lineTo(px+38,py+24);
    ctx.moveTo(px+30,py+33); ctx.lineTo(px+40,py+40);
    ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,.35)';
    ctx.beginPath(); ctx.ellipse(px+22,py+18,8,3,0,0,Math.PI*2); ctx.fill();
    return;
  }
  const g=ctx.createRadialGradient(cx,cy-2,3,cx,cy,27);
  g.addColorStop(0,'#2A2521'); g.addColorStop(.72,'#141110'); g.addColorStop(1,'#0A0C0B');
  ctx.fillStyle=g;
  ctx.beginPath(); ctx.ellipse(cx,cy+2,24,21,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#7A6448'; ctx.lineWidth=3; ctx.stroke();
  ctx.strokeStyle='rgba(250,244,231,.15)'; ctx.lineWidth=1.4;
  ctx.beginPath(); ctx.ellipse(cx+1,cy+1,17,14,0,0,Math.PI*2); ctx.stroke();
}

function drawMud(px,py,t){
  const cx=px+TILE/2, cy=py+TILE/2;
  fillRR(px+3,py+3,TILE-6,TILE-6,7,'#6B6746');
  ctx.fillStyle='rgba(74,71,43,.75)';
  ctx.beginPath(); ctx.ellipse(cx,cy+4,24,18,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(139,150,96,.45)';
  for(let i=0;i<3;i++){
    const bx=px+14+((t/900+i*17)%30), by=py+20+((i*11)%18);
    ctx.beginPath(); ctx.arc(bx,by,3+Math.sin(t/400+i)*1.2,0,Math.PI*2); ctx.fill();
  }
  ctx.strokeStyle='rgba(250,244,231,.32)'; ctx.lineWidth=1.4;
  ctx.beginPath(); ctx.moveTo(px+13,py+42); ctx.quadraticCurveTo(px+24,py+37,px+38,py+41); ctx.stroke();
}

function drawSpikes(px,py){
  fillRR(px+5,py+8,TILE-10,TILE-14,6,'rgba(44,58,54,.28)');
  for(let i=0;i<4;i++){
    const cx=px+15+i*10, base=py+TILE-12;
    ctx.beginPath();
    ctx.moveTo(cx-5,base); ctx.lineTo(cx,py+13); ctx.lineTo(cx+5,base); ctx.closePath();
    ctx.fillStyle='#B9C2C6'; ctx.fill();
    ctx.strokeStyle=C.ink; ctx.lineWidth=1.8; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx-2.4,base-3); ctx.lineTo(cx,py+17); ctx.strokeStyle='rgba(255,255,255,.65)'; ctx.lineWidth=1.2; ctx.stroke();
  }
}

function drawStartPad(px,py){
  const cx=px+TILE/2, cy=py+TILE/2;
  const g=ctx.createRadialGradient(cx,cy,3,cx,cy,21);
  g.addColorStop(0,'rgba(255,252,244,.95)');
  g.addColorStop(.6,'rgba(191,227,224,.65)');
  g.addColorStop(1,'rgba(191,227,224,0)');
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,21,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(46,107,99,.4)'; ctx.lineWidth=2;
  ctx.setLineDash([4,4]); ctx.beginPath(); ctx.arc(cx,cy,15,0,Math.PI*2); ctx.stroke();
  ctx.setLineDash([]);
}

function drawExit(px,py,t){
  const cx=px+TILE/2, cy=py+TILE/2;
  const g=ctx.createRadialGradient(cx,cy,4,cx,cy,26);
  g.addColorStop(0,'rgba(255,248,208,.98)');
  g.addColorStop(.55,'rgba(240,197,120,.72)');
  g.addColorStop(1,'rgba(240,197,120,0)');
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,26,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#FFF6C4'; ctx.lineWidth=3.2; ctx.lineCap='round';
  ctx.beginPath(); ctx.arc(cx,cy+5,13,Math.PI,0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx-13,cy+5); ctx.lineTo(cx-13,cy+17);
  ctx.moveTo(cx+13,cy+5); ctx.lineTo(cx+13,cy+17); ctx.stroke();
  for(let i=0;i<5;i++){
    const a=t/760+i*1.256;
    const rad=16+Math.sin(t/520+i*1.1)*5;
    star(cx+Math.cos(a)*rad,cy+Math.sin(a)*rad*.7-2,2.6,'rgba(255,247,200,'+(.5+.5*Math.sin(t/300+i))+')');
  }
}

function drawTrail(){
  for(let i=0;i<G.trail.length-1;i++){
    const a=G.trail[i], b=G.trail[i+1];
    const cx=a.x*TILE+TILE/2, cy=a.y*TILE+TILE/2;
    const dx=Math.sign(b.x-a.x), dy=Math.sign(b.y-a.y);
    const ox=dy!==0?4.5:0, oy=dx!==0?4.5:0;
    ctx.fillStyle='rgba(112,86,52,.20)';
    for(let s=0;s<2;s++){
      const off=s?1:-1;
      ctx.beginPath();
      ctx.ellipse(cx+dx*3+ox*off,cy+dy*3+oy*off,3.4,2.1,0,0,Math.PI*2);
      ctx.fill();
    }
  }
}

function drawPlanks(t){
  G.planks.forEach((built,key)=>{
    const parts=key.split(','), x=+parts[0], y=+parts[1];
    const px=x*TILE, py=y*TILE;
    const cx=px+TILE/2, cy=py+TILE/2;
    if(t<built){
      const p=clamp(1-(built-t)/PLANK_BUILD,0,1);
      ctx.save();
      ctx.globalAlpha=.4+.45*p;
      ctx.setLineDash([5,4]);
      strokeRR(px+4,py+4,TILE-8,TILE-8,6,'#FFF6C4',2);
      ctx.setLineDash([]);
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.translate(cx,cy);
    ctx.rotate(-.035);
    ctx.fillStyle='rgba(22,38,34,.26)';
    ctx.beginPath(); ctx.ellipse(1,5,26,17,0,0,Math.PI*2); ctx.fill();
    for(let i=0;i<3;i++){
      const yy=-20+i*14;
      fillRR(-25,yy,50,12,3,i%2?'#C48D52':'#B57B44');
      strokeRR(-25,yy,50,12,3,'#7E5129',1.7);
      ctx.strokeStyle='rgba(110,64,26,.45)'; ctx.lineWidth=1;
      ctx.beginPath();
      ctx.moveTo(-18,yy+5);
      ctx.quadraticCurveTo(0,yy+2.4,18,yy+5);
      ctx.stroke();
      ctx.fillStyle='#6B4A2B';
      ctx.beginPath(); ctx.arc(-19.5,yy+6,1.3,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(19.5,yy+6,1.3,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  });
}

function drawBoulder(cx,cy,sc,alpha){
  ctx.save();
  ctx.translate(cx,cy);
  ctx.scale(sc,sc);
  ctx.globalAlpha=alpha;
  ctx.fillStyle='rgba(20,30,28,.24)';
  ctx.beginPath(); ctx.ellipse(0,17,21,8,0,0,Math.PI*2); ctx.fill();
  const g=ctx.createLinearGradient(-16,-18,16,18);
  g.addColorStop(0,'#CCC7BA'); g.addColorStop(.55,C.stone); g.addColorStop(1,'#6F6C63');
  ctx.beginPath();
  ctx.moveTo(-19,6); ctx.lineTo(-14,-13); ctx.lineTo(-2,-19);
  ctx.lineTo(13,-14); ctx.lineTo(20,2); ctx.lineTo(15,17);
  ctx.lineTo(1,20); ctx.lineTo(-12,17); ctx.closePath();
  ctx.fillStyle=g; ctx.fill();
  ctx.strokeStyle=C.ink; ctx.lineWidth=3; ctx.stroke();
  ctx.strokeStyle='rgba(255,255,255,.55)'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(-12,-11); ctx.lineTo(-2,-15); ctx.lineTo(7,-12); ctx.stroke();
  ctx.strokeStyle='rgba(40,44,40,.55)'; ctx.lineWidth=1.6;
  ctx.beginPath(); ctx.moveTo(-3,-2); ctx.lineTo(2,5); ctx.lineTo(-1,12); ctx.stroke();
  ctx.restore();
}

function drawRocks(t){
  G.rocks.forEach(key=>{
    const parts=key.split(','), x=+parts[0], y=+parts[1];
    const cx=x*TILE+TILE/2, cy=y*TILE+TILE/2;
    const placed=G.rockFx.get(key)||0;
    const age=t-placed;
    let off=0, sc=1;
    if(age>=0&&age<ROCK_FALL){
      const p=clamp(age/ROCK_FALL,0,1);
      off=-34*(1-easeOut(p));
      sc=1+(1-p)*.2;
    }
    drawBoulder(cx,cy+off,sc,1);
    if(age>=ROCK_FALL&&age<ROCK_FALL+280){
      const p=clamp((age-ROCK_FALL)/280,0,1);
      ctx.save();
      ctx.strokeStyle='rgba(90,78,62,'+(.5*(1-p))+')';
      ctx.lineWidth=2;
      for(let i=0;i<3;i++){
        ctx.beginPath();
        ctx.ellipse(cx,cy+15,14+p*22,4+p*7,0,0,Math.PI*2);
        ctx.stroke();
      }
      ctx.restore();
    }
  });
}
const FONT_BODY='"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';

function drawTiles(t){
  const x0=Math.max(0,Math.floor(cam.x/TILE)-1);
  const x1=Math.min(COLS-1,Math.ceil((cam.x+view.w/view.scale)/TILE)+1);
  const y0=Math.max(0,Math.floor(cam.y/TILE)-1);
  const y1=Math.min(ROWS-1,Math.ceil((cam.y+view.h/view.scale)/TILE)+1);
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const px=x*TILE, py=y*TILE, ch=cellAt(x,y);
    if(ch==='#'){
      fillRR(px+1,py+1,TILE-2,TILE-2,8,C.wallEdge);
      fillRR(px+3,py+3,TILE-6,TILE-6,7,C.wall);
      fillRR(px+7,py+5,TILE-14,5,2.5,'rgba(255,255,255,.10)');
      if((x*3+y*5)%4===0){
        ctx.fillStyle='rgba(126,196,168,.20)';
        ctx.beginPath();ctx.arc(px+16+(x%3)*9,py+39,3.2,0,Math.PI*2);ctx.fill();
      }
      continue;
    }
    fillRR(px+.5,py+.5,TILE-1,TILE-1,3,(x+y)%2?C.floor:C.floor2);
    ctx.fillStyle='rgba(148,120,74,.16)';
    for(let i=0;i<2;i++){
      const gx=px+12+((x*17+y*29+i*31)%36);
      const gy=py+14+((x*41+y*7+i*19)%34);
      ctx.beginPath();ctx.arc(gx,gy,1.4,0,Math.PI*2);ctx.fill();
    }
    if(ch==='='){
      ctx.fillStyle='rgba(222,158,52,.55)';
      ctx.beginPath();
      ctx.moveTo(px+9,py+7);ctx.lineTo(px+13,py+10);ctx.lineTo(px+9,py+13);ctx.lineTo(px+5,py+10);
      ctx.closePath();ctx.fill();
    }
    if(ch==='~') drawWater(px,py,t);
    if(ch==='^') drawLava(px,py,t);
    if(ch==='o') drawPit(px,py,x,y);
    if(ch==='x') drawSpikes(px,py);
    if(ch==='m') drawMud(px,py,t);
    if(G.dug.has(key(x,y))){
      ctx.fillStyle='rgba(45,42,34,.28)';
      ctx.beginPath(); ctx.arc(px+20,py+22,8,0,Math.PI*2); ctx.arc(px+38,py+36,6,0,Math.PI*2); ctx.fill();
    }
    if(ch==='S') drawStartPad(px,py);
    if(ch==='E') drawExit(px,py,t);
  }
}

function drawArrowGlyph(cx,cy,dir,color){
  ctx.save();
  ctx.translate(cx,cy);
  ctx.rotate(dir==='down'?Math.PI/2:dir==='up'?-Math.PI/2:dir==='left'?Math.PI:0);
  ctx.strokeStyle=color; ctx.lineWidth=3; ctx.lineCap='round'; ctx.lineJoin='round';
  ctx.beginPath(); ctx.moveTo(-6,-6); ctx.lineTo(5,0); ctx.lineTo(-6,6); ctx.stroke();
  ctx.restore();
}

function drawBubble(t){
  if(G.phase!=='playing'||G.overlayOpen) return;
  const h=G.hero;
  if(h.mode==='done'||h.mode==='caught') return;
  const it=heroIntent();
  let kind='', color=C.greenDark;
  if(h.mode==='hesitate'||h.mode==='dead'||it.kind==='lost'){kind='?';color=C.gold;}
  else if(it.kind==='fear'||h.mode==='blocked'){kind='!';color=C.coral;}
  else if(it.dir){kind=it.dir;}
  if(!kind){ if(G.bubble) G.bubble.kind=null; return; }
  const b=G.bubble||(G.bubble={kind:null,at:0});
  if(kind!==b.kind){
    if(b.kind===null||t-b.at>=BUBBLE_HOLD){b.kind=kind;b.at=t;}
    else kind=b.kind;
  }
  const s=view.scale;
  const bob=Math.sin(t/520)*1.6;
  const cx=clamp((h.vx*TILE+TILE/2)*s-cam.x*s,24,view.w-24);
  const by=clamp((h.vy*TILE+TILE/2-58+bob)*s-cam.y*s,10,view.h-46);
  ctx.save();
  screenTransform();
  ctx.beginPath();
  ctx.moveTo(cx-5,by+25); ctx.lineTo(cx,by+36); ctx.lineTo(cx+5,by+25);
  ctx.fillStyle='#FFFCF4'; ctx.fill();
  ctx.strokeStyle=C.ink; ctx.lineWidth=2.2; ctx.stroke();
  fillRR(cx-17,by,34,28,13,'#FFFCF4');
  strokeRR(cx-17,by,34,28,13,C.ink,2.4);
  ctx.textAlign='center'; ctx.textBaseline='middle';
  if(kind==='?'||kind==='!'){
    ctx.fillStyle=color;
    ctx.font='700 20px '+FONT_BODY;
    ctx.fillText(kind,cx,by+15);
  }else{
    drawArrowGlyph(cx,by+14,kind,color);
  }
  ctx.restore();
}

function drawMobs(t){
  for(const m of G.mobs){
    if(!m.alive) continue;
    const cx=m.x*TILE+TILE/2, cy=m.y*TILE+TILE/2+Math.sin(t/260+m.x*1.7)*1.5;
    ctx.fillStyle='rgba(20,30,28,.24)';
    ctx.beginPath(); ctx.ellipse(cx,cy+16,16,6,0,0,Math.PI*2); ctx.fill();
    const g=ctx.createLinearGradient(cx,cy-16,cx,cy+16);
    g.addColorStop(0,'#A98AD8'); g.addColorStop(1,'#6E5AA8');
    ctx.beginPath(); ctx.ellipse(cx,cy+2,16,14,0,0,Math.PI*2);
    ctx.fillStyle=g; ctx.fill();
    ctx.strokeStyle=C.ink; ctx.lineWidth=2.4; ctx.stroke();
    ctx.fillStyle='#F7E6BE';
    ctx.beginPath();
    ctx.moveTo(cx-10,cy-10); ctx.lineTo(cx-6,cy-19); ctx.lineTo(cx-2,cy-11); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx+2,cy-11); ctx.lineTo(cx+6,cy-19); ctx.lineTo(cx+10,cy-10); ctx.closePath(); ctx.fill();
    ctx.strokeStyle=C.ink; ctx.lineWidth=1.4;
    ctx.beginPath();
    ctx.moveTo(cx-10,cy-10); ctx.lineTo(cx-6,cy-19); ctx.lineTo(cx-2,cy-11);
    ctx.moveTo(cx+2,cy-11); ctx.lineTo(cx+6,cy-19); ctx.lineTo(cx+10,cy-10);
    ctx.stroke();
    const ex=m.axis==='x'?m.dir*2.4:0, ey=m.axis==='y'?m.dir*2.4:0;
    for(const s of [-1,1]){
      const wx=cx+s*5.6, wy=cy-3;
      ctx.fillStyle='#FFFCF4';
      ctx.beginPath(); ctx.ellipse(wx,wy,3.2,3.8,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle=C.ink;
      ctx.beginPath(); ctx.arc(wx+ex,wy+ey,1.5,0,Math.PI*2); ctx.fill();
    }
    ctx.strokeStyle=C.ink; ctx.lineWidth=1.8; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(cx-4,cy+8); ctx.quadraticCurveTo(cx,cy+11,cx+4,cy+8); ctx.stroke();
  }
}

function drawPoofs(t){
  G.poofs.forEach((info)=>{
    const age=t-info.at;
    if(age<0||age>620) return;
    const p=clamp(age/620,0,1);
    const cx=info.x*TILE+TILE/2, cy=info.y*TILE+TILE/2;
    ctx.save();
    ctx.globalAlpha=1-p;
    ctx.strokeStyle='#8B6BC4'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(cx,cy,10+p*22,0,Math.PI*2); ctx.stroke();
    for(let i=0;i<6;i++){
      const a=i*1.047+p*.9, r=9+p*20;
      star(cx+Math.cos(a)*r,cy+Math.sin(a)*r,2.6,'#C9B6EE');
    }
    ctx.restore();
  });
}

function drawBlasts(t){
  G.blasts.forEach((info)=>{
    const age=t-info.at;
    if(age<0||age>640) return;
    const p=clamp(age/640,0,1);
    const cx=info.x*TILE+TILE/2, cy=info.y*TILE+TILE/2;
    ctx.save();
    ctx.globalAlpha=1-p;
    ctx.strokeStyle='#F2793C'; ctx.lineWidth=4;
    ctx.beginPath(); ctx.arc(cx,cy,12+p*28,0,Math.PI*2); ctx.stroke();
    ctx.strokeStyle='rgba(255,220,160,.85)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(cx,cy,6+p*18,0,Math.PI*2); ctx.stroke();
    for(let i=0;i<7;i++){
      const a=i*.9+p*.6, r=14+p*30;
      star(cx+Math.cos(a)*r,cy+Math.sin(a)*r,3,'#F2793C');
    }
    ctx.restore();
  });
}

function drawLightFx(t){
  if(t>=G.monster.stunUntil) return;
  const cx=G.monster.vx*TILE+TILE/2, cy=G.monster.vy*TILE+TILE/2;
  const pulse=.5+.5*Math.sin(t/180);
  ctx.save();
  ctx.globalCompositeOperation='lighter';
  const g=ctx.createRadialGradient(cx,cy,4,cx,cy,44);
  g.addColorStop(0,'rgba(255,238,170,'+(.5+pulse*.25)+')');
  g.addColorStop(.55,'rgba(240,197,120,'+(.22+pulse*.12)+')');
  g.addColorStop(1,'rgba(240,197,120,0)');
  ctx.fillStyle=g;
  ctx.beginPath(); ctx.arc(cx,cy,44,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(255,246,196,'+(.55+pulse*.35)+')'; ctx.lineWidth=2.4;
  ctx.beginPath(); ctx.ellipse(cx,cy+18,26,9,0,0,Math.PI*2); ctx.stroke();
  ctx.strokeStyle='rgba(255,246,196,.55)'; ctx.lineWidth=2;
  for(let i=0;i<6;i++){
    const a=t/900+i*Math.PI/3, r=30+Math.sin(t/300+i)*4;
    ctx.beginPath();
    ctx.moveTo(cx+Math.cos(a)*20,cy+Math.sin(a)*12);
    ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r*.8);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMonster(t){
  if(G.phase==='ready') return;
  const m=G.monster;
  const launch=G.startAt+G.level.headStart;
  let alpha=1;
  if(G.phase!=='lost') alpha=clamp((G.t-(G.startAt+500))/700,0,1);
  if(alpha<=0) return;
  const cx=m.vx*TILE+TILE/2, cy=m.vy*TILE+TILE/2;
  const bob=Math.sin(t/340)*1.8;
  const danger=gap()<=2;
  ctx.save();
  ctx.globalAlpha=alpha;
  ctx.fillStyle='rgba(15,28,25,.30)';
  ctx.beginPath();ctx.ellipse(cx,cy+21,26,9,0,0,Math.PI*2);ctx.fill();
  fillRR(cx-17,cy+8,13,16,6,'#4C3D7C');
  fillRR(cx+4,cy+8,13,16,6,'#4C3D7C');
  fillRR(cx-31,cy-14+bob*.4,13,17,6,'#5B4B90');
  fillRR(cx+18,cy-14+bob*.4,13,17,6,'#5B4B90');
  ctx.fillStyle='#F1E6C8';
  [-29,-23,23,29].forEach(dx=>{
    const ax=cx+dx, ay=cy+4+bob*.4;
    ctx.beginPath();ctx.moveTo(ax-2.2,ay);ctx.lineTo(ax,ay+5);ctx.lineTo(ax+2.2,ay);ctx.closePath();ctx.fill();
  });
  const g=ctx.createRadialGradient(cx-10,cy-26,6,cx,cy-6,34);
  g.addColorStop(0,'#8A75C4'); g.addColorStop(1,'#54447F');
  ctx.beginPath();ctx.ellipse(cx,cy-6+bob*.5,27,25,0,0,Math.PI*2);
  ctx.fillStyle=g;ctx.fill();
  ctx.strokeStyle=C.ink;ctx.lineWidth=4;ctx.stroke();
  ctx.fillStyle='#F3E6C4';
  ctx.strokeStyle=C.ink;ctx.lineWidth=2.4;
  ctx.beginPath();
  ctx.moveTo(cx-23,cy-23+bob*.5);ctx.lineTo(cx-15,cy-38+bob*.5);ctx.lineTo(cx-8,cy-26+bob*.5);
  ctx.closePath();ctx.fill();ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx+23,cy-23+bob*.5);ctx.lineTo(cx+15,cy-38+bob*.5);ctx.lineTo(cx+8,cy-26+bob*.5);
  ctx.closePath();ctx.fill();ctx.stroke();
  [-9,9].forEach(dx=>{
    ctx.beginPath();ctx.arc(cx+dx,cy-13+bob*.5,8,0,Math.PI*2);
    ctx.fillStyle='#FFF9EC';ctx.fill();
    ctx.strokeStyle=C.ink;ctx.lineWidth=2;ctx.stroke();
    ctx.beginPath();ctx.arc(cx+dx+(danger?0:-1),cy-12+bob*.5,danger?4:3.3,0,Math.PI*2);
    ctx.fillStyle=danger?'#C43D2B':C.ink;ctx.fill();
  });
  ctx.strokeStyle=C.ink;ctx.lineWidth=2.4;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(cx-15,cy-22+bob*.5);ctx.lineTo(cx-4,cy-19+bob*.5);
  ctx.moveTo(cx+15,cy-22+bob*.5);ctx.lineTo(cx+4,cy-19+bob*.5);ctx.stroke();
  fillRR(cx-12,cy+3+bob*.5,24,10,5,'#3A2545');
  ctx.fillStyle='#F3E6C4';
  for(let i=0;i<4;i++){
    const tx=cx-8+i*5;
    ctx.beginPath();
    ctx.moveTo(tx,cy+4+bob*.5);ctx.lineTo(tx+2.6,cy+9+bob*.5);ctx.lineTo(tx+5.2,cy+4+bob*.5);
    ctx.closePath();ctx.fill();
  }
  ctx.restore();
}

function drawHero(t){
  const h=G.hero;
  const cx=h.vx*TILE+TILE/2, cy=h.vy*TILE+TILE/2;
  const moving=Math.hypot(h.x-h.vx,h.y-h.vy)>.03;
  const hop=moving?Math.abs(Math.sin(t/165))*2.2:0;
  const dir=h.prevDir||'down';
  const fx=dir==='left'?-1:dir==='right'?1:0;
  const fy=dir==='up'?-1:dir==='down'?1:0;
  const swing=moving?Math.sin(t/165)*2.2:0;
  ctx.fillStyle='rgba(15,28,25,.26)';
  ctx.beginPath();ctx.ellipse(cx,cy+20,12,4.5,0,0,Math.PI*2);ctx.fill();
  ctx.save();
  ctx.translate(cx,cy-hop);
  ctx.save();
  ctx.rotate(-.55); ctx.translate(10,-1);
  fillRR(-1.6,-19,3.2,20,1.5,C.steel);
  strokeRR(-1.6,-19,3.2,20,1.5,C.ink,1.4);
  fillRR(-5,0,10,3,1.2,C.gold);
  ctx.restore();
  fillRR(-9.2,10+swing*.4,6.5,9.5,3,C.brown);
  fillRR(2.7,10-swing*.4,6.5,9.5,3,C.brown);
  fillRR(-11,-4,22,20,8,C.green);
  strokeRR(-11,-4,22,20,8,C.ink,3);
  ctx.fillStyle=C.gold;
  ctx.fillRect(-10.6,6.4,21.2,3.2);
  ctx.fillStyle=C.skin;
  ctx.beginPath();ctx.arc(-12,3,3.4,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.arc(12,3,3.4,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle=C.ink;ctx.lineWidth=1.8;
  ctx.beginPath();ctx.arc(-12,3,3.4,0,Math.PI*2);ctx.stroke();
  ctx.beginPath();ctx.arc(12,3,3.4,0,Math.PI*2);ctx.stroke();
  ctx.beginPath();ctx.arc(0,-15,12.5,0,Math.PI*2);
  ctx.fillStyle=C.skin;ctx.fill();
  ctx.strokeStyle=C.ink;ctx.lineWidth=3;ctx.stroke();
  ctx.beginPath();ctx.arc(0,-16,13,Math.PI,0);
  ctx.fillStyle=C.greenDark;ctx.fill();
  ctx.strokeStyle=C.ink;ctx.lineWidth=3;ctx.stroke();
  ctx.beginPath();ctx.moveTo(-13,-16);ctx.lineTo(13,-16);
  ctx.lineWidth=2.4;ctx.stroke();
  ctx.beginPath();ctx.ellipse(12,-27,3.2,5.4,-.5,0,Math.PI*2);
  ctx.fillStyle=C.coral;ctx.fill();
  ctx.strokeStyle=C.ink;ctx.lineWidth=1.8;ctx.stroke();
  const ex=fx*1.8, ey=fy*1.3;
  if(h.mode==='caught'){
    ctx.strokeStyle=C.ink;ctx.lineWidth=1.9;
    [[-4.6,-14.5],[4.6,-14.5]].forEach(p=>{
      const x=p[0]+ex, y=p[1]+ey;
      ctx.beginPath();ctx.moveTo(x-2.5,y-2.5);ctx.lineTo(x+2.5,y+2.5);
      ctx.moveTo(x+2.5,y-2.5);ctx.lineTo(x-2.5,y+2.5);ctx.stroke();
    });
  }else{
    [[-4.6,-14.5],[4.6,-14.5]].forEach(p=>{
      const x=p[0]+ex, y=p[1]+ey;
      ctx.beginPath();ctx.ellipse(x,y,2.9,3.4,0,0,Math.PI*2);
      ctx.fillStyle=C.ink;ctx.fill();
      ctx.beginPath();ctx.arc(x-1,y-1.3,.95,0,Math.PI*2);
      ctx.fillStyle='#FFF9EC';ctx.fill();
    });
  }
  ctx.fillStyle='rgba(228,103,74,.32)';
  ctx.beginPath();ctx.ellipse(-7.5+ex,-9.6,3,1.7,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(7.5+ex,-9.6,3,1.7,0,0,Math.PI*2);ctx.fill();
  ctx.beginPath();ctx.ellipse(ex*1.4,-8.6,1.7,2.1,0,0,Math.PI*2);
  ctx.fillStyle=C.ink;ctx.fill();
  ctx.restore();
}

function drawPlankGhost(cx,cy){
  ctx.save();
  ctx.translate(cx,cy);
  ctx.rotate(-.035);
  for(let i=0;i<3;i++){
    fillRR(-24,-19+i*14,48,11,3,'rgba(196,141,82,.62)');
    strokeRR(-24,-19+i*14,48,11,3,'rgba(126,81,41,.85)',1.4);
  }
  ctx.restore();
}

function drawTag(ax,ay,text){
  const s=view.scale;
  ctx.save();
  screenTransform();
  ctx.font='600 11px '+FONT_BODY;
  const w=ctx.measureText(text).width+14;
  const x=clamp(ax*s-cam.x*s-w/2,6,view.w-w-6);
  let y=clamp(ay*s-cam.y*s,6,view.h-27);
  fillRR(x,y,w,21,7,'rgba(16,32,28,.90)');
  ctx.fillStyle='#FFE9DC';
  ctx.textAlign='left';ctx.textBaseline='middle';
  ctx.fillText(text,x+7,y+11);
  ctx.restore();
}

function drawHover(){
  if(!G.hover||G.phase!=='playing'||G.overlayOpen||G.paused) return;
  const x=G.hover.x, y=G.hover.y;
  if(!inb(x,y)) return;
  const px=x*TILE, py=y*TILE, cx=px+TILE/2, cy=py+TILE/2;
  const v=canPlace(x,y);
  const col=v.ok?'#3E8C82':'#C43D2B';
  ctx.save();
  ctx.fillStyle=v.ok?'rgba(62,140,130,.13)':'rgba(196,61,43,.12)';
  rr(px+2,py+2,TILE-4,TILE-4,7);ctx.fill();
  if(!v.ok) ctx.setLineDash([5,4]);
  strokeRR(px+2,py+2,TILE-4,TILE-4,7,col,2.5);
  ctx.setLineDash([]);
  if(v.ok){
    if(G.tool==='rock') drawBoulder(cx,cy,.82,.42);
    else drawPlankGhost(cx,cy);
  }else{
    drawTag(cx,py+TILE+3,v.reason);
  }
  ctx.restore();
}

function drawShakeCell(){
  if(!G.shakeCell||G.t>=G.shakeCell.until) return;
  const px=G.shakeCell.x*TILE, py=G.shakeCell.y*TILE;
  const p=clamp((G.shakeCell.until-G.t)/420,0,1);
  ctx.save();
  ctx.setLineDash([4,3]);
  strokeRR(px+2,py+2,TILE-4,TILE-4,7,'rgba(196,61,43,'+(.45+p*.45)+')',2.4);
  ctx.setLineDash([]);
  ctx.restore();
}

function drawWinFx(t){
  const cx=G.hero.vx*TILE+TILE/2, cy=G.hero.vy*TILE+TILE/2;
  const p=(Math.sin(t/500)+1)/2;
  ctx.save();
  ctx.strokeStyle='rgba(255,244,180,'+(.3+p*.4)+')';ctx.lineWidth=3;
  ctx.beginPath();ctx.arc(cx,cy-16,22+p*7,0,Math.PI*2);ctx.stroke();
  for(let i=0;i<8;i++){
    const a=t/900+i*.785;
    star(cx+Math.cos(a)*30,cy-16+Math.sin(a)*30,3,'rgba(255,246,196,'+(.45+.5*Math.sin(t/240+i))+')');
  }
  ctx.restore();
}

function drawLostFx(){
  const m=G.monster, s=view.scale;
  const cx=(m.vx*TILE+TILE/2)*s-cam.x*s, cy=(m.vy*TILE+TILE/2)*s-cam.y*s;
  const g=ctx.createRadialGradient(cx,cy,10,cx,cy,Math.max(view.w,view.h)*.7);
  g.addColorStop(0,'rgba(196,61,43,.32)');
  g.addColorStop(.5,'rgba(196,61,43,.13)');
  g.addColorStop(1,'rgba(196,61,43,0)');
  ctx.fillStyle=g;ctx.fillRect(0,0,view.w,view.h);
}

/* ---------- 小地图 ---------- */
let miniStatic=null, miniAt=-1e9;
function buildMini(){
  const c=document.createElement('canvas');
  c.width=COLS*MM*dpr; c.height=ROWS*MM*dpr;
  const g=c.getContext('2d');
  g.setTransform(dpr,0,0,dpr,0,0);
  g.fillStyle='rgba(9,24,21,.78)'; g.fillRect(0,0,COLS*MM,ROWS*MM);
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
    const ch=cellAt(x,y);
    if(ch==='#') continue;
    let col='rgba(243,232,207,.26)';
    if(ch==='~') col='#7FC8D8';
    else if(ch==='^') col='#F2793C';
    else if(ch==='o') col='#4A4038';
    else if(ch==='x') col='#B9C2C6';
    else if(ch==='m') col='#8B8F5E';
    else if(ch==='S') col='#BFE3E0';
    else if(ch==='E') col='#F0C578';
    g.fillStyle=col;
    g.fillRect(x*MM,y*MM,MM,MM);
  }
  miniStatic=c;
}
function drawMini(){
  const g=mctx;
  g.setTransform(dpr,0,0,dpr,0,0);
  g.clearRect(0,0,COLS*MM,ROWS*MM);
  if(miniStatic) g.drawImage(miniStatic,0,0,COLS*MM,ROWS*MM);
  g.fillStyle='rgba(240,197,120,.26)';
  for(let i=0;i<G.trail.length;i++){
    const p=G.trail[i];
    g.fillRect(p.x*MM,p.y*MM,MM,MM);
  }
  if(G.exit){
    g.fillStyle='rgba(255,246,196,'+(.55+.45*Math.sin(G.t/380))+')';
    g.fillRect(G.exit.x*MM-1,G.exit.y*MM-1,MM+2,MM+2);
  }
  if(G.phase!=='ready'){
    const m=monsterPos();
    g.fillStyle='#A98AD8';
    g.beginPath();g.arc(m.x*MM+MM/2,m.y*MM+MM/2,2.8,0,Math.PI*2);g.fill();
  }
  g.fillStyle='#4FBFA8';
  g.beginPath();g.arc(G.hero.x*MM+MM/2,G.hero.y*MM+MM/2,3,0,Math.PI*2);g.fill();
  g.strokeStyle='rgba(255,252,242,.85)';g.lineWidth=1;
  g.beginPath();g.arc(G.hero.x*MM+MM/2,G.hero.y*MM+MM/2,3,0,Math.PI*2);g.stroke();
}

function draw(){
  const t=G.t;
  screenTransform();
  ctx.clearRect(0,0,view.w,view.h);
  ctx.fillStyle='#10231F';
  ctx.fillRect(0,0,view.w,view.h);

  worldTransform();
  drawTiles(t);
  drawTrail();
  drawHover();
  drawPlanks(t);
  drawRocks(t);
  drawBlasts(t);
  drawMobs(t);
  drawPoofs(t);
  if(G.phase==='lost'){ drawHero(t); drawMonster(t); }
  else { drawMonster(t); drawHero(t); }
  drawLightFx(t);
  drawBubble(t);
  if(G.phase==='won') drawWinFx(t);
  drawShakeCell();

  screenTransform();
  if(VIGNETTE){ctx.fillStyle=VIGNETTE;ctx.fillRect(0,0,view.w,view.h);}
  if(G.phase==='lost') drawLostFx();
  if(t-miniAt>140){miniAt=t;drawMini();}
}

let prevTime=performance.now(), hudClock=0;
function frame(now){
  const dt=Math.min(64,Math.max(0,now-prevTime));
  prevTime=now;
  if(!G.paused&&(G.phase==='ready'||G.phase==='playing')) G.t+=dt;
  if(G.phase==='ready'&&G.t>=G.startAt){
    hideOverlay();
    G.overlayOpen=false;
    beginPlay();
  }
  if(!G.paused){
    if(G.phase==='playing'){ heroTick(); mobsTick(); monsterTick(); checkContact(); }
    G.hero.vx=approach(G.hero.vx,G.hero.x,dt);
    G.hero.vy=approach(G.hero.vy,G.hero.y,dt);
    const mp=monsterPos();
    G.monster.vx=approach(G.monster.vx,mp.x,dt);
    G.monster.vy=approach(G.monster.vy,mp.y,dt);
    followCam(dt,false);
  }
  if(G.shake>0) G.shake=Math.max(0,G.shake-dt*.012);
  draw();
  if(now-hudClock>100){ hudClock=now; updateHud(); }
  requestAnimationFrame(frame);
}

measure();
startLevel(0);
new ResizeObserver(()=>{measure();followCam(0,true);}).observe(canvas.parentElement);
requestAnimationFrame(frame);
})();
