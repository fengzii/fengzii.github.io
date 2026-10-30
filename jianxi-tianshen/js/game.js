(function(){
'use strict';
const TILE=56;
/* 地图尺寸逐关变大：每关开局按地图实际行列重设，别的地方一律读当前值。 */
let COLS=39, ROWS=19, W=COLS*TILE, H=ROWS*TILE;
const READY_MS=1500, HERO_STEP=900, HESITATE=2400, DEAD_PAUSE=1900, RETRY=800;
const ROCK_FALL=450, PLANK_BUILD=400, RESUME=300, MUD_SLOW=700;
const BOMB_FUSE=3000, BLAST_R=1;
const START=1500, BUBBLE_HOLD=600;
/* 冰面滑行的单格间隔；传送门穿过去后短暂停顿，免得镜头跟不上。 */
const SLIDE_STEP=250, PORTAL_HOLD=520;

const LEVELS=window.LEVELS||[];

const C={
  floor:'#F3E8CF', floor2:'#EDDFC0', wall:'#2C5A51', wallTop:'#3B7268', wallEdge:'#1B3B35',
  ink:'#20302D', water:'#7FC8D8', waterDeep:'#4C9DAF', lava:'#F2793C', lavaDeep:'#C9501F',
  gold:'#F0C578', green:'#3E8C82', greenDark:'#2E6B63', purple:'#6E5AA8', coral:'#E4674A',
  paper:'#FBF5E6', skin:'#F7CEA3', steel:'#95A2AC', brown:'#B57B44', stone:'#8D8A80',
  grain:'rgba(148,120,74,.16)', mote:'rgba(126,196,168,.20)'
};
/* 每关的配色都从这里出发覆写，切关时先还原，避免场景颜色串关。 */
const BASE_C=Object.assign({},C);
const DIRS={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
const OPP={up:'down',down:'up',left:'right',right:'left'};
const DIR_CN={up:'上',down:'下',left:'左',right:'右'};
const DIR_ANGLE={up:-Math.PI/2,down:Math.PI/2,left:Math.PI,right:0};

const canvas=document.getElementById('stage');
const ctx=canvas.getContext('2d');
const mini=document.getElementById('minimap');
const mctx=mini.getContext('2d');
const dpr=Math.min(window.devicePixelRatio||1,2);
let MM=3;
/* 小地图要和底部道具排在同一行：宽收在 118px 上下，高也别超过道具行的高度。 */
function layoutGrid(cols,rows){
  COLS=cols; ROWS=rows; W=COLS*TILE; H=ROWS*TILE;
  MM=clamp(Math.round(Math.min(118/COLS,46/ROWS)),2,5);
  mini.width=COLS*MM*dpr; mini.height=ROWS*MM*dpr;
  mini.style.width=(COLS*MM)+'px'; mini.style.height=(ROWS*MM)+'px';
}
layoutGrid(COLS,ROWS);

/* 迷宫塞进竖屏会小到点不准，所以只显示勇者附近一段，镜头跟着他走；
   小地图把可视范围放大一点，大地图把可视范围收一点。 */
const view={w:0,h:0,scale:1};
const cam={x:0,y:0,ready:false};
let VIGNETTE=null;

function measure(){
  const box=canvas.parentElement;
  const w=Math.max(1,box.clientWidth), h=Math.max(1,box.clientHeight);
  view.w=w; view.h=h;
  canvas.width=Math.round(w*dpr); canvas.height=Math.round(h*dpr);
  /* 上下两块 HUD 都是浮层：量出它们的下沿与上沿，中间那条带子才是迷宫能用的高度。 */
  const cr=canvas.getBoundingClientRect();
  const hud=document.querySelector('.hud-top');
  G.hudTop=hud?Math.max(0,hud.getBoundingClientRect().bottom-cr.top):0;
  const dock=document.querySelector('.hud-bottom');
  G.hudBottom=dock?Math.max(0,h-(dock.getBoundingClientRect().top-cr.top)):0;
  const basePx=clamp(Math.min(w/10,h/14),30,54)*(G.zoom||1);
  /* 小地图铺不满屏幕时按可用高度放大：上贴面板下沿、下抵工具栏上沿；
     横向至少留 7 列在画面里，免得镜头贴得太近。只放大，不缩小大地图。 */
  const availH=Math.max(140,h-(G.hudTop||0)-(G.hudBottom||0)-6);
  const fillPx=Math.min(availH/ROWS,Math.max(26,w/7));
  const px=Math.max(basePx,fillPx);
  view.scale=clamp(px,26,76)/TILE;
  makeVignette();
}
function makeVignette(){
  VIGNETTE=ctx.createRadialGradient(view.w/2,view.h*.44,Math.min(view.w,view.h)*.34,view.w/2,view.h*.52,Math.max(view.w,view.h)*.74);
  VIGNETTE.addColorStop(0,'rgba(10,24,21,0)');
  VIGNETTE.addColorStop(1,G.vigColor||'rgba(10,24,21,.45)');
}
function clampCam(){
  const vw=view.w/view.scale, vh=view.h/view.scale;
  cam.x=vw>=W?(W-vw)/2:clamp(cam.x,0,W-vw);
  if(vh>=H){
    /* 地图比屏幕矮时顶到顶部 HUD 的下沿，别让画面悬在半空。 */
    cam.y=-(G.hudTop+2)/view.scale;
  }else{
    cam.y=clamp(cam.y,0,H-vh);
  }
}
/* 镜头朝他前进的方向多探两格，岔口才来得及出现在画面里；玩家拖动时暂停跟随。 */
function followCam(dt,snap){
  if(!snap&&G.camFree) return;
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
  timeLbl:document.getElementById('timeLbl'), gapLbl:document.getElementById('gapLbl'),
  rockCnt:document.getElementById('rockCnt'), plankCnt:document.getElementById('plankCnt'), lightCnt:document.getElementById('lightCnt'),
  rockBtn:document.getElementById('toolRock'), plankBtn:document.getElementById('toolPlank'), lightBtn:document.getElementById('toolLight'),
  bombBtn:document.getElementById('toolBomb'), bombCnt:document.getElementById('bombCnt'),
  signBtn:document.getElementById('toolSign'), signCnt:document.getElementById('signCnt'),
  dirBar:document.getElementById('dirBar'),
  dirBtns:Array.prototype.slice.call(document.querySelectorAll('#dirBar [data-dir]')),
  gapTxt:document.getElementById('gapTxt'), gapFill:document.getElementById('gapFill'),
  pause:document.getElementById('btnPause'), restart:document.getElementById('btnRestart'),
  hint:document.getElementById('hint'), hintText:document.getElementById('hintText'),
  ov:document.getElementById('ov'), ovEyebrow:document.getElementById('ovEyebrow'),
  ovTitle:document.getElementById('ovTitle'), ovDesc:document.getElementById('ovDesc'),
  ovStats:document.getElementById('ovStats'), ovPrimary:document.getElementById('ovRetry'),
  ovSecondary:document.getElementById('ovNext'), ovMap:document.getElementById('ovMap'),
  mapBtn:document.getElementById('btnMap'),
  follow:document.getElementById('btnFollow'), help:document.getElementById('help'),
  helpBtn:document.getElementById('btnHelp'), helpClose:document.getElementById('helpClose')
};

const G={
  level:null, levelIndex:0, map:[], start:{x:1,y:1}, exit:null,
  mode:'chase', keyLeft:new Set(), keyTotal:0, doorOpen:true,
  portalTo:new Map(), portalFx:null,
  phase:'idle', paused:false, t:0, startAt:START, overlayOpen:false, overlayTimer:0,
  hero:{x:1,y:1,vx:1,vy:1,prevDir:null,from:{x:0,y:0},mode:'walk',nextAt:0,waitUntil:0,deadPending:null,slideDir:null,holdAfter:0},
  trail:[], monster:{index:0,vx:1,vy:1,nextAt:0},
  rocks:new Set(), planks:new Map(), rockFx:new Map(),
  blasts:new Map(), bombs:new Map(), broken:new Set(),
  signs:new Map(), signDir:'right',
  items:{rock:0,plank:0,light:0,bomb:0,sign:0}, tool:'rock',
  hover:null, shake:0, shakeCell:null, seen:new Set(), camFree:false,
  flags:{backtrack:0,waitMs:0},
  hintBase:'', hintTimer:0,
  bubble:{kind:null,at:0}, spikePop:null, helpOpen:false, wasPaused:false,
  lastPlace:0,
  filled:new Set(), mobs:[], poofs:new Map(), lightFx:-1e9, caughtBy:'', blastFx:-1e9,
  autoPrefs:{}, theme:null, bg:'#10231F', vigColor:'rgba(10,24,21,.45)', zoom:1, hudTop:0, hudBottom:0,
  hasMap:false, mapItem:null, vision:2,
  /* 总图：atlas=true 时主循环只画地图，游戏逻辑整体冻结。 */
  atlas:false, atlasCursor:null, atlasHoverAt:0, atlasLeaving:null, cleared:new Set()
};

function key(x,y){return x+','+y;}
function inb(x,y){return x>=0&&y>=0&&x<COLS&&y<ROWS;}
function cellAt(x,y){
  if(!inb(x,y)) return '#';
  const ch=G.map[y][x];
  /* c = 裂墙：看着是墙，炸弹能炸塌，塌了就变成普通地面。 */
  if(ch==='c'&&G.broken.has(key(x,y))) return '.';
  return ch;
}
function isHazard(ch){return ch==='~'||ch==='^';}
function isWall(x,y){
  const ch=cellAt(x,y);
  /* 锁门在钥匙捡齐前当墙用；开了门就是一块普通地面。 */
  return ch==='#'||ch==='c'||(ch==='d'&&!G.doorOpen);
}
function plankReady(x,y,now){const v=G.planks.get(key(x,y));return v!==undefined&&now>=v;}
function mobAt(x,y){return G.mobs.find(m=>m.alive&&m.x===x&&m.y===y)||null;}
function rockNear(x,y){
  for(const d in DIRS){
    const nx=x+DIRS[d][0], ny=y+DIRS[d][1];
    if(G.rocks.has(key(nx,ny))) return true;
  }
  return false;
}
function heroStepOpen(x,y,t){
  const ch=cellAt(x,y);
  if(ch==='~'||ch==='^') return plankReady(x,y,t);
  if(mobAt(x,y)) return false;
  if(G.bombs.has(key(x,y))) return false;
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

/* 钥匙、锁门、传送门、宝箱在开局时统计一次；宝箱与钥匙捡走后直接把地图字符改成地面。 */
function scanLevelTiles(){
  const one=[], two=[];
  G.keyLeft=new Set();
  G.portalTo=new Map(); G.portalFx=null;
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
    const c=G.map[y][x];
    if(c==='k') G.keyLeft.add(key(x,y));
    else if(c==='1') one.push({x,y});
    else if(c==='2') two.push({x,y});
  }
  G.keyTotal=G.keyLeft.size;
  G.doorOpen=G.keyTotal===0;
  const n=Math.min(one.length,two.length);
  for(let i=0;i<n;i++){
    G.portalTo.set(key(one[i].x,one[i].y),two[i]);
    G.portalTo.set(key(two[i].x,two[i].y),one[i]);
  }
}

/* 场景主题：换一套地形配色、页面底色与小地图底色。 */
function applyScene(){
  const th=G.theme, root=document.documentElement.style;
  G.bg=(th&&th.bg)||'#10231F';
  G.vigColor=(th&&th.vignette)||'rgba(10,24,21,.45)';
  Object.assign(C,BASE_C,(th&&th.palette)||{});
  root.setProperty('--board-bg',G.bg);
  root.setProperty('--scene-a',(th&&th.sceneA)||'#235049');
  root.setProperty('--scene-b',(th&&th.sceneB)||'#122E29');
  root.setProperty('--mini-bg',(th&&th.mini)||'rgba(9,24,21,.72)');
  makeVignette();
}

/* 没有手写偏好时，从终点反向做一次 BFS：勇者会沿着最短路朝出口走，
   玩家再用石头封路、用指示牌改道，才有得玩。 */
function prefWalkable(x,y){
  if(!inb(x,y)) return false;
  const ch=G.map[y][x];
  return ch!=='#'&&ch!=='c';
}
function buildAutoPrefs(){
  G.autoPrefs={};
  if(!G.exit) return;
  const dist=Array.from({length:ROWS},()=>Array(COLS).fill(-1));
  const par=Array.from({length:ROWS},()=>Array(COLS).fill(null));
  const q=[G.exit]; dist[G.exit.y][G.exit.x]=0;
  for(let i=0;i<q.length;i++){
    const {x,y}=q[i];
    for(const d of ['down','right','up','left']){
      const nx=x+DIRS[d][0], ny=y+DIRS[d][1];
      if(!prefWalkable(nx,ny)||dist[ny][nx]>=0) continue;
      dist[ny][nx]=dist[y][x]+1; par[ny][nx]=OPP[d]; q.push({x:nx,y:ny});
    }
  }
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
    if(!prefWalkable(x,y)||dist[y][x]<0) continue;
    const rest=['down','right','up','left']
      .filter(d=>d!==par[y][x]&&prefWalkable(x+DIRS[d][0],y+DIRS[d][1]))
      .sort((a,b)=>dist[y+DIRS[a][1]][x+DIRS[a][0]]-dist[y+DIRS[b][1]][x+DIRS[b][0]]);
    G.autoPrefs[key(x,y)]=(par[y][x]?[par[y][x]]:[]).concat(rest);
  }
}

/* 地图道具：沿勇者的偏好路线往前十几步，摆在必经的走廊上；
   捡到之前小地图不显示，捡到后才点亮。 */
function placeMapItem(){
  G.mapItem=null;
  if(!G.exit) return;
  let x=G.start.x, y=G.start.y;
  const route=[];
  for(let i=0;i<400;i++){
    if(x===G.exit.x&&y===G.exit.y) break;
    const dirs=G.autoPrefs[key(x,y)];
    if(!dirs||!dirs.length) break;
    const d=dirs[0];
    const nx=x+DIRS[d][0], ny=y+DIRS[d][1];
    if(!inb(nx,ny)||!prefWalkable(nx,ny)) break;
    x=nx; y=ny; route.push({x,y});
  }
  /* 尽量在第一个坑/尖刺之前让他拿到地图，否则常常还没捡到就出事了。 */
  let want=clamp(Math.round(route.length*.16),12,26);
  const hz=route.findIndex(c=>{const ch=G.map[c.y][c.x];return ch==='x'||ch==='o';});
  if(hz>=0) want=Math.min(want,Math.max(6,hz-2));
  const ok=(c)=>{
    const ch=G.map[c.y][c.x];
    if(ch!=='.'&&ch!=='=') return false;
    if(G.rocks.has(key(c.x,c.y))) return false;
    return !(G.mobs||[]).some(m=>m.x===c.x&&m.y===c.y);
  };
  let cell=null;
  for(let i=Math.min(want,route.length-1);i>=want-8&&i>=0;i--){
    if(ok(route[i])){ cell=route[i]; break; }
  }
  if(!cell) cell=route.find(ok)||null;
  if(!cell) return;
  G.map[cell.y][cell.x]='M';
  G.mapItem={x:cell.x,y:cell.y,taken:false};
}

function takeMapItem(x,y){
  G.mapItem.taken=true; G.hasMap=true;
  G.map[y][x]='.';
  G.poofs.set(key(x,y),{x,y,at:G.t});
  G.shake=3;
  mini.hidden=false;
  buildMini(); drawMini();
  say('捡到地图！小地图已经打开了。',false);
}

function startLevel(i){
  exitAtlas();
  G.levelIndex=i; G.level=LEVELS[i];
  layoutGrid(G.level.map[0].length,G.level.map.length);
  /* 小地图视野放宽，大地图稍微收紧，难度上来时压迫感更强。 */
  G.zoom=.72+.24*clamp((COLS-19)/28,0,1);
  /* 勇者视野固定 2 格：只看眼前两格，再远的死胡同看不到。 */
  G.vision=2;
  G.theme=(window.THEMES||{})[G.level.theme]||null;
  applyScene();
  measure();
  parseMap(G.level.map);
  scanLevelTiles();
  G.mode=G.level.mode==='timer'?'timer':'chase';
  G.phase='ready'; G.paused=false;
  G.t=0; G.startAt=START;
  G.hero={x:G.start.x,y:G.start.y,vx:G.start.x,vy:G.start.y,prevDir:null,from:{x:G.start.x,y:G.start.y},mode:'walk',nextAt:START+250,waitUntil:0,deadPending:null,slideDir:null,holdAfter:0};
  G.trail=[{x:G.start.x,y:G.start.y}];
  G.monster={index:0,vx:G.start.x,vy:G.start.y,nextAt:G.mode==='chase'?START+G.level.headStart:Infinity,stunUntil:0};
  G.rocks=new Set((G.level.rocks||[]).map(r=>key(r.x,r.y)));
  buildAutoPrefs();
  G.planks=new Map(); G.rockFx=new Map(); G.broken=new Set();
  G.signs=new Map(); G.signDir='right';
  G.blasts=new Map(); G.bombs=new Map(); G.blastFx=-1e9;
  G.filled=new Set(); G.poofs=new Map(); G.lightFx=-1e9; G.caughtBy=''; G.spikePop=null;
  G.mobs=(G.level.mobs||[]).map(m=>({x:m.x,y:m.y,axis:m.axis,min:m.min,max:m.max,speed:m.speed,dir:m.dir||1,alive:true,nextAt:START+250}));
  /* 每关都要重新捡一次地图：开局先把小地图藏起来。 */
  G.hasMap=false; G.mapItem=null; mini.hidden=true;
  placeMapItem();
  G.items={rock:G.level.rock,plank:G.level.plank,light:G.level.light||0,bomb:G.level.bomb||0,sign:G.level.sign||0};
  G.tool=G.items.rock>0?'rock':(G.items.plank>0?'plank':'rock');
  G.hover=null; G.shake=0; G.shakeCell=null; G.seen=new Set();
  G.camFree=false; if(el.follow) el.follow.hidden=true;
  G.helpOpen=false; G.wasPaused=false; if(el.help) el.help.classList.remove('show');
  G.flags={backtrack:0,waitMs:0};
  G.hintBase=G.mode==='timer'?'抢在倒计时前把他送出去':'盯住他头顶的箭头'; G.hintTimer=0;
  G.bubble={kind:null,at:0};
  G.lastPlace=0;
  el.lvlName.textContent=G.level.name.split('·')[1].trim();
  updateTools(); updateHud(); say(G.hintBase,false);
  cam.ready=false; followCam(0,true);
  buildMini();
  showOverlay({eyebrow:'LEVEL '+G.level.short+(G.theme?' · '+G.theme.label:''),title:G.level.name.split('·')[1].trim(),desc:G.level.target,stats:'',primary:null,secondary:null});
  G.overlayOpen=true;
  G.overlayTimer=setTimeout(()=>{hideOverlay();G.overlayOpen=false;},READY_MS);
}

function beginPlay(){
  G.phase='playing';
  G.hero.nextAt=G.t+300;
  G.monster.nextAt=G.mode==='chase'?G.t+G.level.headStart:Infinity;
  G.hintBase=G.level.target;
  say('勇者出发了。',false);
}

function updateTools(){
  el.rockCnt.textContent=G.items.rock;
  el.plankCnt.textContent=G.items.plank;
  el.lightCnt.textContent=G.items.light;
  if(el.bombCnt) el.bombCnt.textContent=G.items.bomb;
  if(el.signCnt) el.signCnt.textContent=G.items.sign;
  const avail={rock:G.items.rock>0,plank:G.items.plank>0,light:G.items.light>0,bomb:G.items.bomb>0,sign:G.items.sign>0};
  /* 用光的道具连图标一起收起来，HUD 只留还能用的东西。 */
  el.rockBtn.hidden=!avail.rock;
  el.plankBtn.hidden=!avail.plank;
  el.lightBtn.hidden=!avail.light;
  if(el.bombBtn) el.bombBtn.hidden=!avail.bomb;
  if(el.signBtn) el.signBtn.hidden=!avail.sign;
  if(!avail[G.tool]){
    const next=['rock','plank','bomb','sign'].find(t=>avail[t]);
    G.tool=next||'rock';
  }
  el.rockBtn.classList.toggle('on',G.tool==='rock');
  el.plankBtn.classList.toggle('on',G.tool==='plank');
  if(el.bombBtn) el.bombBtn.classList.toggle('on',G.tool==='bomb');
  if(el.signBtn) el.signBtn.classList.toggle('on',G.tool==='sign');
  /* 选中指示牌时才露出四方向选择条。 */
  if(el.dirBar){
    el.dirBar.hidden=G.tool!=='sign'||!avail.sign;
    for(const b of el.dirBtns) b.classList.toggle('on',b.getAttribute('data-dir')===G.signDir);
  }
}

function updateHud(){
  const ready=G.phase==='ready';
  if(G.mode==='timer'){
    /* 倒计时关：第一读数显示剩余时间，第二读数显示钥匙进度，进度条随剩余时间收缩。 */
    const limit=G.level.timeLimit||60000;
    const left=ready?limit/1000:Math.max(0,(limit-(G.t-G.startAt))/1000);
    el.timeLbl.textContent='剩余';
    el.time.textContent=left.toFixed(1)+'s';
    el.time.classList.toggle('warn',!ready&&left<=10);
    el.gapLbl.textContent='钥匙';
    const taken=G.keyTotal-G.keyLeft.size;
    el.gapTxt.textContent=G.keyTotal?taken+' / '+G.keyTotal:'—';
    el.gapTxt.classList.remove('warn');
    const ratio=ready?1:Math.max(0,left*1000/limit);
    el.gapFill.style.width=(ratio*100)+'%';
    el.gapFill.classList.toggle('warn',!ready&&left<=15);
    el.gapFill.classList.toggle('danger',!ready&&left<=7);
    el.pause.textContent=G.paused?'▶':'Ⅱ';
    return;
  }
  el.timeLbl.textContent='用时';
  const secs=Math.max(0,(G.t-G.startAt)/1000);
  el.time.textContent=secs.toFixed(1)+'s';
  el.time.classList.remove('warn');
  el.gapLbl.textContent='追击';
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
  el.hint.classList.add('show');
  clearTimeout(G.hintTimer);
  G.hintTimer=setTimeout(()=>{
    el.hint.classList.remove('show','err');
    el.hintText.textContent=G.hintBase;
  },2600);
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
  setBtn(el.ovMap,o.tertiary);
  el.ov.classList.add('show');
}
function hideOverlay(){el.ov.classList.remove('show');}
function optionsAt(x,y){
  const out=[];
  for(const d in DIRS){
    const nx=x+DIRS[d][0], ny=y+DIRS[d][1];
    if(!inb(nx,ny)||isWall(nx,ny)) continue;
    if(G.rocks.has(key(nx,ny))) continue;
    if(G.bombs.has(key(nx,ny))) continue;
    out.push({dir:d,x:nx,y:ny});
  }
  return out;
}

function prefOrder(x,y){
  const k=key(x,y);
  return (G.level.prefs&&G.level.prefs[k])||G.autoPrefs[k]||['down','right','up','left'];
}

function byPref(list,x,y){
  const order=prefOrder(x,y);
  return list.slice().sort((a,b)=>{
    const ia=order.indexOf(a.dir)<0?9:order.indexOf(a.dir);
    const ib=order.indexOf(b.dir)<0?9:order.indexOf(b.dir);
    return ia-ib;
  });
}

/* 勇者视野：从当前格朝某个方向往前看 vision 格。
   一路都是单行道、尽头又是墙，说明这条支路他一眼就能看穿是死胡同；
   尽头要是终点、钥匙、宝箱、地图或传送门，那还是值得走一趟。 */
function visionDeadEnd(x,y,dir){
  const vision=G.vision||2;
  let fx=x, fy=y;
  let cx=x+DIRS[dir][0], cy=y+DIRS[dir][1];
  for(let i=0;i<vision;i++){
    if(!inb(cx,cy)||isWall(cx,cy)||G.rocks.has(key(cx,cy))||mobAt(cx,cy)) return true;
    let next=null, exits=0;
    for(const d in DIRS){
      const nx=cx+DIRS[d][0], ny=cy+DIRS[d][1];
      if(nx===fx&&ny===fy) continue;
      if(!inb(nx,ny)||isWall(nx,ny)||G.rocks.has(key(nx,ny))) continue;
      exits++;
      if(!next) next={x:nx,y:ny};
    }
    if(exits>=2) return false;
    if(exits===0){
      const ch=cellAt(cx,cy);
      return !(ch==='E'||ch==='k'||ch==='t'||ch==='M'||ch==='1'||ch==='2');
    }
    fx=cx; fy=cy; cx=next.x; cy=next.y;
  }
  return false;
}

/* 勇者只认自己眼前的偏好：岔口立了指示牌，就先照箭头走；箭头那条过不去，才退回原本的偏好。 */
function pickOption(opts){
  const h=G.hero;
  const sign=G.signs.get(key(h.x,h.y));
  if(sign){
    const want=opts.find(o=>o.dir===sign.dir);
    if(want) return want;
  }
  const notBack=opts.filter(o=>!(o.x===h.from.x&&o.y===h.from.y));
  const pool=notBack.length?notBack:opts;
  const sorted=byPref(pool,h.x,h.y);
  /* 视野里已经看穿的死路先不走；实在只剩死路，才硬着头皮进去。 */
  const sane=sorted.filter(o=>!visionDeadEnd(h.x,h.y,o.dir));
  return (sane.length?sane:sorted)[0]||null;
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
  const k=key(o.x,o.y), ch=cellAt(o.x,o.y);
  /* 坑与尖刺都不挡路：他照样走上去，只有天神提前处理才不会出事。 */
  if(ch==='x'&&!plankReady(o.x,o.y,G.t)){
    G.spikePop={x:o.x,y:o.y,at:performance.now()};
    G.caughtBy='spike'; caught(); return;
  }
  if(ch==='o'&&!G.filled.has(k)&&!plankReady(o.x,o.y,G.t)){
    G.caughtBy='pit'; caught(); return;
  }
  if(ch==='k') takeKey(o.x,o.y);
  if(ch==='t') takeChest(o.x,o.y);
  if(ch==='M') takeMapItem(o.x,o.y);
  if(ch==='1'||ch==='2'){
    const to=G.portalTo.get(k);
    if(to){
      h.x=to.x; h.y=to.y;
      h.from={x:to.x,y:to.y};
      G.trail.push({x:to.x,y:to.y});
      G.portalFx={from:{x:o.x,y:o.y},to:{x:to.x,y:to.y},at:G.t};
      h.holdAfter=PORTAL_HOLD;
      G.shake=2;
      say('穿过传送门，他一眨眼就到了另一头。',false);
      if(G.exit&&to.x===G.exit.x&&to.y===G.exit.y) win();
      return;
    }
  }
  if(G.exit&&o.x===G.exit.x&&o.y===G.exit.y) win();
}

function takeKey(x,y){
  const k=key(x,y);
  if(!G.keyLeft.has(k)) return;
  G.keyLeft.delete(k);
  G.map[y][x]='.';
  buildMini();
  if(G.keyLeft.size>0){
    say('捡到一把钥匙，还差 '+G.keyLeft.size+' 把才开得了锁门。',false);
  }else if(G.keyTotal>0){
    G.doorOpen=true;
    say('钥匙齐了，锁门打开了。',false);
  }
  updateHud();
}

function takeChest(x,y){
  const bonus=G.level.chest||{}, cn={plank:'木板',rock:'落石',light:'圣光',bomb:'炸弹',sign:'指示牌'};
  const parts=[];
  G.map[y][x]='.';
  for(const p in bonus){
    const n=bonus[p];
    if(!n) continue;
    G.items[p]=(G.items[p]||0)+n;
    parts.push((cn[p]||p)+' +'+n);
  }
  G.shake=4;
  buildMini(); updateTools(); updateHud();
  say(parts.length?'宝箱打开了：'+parts.join('，')+'。':'宝箱是空的。',!parts.length);
}

function advanceAfterStep(t){
  const h=G.hero;
  const hold=h.holdAfter||0; h.holdAfter=0;
  if(cellAt(h.x,h.y)==='i'){
    /* 踩上冰面就顺着同一方向滑，直到撞上东西才恢复自己选路。 */
    h.mode='slide'; h.slideDir=h.prevDir; h.nextAt=t+SLIDE_STEP+hold;
  }else{
    h.mode='walk'; h.slideDir=null; h.nextAt=t+heroStepDelay(t)+hold;
  }
  h.waitUntil=0;
}

function heroTick(){
  if(G.phase!=='playing') return;
  const h=G.hero, t=G.t;
  if(t<h.waitUntil||t<h.nextAt) return;
  if(h.deadPending){
    const o=h.deadPending; h.deadPending=null;
    moveHero(o); if(G.phase!=='playing')return;
    advanceAfterStep(t);
    return;
  }
  if(h.mode==='slide'){
    const d=h.slideDir||h.prevDir||'right';
    const nx=h.x+DIRS[d][0], ny=h.y+DIRS[d][1];
    const hazardCell=inb(nx,ny)&&(cellAt(nx,ny)==='o'||cellAt(nx,ny)==='x')&&!plankReady(nx,ny,t);
    /* 坑和尖刺拦不住滑行：滑过去就会出事；其它过不去的地形才会让他停下来。 */
    if(!hazardCell){
      if(!inb(nx,ny)||isWall(nx,ny)||G.rocks.has(key(nx,ny))||G.bombs.has(key(nx,ny))||mobAt(nx,ny)||!heroStepOpen(nx,ny,t)){
        h.mode='walk'; h.slideDir=null; h.nextAt=t+heroStepDelay(t); h.waitUntil=0;
        return;
      }
    }
    moveHero({dir:d,x:nx,y:ny});
    if(G.phase!=='playing') return;
    advanceAfterStep(t);
    return;
  }
  const opts=optionsAt(h.x,h.y);
  const fresh=opts.filter(o=>!(o.x===h.from.x&&o.y===h.from.y));
  /* 前面被石头压住、又没有别的岔路：他停住等，而不是掉头乱撞。 */
  if(!fresh.length&&rockNear(h.x,h.y)){
    h.mode='blocked'; h.waitUntil=t+RETRY; G.flags.waitMs+=RETRY;
    say('石头挡住了他的路，用炸弹炸开。',false);
    return;
  }
  if(!opts.length){
    h.mode='blocked'; h.waitUntil=t+RETRY; G.flags.waitMs+=RETRY;
    return;
  }
  const k=key(h.x,h.y);
  /* 只在「岔口、且那条死路还开着」时犹豫：给玩家一个封路的窗口；
     要是这里已经立了指示牌，他一眼就知道往哪走，省掉思考的时间。 */
  const forkDir=G.level.forks&&G.level.forks[k];
  if(forkDir&&!G.seen.has(k)&&opts.some(o=>o.dir===forkDir)&&!G.signs.has(k)){
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
  if(G.phase!=='playing') return;
  advanceAfterStep(t);
}

function monsterTick(){
  if(G.phase!=='playing'||G.mode!=='chase') return;
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
  if(G.phase!=='playing'||G.mode!=='chase') return;
  if(G.t<G.startAt+G.level.headStart) return;
  const m=monsterPos(), h=G.hero;
  if(m.x===h.x&&m.y===h.y){G.caughtBy='big';caught();}
}

/* 炸弹占格 3 秒，然后炸掉九格里的墙、石头与小怪；勇者在范围内同样会被波及。 */
function bombsTick(){
  if(G.phase!=='playing') return;
  for(const pair of G.bombs){
    if(G.t>=pair[1].at){ detonate(pair[1],pair[0]); if(G.phase!=='playing') return; }
  }
  for(const pair of G.blasts){ if(G.t-pair[1].at>700) G.blasts.delete(pair[0]); }
}
/* 炸弹只炸得开石头，炸不穿石墙：围墙是迷宫本身，石头才是真能清掉的路障。 */
function detonate(b,k){
  const t=G.t;
  G.bombs.delete(k);
  let cleared=0, cracked=0;
  for(let dy=-b.r;dy<=b.r;dy++)for(let dx=-b.r;dx<=b.r;dx++){
    const x=b.x+dx, y=b.y+dy;
    if(!inb(x,y)) continue;
    const ck=key(x,y);
    G.blasts.set(ck,{x,y,at:t});
    if(G.rocks.has(ck)){ G.rocks.delete(ck); cleared++; }
    if(G.map[y][x]==='c'&&!G.broken.has(ck)){ G.broken.add(ck); cracked++; }
  }
  for(const m of G.mobs){
    if(m.alive&&Math.abs(m.x-b.x)<=b.r&&Math.abs(m.y-b.y)<=b.r){
      m.alive=false; G.poofs.set(key(m.x,m.y),{x:m.x,y:m.y,at:t});
    }
  }
  G.blastFx=t; G.shake=11;
  buildMini();
  const h=G.hero;
  if(Math.abs(h.x-b.x)<=b.r&&Math.abs(h.y-b.y)<=b.r){
    G.caughtBy='bomb'; caught(); return;
  }
  say(cleared&&cracked?'轰！石头清开了，裂墙也塌了。':
      cracked?'轰！裂墙塌了，一条新路开了。':
      cleared?'轰！堵路的石头被炸开了。':'轰——石墙纹丝不动。',false);
}

function win(){
  if(G.phase!=='playing') return;
  G.phase='won'; G.hero.mode='done';
  G.cleared.add(G.levelIndex);
  hideOverlay(); G.overlayOpen=true;
  say('他安全抵达了！',false);
  const secs=((G.t-G.startAt)/1000).toFixed(1);
  const next=LEVELS[G.levelIndex+1];
  let stats;
  if(G.mode==='timer'){
    const limit=(G.level.timeLimit||60000)/1000;
    const left=Math.max(0,limit-((G.t-G.startAt)/1000)).toFixed(1);
    stats='<div><b>'+secs+'s</b>用时</div><div><b>'+left+'s</b>剩余时间</div>'+
      (G.keyTotal?'<div><b>'+(G.keyTotal-G.keyLeft.size)+' / '+G.keyTotal+'</b>钥匙</div>':'');
  }else{
    stats='<div><b>'+secs+'s</b>用时</div><div><b>'+G.items.rock+'</b>剩余落石</div><div><b>'+G.items.plank+'</b>剩余木板</div><div><b>'+G.items.light+'</b>剩余圣光</div>';
  }
  const retry={label:'再走一次',fn:()=>{hideOverlay();startLevel(G.levelIndex);}};
  setTimeout(()=>{
    showOverlay({
      eyebrow:'LEVEL CLEAR',
      title:'抵达终点',
      desc:'勇者安全走进了光里。',
      stats:stats,
      primary:next?{label:'下一关',fn:()=>{hideOverlay();startLevel(G.levelIndex+1);}}:retry,
      secondary:next?retry:null,
      tertiary:{label:'返回关卡地图',fn:()=>{hideOverlay();G.overlayOpen=false;openAtlas();}}
    });
  },600);
}

function timeUp(){
  if(G.phase!=='playing') return;
  G.phase='lost'; G.hero.mode='caught'; G.shake=6;
  hideOverlay(); G.overlayOpen=true;
  say('倒计时走完了。',true);
  const secs=((G.t-G.startAt)/1000).toFixed(1);
  const taken=G.keyTotal-G.keyLeft.size;
  setTimeout(()=>{
    showOverlay({
      eyebrow:'TIME UP',
      title:'倒计时走完了',
      desc:'时间到，他还困在迷宫里。'+(G.level.failHint||''),
      stats:'<div><b>'+secs+'s</b>坚持了</div>'+(G.keyTotal?'<div><b>'+taken+' / '+G.keyTotal+'</b>钥匙</div>':''),
      primary:{label:'再试一次',fn:()=>{hideOverlay();startLevel(G.levelIndex);}},
      secondary:null,
      tertiary:{label:'返回关卡地图',fn:()=>{hideOverlay();G.overlayOpen=false;openAtlas();}}
    });
  },700);
}

function caught(){
  if(G.phase!=='playing') return;
  G.phase='lost'; G.hero.mode='caught'; G.shake=9;
  hideOverlay(); G.overlayOpen=true;
  say(G.caughtBy==='mob'?'被小怪扑倒了！':G.caughtBy==='spike'?'尖刺弹起来了！':G.caughtBy==='pit'?'他掉进坑里了！':G.caughtBy==='bomb'?'炸弹把他卷进去了！':'被抓住了！',true);
  setTimeout(()=>{
    let title='被追上了',desc='怪物贴得太近了。';
    if(G.caughtBy==='spike'){
      title='尖刺刺穿了他';
      desc='他踩上那块地砖，尖刺才弹起来。';
    }else if(G.caughtBy==='pit'){
      title='掉进了深坑';
      desc='那里还没填上石头，也没有木板。';
    }else if(G.caughtBy==='bomb'){
      title='被炸飞了';
      desc='爆炸时他正好站在九格之内。';
    }else if(G.caughtBy==='mob'){
      title='小怪拦住了他';
      desc='他一头撞进了巡逻线。';
    }else if(G.mode==='timer'){
      title='勇者倒下了';
      desc='这一关全靠他自己走完。';
    }else if(G.flags.backtrack>0){
      title='走错路了';
      desc='他绕进死路折返，被从背后追上。';
    }else if(G.flags.waitMs>=3000){
      title='耽搁太久';
      desc='他在危险地形前停得太久。';
    }
    const secs=((G.t-G.startAt)/1000).toFixed(1);
    const stats=G.mode==='timer'
      ? '<div><b>'+secs+'s</b>坚持了</div>'+(G.keyTotal?'<div><b>'+(G.keyTotal-G.keyLeft.size)+' / '+G.keyTotal+'</b>钥匙</div>':'')
      : '<div><b>'+secs+'s</b>坚持了</div><div><b>'+gap()+' 格</b>最后距离</div>';
    showOverlay({
      eyebrow:'LEVEL FAILED',
      title:title,
      desc:desc+G.level.failHint,
      stats:stats,
      primary:{label:'重试本关',fn:()=>{hideOverlay();startLevel(G.levelIndex);}},
      secondary:null,
      tertiary:{label:'返回关卡地图',fn:()=>{hideOverlay();G.overlayOpen=false;openAtlas();}}
    });
  },800);
}

function canPlace(x,y){
  if(!inb(x,y)) return {ok:false,reason:'不在地图里'};
  if(G.phase!=='playing'||G.paused) return {ok:false,reason:'现在不能放置'};
  const k=key(x,y), ch=cellAt(x,y);
  if(G.tool==='rock'){
    if(G.items.rock<=0) return {ok:false,reason:'落石用完了'};
    if(ch==='#'||ch==='c') return {ok:false,reason:'墙面上放不住石头'};
    if(G.rocks.has(k)||G.planks.has(k)||G.bombs.has(k)) return {ok:false,reason:'这里已经有东西了'};
    if(ch==='~'||ch==='^') return {ok:false,reason:'石头会沉下去，那里要用木板'};
    if(ch==='m') return {ok:false,reason:'石头会陷进泥里，用木板铺平它'};
    if(ch==='x') return {ok:false,reason:'尖刺会顶开落石，换木板盖住它'};
    if(ch==='=') return {ok:false,reason:'这里是必经之路，堵住他会困死'};
    if(ch==='S'||ch==='E'||ch==='k'||ch==='d'||ch==='t'||ch==='1'||ch==='2'||ch==='M') return {ok:false,reason:'关键位置不能堵'};
    if(ch==='o'&&G.filled.has(k)) return {ok:false,reason:'这个坑已经填好了'};
    if(G.hero.x===x&&G.hero.y===y) return {ok:false,reason:'不能砸到他'};
    const m=G.mode==='timer'?null:monsterPos();
    if(m&&m.x===x&&m.y===y) return {ok:false,reason:'大怪物挡住了落点'};
    return {ok:true};
  }
  if(G.tool==='bomb'){
    if(G.items.bomb<=0) return {ok:false,reason:'炸弹用完了'};
    if(G.bombs.has(k)) return {ok:false,reason:'这一格已经有炸弹'};
    if(ch==='#'||ch==='c') return {ok:false,reason:'炸弹放到旁边才能崩开它'};
    if(ch==='~'||ch==='^') return {ok:false,reason:'水里点不着火'};
    if(ch==='o') return {ok:false,reason:'坑里放不稳'};
    if(ch==='S'||ch==='E'||ch==='k'||ch==='d'||ch==='t'||ch==='1'||ch==='2'||ch==='M') return {ok:false,reason:'关键位置不能放'};
    if(G.rocks.has(k)||G.planks.has(k)) return {ok:false,reason:'这一格已经有东西了'};
    const mp=G.mode==='timer'?null:monsterPos();
    if((G.hero.x===x&&G.hero.y===y)||(mp&&mp.x===x&&mp.y===y)) return {ok:false,reason:'不能直接放在脚下'};
    if(mobAt(x,y)) return {ok:false,reason:'小怪正踩在这一格'};
    return {ok:true};
  }
  if(G.tool==='sign'){
    const has=G.signs.has(k);
    if(G.items.sign<=0&&!has) return {ok:false,reason:'指示牌用完了'};
    if(ch==='#'||ch==='c') return {ok:false,reason:'墙面上立不住指示牌'};
    if(ch==='~'||ch==='^'||ch==='o'||ch==='x'||ch==='m') return {ok:false,reason:'指示牌要立在平整的地面上'};
    if(ch==='i') return {ok:false,reason:'冰面上立不住指示牌'};
    if(ch==='S'||ch==='E'||ch==='k'||ch==='d'||ch==='t'||ch==='1'||ch==='2'||ch==='M') return {ok:false,reason:'关键位置不能立牌'};
    if(G.rocks.has(k)||G.planks.has(k)||G.bombs.has(k)) return {ok:false,reason:'这一格已经有东西了'};
    if(G.hero.x===x&&G.hero.y===y) return {ok:false,reason:'不能立在他脚下'};
    const mp=G.mode==='timer'?null:monsterPos();
    if(mp&&mp.x===x&&mp.y===y) return {ok:false,reason:'大怪物挡住了落点'};
    if(mobAt(x,y)) return {ok:false,reason:'小怪正踩在这一格'};
    return {ok:true};
  }
  if(G.items.plank<=0) return {ok:false,reason:'木板用完了'};
  if(ch!=='~'&&ch!=='^'&&ch!=='x'&&ch!=='m'&&ch!=='o') return {ok:false,reason:'木板只能架在水面、熔岩、尖刺、泥沼或深坑上'};
  if(G.planks.has(k)) return {ok:false,reason:'这里已经铺好了'};
  if(G.bombs.has(k)) return {ok:false,reason:'炸弹正占着这一格'};
  if(ch==='o'&&G.filled.has(k)) return {ok:false,reason:'这个坑已经填好了'};
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
    G.bombs.set(k,{x,y,at:t+BOMB_FUSE,r:BLAST_R});
    G.shake=4; G.shakeCell=null;
    say('炸弹占住了这一格，3 秒后爆炸。',false);
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
  }else if(G.tool==='sign'){
    const had=G.signs.has(k);
    if(!had) G.items.sign--;
    G.signs.set(k,{dir:G.signDir,at:t});
    G.shake=2; G.shakeCell=null;
    say(had?'指示牌改指向「'+DIR_CN[G.signDir]+'」。':'指示牌立好了，他会照着「'+DIR_CN[G.signDir]+'」走。',false);
  }else{
    G.items.plank--;
    const built=t+PLANK_BUILD;
    G.planks.set(k,built);
    if(Math.abs(G.hero.x-x)+Math.abs(G.hero.y-y)<=1) G.hero.waitUntil=Math.max(G.hero.waitUntil,built+RESUME);
    say(ch==='x'?'木板盖住了尖刺。':ch==='m'?'木板铺平了泥沼。':ch==='o'?'木板架住了深坑。':'木板铺好了。',false);
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
  if(tool==='sign'&&G.items.sign<=0){say('指示牌用完了',true);return;}
  G.tool=tool; updateTools();
}

function castLight(){
  if(G.phase!=='playing'||G.paused||G.overlayOpen) return;
  if(G.mode!=='chase'){say('这一关没有大怪物，圣光用不上。',true);return;}
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
      eyebrow:'PAUSED',title:'暂停',desc:'拖动画布可以先看路线；石头封路、木板过险地、圣光定住怪物，点右上角 ? 看全部效果。',
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
el.signBtn.onclick=()=>setTool('sign');
if(el.dirBar) el.dirBtns.forEach(b=>{
  b.onclick=()=>{
    const d=b.getAttribute('data-dir');
    if(!DIRS[d]) return;
    G.signDir=d;
    if(G.tool==='sign'||G.items.sign>0) setTool('sign');
    updateTools();
  };
});
el.pause.onclick=()=>{ if(G.phase==='playing'&&!G.overlayOpen&&!G.helpOpen) togglePause(); };
el.ov.addEventListener('click',()=>{
  if(G.phase==='ready'){clearTimeout(G.overlayTimer);hideOverlay();G.overlayOpen=false;beginPlay();}
});
el.restart.onclick=()=>{ clearTimeout(G.overlayTimer); hideOverlay(); G.overlayOpen=false; G.paused=false; startLevel(G.levelIndex); };
/* 顶栏的地图键：随时退回总图，再点徽章换一关。 */
if(el.mapBtn) el.mapBtn.onclick=()=>{ if(!G.atlas) openAtlas(); };

/* 拖动过地图后，点一下就把镜头交还给勇者。 */
if(el.follow) el.follow.onclick=()=>{
  G.camFree=false; el.follow.hidden=true; followCam(0,true);
};

/* 帮助面板：打开时冻结时间，关掉后回到原来的状态。 */
function openHelp(){
  if(!el.help||G.helpOpen) return;
  G.helpOpen=true; G.wasPaused=G.paused;
  G.paused=true; updateHud();
  el.help.classList.add('show');
}
function closeHelp(){
  if(!el.help||!G.helpOpen) return;
  G.helpOpen=false; el.help.classList.remove('show');
  G.paused=G.wasPaused; G.wasPaused=false;
  updateHud();
}
if(el.helpBtn) el.helpBtn.onclick=openHelp;
if(el.helpClose) el.helpClose.onclick=closeHelp;
if(el.help) el.help.addEventListener('click',e=>{ if(e.target===el.help) closeHelp(); });

/* 单指拖动 = 平移地图（方便天神提前规划线路）；轻点 = 落子。 */
let drag=null;
canvas.addEventListener('pointerdown',e=>{
  if(G.atlas){ atlasPress={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false}; try{canvas.setPointerCapture(e.pointerId);}catch(err){} return; }
  if(G.overlayOpen||G.paused) return;
  if(e.pointerType==='touch') G.hover=null;
  drag={id:e.pointerId,sx:e.clientX,sy:e.clientY,x:e.clientX,y:e.clientY,moved:false};
  try{canvas.setPointerCapture(e.pointerId);}catch(err){}
});
canvas.addEventListener('pointermove',e=>{
  if(G.atlas){
    if(atlasPress&&atlasPress.id===e.pointerId&&Math.hypot(e.clientX-atlasPress.x,e.clientY-atlasPress.y)>10) atlasPress.moved=true;
    atlasPointerMove(e.clientX,e.clientY);
    return;
  }
  if(drag&&drag.id===e.pointerId){
    if(!drag.moved){
      if(Math.hypot(e.clientX-drag.sx,e.clientY-drag.sy)<10) return;
      drag.moved=true; G.camFree=true; G.hover=null;
      if(el.follow) el.follow.hidden=false;
    }
    cam.x-=(e.clientX-drag.x)/view.scale;
    cam.y-=(e.clientY-drag.y)/view.scale;
    drag.x=e.clientX; drag.y=e.clientY;
    clampCam();
    return;
  }
  if(e.pointerType==='touch') return;
  G.hover=canvasCell(e);
});
canvas.addEventListener('pointerup',e=>{
  if(G.atlas){
    const p=atlasPress; atlasPress=null;
    if(!p||p.id!==e.pointerId||p.moved) return;
    try{canvas.releasePointerCapture(e.pointerId);}catch(err){}
    atlasTap(e.clientX,e.clientY);
    return;
  }
  if(!drag||drag.id!==e.pointerId) return;
  const d=drag; drag=null;
  try{canvas.releasePointerCapture(e.pointerId);}catch(err){}
  if(d.moved||G.overlayOpen||G.paused) return;
  const c=canvasCell(e);
  place(c.x,c.y);
});
canvas.addEventListener('pointercancel',e=>{
  if(G.atlas){ atlasPress=null; return; }
  if(drag&&drag.id===e.pointerId) drag=null;
});
canvas.addEventListener('pointerleave',()=>{
  if(G.atlas){ atlasPointerOut(); return; }
  G.hover=null;
});

document.addEventListener('keydown',e=>{
  if(G.atlas){ atlasKey(e); return; }
  if(G.helpOpen){ if(e.key===' '||e.key==='Escape'||e.key==='?'){e.preventDefault();closeHelp();} return; }
  if(e.key==='1'){setTool('rock');return;}
  if(e.key==='2'){setTool('plank');return;}
  if(e.key==='3'){castLight();return;}
  if(e.key==='4'){setTool('bomb');return;}
  if(e.key==='5'){setTool('sign');return;}
  if(e.key==='m'||e.key==='M'){openAtlas();return;}
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
  if(G.atlas) return;
  if(document.hidden&&G.phase==='playing'&&!G.paused) togglePause();
});
window.addEventListener('blur',()=>{
  if(G.atlas) return;
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

function drawSpikes(px,py,x,y){
  if(plankReady(x,y,G.t)) return;
  const pop=G.spikePop&&G.spikePop.x===x&&G.spikePop.y===y?G.spikePop:null;
  const up=pop?clamp((performance.now()-pop.at)/140,0,1):0;
  const base=py+TILE-11;
  fillRR(px+5,py+6,TILE-10,TILE-12,7,'rgba(64,76,72,.16)');
  ctx.strokeStyle='rgba(44,58,54,.32)'; ctx.lineWidth=1.4;
  for(let i=0;i<4;i++){
    const cx=px+15+i*9.6;
    ctx.beginPath();ctx.ellipse(cx,base-1.5,4.6,2.8,0,0,Math.PI*2);ctx.stroke();
  }
  for(let i=0;i<4;i++){
    const cx=px+15+i*9.6;
    const tip=base-(6+up*30);
    ctx.beginPath();
    ctx.moveTo(cx-4.4,base); ctx.lineTo(cx,tip); ctx.lineTo(cx+4.4,base); ctx.closePath();
    ctx.fillStyle=up>0?'#CBD4D6':'#9FA9AC'; ctx.fill();
    ctx.strokeStyle=C.ink; ctx.lineWidth=1.7; ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,.7)'; ctx.lineWidth=1.1;
    ctx.beginPath(); ctx.moveTo(cx-2,tip+3); ctx.lineTo(cx-1.2,base-2); ctx.stroke();
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
    drawPlankBody();
    ctx.restore();
  });
}

/* 铺好的木板本体；预览也调用同一个函数，保证位置、尺寸、木纹与实物一致。 */
function drawPlankBody(alpha){
  ctx.save();
  if(alpha!==undefined) ctx.globalAlpha=alpha;
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
}

/* 指示牌：插在岔口的木牌，箭头指向勇者下一步该走的方向。 */
function drawSign(cx,cy,dir,now,alpha){
  const a=alpha===undefined?1:alpha;
  ctx.save();
  ctx.globalAlpha=a;
  ctx.translate(cx,cy);
  ctx.fillStyle='rgba(20,34,30,.22)';
  ctx.beginPath(); ctx.ellipse(0,19,15,5.5,0,0,Math.PI*2); ctx.fill();
  ctx.save();
  ctx.translate(0,3);
  ctx.rotate(Math.sin(now/700+cx*.05)*.04);
  ctx.lineCap='round';
  ctx.strokeStyle='#6B4A2B'; ctx.lineWidth=5;
  ctx.beginPath(); ctx.moveTo(0,17); ctx.lineTo(0,-6); ctx.stroke();
  ctx.strokeStyle='#B57B44'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(-1.4,16); ctx.lineTo(-1.4,-6); ctx.stroke();
  const bw=34, bh=26, by=-16;
  fillRR(-bw/2+1.5,by+2,bw,bh,7,'rgba(20,34,30,.22)');
  fillRR(-bw/2,by,bw,bh,7,'#C48D52');
  strokeRR(-bw/2,by,bw,bh,7,'#6B4A2B',2);
  ctx.strokeStyle='rgba(126,81,41,.5)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(-bw/2+4,by+6); ctx.lineTo(bw/2-4,by+6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-bw/2+4,by+bh-5); ctx.lineTo(bw/2-4,by+bh-5); ctx.stroke();
  ctx.save();
  ctx.translate(0,by+bh/2);
  ctx.rotate(DIR_ANGLE[dir]||0);
  ctx.fillStyle='#2E6B63';
  ctx.beginPath();
  ctx.moveTo(-6,-2.6); ctx.lineTo(2,-2.6); ctx.lineTo(2,-7.4); ctx.lineTo(11,0);
  ctx.lineTo(2,7.4); ctx.lineTo(2,2.6); ctx.lineTo(-6,2.6); ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle='#8A6A44';
  ctx.beginPath(); ctx.arc(-bw/2+4,by+bh/2,1.6,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(bw/2-4,by+bh/2,1.6,0,Math.PI*2); ctx.fill();
  ctx.restore();
  ctx.restore();
}

function drawSigns(now){
  G.signs.forEach((s,k)=>{
    const p=k.split(','), x=+p[0], y=+p[1];
    drawSign(x*TILE+TILE/2,y*TILE+TILE/2,s.dir,now,1);
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
/* 炸弹占住一格：虚线框出九格波及范围，右上角显示剩余秒数。 */
function drawBombs(t){
  ctx.save();
  G.bombs.forEach(b=>{
    const px=b.x*TILE, py=b.y*TILE;
    const left=Math.max(0,b.at-t);
    const p=clamp(1-left/BOMB_FUSE,0,1);
    const blink=.5+.5*Math.sin(t/(90+p*70));
    const rx=px-b.r*TILE, ry=py-b.r*TILE, rw=(b.r*2+1)*TILE, rh=(b.r*2+1)*TILE;

    ctx.fillStyle='rgba(226,72,46,'+(.05+p*.10)+')';
    ctx.fillRect(rx,ry,rw,rh);
    ctx.fillStyle='rgba(226,72,46,'+(.06+p*.14)+')';
    ctx.fillRect(px+1.5,py+1.5,TILE-3,TILE-3);
    ctx.save();
    ctx.setLineDash([9,7]); ctx.lineDashOffset=-t/36;
    ctx.strokeStyle='rgba(240,120,84,'+(.28+blink*.34+p*.16)+')';
    ctx.lineWidth=2.2;
    ctx.strokeRect(rx+1.5,ry+1.5,rw-3,rh-3);
    ctx.restore();

    const cx=px+TILE/2, cy=py+TILE/2+Math.sin(t/170)*1.4;
    ctx.fillStyle='rgba(16,26,24,.28)';
    ctx.beginPath(); ctx.ellipse(cx,py+TILE-9,15,5.5,0,0,Math.PI*2); ctx.fill();

    const g=ctx.createRadialGradient(cx-6,cy-7,3,cx,cy,17);
    g.addColorStop(0,'#6E7270'); g.addColorStop(.55,'#40443F'); g.addColorStop(1,'#1E211F');
    ctx.beginPath(); ctx.arc(cx,cy,15,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
    ctx.strokeStyle=C.ink; ctx.lineWidth=2.4; ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,.30)';
    ctx.beginPath(); ctx.ellipse(cx-5,cy-6,5,3.4,-.7,0,Math.PI*2); ctx.fill();

    ctx.strokeStyle='#B57B44'; ctx.lineWidth=2.6; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(cx+8,cy-11); ctx.quadraticCurveTo(cx+14,cy-18,cx+11,cy-24); ctx.stroke();
    const sp=.6+.4*Math.sin(t/70);
    star(cx+11,cy-26,2.6+sp*1.6,'#FFD68A');
    star(cx+11,cy-26,1.5,'#FFF6D2');

    const badge=px+TILE-10, badgeY=py+10;
    ctx.beginPath(); ctx.arc(badge,badgeY,10,0,Math.PI*2);
    ctx.fillStyle='rgba(14,26,23,.92)'; ctx.fill();
    ctx.strokeStyle='rgba(240,197,120,'+(.6+.35*blink)+')'; ctx.lineWidth=1.6; ctx.stroke();
    ctx.fillStyle='#F7E6BE';
    ctx.font='700 15px '+FONT_BODY;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(String(Math.max(1,Math.ceil(left/1000))),badge,badgeY+.5);
  });
  ctx.restore();
}

/* 裂墙：带裂纹的石壁，颜色比墙浅，裂缝里透一点暖光，提示这堵墙可以炸。 */
function drawCrackedWall(px,py,x,y){
  fillRR(px+1,py+1,TILE-2,TILE-2,8,'#24403A');
  fillRR(px+3,py+3,TILE-6,TILE-6,7,'#3F6057');
  fillRR(px+7,py+5,TILE-14,5,2.5,'rgba(255,255,255,.13)');
  ctx.lineCap='round';
  ctx.strokeStyle='rgba(16,28,25,.78)'; ctx.lineWidth=2.4;
  ctx.beginPath();
  ctx.moveTo(px+14,py+10);
  ctx.lineTo(px+22,py+20);
  ctx.lineTo(px+18,py+30);
  ctx.lineTo(px+28,py+44);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(px+22,py+20);
  ctx.lineTo(px+33,py+15);
  ctx.lineTo(px+42,py+24);
  ctx.stroke();
  ctx.lineWidth=1.3;
  ctx.beginPath();
  ctx.moveTo(px+18,py+30);
  ctx.lineTo(px+30,py+34);
  ctx.lineTo(px+37,py+46);
  ctx.stroke();
  ctx.strokeStyle='rgba(240,197,120,'+(.13+.09*Math.sin(G.t/360+x*2+y))+')';
  ctx.lineWidth=1.6;
  ctx.beginPath();
  ctx.moveTo(px+15,py+11);
  ctx.lineTo(px+22,py+20);
  ctx.lineTo(px+18,py+30);
  ctx.stroke();
  ctx.fillStyle='rgba(18,32,28,.42)';
  ctx.beginPath(); ctx.arc(px+20,py+50,2.4,0,Math.PI*2); ctx.arc(px+33,py+48,1.8,0,Math.PI*2); ctx.fill();
}

/* 冰面：半透明的浅蓝地块，踩上去会一直滑。 */
function drawIce(px,py,t){
  const cx=px+TILE/2, cy=py+TILE/2;
  fillRR(px+1,py+1,TILE-2,TILE-2,6,'#CBE6EF');
  const g=ctx.createLinearGradient(px,py,px+TILE,py+TILE);
  g.addColorStop(0,'rgba(255,255,255,.85)');
  g.addColorStop(.55,'rgba(196,231,240,.52)');
  g.addColorStop(1,'rgba(146,203,219,.55)');
  fillRR(px+3,py+3,TILE-6,TILE-6,5,g);
  ctx.save();
  rr(px+4,py+4,TILE-8,TILE-8,4); ctx.clip();
  ctx.strokeStyle='rgba(255,255,255,.85)'; ctx.lineWidth=3; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(px+8,py+44); ctx.lineTo(px+24,py+30); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(px+22,py+50); ctx.lineTo(px+42,py+28); ctx.stroke();
  ctx.strokeStyle='rgba(112,174,192,.42)'; ctx.lineWidth=1.6;
  ctx.beginPath(); ctx.moveTo(px+14,py+18); ctx.lineTo(px+34,py+14); ctx.stroke();
  ctx.restore();
  ctx.fillStyle='rgba(255,255,255,'+(.22+.18*Math.sin(t/480+px))+')';
  ctx.beginPath(); ctx.ellipse(cx-6,cy+9,11,4,-.42,0,Math.PI*2); ctx.fill();
}

/* 钥匙：地上发光的金钥匙。 */
function drawKey(px,py,t){
  const cx=px+TILE/2, cy=py+TILE/2+Math.sin(t/420+px)*1.8;
  ctx.fillStyle='rgba(20,30,28,.20)';
  ctx.beginPath(); ctx.ellipse(cx,py+TILE-11,13,4.4,0,0,Math.PI*2); ctx.fill();
  const glow=ctx.createRadialGradient(cx,cy,2,cx,cy,22);
  glow.addColorStop(0,'rgba(255,232,160,.6)'); glow.addColorStop(1,'rgba(255,232,160,0)');
  ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(cx,cy,22,0,Math.PI*2); ctx.fill();
  ctx.save();
  ctx.translate(cx,cy); ctx.rotate(-.55);
  ctx.beginPath(); ctx.arc(-7,0,6.2,0,Math.PI*2);
  ctx.fillStyle=C.gold; ctx.fill();
  ctx.strokeStyle='#7E5129'; ctx.lineWidth=2.4; ctx.stroke();
  ctx.beginPath(); ctx.arc(-7,0,2.4,0,Math.PI*2);
  ctx.fillStyle='#FBF3DA'; ctx.fill();
  fillRR(-1.5,-2,17,4,2,C.gold);
  strokeRR(-1.5,-2,17,4,2,'#7E5129',1.6);
  fillRR(11,1,4.5,7,1.8,C.gold);
  fillRR(5.5,1,4.5,5.5,1.8,C.gold);
  ctx.restore();
}

/* 锁门：钥匙没捡齐前是一扇锁着的木门，齐了就变成敞开的门洞。 */
function drawDoor(px,py,open){
  const cx=px+TILE/2;
  fillRR(px+4,py+2,TILE-8,TILE-4,6,'#4E3B26');
  if(open){
    fillRR(px+8,py+5,TILE-16,TILE-10,4,'#C7B492');
    ctx.fillStyle='rgba(255,246,196,.55)';
    ctx.beginPath();
    ctx.moveTo(cx-7,py+TILE-9); ctx.lineTo(cx,py+TILE-21); ctx.lineTo(cx+7,py+TILE-9);
    ctx.closePath(); ctx.fill();
    fillRR(px+6,py+3,5,TILE-6,2,'#8A5C33');
    fillRR(px+TILE-11,py+3,5,TILE-6,2,'#8A5C33');
    return;
  }
  fillRR(px+7,py+5,TILE-14,TILE-10,4,'#95643A');
  ctx.strokeStyle='rgba(58,38,20,.7)'; ctx.lineWidth=1.8;
  for(let i=0;i<3;i++){
    const yy=py+13+i*11;
    ctx.beginPath(); ctx.moveTo(px+10,yy); ctx.lineTo(px+TILE-10,yy); ctx.stroke();
  }
  fillRR(cx+5,py+TILE/2-7,11,13,3,'#C9A05A');
  strokeRR(cx+5,py+TILE/2-7,11,13,3,C.ink,1.6);
  ctx.fillStyle='#4A3218';
  ctx.beginPath(); ctx.arc(cx+10.5,py+TILE/2-1,2.2,0,Math.PI*2); ctx.fill();
  ctx.fillRect(cx+9.4,py+TILE/2-1,2.2,4.6);
}

/* 传送门：一对同色的漩涡，踏进去就从另一头出来。 */
function drawPortal(px,py,t,ch){
  const cx=px+TILE/2, cy=py+TILE/2;
  const hue=ch==='1'?'#4CB7AE':'#F0C578';
  const spin=t/900+(ch==='1'?0:1.5);
  fillRR(px+5,py+5,TILE-10,TILE-10,10,'rgba(16,38,35,.55)');
  ctx.save();
  const g=ctx.createRadialGradient(cx,cy,2,cx,cy,17);
  g.addColorStop(0,'rgba(255,255,255,.85)'); g.addColorStop(.5,hue); g.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,17,0,Math.PI*2); ctx.fill();
  for(let i=0;i<2;i++){
    const r=10+i*6+Math.sin(t/380+i)*2;
    ctx.globalAlpha=.85-i*.22;
    ctx.strokeStyle=hue; ctx.lineWidth=3-i;
    ctx.beginPath(); ctx.ellipse(cx,cy,r,r*.74,spin+i*.9,0,Math.PI*2); ctx.stroke();
  }
  ctx.globalAlpha=1;
  for(let i=0;i<4;i++){
    const a=spin*1.6+i*1.57, rad=10+Math.sin(t/300+i)*2;
    star(cx+Math.cos(a)*rad,cy+Math.sin(a)*rad*.72,1.9,'rgba(255,255,255,.8)');
  }
  ctx.restore();
}

/* 宝箱：踩到就补给道具。 */
function drawChest(px,py,t){
  const cx=px+TILE/2, cy=py+TILE/2;
  const bob=Math.sin(t/500+px)*1.4;
  ctx.fillStyle='rgba(20,30,28,.22)';
  ctx.beginPath(); ctx.ellipse(cx,py+TILE-9,16,5,0,0,Math.PI*2); ctx.fill();
  fillRR(cx-16,cy-3+bob,32,15,4,'#9A6432');
  strokeRR(cx-16,cy-3+bob,32,15,4,C.ink,2.2);
  fillRR(cx-17,cy-13+bob,34,10,5,'#B57B44');
  strokeRR(cx-17,cy-13+bob,34,10,5,C.ink,2.2);
  ctx.fillStyle='#F0C578';
  ctx.fillRect(cx-3,cy-13+bob,6,26);
  fillRR(cx-5,cy+1+bob,10,8,2.4,'#C9A05A');
  strokeRR(cx-5,cy+1+bob,10,8,2.4,C.ink,1.6);
  ctx.fillStyle='#4A3218';
  ctx.beginPath(); ctx.arc(cx,cy+4+bob,1.7,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(255,255,255,.35)';
  ctx.beginPath(); ctx.ellipse(cx-6,cy-10+bob,7,2,-.2,0,Math.PI*2); ctx.fill();
}

/* 地图道具：一卷摊开的羊皮纸，捡走前一直在地上闪。 */
function drawMapItem(px,py,t){
  const cx=px+TILE/2, cy=py+TILE/2+Math.sin(t/430+px)*1.6;
  ctx.fillStyle='rgba(20,30,28,.22)';
  ctx.beginPath(); ctx.ellipse(cx,py+TILE-10,14,4.6,0,0,Math.PI*2); ctx.fill();
  const glow=ctx.createRadialGradient(cx,cy,2,cx,cy,24);
  glow.addColorStop(0,'rgba(246,217,122,.55)'); glow.addColorStop(1,'rgba(246,217,122,0)');
  ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(cx,cy,24,0,Math.PI*2); ctx.fill();
  ctx.save();
  ctx.translate(cx,cy); ctx.rotate(Math.sin(t/700)*.10);
  fillRR(-13,-14,26,28,4,'#F4E4BE');
  strokeRR(-13,-14,26,28,4,'#8A6A38',2);
  fillRR(-16,-17,32,7,3.4,'#B57B44');
  strokeRR(-16,-17,32,7,3.4,C.ink,1.6);
  fillRR(-16,10,32,7,3.4,'#B57B44');
  strokeRR(-16,10,32,7,3.4,C.ink,1.6);
  /* 纸面上画一条曲折的路线和一个红叉，一眼就能认出是地图。 */
  ctx.strokeStyle='rgba(94,72,42,.75)'; ctx.lineWidth=1.6; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(-8,-6); ctx.lineTo(-2,-2); ctx.lineTo(-6,3); ctx.lineTo(3,6); ctx.stroke();
  ctx.strokeStyle='#C9502F'; ctx.lineWidth=2;
  ctx.beginPath(); ctx.moveTo(3,-7); ctx.lineTo(9,-1); ctx.moveTo(9,-7); ctx.lineTo(3,-1); ctx.stroke();
  ctx.restore();
}

const FONT_BODY='"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif';

/* ---------- 场景装饰：同一套迷宫，换主题就换一层地貌 ---------- */
function tileHash(x,y,n){return ((x*37+y*57+n*91)%97)/97;}
function drawWallDecor(px,py,x,y,t){
  const d=G.theme&&G.theme.decor; if(!d) return;
  const cx=px+TILE/2, h1=tileHash(x,y,1), h2=tileHash(x,y,2), h3=tileHash(x,y,3);
  ctx.save();
  if(d==='forest'){
    if(h1<.34){
      const ox=(h2-.5)*14, bx=cx+ox, by=py+38, sc=.8+h3*.45;
      ctx.fillStyle='#3A2A1B'; ctx.fillRect(bx-2,by-6,4,14);
      for(let i=0;i<3;i++){
        const w=(17-i*4.6)*sc, top=by-10-i*10*sc;
        ctx.fillStyle=i===2?'#2E6B41':'#235232';
        ctx.beginPath();ctx.moveTo(bx-w,top+11*sc);ctx.lineTo(bx,top);ctx.lineTo(bx+w,top+11*sc);ctx.closePath();ctx.fill();
      }
      ctx.fillStyle='rgba(126,196,168,.5)'; ctx.beginPath(); ctx.arc(bx-3,by-18,1.7,0,Math.PI*2); ctx.fill();
    }else if(h3<.16){
      ctx.fillStyle='rgba(230,200,160,.75)';
      ctx.beginPath(); ctx.ellipse(cx+9,py+42,5,3,0,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='rgba(234,240,220,.8)'; ctx.beginPath(); ctx.arc(cx+9,py+40,2.4,0,Math.PI*2); ctx.fill();
    }
  }else if(d==='cave'){
    if(h1<.42){
      ctx.fillStyle='rgba(30,36,40,.92)';
      for(let i=0;i<3;i++){
        const sx=px+11+i*16+tileHash(x,y,10+i)*6, len=8+tileHash(x,y,20+i)*17;
        ctx.beginPath();ctx.moveTo(sx-4,py+2);ctx.lineTo(sx,py+2+len);ctx.lineTo(sx+4,py+2);ctx.closePath();ctx.fill();
      }
    }
    if(h2<.2){
      const sx=cx+6, sy=py+40;
      ctx.fillStyle='rgba(120,226,238,'+(.55+.25*Math.sin(t/700+px*.1))+')';
      ctx.beginPath();ctx.moveTo(sx,sy-8);ctx.lineTo(sx+4,sy);ctx.lineTo(sx,sy+8);ctx.lineTo(sx-4,sy);ctx.closePath();ctx.fill();
    }
  }else if(d==='wasteland'){
    ctx.strokeStyle='rgba(48,38,26,.5)'; ctx.lineWidth=1.4;
    ctx.beginPath();
    ctx.moveTo(px+9+tileHash(x,y,2)*8,py+16);ctx.lineTo(px+20,py+30);ctx.lineTo(px+15,py+40);
    ctx.moveTo(px+33,py+14);ctx.lineTo(px+29,py+26);ctx.lineTo(px+40,py+37);
    ctx.stroke();
    if(h3<.13){
      ctx.strokeStyle='rgba(240,234,214,.65)'; ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(cx-8,py+39);ctx.lineTo(cx+8,py+41);ctx.moveTo(cx-6,py+34);ctx.lineTo(cx+7,py+36);ctx.stroke();
    }
  }else if(d==='desert'){
    if(h1<.46){
      ctx.strokeStyle='rgba(217,178,108,.6)'; ctx.lineWidth=2;
      ctx.beginPath();
      ctx.moveTo(px+6,py+22); ctx.quadraticCurveTo(px+22,py+14,px+38,py+21);
      ctx.moveTo(px+9,py+36); ctx.quadraticCurveTo(px+25,py+29,px+44,py+37);
      ctx.stroke();
    }
    if(h2<.16){
      const sx=cx+4, sy=py+42;
      ctx.fillStyle='#4C7A44';
      ctx.fillRect(sx-3,sy-22,6,24); ctx.fillRect(sx+3,sy-15,4,9); ctx.fillRect(sx-7,sy-12,4,7);
      ctx.fillStyle='rgba(255,255,255,.28)'; ctx.fillRect(sx-1,sy-20,1.6,16);
    }
  }else if(d==='lava'){
    ctx.strokeStyle='rgba(90,26,10,.65)'; ctx.lineWidth=4; ctx.beginPath();
    ctx.moveTo(px+10,py+12);ctx.lineTo(px+19,py+27);ctx.lineTo(px+15,py+43);ctx.stroke();
    if(h1<.55){
      ctx.shadowColor='#FF6A1E'; ctx.shadowBlur=8;
      ctx.strokeStyle='rgba(255,154,74,'+(.6+.3*Math.sin(t/520+px*.1))+')'; ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(px+10,py+12);ctx.lineTo(px+19,py+27);ctx.lineTo(px+15,py+43);ctx.stroke();
      ctx.shadowBlur=0;
    }
    ctx.fillStyle='rgba(255,170,90,.55)';
    for(let i=0;i<2;i++){ ctx.beginPath(); ctx.arc(px+30+i*10,py+20+i*12,1.8,0,Math.PI*2); ctx.fill(); }
  }else if(d==='snow'){
    fillRR(px+2,py+1.5,TILE-4,13,5,'rgba(248,253,255,.9)');
    fillRR(px+9,py+3,TILE-26,5,3,'rgba(255,255,255,.95)');
    if(h1<.42){
      ctx.fillStyle='rgba(207,233,243,.9)';
      for(let i=0;i<3;i++){
        const sx=px+15+i*12, len=7+tileHash(x,y,13+i)*11;
        ctx.beginPath();ctx.moveTo(sx-3,py+13);ctx.lineTo(sx,py+13+len);ctx.lineTo(sx+3,py+13);ctx.closePath();ctx.fill();
      }
    }
    if(h2<.16){
      fillRR(px+18,py+30,TILE-36,TILE-22,5,'rgba(150,200,220,.20)');
      ctx.fillStyle='rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(px+24,py+37,2,0,Math.PI*2); ctx.fill();
    }
  }else if(d==='swamp'){
    ctx.fillStyle='rgba(70,100,54,.38)';
    ctx.beginPath(); ctx.ellipse(px+18,py+44,17,7,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(86,120,64,.9)';
    for(let i=0;i<3;i++){
      const sx=px+16+i*11+tileHash(x,y,14+i)*5, top=py+18+tileHash(x,y,24+i)*8;
      ctx.strokeStyle='rgba(94,122,70,.85)'; ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(sx,py+45);ctx.quadraticCurveTo(sx-3,top+8,sx-1,top);ctx.stroke();
      ctx.beginPath();ctx.ellipse(sx-1,top-2,3,5,0,0,Math.PI*2);ctx.fill();
    }
    if(h2<.24){
      ctx.fillStyle='rgba(190,230,190,.45)'; ctx.beginPath(); ctx.arc(cx+9,py+36,2.6,0,Math.PI*2); ctx.fill();
    }
  }else if(d==='castle'){
    ctx.strokeStyle='rgba(28,24,46,.38)'; ctx.lineWidth=1.5;
    for(let r=0;r<3;r++){
      const yy=py+13+r*15;
      ctx.beginPath();ctx.moveTo(px+4,yy);ctx.lineTo(px+TILE-4,yy);ctx.stroke();
      const off=(r%2)?0:10;
      for(let cx2=px+8+off;cx2<px+TILE-5;cx2+=20){
        ctx.beginPath();ctx.moveTo(cx2,yy);ctx.lineTo(cx2,yy+14);ctx.stroke();
      }
    }
    if(h1<.16){
      fillRR(cx-7,py+16,14,22,7,'rgba(30,25,48,.85)');
      fillRR(cx-3,py+20,6,13,3,'rgba(255,214,130,.55)');
      ctx.strokeStyle='rgba(255,232,170,.35)'; ctx.lineWidth=1.4; ctx.strokeRect(cx-8.5,py+14.5,17,25);
    }
  }
  ctx.restore();
}
function drawFloorDecor(px,py,x,y,t){
  const d=G.theme&&G.theme.decor; if(!d) return;
  const cx=px+TILE/2, h1=tileHash(x,y,5), h2=tileHash(x,y,6), h3=tileHash(x,y,7);
  ctx.save();
  if(d==='forest'){
    if(h1<.4){
      ctx.strokeStyle='rgba(88,138,70,.5)'; ctx.lineWidth=1.6;
      const bx=px+12+h2*26, by=py+38+h3*8;
      ctx.beginPath();
      ctx.moveTo(bx,by);ctx.lineTo(bx-4,by-9);
      ctx.moveTo(bx+3,by);ctx.lineTo(bx+2,by-12);
      ctx.moveTo(bx+6,by);ctx.lineTo(bx+10,by-8);
      ctx.stroke();
    }
    if(h2<.07){ ctx.fillStyle='rgba(240,197,120,.75)'; ctx.beginPath(); ctx.arc(px+20+h1*18,py+18+h3*14,2,0,Math.PI*2); ctx.fill(); }
  }else if(d==='cave'){
    ctx.fillStyle='rgba(120,112,98,.38)';
    for(let i=0;i<2;i++){ ctx.beginPath(); ctx.ellipse(px+16+i*18+h1*6,py+20+i*17+h2*5,3.4,2.4,h3,0,Math.PI*2); ctx.fill(); }
    if(h2<.18){ ctx.fillStyle='rgba(80,170,190,.18)'; ctx.beginPath(); ctx.ellipse(px+28,py+30,13,9,0,0,Math.PI*2); ctx.fill(); }
  }else if(d==='wasteland'){
    if(h1<.34){
      ctx.strokeStyle='rgba(140,116,80,.32)'; ctx.lineWidth=1.4;
      ctx.beginPath();ctx.moveTo(px+14,py+16);ctx.lineTo(px+24,py+26);ctx.lineTo(px+19,py+38);ctx.stroke();
    }
    if(h2<.1){ ctx.strokeStyle='rgba(120,150,90,.45)'; ctx.lineWidth=1.4;
      ctx.beginPath();ctx.moveTo(px+34,py+40);ctx.lineTo(px+38,py+31);ctx.stroke(); }
  }else if(d==='desert'){
    if(h1<.5){
      ctx.strokeStyle='rgba(214,186,128,.55)'; ctx.lineWidth=1.8;
      ctx.beginPath();ctx.moveTo(px+8,py+24);ctx.quadraticCurveTo(px+22,py+18,px+36,py+25);ctx.stroke();
      ctx.beginPath();ctx.moveTo(px+12,py+37);ctx.quadraticCurveTo(px+26,py+31,px+42,py+38);ctx.stroke();
    }
    if(h2<.12){ ctx.fillStyle='rgba(160,132,84,.45)'; ctx.beginPath(); ctx.ellipse(px+20,py+40,4,2.6,0,0,Math.PI*2); ctx.fill(); }
  }else if(d==='lava'){
    if(h1<.5){
      ctx.fillStyle='rgba(255,140,70,'+(.25+.2*Math.sin(t/430+px*.2))+')';
      for(let i=0;i<2;i++){ ctx.beginPath(); ctx.arc(px+16+i*20,py+22+i*12,1.8,0,Math.PI*2); ctx.fill(); }
    }
    if(h2<.2){ ctx.fillStyle='rgba(60,34,28,.35)'; ctx.beginPath(); ctx.ellipse(px+30,py+36,9,5,0,0,Math.PI*2); ctx.fill(); }
  }else if(d==='snow'){
    ctx.fillStyle='rgba(255,255,255,.6)';
    for(let i=0;i<3;i++){ ctx.beginPath(); ctx.arc(px+12+i*14+h1*4,py+16+i*11+h2*5,1.4,0,Math.PI*2); ctx.fill(); }
    if(h3<.1){ ctx.fillStyle='rgba(140,200,220,.2)'; ctx.beginPath(); ctx.ellipse(px+28,py+32,12,8,0,0,Math.PI*2); ctx.fill(); }
  }else if(d==='swamp'){
    if(h1<.4){
      ctx.fillStyle='rgba(84,116,64,.32)';
      ctx.beginPath(); ctx.ellipse(px+20+h2*10,py+22+h3*12,10,6,h1,0,Math.PI*2); ctx.fill();
    }
    if(h2<.12){
      ctx.fillStyle='rgba(120,170,140,.3)';
      ctx.beginPath(); ctx.ellipse(px+32,py+38,12,7,0,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle='rgba(220,240,220,.3)'; ctx.lineWidth=1.2; ctx.beginPath(); ctx.ellipse(px+32,py+38,12,7,0,0,Math.PI*2); ctx.stroke();
    }
  }else if(d==='castle'){
    if(h1<.3){
      ctx.strokeStyle='rgba(160,146,116,.28)'; ctx.lineWidth=1.3;
      ctx.beginPath();ctx.moveTo(px+10,py+18);ctx.lineTo(px+44,py+18);ctx.moveTo(px+10,py+36);ctx.lineTo(px+44,py+36);ctx.stroke();
    }
    if(h2<.08){ ctx.fillStyle='rgba(222,158,52,.22)'; ctx.beginPath(); ctx.arc(px+28,py+28,6,0,Math.PI*2); ctx.fill(); }
  }
  ctx.restore();
}

function drawTiles(t){
  const x0=Math.max(0,Math.floor(cam.x/TILE)-1);
  const x1=Math.min(COLS-1,Math.ceil((cam.x+view.w/view.scale)/TILE)+1);
  const y0=Math.max(0,Math.floor(cam.y/TILE)-1);
  const y1=Math.min(ROWS-1,Math.ceil((cam.y+view.h/view.scale)/TILE)+1);
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const px=x*TILE, py=y*TILE, ch=cellAt(x,y);
    if(ch==='c'){ drawCrackedWall(px,py,x,y); continue; }
    if(ch==='#'){
      fillRR(px+1,py+1,TILE-2,TILE-2,8,C.wallEdge);
      fillRR(px+3,py+3,TILE-6,TILE-6,7,C.wall);
      fillRR(px+7,py+5,TILE-14,5,2.5,'rgba(255,255,255,.10)');
      if((x*3+y*5)%4===0){
        ctx.fillStyle=C.mote||'rgba(126,196,168,.20)';
        ctx.beginPath();ctx.arc(px+16+(x%3)*9,py+39,3.2,0,Math.PI*2);ctx.fill();
      }
      drawWallDecor(px,py,x,y,t);
      continue;
    }
    fillRR(px+.5,py+.5,TILE-1,TILE-1,3,(x+y)%2?C.floor:C.floor2);
    ctx.fillStyle=C.grain||'rgba(148,120,74,.16)';
    for(let i=0;i<2;i++){
      const gx=px+12+((x*17+y*29+i*31)%36);
      const gy=py+14+((x*41+y*7+i*19)%34);
      ctx.beginPath();ctx.arc(gx,gy,1.4,0,Math.PI*2);ctx.fill();
    }
    drawFloorDecor(px,py,x,y,t);
    if(ch==='='){
      ctx.fillStyle='rgba(222,158,52,.55)';
      ctx.beginPath();
      ctx.moveTo(px+9,py+7);ctx.lineTo(px+13,py+10);ctx.lineTo(px+9,py+13);ctx.lineTo(px+5,py+10);
      ctx.closePath();ctx.fill();
    }
    if(ch==='~') drawWater(px,py,t);
    if(ch==='^') drawLava(px,py,t);
    if(ch==='o') drawPit(px,py,x,y);
    if(ch==='x') drawSpikes(px,py,x,y);
    if(ch==='m') drawMud(px,py,t);
    if(ch==='i') drawIce(px,py,t);
    if(ch==='k') drawKey(px,py,t);
    if(ch==='d') drawDoor(px,py,G.doorOpen);
    if(ch==='1'||ch==='2') drawPortal(px,py,t,ch);
    if(ch==='t') drawChest(px,py,t);
    if(ch==='M') drawMapItem(px,py,t);
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
  if(h.mode==='slide'){kind=h.slideDir||h.prevDir||'right';}
  else if(h.mode==='hesitate'||h.mode==='dead'||it.kind==='lost'){kind='?';color=C.gold;}
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
  /* 气泡挂在脑袋正上方，尾巴垂直指向头顶。 */
  const hs=(h.vy*TILE+TILE/2)*s-cam.y*s;
  const headTop=hs-29*s;
  const bx=clamp(cx,26,view.w-26);
  const by=clamp(headTop-34+bob,(G.hudTop||0)+2,view.h-40);
  const tailTip=hs-20;
  ctx.save();
  screenTransform();
  if(tailTip>by+26){
    ctx.beginPath();
    ctx.moveTo(bx-7,by+26); ctx.lineTo(cx,tailTip); ctx.lineTo(bx+7,by+26);
    ctx.fillStyle='#FFFCF4'; ctx.fill();
    ctx.strokeStyle=C.ink; ctx.lineWidth=2.2; ctx.stroke();
  }
  fillRR(bx-17,by,34,28,13,'#FFFCF4');
  strokeRR(bx-17,by,34,28,13,C.ink,2.4);
  ctx.textAlign='center'; ctx.textBaseline='middle';
  if(kind==='?'||kind==='!'){
    ctx.fillStyle=color;
    ctx.font='700 20px '+FONT_BODY;
    ctx.fillText(kind,bx,by+15);
  }else{
    drawArrowGlyph(bx,by+14,kind,color);
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
  /* 倒计时关没有追击怪物。 */
  if(G.mode!=='chase') return;
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
  drawPlankBody(.6);
  ctx.restore();
}

/* 炸弹预览：半透明炸弹 + 与真炸弹一致的九格波及虚线框，落点范围一眼看清。 */
function drawBombGhost(cx,cy,t){
  const px=cx-TILE/2, py=cy-TILE/2;
  const cx0=px+TILE/2, cy0=py+TILE/2+Math.sin(t/170)*1.4;
  ctx.save();
  ctx.fillStyle='rgba(226,72,46,.07)';
  ctx.fillRect(px-TILE,py-TILE,TILE*3,TILE*3);
  ctx.setLineDash([9,7]); ctx.lineDashOffset=-t/36;
  ctx.strokeStyle='rgba(240,120,84,.55)'; ctx.lineWidth=2.2;
  ctx.strokeRect(px-TILE+1.5,py-TILE+1.5,TILE*3-3,TILE*3-3);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha=.62;
  ctx.fillStyle='rgba(16,26,24,.24)';
  ctx.beginPath(); ctx.ellipse(cx0,py+TILE-9,15,5.5,0,0,Math.PI*2); ctx.fill();
  const g=ctx.createRadialGradient(cx0-6,cy0-7,3,cx0,cy0,17);
  g.addColorStop(0,'#6E7270'); g.addColorStop(.55,'#40443F'); g.addColorStop(1,'#1E211F');
  ctx.beginPath(); ctx.arc(cx0,cy0,15,0,Math.PI*2); ctx.fillStyle=g; ctx.fill();
  ctx.strokeStyle=C.ink; ctx.lineWidth=2.4; ctx.stroke();
  ctx.strokeStyle='#B57B44'; ctx.lineWidth=2.6; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(cx0+8,cy0-11); ctx.quadraticCurveTo(cx0+14,cy0-18,cx0+11,cy0-24); ctx.stroke();
  star(cx0+11,cy0-26,3.4,'#FFD68A');
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
    else if(G.tool==='sign') drawSign(cx,cy,G.signDir,G.t,.5);
    else if(G.tool==='bomb') drawBombGhost(cx,cy,G.t);
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

function drawPortalFx(t){
  const fx=G.portalFx;
  if(!fx) return;
  const age=t-fx.at;
  if(age<0||age>700) return;
  const p=clamp(age/700,0,1);
  ctx.save();
  ctx.globalAlpha=1-p;
  for(const c of [fx.from,fx.to]){
    const cx=c.x*TILE+TILE/2, cy=c.y*TILE+TILE/2;
    ctx.strokeStyle='#9BE6DE'; ctx.lineWidth=3.4;
    ctx.beginPath(); ctx.arc(cx,cy,10+p*34,0,Math.PI*2); ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,.7)'; ctx.lineWidth=1.8;
    ctx.beginPath(); ctx.arc(cx,cy,4+p*20,0,Math.PI*2); ctx.stroke();
  }
  ctx.restore();
}

function drawLostFx(){
  if(G.mode!=='chase') return;
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
  g.fillStyle=(G.theme&&G.theme.mini)||'rgba(9,24,21,.78)'; g.fillRect(0,0,COLS*MM,ROWS*MM);
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
    const ch=cellAt(x,y);
    if(ch==='#') continue;
    /* 裂墙在小地图上单独给一层颜色，天神一眼就能看见可炸的缺口。 */
    if(ch==='c'){ g.fillStyle='#4A6A61'; g.fillRect(x*MM,y*MM,MM,MM); continue; }
    let col='rgba(243,232,207,.26)';
    if(ch==='~') col='#7FC8D8';
    else if(ch==='^') col='#F2793C';
    else if(ch==='o') col='#4A4038';
    else if(ch==='x') col='#B9C2C6';
    else if(ch==='m') col='#8B8F5E';
    else if(ch==='i') col='#BCE6F2';
    else if(ch==='k') col='#F6D97A';
    else if(ch==='d') col=G.doorOpen?'#8A7A5A':'#7A4B2A';
    else if(ch==='t') col='#E8923C';
    else if(ch==='1') col='#4CB7AE';
    else if(ch==='2') col='#E0B24C';
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
  for(const b of G.bombs.values()){
    g.strokeStyle='rgba(240,120,84,'+(.45+.4*Math.sin(G.t/120))+')';
    g.lineWidth=1;
    g.strokeRect(b.x*MM-b.r*MM, b.y*MM-b.r*MM, (b.r*2+1)*MM, (b.r*2+1)*MM);
    g.fillStyle='#E2482E';
    g.fillRect(b.x*MM, b.y*MM, MM, MM);
  }
  G.signs.forEach((s,k)=>{
    const p=k.split(','), x=+p[0], y=+p[1];
    g.fillStyle='#C48D52';
    g.fillRect(x*MM,y*MM,MM,MM);
  });
  if(G.exit){
    g.fillStyle='rgba(255,246,196,'+(.55+.45*Math.sin(G.t/380))+')';
    g.fillRect(G.exit.x*MM-1,G.exit.y*MM-1,MM+2,MM+2);
  }
  if(G.phase!=='ready'&&G.mode==='chase'){
    const m=monsterPos();
    g.fillStyle='#A98AD8';
    g.beginPath();g.arc(m.x*MM+MM/2,m.y*MM+MM/2,2.8,0,Math.PI*2);g.fill();
  }
  g.fillStyle='#4FBFA8';
  g.beginPath();g.arc(G.hero.x*MM+MM/2,G.hero.y*MM+MM/2,3,0,Math.PI*2);g.fill();
  g.strokeStyle='rgba(255,252,242,.85)';g.lineWidth=1;
  g.beginPath();g.arc(G.hero.x*MM+MM/2,G.hero.y*MM+MM/2,3,0,Math.PI*2);g.stroke();
}

/* ================= 关卡总图 =================
   开局先落在一张羊皮卷上：八枚地形徽章按序号串成一条路线，
   点哪枚就从哪一关开始。素材全部用 Canvas 手绘，不依赖外部图库。
*/
const boardEl=document.querySelector('.board');
const FONT_SERIF='"Songti SC","STSong","Noto Serif CJK SC","Source Han Serif SC",Georgia,serif';
const FONT_MONO='"SFMono-Regular",Consolas,"Liberation Mono",Menlo,monospace';
/* 节点摆法：竖屏走蛇形，横屏走对角；坐标是图幅内的归一化值。 */
const ATLAS_TALL=[[.16,.93],[.47,.83],[.82,.71],[.62,.58],[.24,.45],[.52,.33],[.82,.20],[.45,.07]];
const ATLAS_WIDE=[[.09,.76],[.20,.66],[.31,.56],[.42,.46],[.53,.36],[.64,.26],[.75,.16],[.88,.07]];
let atlasGeo=null, atlasPaper=null, atlasPaperKey='', atlasT=0, atlasPress=null;

function atlasCanResume(){ return G.phase==='playing'||G.phase==='ready'; }
function atlasInvalidate(){ atlasGeo=null; atlasPaper=null; atlasPaperKey=''; }

function atlasLayout(){
  const w=view.w, h=view.h;
  const key=Math.round(w)+'x'+Math.round(h)+':'+(atlasCanResume()?1:0);
  if(atlasGeo&&atlasGeo.key===key) return atlasGeo;
  const pad=clamp(Math.min(w,h)*.045,12,22);
  const sheet={x:pad,y:pad,w:w-pad*2,h:h-pad*2};
  const headerH=clamp(h*.12,66,92);
  const footerH=clamp(h*.155,68,112);
  const inner={x:sheet.x+16,y:sheet.y+headerH,w:sheet.w-32,h:sheet.h-headerH-footerH};
  const wide=w/h>.82;
  const r=wide?clamp(Math.min(inner.w*.047,inner.h*.115),13,23)
              :clamp(Math.min(inner.w*.072,inner.h*.052),14,28);
  const pts=(wide?ATLAS_WIDE:ATLAS_TALL).slice(0,LEVELS.length);
  const nodes=pts.map(p=>({x:inner.x+p[0]*inner.w,y:inner.y+p[1]*inner.h,r}));
  const curve=atlasCurve(nodes);
  const foot={x:sheet.x+14,y:sheet.y+sheet.h-footerH+4,w:sheet.w-28,h:footerH-20};
  const chip=atlasCanResume()?{x:sheet.x+sheet.w-106,y:sheet.y+15,w:90,h:27}:null;
  atlasGeo={key,w,h,sheet,inner,headerH,footerH,r,nodes,curve,foot,chip,wide};
  return atlasGeo;
}

/* Catmull-Rom 采样：路线要像用毛笔画出来的，不能是一段段直线。 */
function atlasCurve(pts){
  if(!pts.length) return [];
  if(pts.length===1) return [{x:pts[0].x,y:pts[0].y}];
  const out=[];
  for(let i=0;i<pts.length-1;i++){
    const p0=pts[Math.max(0,i-1)], p1=pts[i], p2=pts[i+1], p3=pts[Math.min(pts.length-1,i+2)];
    for(let j=0;j<16;j++){
      const u=j/16, u2=u*u, u3=u2*u;
      out.push({
        x:.5*(2*p1.x+(-p0.x+p2.x)*u+(2*p0.x-5*p1.x+4*p2.x-p3.x)*u2+(-p0.x+3*p1.x-3*p2.x+p3.x)*u3),
        y:.5*(2*p1.y+(-p0.y+p2.y)*u+(2*p0.y-5*p1.y+4*p2.y-p3.y)*u2+(-p0.y+3*p1.y-3*p2.y+p3.y)*u3)
      });
    }
  }
  out.push({x:pts[pts.length-1].x,y:pts[pts.length-1].y});
  return out;
}

function openAtlas(){
  clearTimeout(G.overlayTimer);
  hideOverlay();
  G.overlayOpen=false;
  G.atlas=true;
  G.atlasCursor=null;
  G.atlasHoverAt=performance.now();
  G.atlasLeaving=null;
  atlasPress=null;
  atlasT=performance.now();
  atlasInvalidate();
  if(boardEl) boardEl.classList.add('atlas');
  canvas.style.cursor='default';
  if(el.follow) el.follow.hidden=true;
  drag=null;
}
function exitAtlas(){
  if(!G.atlas&&!boardEl.classList.contains('atlas')) return;
  G.atlas=false; G.atlasLeaving=null; G.atlasCursor=null; atlasPress=null;
  if(boardEl) boardEl.classList.remove('atlas');
  canvas.style.cursor='crosshair';
  drag=null;
}
function resumeFromAtlas(){
  if(!atlasCanResume()) return;
  const wasReady=G.phase==='ready';
  exitAtlas();
  measure();
  G.overlayOpen=false; clearTimeout(G.overlayTimer);
  if(wasReady) beginPlay();
  else hideOverlay();
  updateTools(); updateHud(); followCam(0,true);
}

function atlasChoose(i){
  if(G.atlasLeaving||!LEVELS[i]) return;
  G.atlasLeaving={i,at:performance.now()};
  G.atlasCursor=i;
  setTimeout(()=>{ if(G.atlas) startLevel(i); },260);
}

function atlasPoint(cx,cy){
  const r=canvas.getBoundingClientRect();
  return {x:(cx-r.left)/Math.max(1,r.width)*view.w,y:(cy-r.top)/Math.max(1,r.height)*view.h};
}
function atlasHit(cx,cy){
  const geo=atlasLayout(), p=atlasPoint(cx,cy);
  if(geo.chip&&p.x>=geo.chip.x&&p.x<=geo.chip.x+geo.chip.w&&p.y>=geo.chip.y&&p.y<=geo.chip.y+geo.chip.h) return {kind:'resume'};
  for(let i=0;i<geo.nodes.length;i++){
    const n=geo.nodes[i];
    if(Math.hypot(p.x-n.x,p.y-n.y)<=n.r+7) return {kind:'node',i};
  }
  return null;
}
function atlasPointerMove(cx,cy){
  if(G.atlasLeaving) return;
  const hit=atlasHit(cx,cy);
  const idx=hit&&hit.kind==='node'?hit.i:null;
  if(idx!==G.atlasCursor){ G.atlasCursor=idx; G.atlasHoverAt=performance.now(); }
  canvas.style.cursor=hit?'pointer':'default';
}
function atlasPointerOut(){
  if(G.atlasLeaving) return;
  if(G.atlasCursor!==null){ G.atlasCursor=null; canvas.style.cursor='default'; }
}
function atlasTap(cx,cy){
  if(G.atlasLeaving) return;
  const hit=atlasHit(cx,cy);
  if(!hit) return;
  if(hit.kind==='resume') resumeFromAtlas();
  else atlasChoose(hit.i);
}
function atlasKey(e){
  if(G.atlasLeaving){ e.preventDefault(); return; }
  if(e.key==='Escape'||e.key==='m'||e.key==='M'){ e.preventDefault(); resumeFromAtlas(); return; }
  if(e.key==='ArrowRight'||e.key==='ArrowDown'||e.key==='ArrowLeft'||e.key==='ArrowUp'){
    e.preventDefault();
    const step=(e.key==='ArrowRight'||e.key==='ArrowDown')?1:-1;
    const cur=G.atlasCursor==null?0:G.atlasCursor;
    G.atlasCursor=clamp(cur+step,0,LEVELS.length-1);
    G.atlasHoverAt=performance.now();
    return;
  }
  if(e.key==='Enter'){
    e.preventDefault();
    atlasChoose(G.atlasCursor==null?0:G.atlasCursor);
  }
}

/* 羊皮卷底色、经纬网、纤维与等高线只画一次，之后每帧只叠动态层。 */
function buildAtlasPaper(geo){
  const key=Math.round(view.w)+'x'+Math.round(view.h);
  if(atlasPaper&&atlasPaperKey===key) return;
  const c=document.createElement('canvas');
  c.width=Math.max(1,Math.round(view.w*dpr));
  c.height=Math.max(1,Math.round(view.h*dpr));
  const g=c.getContext('2d');
  g.setTransform(dpr,0,0,dpr,0,0);
  const S=geo.sheet, W=view.w, H=view.h;
  const pathRR=(x,y,w,h,r)=>{
    const rad=Math.max(0,Math.min(r,w/2,h/2));
    g.beginPath();
    g.moveTo(x+rad,y); g.lineTo(x+w-rad,y); g.arcTo(x+w,y,x+w,y+rad,rad);
    g.lineTo(x+w,y+h-rad); g.arcTo(x+w,y+h,x+w-rad,y+h,rad);
    g.lineTo(x+rad,y+h); g.arcTo(x,y+h,x,y+h-rad,rad);
    g.lineTo(x,y+rad); g.arcTo(x,y,x+rad,y,rad); g.closePath();
  };

  /* 桌面：深松绿，把纸卷托起来 */
  const bg=g.createRadialGradient(W*.5,H*.34,Math.min(W,H)*.16,W*.5,H*.5,Math.max(W,H)*.72);
  bg.addColorStop(0,'#16302A'); bg.addColorStop(1,'#071210');
  g.fillStyle=bg; g.fillRect(0,0,W,H);

  g.save();
  g.shadowColor='rgba(2,8,6,.7)'; g.shadowBlur=30; g.shadowOffsetY=14;
  g.fillStyle='#D9C49B'; pathRR(S.x,S.y,S.w,S.h,18); g.fill();
  g.restore();
  const pg=g.createLinearGradient(S.x,S.y,S.x+S.w*.55,S.y+S.h*.9);
  pg.addColorStop(0,'#FAF1DD'); pg.addColorStop(.45,'#F0E3C6'); pg.addColorStop(1,'#DDC79C');
  g.fillStyle=pg; pathRR(S.x,S.y,S.w,S.h,18); g.fill();

  g.save(); pathRR(S.x,S.y,S.w,S.h,18); g.clip();
  const hl=g.createRadialGradient(S.x+S.w*.22,S.y+S.h*.14,0,S.x+S.w*.22,S.y+S.h*.14,Math.max(S.w,S.h)*1.06);
  hl.addColorStop(0,'rgba(255,253,244,.5)'); hl.addColorStop(.72,'rgba(255,250,232,.06)'); hl.addColorStop(1,'rgba(116,88,44,.16)');
  g.fillStyle=hl; g.fillRect(S.x,S.y,S.w,S.h);

  /* 经纬网 */
  g.strokeStyle='rgba(74,86,62,.05)'; g.lineWidth=1;
  for(let x=S.x+13;x<S.x+S.w;x+=26){
    g.beginPath(); g.moveTo(Math.round(x)+.5,S.y); g.lineTo(Math.round(x)+.5,S.y+S.h); g.stroke();
  }
  for(let y=S.y+13;y<S.y+S.h;y+=26){
    g.beginPath(); g.moveTo(S.x,Math.round(y)+.5); g.lineTo(S.x+S.w,Math.round(y)+.5); g.stroke();
  }

  /* 纸纤维与斑点 */
  for(let i=0;i<54;i++){
    const x=S.x+Math.random()*S.w, y=S.y+Math.random()*S.h, a=Math.random()*Math.PI, len=8+Math.random()*26;
    g.strokeStyle='rgba(108,84,46,'+(.018+Math.random()*.028)+')'; g.lineWidth=1;
    g.beginPath(); g.moveTo(x,y); g.lineTo(x+Math.cos(a)*len,y+Math.sin(a)*len); g.stroke();
  }
  for(let i=0;i<1100;i++){
    g.fillStyle='rgba(92,72,40,'+(.012+Math.random()*.045)+')';
    g.fillRect(S.x+Math.random()*S.w,S.y+Math.random()*S.h,1.1,1.1);
  }

  /* 等高线：几圈不规则的墨迹，让纸面像旧地图 */
  const blob=(cx,cy,rx,ry,seed,alpha)=>{
    g.strokeStyle='rgba(70,84,60,'+alpha+')'; g.lineWidth=1;
    for(let k=0;k<3;k++){
      g.beginPath();
      const sc=1+k*.26;
      for(let a=0;a<=Math.PI*2+.01;a+=.2){
        const m=1+.13*Math.sin(a*3+seed+k*.9)+.07*Math.sin(a*5-seed*2);
        const x=cx+Math.cos(a)*rx*sc*m, y=cy+Math.sin(a)*ry*sc*m;
        if(a===0) g.moveTo(x,y); else g.lineTo(x,y);
      }
      g.closePath(); g.stroke();
    }
  };
  blob(S.x+S.w*.70,S.y+S.h*.30,S.w*.24,S.h*.12,1.2,.05);
  blob(S.x+S.w*.20,S.y+S.h*.66,S.w*.20,S.h*.10,3.6,.045);
  blob(S.x+S.w*.56,S.y+S.h*.92,S.w*.16,S.h*.07,5.1,.04);

  /* 折痕 */
  g.strokeStyle='rgba(96,74,40,.06)'; g.lineWidth=1.5;
  for(const fx of [.34,.66]){
    const xx=S.x+S.w*fx;
    g.beginPath(); g.moveTo(xx,S.y+6); g.lineTo(xx+2,S.y+S.h*.5); g.lineTo(xx,S.y+S.h-6); g.stroke();
  }
  g.restore();

  /* 纸边压暗（外向内六层） */
  for(let i=0;i<6;i++){
    g.strokeStyle='rgba(107,84,46,'+(.05-i*.007)+')'; g.lineWidth=2;
    pathRR(S.x+i*2,S.y+i*2,S.w-i*4,S.h-i*4,14); g.stroke();
  }
  /* 双线边框 + 四角小菱形 */
  g.strokeStyle='rgba(64,78,58,.30)'; g.lineWidth=1;
  pathRR(S.x+9,S.y+9,S.w-18,S.h-18,12); g.stroke();
  g.strokeStyle='rgba(64,78,58,.13)';
  pathRR(S.x+13,S.y+13,S.w-26,S.h-26,10); g.stroke();
  for(const px of [S.x+9,S.x+S.w-9]){
    for(const py of [S.y+9,S.y+S.h-9]){
      g.save(); g.translate(px,py); g.rotate(Math.PI/4);
      g.fillStyle='rgba(178,130,52,.5)'; g.fillRect(-2.6,-2.6,5.2,5.2); g.restore();
    }
  }

  /* 抬头 */
  const hx=S.x+22, tpx=clamp(geo.headerH*.42,19,30);
  g.textAlign='left'; g.textBaseline='alphabetic';
  g.fillStyle='rgba(56,72,58,.78)';
  g.font='600 7.5px '+FONT_MONO;
  tracked(g,'THE APPRENTICE · ATLAS',hx,S.y+geo.headerH*.27,1.7);
  g.fillStyle='#1C2E27';
  g.font='700 '+tpx+'px '+FONT_SERIF;
  g.fillText('见习之路',hx,S.y+geo.headerH*.30+tpx*1.02);

  const ry=S.y+geo.headerH-9;
  const rl=g.createLinearGradient(hx,0,S.x+S.w-22,0);
  rl.addColorStop(0,'rgba(178,130,52,.72)'); rl.addColorStop(1,'rgba(178,130,52,0)');
  g.fillStyle=rl; g.fillRect(hx,ry,S.x+S.w-22-hx,1.4);
  g.save(); g.translate(hx+2,ry+.7); g.rotate(Math.PI/4);
  g.fillStyle='rgba(178,130,52,.9)'; g.fillRect(-2.4,-2.4,4.8,4.8); g.restore();

  if(!geo.chip){
    g.textAlign='right'; g.textBaseline='alphabetic';
    g.font='600 10px '+FONT_SERIF; g.fillStyle='rgba(52,68,58,.8)';
    g.fillText('共 '+LEVELS.length+' 境',S.x+S.w-24,S.y+geo.headerH*.30+tpx*1.02);
    g.font='600 7px '+FONT_MONO; g.fillStyle='rgba(56,72,58,.55)';
    trackedR(g,'ATLAS · VIII',S.x+S.w-24,S.y+geo.headerH*.27,1.4);
  }

  /* 指北针：放在右下角空白处 */
  const ccx=geo.inner.x+geo.inner.w*.93, ccy=geo.inner.y+geo.inner.h*.962;
  const cr=clamp(Math.min(geo.inner.w,geo.inner.h)*.055,10,20);
  g.save(); g.translate(ccx,ccy);
  g.strokeStyle='rgba(56,70,54,.32)'; g.lineWidth=1;
  g.beginPath(); g.arc(0,0,cr,0,Math.PI*2); g.stroke();
  g.beginPath(); g.arc(0,0,cr*.7,0,Math.PI*2); g.stroke();
  g.fillStyle='rgba(46,60,46,.5)';
  g.beginPath(); g.moveTo(0,-cr*.92); g.lineTo(cr*.17,0); g.lineTo(0,cr*.92); g.lineTo(-cr*.17,0); g.closePath(); g.fill();
  g.fillStyle='rgba(180,132,58,.78)';
  g.beginPath(); g.moveTo(-cr*.92,0); g.lineTo(0,cr*.17); g.lineTo(cr*.92,0); g.lineTo(0,-cr*.17); g.closePath(); g.fill();
  g.fillStyle='rgba(56,70,54,.5)'; g.font='600 6px '+FONT_MONO;
  g.textAlign='center'; g.textBaseline='middle'; g.fillText('N',0,-cr-5);
  g.restore();

  /* 底部说明牌 */
  const F=geo.foot;
  g.fillStyle='rgba(252,246,231,.68)'; pathRR(F.x,F.y,F.w,F.h,10); g.fill();
  g.strokeStyle='rgba(64,78,58,.24)'; g.lineWidth=1; pathRR(F.x,F.y,F.w,F.h,10); g.stroke();
  g.fillStyle='rgba(178,130,52,.82)'; g.fillRect(F.x+11,F.y+12,2,Math.max(4,F.h-24));

  atlasPaper=c; atlasPaperKey=key;
}

function tracked(g,text,x,y,sp){
  const chars=Array.from(text);
  g.textAlign='left';
  let cx=x;
  for(const ch of chars){ g.fillText(ch,cx,y); cx+=g.measureText(ch).width+sp; }
}
function trackedR(g,text,x,y,sp){
  const chars=Array.from(text);
  g.textAlign='left';
  let total=0;
  for(const ch of chars) total+=g.measureText(ch).width+sp;
  let cx=x-total+sp;
  for(const ch of chars){ g.fillText(ch,cx,y); cx+=g.measureText(ch).width+sp; }
}
function clipText(text,maxW){
  if(ctx.measureText(text).width<=maxW) return text;
  let s=text;
  while(s.length>1&&ctx.measureText(s+'…').width>maxW) s=s.slice(0,-1);
  return s+'…';
}

function drawAtlas(now){
  screenTransform();
  ctx.clearRect(0,0,view.w,view.h);
  ctx.fillStyle='#081411'; ctx.fillRect(0,0,view.w,view.h);
  const geo=atlasLayout();
  buildAtlasPaper(geo);
  const enter=clamp((now-atlasT)/460,0,1);
  ctx.save();
  ctx.globalAlpha=.22+.78*easeOut(enter);
  if(atlasPaper) ctx.drawImage(atlasPaper,0,0,view.w,view.h);
  drawAtlasDust(geo,now);
  drawAtlasRoute(geo,now);
  for(let i=0;i<geo.nodes.length;i++) drawAtlasNode(geo,i,now);
  drawAtlasFooter(geo);
  drawAtlasChip(geo);
  if(G.atlasLeaving) drawAtlasLeaving(geo,now);
  ctx.restore();
}

function drawAtlasDust(geo,now){
  const S=geo.sheet;
  for(let i=0;i<16;i++){
    const px=S.x+((i*137.5)%100)/100*S.w+Math.sin(now/2600+i)*6;
    const py=S.y+((i*61.7)%100)/100*S.h+Math.cos(now/3100+i*1.7)*5;
    const a=.10+.13*(.5+.5*Math.sin(now/900+i*2.1));
    ctx.fillStyle='rgba(255,244,205,'+a+')';
    ctx.beginPath(); ctx.arc(px,py,.8+(i%3)*.5,0,Math.PI*2); ctx.fill();
  }
}

function drawAtlasRoute(geo,now){
  const pts=geo.curve;
  if(!pts.length) return;
  const stroke=(col,lw,dash,from,to)=>{
    ctx.save(); ctx.lineCap='round'; ctx.lineJoin='round';
    ctx.strokeStyle=col; ctx.lineWidth=lw;
    if(dash) ctx.setLineDash(dash);
    ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y);
    for(let i=1;i<to;i++) ctx.lineTo(pts[i].x,pts[i].y);
    ctx.stroke(); ctx.restore();
  };
  const r=geo.r;
  stroke('rgba(255,251,238,.78)',Math.max(6,r*.34),null,0,pts.length);
  stroke('rgba(176,148,96,.42)',Math.max(3,r*.17),null,0,pts.length);
  const maxCleared=[...G.cleared].reduce((a,b)=>Math.max(a,b),-1);
  if(maxCleared>=1){
    stroke('rgba(190,138,50,.5)',Math.max(2.4,r*.10),null,0,Math.min(pts.length-1,maxCleared*16+8));
  }
  ctx.save();
  ctx.strokeStyle='rgba(180,128,44,.85)'; ctx.lineWidth=1.4; ctx.lineCap='round';
  ctx.setLineDash([6,8]); ctx.lineDashOffset=-now/28;
  ctx.beginPath(); ctx.moveTo(pts[0].x,pts[0].y);
  for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x,pts[i].y);
  ctx.stroke();
  ctx.restore();
  const u=(now/34000)%1;
  const p=pts[Math.min(pts.length-1,Math.floor(u*(pts.length-1)))];
  const gl=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r*.95);
  gl.addColorStop(0,'rgba(255,236,178,.9)'); gl.addColorStop(1,'rgba(255,214,120,0)');
  ctx.fillStyle=gl; ctx.beginPath(); ctx.arc(p.x,p.y,r*.95,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#FFF3CE'; ctx.beginPath(); ctx.arc(p.x,p.y,1.7,0,Math.PI*2); ctx.fill();
}

function drawAtlasNode(geo,i,now){
  const n=geo.nodes[i];
  const themeKey=(LEVELS[i]&&LEVELS[i].theme)||'forest';
  const th=(window.THEMES||{})[themeKey]||{};
  const hover=G.atlasCursor===i&&!G.atlasLeaving;
  const hov=hover?clamp((now-(G.atlasHoverAt||now))/200,0,1):0;
  const R=n.r*(1+.055*hov);
  ctx.save();
  ctx.translate(n.x,n.y);

  ctx.fillStyle='rgba(40,30,14,.22)';
  ctx.beginPath(); ctx.ellipse(0,R*1.02,R*.86,R*.24,0,0,Math.PI*2); ctx.fill();
  if(hov>0){
    const gg=ctx.createRadialGradient(0,0,R*.7,0,0,R*2);
    gg.addColorStop(0,'rgba(244,204,124,'+(.40*hov)+')'); gg.addColorStop(1,'rgba(244,204,124,0)');
    ctx.fillStyle=gg; ctx.beginPath(); ctx.arc(0,0,R*2,0,Math.PI*2); ctx.fill();
  }
  ctx.fillStyle='#1B2A24';
  ctx.beginPath(); ctx.arc(0,0,R,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle=hover?'#D3A04B':'rgba(24,38,32,.85)';
  ctx.lineWidth=hover?2.6:1.8;
  ctx.beginPath(); ctx.arc(0,0,R-1.4,0,Math.PI*2); ctx.stroke();
  ctx.fillStyle='#F5EACD';
  ctx.beginPath(); ctx.arc(0,0,R-3.6,0,Math.PI*2); ctx.fill();

  const IR=R-6.4;
  if(IR>4){
    ctx.save();
    ctx.beginPath(); ctx.arc(0,0,IR,0,Math.PI*2); ctx.clip();
    atlasEmblem(themeKey,IR);
    const sh=ctx.createRadialGradient(0,-IR*.2,IR*.25,0,0,IR*1.02);
    sh.addColorStop(0,'rgba(8,18,14,0)'); sh.addColorStop(1,'rgba(8,18,14,.4)');
    ctx.fillStyle=sh; ctx.fillRect(-IR,-IR,IR*2,IR*2);
    ctx.restore();
    ctx.strokeStyle='rgba(196,146,66,.85)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(0,0,IR+.6,0,Math.PI*2); ctx.stroke();
  }

  /* 编号：像盖在图上的一枚小铜章 */
  const sr=Math.max(7,R*.30);
  ctx.save();
  ctx.translate(-R*.70,-R*.70);
  ctx.fillStyle='#C79A4C';
  ctx.beginPath(); ctx.arc(0,0,sr,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(24,38,32,.75)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.arc(0,0,sr,0,Math.PI*2); ctx.stroke();
  ctx.fillStyle='#1F2A1C';
  ctx.font='700 '+Math.max(7,sr*.95)+'px '+FONT_MONO;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(String(i+1).padStart(2,'0'),0,sr*.05);
  ctx.restore();

  if(G.cleared.has(i)){
    star(R*.74,-R*.74,R*.22,'rgba(214,160,66,.95)');
    star(R*.74,-R*.74,R*.10,'rgba(255,240,196,.95)');
  }
  ctx.restore();

  /* 地形名压在纸面上 */
  const label=(th.label||'').slice(0,3);
  const fs=Math.max(9,Math.round(R*.40));
  ctx.save();
  ctx.textAlign='center'; ctx.textBaseline='top';
  ctx.font='600 '+fs+'px '+FONT_SERIF;
  const tw=ctx.measureText(label).width+9;
  fillRR(n.x-tw/2,n.y+R+6,tw,fs+7,6,'rgba(248,240,219,.72)');
  ctx.fillStyle=hover?'#8A5C12':'rgba(30,46,38,.92)';
  ctx.fillText(label,n.x,n.y+R+9);
  ctx.restore();
}

function drawAtlasFooter(geo){
  const F=geo.foot;
  const idx=G.atlasCursor!=null?Math.min(G.atlasCursor,LEVELS.length-1):-1;
  const L=idx>=0?LEVELS[idx]:null;
  ctx.save();
  ctx.textAlign='left'; ctx.textBaseline='alphabetic';
  const tx=F.x+22;
  ctx.fillStyle='#1E302A';
  ctx.font='700 13px '+FONT_SERIF;
  ctx.fillText(clipText(L?L.name:'从第一境开始',F.w-(L?122:52)),tx,F.y+F.h*.40);
  ctx.fillStyle='rgba(52,70,60,.86)';
  ctx.font='400 11px '+FONT_SERIF;
  ctx.fillText(clipText(L?L.target:'八境相连，点一枚徽章，把勇者放进那一关。',F.w-42),tx,F.y+F.h*.76);
  if(L){
    ctx.textAlign='right';
    ctx.fillStyle='rgba(150,104,34,.9)';
    ctx.font='600 8px '+FONT_MONO;
    ctx.fillText(String(idx+1).padStart(2,'0')+' / '+String(LEVELS.length).padStart(2,'0'),F.x+F.w-14,F.y+F.h*.40);
    ctx.fillStyle='rgba(150,104,34,.78)';
    ctx.font='600 8.5px '+FONT_SERIF;
    ctx.fillText('点击启程',F.x+F.w-14,F.y+F.h*.76);
  }
  ctx.restore();
}

function drawAtlasChip(geo){
  const c=geo.chip;
  if(!c) return;
  ctx.save();
  fillRR(c.x,c.y,c.w,c.h,9,'rgba(252,245,228,.94)');
  strokeRR(c.x,c.y,c.w,c.h,9,'rgba(66,80,58,.35)',1);
  ctx.fillStyle='#243A30';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.font='600 10px '+FONT_SERIF;
  ctx.fillText('继续本关',c.x+c.w/2+7,c.y+c.h/2+1);
  ctx.strokeStyle='rgba(160,112,40,.9)'; ctx.lineWidth=1.4; ctx.lineCap='round';
  ctx.beginPath();
  ctx.moveTo(c.x+13,c.y+c.h/2); ctx.lineTo(c.x+20,c.y+c.h/2);
  ctx.lineTo(c.x+17.2,c.y+c.h/2-2.8);
  ctx.moveTo(c.x+20,c.y+c.h/2); ctx.lineTo(c.x+17.2,c.y+c.h/2+2.8);
  ctx.stroke();
  ctx.restore();
}

function drawAtlasLeaving(geo,now){
  const lv=G.atlasLeaving, n=geo.nodes[lv.i];
  if(!n) return;
  const p=clamp((now-lv.at)/260,0,1);
  ctx.save();
  ctx.strokeStyle='rgba(212,168,88,'+(.9*(1-p))+')'; ctx.lineWidth=2.4;
  ctx.beginPath(); ctx.arc(n.x,n.y,n.r*(1+p*.95),0,Math.PI*2); ctx.stroke();
  ctx.fillStyle='rgba(255,240,200,'+(.35*(1-p))+')';
  ctx.beginPath(); ctx.arc(n.x,n.y,n.r*(1+p*.3),0,Math.PI*2); ctx.fill();
  ctx.restore();
}

/* ---------- 八种地形小徽章：都画在 [-R,R] 的圆形裁切里 ---------- */
function atlasPine(x,by,h,w,col,cap){
  ctx.fillStyle='rgba(8,20,13,.85)';
  ctx.fillRect(x-w*.08,by-h*.30,w*.16,h*.30);
  ctx.fillStyle=col;
  ctx.beginPath();
  ctx.moveTo(x,by-h);
  ctx.lineTo(x+w*.62,by-h*.30);
  ctx.lineTo(x+w,by);
  ctx.lineTo(x-w,by);
  ctx.lineTo(x-w*.62,by-h*.30);
  ctx.closePath(); ctx.fill();
  if(cap){
    ctx.fillStyle=cap;
    ctx.beginPath();
    ctx.moveTo(x,by-h);
    ctx.lineTo(x+w*.30,by-h*.60);
    ctx.lineTo(x-w*.30,by-h*.60);
    ctx.closePath(); ctx.fill();
  }
}
function atlasEmblem(key,R){
  const bg=ctx.createLinearGradient(0,-R,0,R);
  if(key==='forest'){
    bg.addColorStop(0,'#6EA97A'); bg.addColorStop(.48,'#2E6440'); bg.addColorStop(1,'#0F2618');
    ctx.fillStyle=bg; ctx.fillRect(-R,-R,R*2,R*2);
    ctx.fillStyle='rgba(16,44,28,.75)';
    ctx.beginPath(); ctx.moveTo(-R,R*.36);
    ctx.quadraticCurveTo(-R*.35,R*.02,R*.06,R*.30);
    ctx.quadraticCurveTo(R*.5,R*.08,R,R*.38);
    ctx.lineTo(R,R); ctx.lineTo(-R,R); ctx.closePath(); ctx.fill();
    atlasPine(-R*.44,R*.72,R*.80,R*.28,'#0D2718','#86C095');
    atlasPine(R*.02,R*.82,R*1.02,R*.32,'#0A2115','#9AD0A6');
    atlasPine(R*.46,R*.70,R*.72,R*.24,'#123322','#75B084');
    ctx.strokeStyle='rgba(245,230,190,.6)'; ctx.lineWidth=Math.max(1.2,R*.06);
    ctx.beginPath(); ctx.moveTo(-R*.55,R*1.02);
    ctx.quadraticCurveTo(-R*.15,R*.74,R*.6,R*.94); ctx.stroke();
  }
  else if(key==='cave'){
    bg.addColorStop(0,'#5A6E78'); bg.addColorStop(.5,'#232F36'); bg.addColorStop(1,'#0A1214');
    ctx.fillStyle=bg; ctx.fillRect(-R,-R,R*2,R*2);
    ctx.fillStyle='#2A363D';
    ctx.beginPath(); ctx.moveTo(-R,R); ctx.lineTo(-R,-R*.18);
    ctx.quadraticCurveTo(-R*.5,-R*1.02,R*.02,-R*1.0);
    ctx.quadraticCurveTo(R*.55,-R*.98,R,-R*.16);
    ctx.lineTo(R,R); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#050B0E';
    ctx.beginPath(); ctx.moveTo(-R*.64,R); ctx.lineTo(-R*.64,-R*.04);
    ctx.quadraticCurveTo(0,-R*.66,R*.64,-R*.04);
    ctx.lineTo(R*.64,R); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#6FB3BE';
    ctx.beginPath(); ctx.ellipse(0,R*.68,R*.5,R*.15,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(210,244,246,.7)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(-R*.34,R*.62); ctx.quadraticCurveTo(0,R*.55,R*.34,R*.62); ctx.stroke();
    ctx.fillStyle='#4C5E66';
    for(let i=0;i<3;i++){
      const sx=-R*.4+i*R*.4;
      ctx.beginPath(); ctx.moveTo(sx,-R*.58); ctx.lineTo(sx+R*.10,-R*.18); ctx.lineTo(sx-R*.10,-R*.18); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle='rgba(120,196,180,.22)';
    ctx.beginPath(); ctx.arc(-R*.24,-R*.36,R*.13,0,Math.PI*2); ctx.fill();
  }
  else if(key==='wasteland'){
    bg.addColorStop(0,'#A98B62'); bg.addColorStop(.55,'#5C4A32'); bg.addColorStop(1,'#241C12');
    ctx.fillStyle=bg; ctx.fillRect(-R,-R,R*2,R*2);
    ctx.fillStyle='rgba(240,216,160,.9)';
    ctx.beginPath(); ctx.arc(-R*.34,-R*.44,R*.15,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#3B2E1E';
    ctx.beginPath(); ctx.moveTo(-R,R*.22);
    ctx.quadraticCurveTo(-R*.4,R*.10,R*.06,R*.26);
    ctx.quadraticCurveTo(R*.5,R*.12,R,R*.28);
    ctx.lineTo(R,R); ctx.lineTo(-R,R); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#6B563C';
    ctx.fillRect(-R*.62,R*.02,R*.22,R*.62);
    ctx.fillRect(R*.34,-R*.06,R*.20,R*.70);
    ctx.fillStyle='#8B7350';
    ctx.fillRect(-R*.66,R*.02,R*.30,R*.10);
    ctx.fillRect(R*.30,-R*.06,R*.28,R*.10);
    ctx.strokeStyle='rgba(198,176,136,.55)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(-R*.5,R*.64); ctx.lineTo(-R*.2,R*.56); ctx.lineTo(R*.02,R*.68); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(R*.24,R*.58); ctx.lineTo(R*.48,R*.50); ctx.stroke();
  }
  else if(key==='desert'){
    bg.addColorStop(0,'#D3A263'); bg.addColorStop(.5,'#A97A46'); bg.addColorStop(1,'#463218');
    ctx.fillStyle=bg; ctx.fillRect(-R,-R,R*2,R*2);
    ctx.fillStyle='rgba(255,232,178,.95)';
    ctx.beginPath(); ctx.arc(-R*.28,-R*.42,R*.16,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(255,238,190,.5)'; ctx.lineWidth=1.2;
    ctx.beginPath(); ctx.arc(-R*.28,-R*.42,R*.28,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle='#C9A468';
    ctx.beginPath(); ctx.moveTo(-R,R*.42);
    ctx.quadraticCurveTo(-R*.3,R*.06,R*.16,R*.34);
    ctx.quadraticCurveTo(R*.6,R*.58,R,R*.30);
    ctx.lineTo(R,R); ctx.lineTo(-R,R); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#EBD3A2';
    ctx.beginPath(); ctx.moveTo(-R,R*.72);
    ctx.quadraticCurveTo(-R*.2,R*.42,R*.34,R*.68);
    ctx.quadraticCurveTo(R*.68,R*.82,R,R*.66);
    ctx.lineTo(R,R); ctx.lineTo(-R,R); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(140,100,52,.4)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(-R*.5,R*.86); ctx.quadraticCurveTo(0,R*.78,R*.5,R*.88); ctx.stroke();
  }
  else if(key==='lava'){
    bg.addColorStop(0,'#7A2C17'); bg.addColorStop(.5,'#43160D'); bg.addColorStop(1,'#1B0906');
    ctx.fillStyle=bg; ctx.fillRect(-R,-R,R*2,R*2);
    ctx.fillStyle='#2B1108';
    ctx.beginPath(); ctx.moveTo(-R,R*.10); ctx.lineTo(-R*.18,-R*.56);
    ctx.lineTo(R*.18,-R*.56); ctx.lineTo(R,R*.10);
    ctx.lineTo(R,R); ctx.lineTo(-R,R); ctx.closePath(); ctx.fill();
    const cr=ctx.createRadialGradient(0,-R*.1,0,0,-R*.1,R*.5);
    cr.addColorStop(0,'rgba(255,150,70,.7)'); cr.addColorStop(1,'rgba(255,120,40,0)');
    ctx.fillStyle=cr; ctx.beginPath(); ctx.arc(0,-R*.1,R*.5,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#FF8A3C'; ctx.lineWidth=Math.max(2,R*.16); ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(-R*.04,-R*.42);
    ctx.quadraticCurveTo(R*.3,-R*.05,R*.12,R*.34);
    ctx.quadraticCurveTo(-R*.08,R*.66,R*.5,R*.96); ctx.stroke();
    ctx.fillStyle='rgba(255,214,140,.9)';
    for(let i=0;i<4;i++){
      ctx.beginPath(); ctx.arc(-R*.4+i*R*.28,-R*.2+((i%2)?R*.12:0),1.2,0,Math.PI*2); ctx.fill();
    }
  }
  else if(key==='snow'){
    bg.addColorStop(0,'#B7CED8'); bg.addColorStop(.5,'#64818F'); bg.addColorStop(1,'#20323C');
    ctx.fillStyle=bg; ctx.fillRect(-R,-R,R*2,R*2);
    ctx.fillStyle='rgba(234,246,255,.85)';
    ctx.beginPath(); ctx.arc(-R*.3,-R*.5,R*.14,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#E7F2F4';
    ctx.beginPath(); ctx.moveTo(-R,R*.32);
    ctx.quadraticCurveTo(-R*.3,R*.10,R*.10,R*.30);
    ctx.quadraticCurveTo(R*.55,R*.10,R,R*.34);
    ctx.lineTo(R,R); ctx.lineTo(-R,R); ctx.closePath(); ctx.fill();
    atlasPine(-R*.42,R*.54,R*.70,R*.24,'#223C48');
    atlasPine(R*.14,R*.62,R*.86,R*.28,'#1B333E');
    ctx.fillStyle='rgba(255,255,255,.95)';
    ctx.beginPath(); ctx.moveTo(-R*.42,R*.54-R*.70); ctx.lineTo(-R*.42+R*.30,R*.54-R*.70*.62); ctx.lineTo(-R*.42-R*.30,R*.54-R*.70*.62); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(R*.14,R*.62-R*.86); ctx.lineTo(R*.14+R*.34,R*.62-R*.86*.62); ctx.lineTo(R*.14-R*.34,R*.62-R*.86*.62); ctx.closePath(); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.65)';
    for(let i=0;i<5;i++){ ctx.beginPath(); ctx.arc(-R*.6+i*R*.3,-R*.2+((i%2)?R*.1:0),1.1,0,Math.PI*2); ctx.fill(); }
  }
  else if(key==='swamp'){
    bg.addColorStop(0,'#5F8664'); bg.addColorStop(.55,'#2C4A34'); bg.addColorStop(1,'#0D1D14');
    ctx.fillStyle=bg; ctx.fillRect(-R,-R,R*2,R*2);
    ctx.fillStyle='#3E6B52';
    ctx.beginPath(); ctx.ellipse(0,R*.6,R*.86,R*.34,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(126,174,118,.85)';
    ctx.beginPath(); ctx.ellipse(-R*.18,R*.62,R*.26,R*.13,0,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(206,236,208,.6)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(-R*.6,R*.5); ctx.quadraticCurveTo(0,R*.42,R*.6,R*.52); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-R*.4,R*.78); ctx.quadraticCurveTo(0,R*.7,R*.44,R*.8); ctx.stroke();
    ctx.strokeStyle='#8FAE62'; ctx.lineWidth=Math.max(1.3,R*.05);
    for(let i=0;i<3;i++){
      const rx=-R*.4+i*R*.32, ty=R*.42+i*R*.06;
      ctx.beginPath(); ctx.moveTo(rx,R*.84); ctx.quadraticCurveTo(rx-R*.06,R*.5,rx+R*.04,ty); ctx.stroke();
      ctx.fillStyle='rgba(178,196,120,.8)';
      ctx.beginPath(); ctx.ellipse(rx+R*.04,ty,R*.07,R*.13,0,0,Math.PI*2); ctx.fill();
    }
  }
  else{
    bg.addColorStop(0,'#7A6AA0'); bg.addColorStop(.5,'#3C3055'); bg.addColorStop(1,'#171125');
    ctx.fillStyle=bg; ctx.fillRect(-R,-R,R*2,R*2);
    ctx.fillStyle='rgba(233,224,255,.82)';
    ctx.beginPath(); ctx.arc(-R*.3,-R*.52,R*.13,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#241B33';
    ctx.beginPath(); ctx.moveTo(-R,R*.30);
    ctx.quadraticCurveTo(-R*.2,R*.04,R,R*.34);
    ctx.lineTo(R,R); ctx.lineTo(-R,R); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#4B3F68';
    ctx.fillRect(-R*.72,R*.04,R*.30,R*.58);
    ctx.fillRect(R*.42,R*.04,R*.30,R*.58);
    ctx.fillStyle='#6E5F92';
    ctx.fillRect(-R*.72,R*.04,R*.30,R*.10);
    ctx.fillRect(R*.42,R*.04,R*.30,R*.10);
    ctx.fillStyle='#120C1C';
    ctx.beginPath(); ctx.moveTo(-R*.24,R);
    ctx.quadraticCurveTo(-R*.20,R*.30,0,R*.30);
    ctx.quadraticCurveTo(R*.20,R*.30,R*.24,R);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle='rgba(240,197,120,.85)';
    ctx.beginPath(); ctx.arc(-R*.58,R*.24,1.4,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(R*.58,R*.24,1.4,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='rgba(240,197,120,.55)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(-R*.30,R*.94); ctx.lineTo(-R*.30,R*.56); ctx.lineTo(R*.30,R*.56); ctx.lineTo(R*.30,R*.94); ctx.stroke();
    ctx.fillStyle='#E4674A';
    ctx.beginPath(); ctx.moveTo(0,-R*.04); ctx.lineTo(R*.28,-R*.04); ctx.lineTo(R*.14,R*.18); ctx.closePath(); ctx.fill();
  }
}

function draw(){
  const t=G.t;
  screenTransform();
  ctx.clearRect(0,0,view.w,view.h);
  ctx.fillStyle=G.bg;
  ctx.fillRect(0,0,view.w,view.h);

  worldTransform();
  drawTiles(t);
  drawTrail();
  drawSigns(t);
  drawHover();
  drawPlanks(t);
  drawRocks(t);
  drawBombs(t);
  drawBlasts(t);
  drawPortalFx(t);
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
  if(G.hasMap&&t-miniAt>140){miniAt=t;drawMini();}
}

let prevTime=performance.now(), hudClock=0;
function frame(now){
  const dt=Math.min(64,Math.max(0,now-prevTime));
  prevTime=now;
  /* 总图模式：只画地图，回合逻辑与计时全部冻结。 */
  if(G.atlas){ drawAtlas(now); requestAnimationFrame(frame); return; }
  if(!G.paused&&(G.phase==='ready'||G.phase==='playing')) G.t+=dt;
  if(G.phase==='ready'&&G.t>=G.startAt){
    hideOverlay();
    G.overlayOpen=false;
    beginPlay();
  }
  if(!G.paused){
    if(G.phase==='playing'){ heroTick(); mobsTick(); monsterTick(); bombsTick(); checkContact(); }
    /* 倒计时关：时间耗尽就算失败（追击关不看这条）。 */
    if(G.phase==='playing'&&G.mode==='timer'&&G.t-G.startAt>=G.level.timeLimit) timeUp();
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
openAtlas();
new ResizeObserver(()=>{ measure(); if(G.atlas) atlasInvalidate(); else followCam(0,true); }).observe(canvas.parentElement);
requestAnimationFrame(frame);
})();
