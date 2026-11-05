// 界面：任务面板、撤离点距离、指南针、生命体力、武器道具、提示、横幅、浮动文字、各种屏幕
const $=id=>document.getElementById(id);
const cache={};const set=(id,k,v,fn)=>{if(cache[id+k]===v)return;cache[id+k]=v;fn(v);};

export function mission(done,total,sub){set('m','t',`${done}/${total}`,()=>{$('mText').textContent=`到达撤离点 · ${done}/${total}`;$('mChk').classList.toggle('done',done>=total);});set('m','s',sub,v=>$('mSub').innerHTML=v);}
export function dist(label,num,hold){set('d','l',label,v=>$('distT').textContent=v);set('d','n',num,v=>$('distN').textContent=v);
 set('d','h',hold==null?-1:Math.round(hold*200),()=>{$('holdBar').hidden=hold==null;$('dist').classList.toggle('hold',hold!=null);if(hold!=null)$('holdBar').firstChild.style.width=(hold*100)+'%';});}
export function compass(a){set('c','a',Math.round(a*60),()=>$('arrow').style.transform=`rotate(${a}rad)`);}
export function hearts(hp,max,shield){set('h','v',hp*10+max*100+(shield?1:0),()=>{let s='';for(let i=0;i<max;i++)s+=`<i class="${i<hp?'':'off'}${shield&&i===Math.min(hp,max)-1?' sh':''}">${i<hp?'❤️':'🤍'}</i>`;if(shield)s+='<i class="sh">🥚</i>';$('hearts').innerHTML=s;});}
export function stamina(k){set('s','v',Math.round(k*50),()=>$('stBar').style.width=(k*100)+'%');}
export function weapon(name,buffs,inv){set('w','n',name,v=>$('wName').textContent=v);
 const key=buffs.map(b=>b.name+Math.ceil(b.t)).join();set('w','b',key,()=>$('buffs').innerHTML=buffs.map(b=>`<div class="buff" style="color:${b.col}">${b.name}<b>${Math.ceil(b.t)}s</b></div>`).join(''));
 set('w','s',inv.stink,v=>$('iStink').textContent=v);set('w','c',inv.coin,v=>$('iCoin').textContent=v);set('w','g',inv.gold,v=>$('iGold').textContent=v);}
export function tip(html){set('t','v',html,v=>{$('tip').innerHTML=v;$('tip').hidden=!v;});}
export function cross(x,y){const c=$('cross');c.style.transform=`translate(${x}px,${y}px)`;}
let hitT=0;export function hitMark(){const c=$('cross');c.classList.add('hit');clearTimeout(hitT);hitT=setTimeout(()=>c.classList.remove('hit'),90);}
export function prompt(x,y,text,k){const p=$('prompt');if(text==null){p.hidden=true;return;}p.hidden=false;p.style.transform=`translate(${x}px,${y}px)`;set('p','t',text,v=>$('pText').textContent=v);$('pBar').style.width=(k*100)+'%';}
let bT=0;export function banner(t,s='',dur=2.6){$('bT').textContent=t;$('bS').textContent=s;$('banner').classList.add('on');clearTimeout(bT);bT=setTimeout(()=>$('banner').classList.remove('on'),dur*1000);}
// 浮动文字（屏幕坐标，由 main 每帧投影后传入）
const floats=[];
export function floatText(wx,wy,wz,text,col='#fff',size=14){const d=document.createElement('div');d.className='ft';d.textContent=text;d.style.color=col;d.style.fontSize=size+'px';document.body.appendChild(d);floats.push({d,wx,wy,wz,t:0});}
export function updateFloats(dt,project){for(let i=floats.length-1;i>=0;i--){const f=floats[i];f.t+=dt;if(f.t>1.1){f.d.remove();floats.splice(i,1);continue;}
 const[x,y]=project(f.wx,f.wy+f.t*1.2,f.wz);f.d.style.left=x+'px';f.d.style.top=y+'px';f.d.style.opacity=f.t<.8?1:1-(f.t-.8)/.3;}}
export function clearFloats(){for(const f of floats)f.d.remove();floats.length=0;}
export function playing(on){document.body.classList.toggle('playing',on);}

// ---------- 屏幕 ----------
const KEYS=`<div class="keys"><span><k>W</k><k>A</k><k>S</k><k>D</k></span><span>移动</span><span>鼠标 + 左键</span><span>瞄准、发射玉米粒</span><span><k>空格</k></span><span>翻滚（短暂无敌）</span><span><k>Shift</k></span><span>冲刺</span><span><k>E</k> 按住</span><span>搜索箱子</span><span><k>Q</k></span><span>扔臭蛋：熏晕一片黄鼠狼</span><span><k>Esc</k> / <k>M</k></span><span>暂停 / 静音</span></div>`;
export function screen(kind,d={},actions={}){const s=$('screen');if(!kind){s.hidden=true;s.innerHTML='';return;}s.hidden=false;let h='';
 if(kind==='title')h=`<div class="card"><h1>萌鸡突围</h1><p>黄鼠狼巡逻队占领了林间营地。<br>带上玉米发射器，依次占领 <b>3 个撤离点</b>，每个都要守住一波围攻，<br>最后坐蛋壳飞艇离开。</p>${KEYS}
  <div class="stats"><div><b>${d.gold}</b>金蛋库存</div><div><b>${d.coin}</b>玉米币</div><div><b>${d.wins}/${d.runs}</b>成功 / 出击</div></div>
  <button class="btn" data-a="start">开始行动</button></div>`;
 else if(kind==='pause')h=`<div class="card"><h2>暂停</h2>${KEYS}<button class="btn" data-a="resume">继续</button><button class="btn ghost" data-a="quit">放弃这局</button><p style="font-size:12px;opacity:.6">画质：${d.q} <k>O</k> 切换</p></div>`;
 else if(kind==='dead')h=`<div class="card"><h2 style="color:#ff9a8a">被打倒了……</h2><p>巡逻队把你拖回了营地外面。</p>
  <div class="stats"><div><b>${d.points}/3</b>撤离点</div><div><b>${d.kills}</b>打晕黄鼠狼</div><div><b>${d.time}</b>用时</div></div>
  <p><span class="kept">保住了金蛋 ×${d.gold}</span>　<span class="lost">丢失玉米币 ×${d.coin}</span></p><p style="font-size:12.5px;opacity:.7">小技巧：${d.tip}</p>
  <button class="btn" data-a="start">再来一局</button><button class="btn ghost" data-a="title">返回</button></div>`;
 else if(kind==='win')h=`<div class="card"><h2 style="color:var(--egg)">突围成功！</h2><p>蛋壳飞艇载着你飞过了树梢。</p>
  <div class="stats"><div><b>${d.kills}</b>打晕黄鼠狼</div><div><b>${d.time}</b>用时</div><div><b>${d.hp}</b>剩余生命</div></div>
  <p class="kept">带回金蛋 ×${d.gold}　玉米币 ×${d.coin}</p><button class="btn" data-a="start">再来一局</button><button class="btn ghost" data-a="title">返回</button></div>`;
 s.innerHTML=h;s.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>actions[b.dataset.a]?.());}
