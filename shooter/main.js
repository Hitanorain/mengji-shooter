// 萌鸡突围 · 主循环：玩家、黄鼠狼 AI、子弹、成长（经验、三选一、武器换代）、道具、搜箱、臭蛋、油桶、撤离点坚守、增援、头目、结算
import {THREE,scene,camera,composer,sun,SUNOFF,POOL,finalPass,quality,setQuality,clamp,lr,lpick,angLerp} from './engine.js';
import * as map from './map.js';
import {makeChick,makeWeasel,animWalk,flash,makeBullet,makePickup,PICKUPS,makeMark,setMark,makeBar,makeStars,makeAirship} from './models.js';
import {TIERS,TIER_LV,UPGRADES,REGEN_T,LEECH_N,BULLET_BUFFS,xpNeed,weaponStats,rollChoices} from './upgrades.js';
import * as fx from './fx.js';
import * as hud from './hud.js';
import * as audio from './audio.js';
const sfx=audio.sfx;

// ---------- 存档（只存局外数据） ----------
const SAVE_KEY='mengji-shooter-v1';
let save={gold:0,coin:0,runs:0,wins:0,bestLv:0};
try{Object.assign(save,JSON.parse(localStorage.getItem(SAVE_KEY)||'{}'));}catch(e){}
const persist=()=>{try{localStorage.setItem(SAVE_KEY,JSON.stringify(save));}catch(e){}};

// ---------- 输入 ----------
const keys={},mouse={x:innerWidth/2,y:innerHeight/2,down:false};
addEventListener('keydown',e=>{if(e.repeat)return;keys[e.code]=true;audio.init();
 if(state==='pick'){const i=['Digit1','Digit2','Digit3','Numpad1','Numpad2','Numpad3'].indexOf(e.code);if(i>=0)hud.choose(i%3);return;}
 if(e.code==='Escape'||e.code==='KeyP'){if(state==='play')pause();else if(state==='pause')resume();}
 if(e.code==='KeyM')audio.toggleMute();
 if(e.code==='KeyO'){setQuality(!quality.high);if(state==='pause')pause();}
 if(state==='play'){if(e.code==='Space'){e.preventDefault();tryRoll();}if(e.code==='KeyQ')throwStink();}});
addEventListener('keyup',e=>{keys[e.code]=false;});
addEventListener('mousemove',e=>{mouse.x=e.clientX;mouse.y=e.clientY;});
addEventListener('mousedown',e=>{if(e.button===0)mouse.down=true;audio.init();});
addEventListener('mouseup',e=>{if(e.button===0)mouse.down=false;});
addEventListener('contextmenu',e=>e.preventDefault());
addEventListener('wheel',e=>{zoom=clamp(zoom+Math.sign(e.deltaY)*.08,.78,1.3);},{passive:true});
addEventListener('blur',()=>{for(const k in keys)keys[k]=false;mouse.down=false;if(state==='play')pause();});
const ray=new THREE.Raycaster(),aimPlane=new THREE.Plane(new THREE.Vector3(0,1,0),-.6),aim=new THREE.Vector3(),ndc=new THREE.Vector2();
function updateAim(){ndc.set(mouse.x/innerWidth*2-1,-(mouse.y/innerHeight)*2+1);ray.setFromCamera(ndc,camera);ray.ray.intersectPlane(aimPlane,aim);}
const tmpV=new THREE.Vector3();
function project(x,y,z){tmpV.set(x,y,z).project(camera);return[(tmpV.x+1)/2*innerWidth,(1-tmpV.y)/2*innerHeight];}
const hex=c=>'#'+c.toString(16).padStart(6,'0');

// ---------- 玩家 ----------
const pm=makeChick();
const shieldMesh=new THREE.Mesh(new THREE.SphereGeometry(.78,28,18),new THREE.MeshStandardMaterial({color:0xfff6e4,transparent:true,opacity:.22,roughness:.2,emissive:0x9fe6ff,emissiveIntensity:.35,depthWrite:false}));
shieldMesh.position.y=.7;shieldMesh.scale.y=1.15;pm.g.add(shieldMesh);
const P={};
function resetPlayer(){const buffs={speed:0};for(const k of BULLET_BUFFS)buffs[k]=0;
 Object.assign(P,{x:map.START[0],z:map.START[1],face:Math.PI,hp:5,max:5,st:1,roll:0,rdx:0,rdz:0,inv:0,fireCd:0,recoil:0,kx:0,kz:0,
 buffs,shield:false,stink:2,bag:{coin:0,gold:0},search:null,searchT:0,hurtT:0,downT:0,moving:0,dustT:0,riding:false,
 tier:0,lv:1,xp:0,up:{},kos:0,regenT:0,pending:0});
 pm.g.position.set(P.x,0,P.z);pm.g.rotation.set(0,P.face,0);pm.body.rotation.set(0,0,0);pm.gun.scale.setScalar(1);pm.g.visible=true;if(pm.g.parent!==scene)scene.add(pm.g);}

// ---------- 黄鼠狼 ----------
// rifle 步枪兵、rush 冲锋兵、heavy 重装兵（霰弹）、boss 黄鼠狼队长
const FT={rifle:{hp:5,xp:3,fur:0x9a683a,scarf:0xc8261c},rush:{hp:4,xp:3,club:true,fur:0xb27c46,scarf:0xe0702a},
 heavy:{hp:20,xp:10,fur:0x7a5232,scarf:0x7a1a14,helmet:0x3d4a2a,scale:1.4},boss:{hp:300,xp:40,fur:0x8a5a30,scarf:0x6a2ab0,helmet:0xd4a020,scale:1.9}};
const hpMul=()=>1+active*.3+Math.min(stats.time/400,.8)+(P.lv-1)*.05;
const foes=[];
function spawnFoe(type,x,z,o={}){const D=FT[type];const m=makeWeasel({club:!!D.club,fur:D.fur,scarf:D.scarf,helmet:D.helmet,scale:D.scale});
 const hp=Math.round(D.hp*hpMul());
 m.g.position.set(x,0,z);const f={type,m,x,z,face:o.face??0,hp,max:hp,rad:.45*(D.scale||1),state:o.state==='combat'?'guard':(o.state||'guard'),home:[x,z],patrol:o.patrol||null,pi:0,wait:lr(0,2),
  cd:lr(.6,1.6),aimT:0,burst:0,burstT:0,spot:null,reT:0,stun:0,hitT:0,downT:0,seenT:0,last:[x,z],alertT:0,atkT:0,kx:0,kz:0,stuckT:0,detour:null,detourT:0,sp:0,
  burn:0,burnDps:0,slow:0,pat:0,mark:makeMark(m.g),bar:makeBar(m.g),stars:makeStars(m.g),markT:0,wave:!!o.wave,boss:type==='boss'};
 m.g.rotation.y=f.face;foes.push(f);if(o.state==='combat')alert(f,0);return f;}
function removeFoe(f){scene.remove(f.m.g);f.m.g.traverse(o=>{if(o.isMesh&&o.geometry)o.geometry.dispose();});for(const m of f.m.mats)m.dispose();if(f.spot)f.spot.taken=null;}
function placeFoes(){
 const A=map.OUTPOST_A,B=map.OUTPOST_B;
 spawnFoe('rifle',A[0]-1,A[1]-.6,{face:0});spawnFoe('rifle',A[0]+1.4,A[1]-.4,{face:.3});spawnFoe('rush',A[0]+.3,A[1]-1.8,{face:0});
 spawnFoe('rifle',-17.6,-5.2,{face:.4});spawnFoe('rifle',-23.2,-5.6,{face:-.3});
 spawnFoe('rush',-12,-9.6,{patrol:[[-14,-9.4],[0,-12.6]]});
 spawnFoe('rifle',B[0]-1.6,B[1]-.6,{face:0});spawnFoe('rifle',B[0]+1.6,B[1]-.8,{face:.2});spawnFoe('heavy',B[0],B[1]-1.8,{face:0});spawnFoe('rush',B[0]-3,B[1]-2,{face:.4});
 spawnFoe('rifle',-8,-32,{face:.6});spawnFoe('rifle',25,-8,{face:-.6});spawnFoe('rush',17,-1,{patrol:[[17,-1],[26,2],[24,-10]]});
 spawnFoe('rush',-21,21,{patrol:[[-21,21],[-26,10],[-14,4]]});spawnFoe('rifle',-26,2,{face:1});spawnFoe('rifle',26,10,{face:-1.2,patrol:[[26,10],[24,22]]});}
function alert(f,delay=.35){if(f.state==='combat'||f.state==='down')return;f.state='combat';f.alertT=delay;f.seenT=0;f.last=[P.x,P.z];f.reT=0;f.cd=Math.max(f.cd,lr(.6,1.1));setMark(f.mark,'!');f.markT=1.4;
 if(delay>0)sfx.alert();
 for(const o of foes)if(o!==f&&o.state!=='combat'&&o.state!=='down'&&Math.hypot(o.x-f.x,o.z-f.z)<9)setTimeout(()=>{if(state==='play')alert(o,.3);},300+Math.random()*300);}
function noise(x,z,r){for(const f of foes)if(f.state!=='combat'&&f.state!=='down'&&Math.hypot(f.x-x,f.z-z)<r)alert(f);}

// 移动：朝目标走，前方有障碍就往旁边绕；卡住时随便找个方向绕一下
function steer(f,tx,tz,speed,dt){if(f.slow>0)speed*=.55;let dx=tx-f.x,dz=tz-f.z;const d=Math.hypot(dx,dz);if(d<.2){f.sp=0;return true;}dx/=d;dz/=d;
 if(f.detourT>0){f.detourT-=dt;dx=f.detour[0];dz=f.detour[1];}
 else for(const b of map.obs){if(!b.alive)continue;const ox=b.x-f.x,oz=b.z-f.z,pr=ox*dx+oz*dz;if(pr<0||pr>1.8+b.r)continue;const s=-ox*dz+oz*dx,R=b.r+f.rad+.1;if(Math.abs(s)>=R)continue;
  const w=(R-Math.abs(s))/R*(1-pr/(2+b.r))*1.6,sg=s>0?-1:1,ox0=dx;dx+=-dz*sg*w;dz+=ox0*sg*w;const l=Math.hypot(dx,dz)||1;dx/=l;dz/=l;}
 const px=f.x,pz=f.z,step=Math.min(speed*dt,d);f.x+=dx*step;f.z+=dz*step;const p={x:f.x,z:f.z};map.collide(p,f.rad);f.x=p.x;f.z=p.z;
 const moved=Math.hypot(f.x-px,f.z-pz);f.sp=moved/dt;f.mvx=dx;f.mvz=dz;
 if(moved<step*.3){f.stuckT+=dt;if(f.stuckT>.5){f.stuckT=0;const a=Math.atan2(dz,dx)+(Math.random()<.5?1:-1)*lr(1.2,2);f.detour=[Math.cos(a),Math.sin(a)];f.detourT=lr(.4,.8);}}else f.stuckT=Math.max(0,f.stuckT-dt);
 return false;}
// 寻路：能直接走过去就直走，否则按 A* 路径点走
function moveTo(f,tx,tz,speed,dt){f.navT=(f.navT||0)-dt;
 if(f.navT<=0||Math.hypot(tx-(f.ptx??1e9),tz-(f.ptz??1e9))>1.5){f.navT=lr(.5,.8);f.ptx=tx;f.ptz=tz;f.path=map.walkClear(f.x,f.z,tx,tz)?null:map.findPath(f.x,f.z,tx,tz);}
 if(!f.path||!f.path.length)return steer(f,tx,tz,speed,dt);
 const w=f.path[0];if(f.path.length>1&&Math.hypot(w[0]-f.x,w[1]-f.z)<.4){f.path.shift();return moveTo(f,tx,tz,speed,dt);}
 steer(f,w[0],w[1],speed,dt);return f.path.length===1&&Math.hypot(tx-f.x,tz-f.z)<.2;}
// 找一个矮掩体后面、能看到小鸡、距离合适的位置
function pickSpot(f){if(f.spot){f.spot.taken=null;f.spot=null;}let best=null,bs=1e9;
 for(const s of map.coverSpots){if(s.taken||!s.b.alive)continue;const de=Math.hypot(s.x-f.x,s.z-f.z);if(de>10)continue;const dp=Math.hypot(s.x-P.x,s.z-P.z);if(dp<5||dp>15)continue;
  const ox=s.b.x-s.x,oz=s.b.z-s.z,px=P.x-s.x,pz=P.z-s.z,c=(ox*px+oz*pz)/(Math.hypot(ox,oz)*dp);if(c<.86)continue;
  const sc=de+Math.abs(dp-9)*.6-c*2;if(sc<bs&&map.losClear(s.x,s.z,P.x,P.z)){bs=sc;best=s;}}
 if(best){best.taken=f;f.spot=best;}}
function spotValid(f){const s=f.spot;if(!s||!s.b.alive)return false;const dp=Math.hypot(s.x-P.x,s.z-P.z);if(dp<4||dp>17)return false;const ox=s.b.x-s.x,oz=s.b.z-s.z,px=P.x-s.x,pz=P.z-s.z;return(ox*px+oz*pz)/(Math.hypot(ox,oz)*dp)>.8;}

const AIM_T={rifle:.45,heavy:.7,boss:.55};
function updateFoe(f,dt){const m=f.m;
 if(f.state==='down'){f.downT+=dt;const k=Math.min(f.downT/.35,1);m.body.rotation.x=-k*1.45;m.body.position.y=k*.15;f.stars.visible=f.downT<2.2;f.stars.rotation.y+=dt*5;
  if(f.downT>2.4)m.g.position.y=-(f.downT-2.4)*.9;if(f.downT>3.4){removeFoe(f);return false;}return true;}
 f.hitT=Math.max(0,f.hitT-dt*6);flash(m,f.hitT);
 // 着火、减速
 if(f.burn>0){f.burn-=dt;f.hp-=f.burnDps*dt;if(Math.random()<dt*14)fx.spark(f.x+lr(-.2,.2),lr(.5,1.2)*(f.rad/.45),f.z+lr(-.2,.2),0xff6020,1,1.2);if(f.hp<=0){knockOut(f);return true;}}
 if(f.slow>0){f.slow-=dt;if(Math.random()<dt*6)fx.spark(f.x+lr(-.3,.3),lr(.3,1),f.z+lr(-.3,.3),0x8fe0ff,1,.6);}
 f.x+=f.kx*dt;f.z+=f.kz*dt;f.kx*=Math.exp(-dt*10);f.kz*=Math.exp(-dt*10);{const p={x:f.x,z:f.z};map.collide(p,f.rad);f.x=p.x;f.z=p.z;}
 if(f.markT>0){f.markT-=dt;if(f.markT<=0)setMark(f.mark,null);}
 const dx=P.x-f.x,dz=P.z-f.z,dist=Math.hypot(dx,dz),pAlive=P.hp>0&&!P.riding;
 let faceTo=null;
 if(f.stun>0){if(f.boss)f.stun=Math.min(f.stun,.8);f.stun-=dt;f.stars.visible=true;f.stars.rotation.y+=dt*5;f.aimT=0;f.burst=0;m.body.rotation.z=Math.sin(f.stun*8)*.12;
  if(f.stun<=0){f.stars.visible=false;m.body.rotation.z=0;}placeModel(f,null,dt);return true;}
 if(f.state==='guard'||f.state==='search'){
  // 发现小鸡：正面 11 米扇形，或 5 米内任何方向，要有视线
  if(pAlive){const fx=Math.sin(f.face),fz=Math.cos(f.face),cosA=(dx*fx+dz*fz)/(dist||1);
   if(((dist<11&&cosA>.4)||dist<5)&&map.losClear(f.x,f.z,P.x,P.z))alert(f);}
  if(f.state==='search'){if(moveTo(f,f.last[0],f.last[1],2,dt)){f.wait-=dt;f.face+=dt*1.5;if(f.wait<-3){f.state='guard';setMark(f.mark,null);}}}
  else if(f.patrol){const t=f.patrol[f.pi];if(moveTo(f,t[0],t[1],1.5,dt)){f.wait-=dt;if(f.wait<=0){f.pi=(f.pi+1)%f.patrol.length;f.wait=lr(1,2.5);}}}
  else{f.sp=0;f.wait-=dt;if(f.wait<=0){f.wait=lr(1.5,3.5);f.lookTo=f.face+lr(-.8,.8);}if(f.lookTo!=null)f.face=angLerp(f.face,f.lookTo,dt*2);}
  if(f.sp>.2)faceTo=Math.atan2(f.mvx,f.mvz);
 }else if(f.state==='combat'){
  if(f.alertT>0){f.alertT-=dt;placeModel(f,Math.atan2(dx,dz),dt);return true;}
  const los=pAlive&&dist<22&&map.losClear(f.x,f.z,P.x,P.z);
  if(los){f.seenT=0;f.last=[P.x,P.z];}else f.seenT+=dt;
  if(f.seenT>7&&!f.wave){f.state='search';f.wait=0;setMark(f.mark,'?');f.markT=3;if(f.spot){f.spot.taken=null;f.spot=null;}}
  if(f.type!=='rush'){// 远程：步枪兵找掩体；重装兵、队长边走边打
   const rifle=f.type==='rifle',spd=rifle?3.2:f.boss?1.9:2.2;
   if(rifle){f.reT-=dt;if(f.reT<=0||(f.spot&&!spotValid(f))){f.reT=lr(1.2,2);if(!spotValid(f))pickSpot(f);}}
   let moving=false;
   if(f.aimT<=0&&f.burst<=0){if(f.spot){moving=!moveTo(f,f.spot.x,f.spot.z,spd,dt);}
    else if(!los){moving=!moveTo(f,f.last[0],f.last[1],spd,dt);}
    else{const near=rifle?6:f.boss?6:4,far=rifle?12:f.boss?9:8,want=dist>far?1:dist<near?-1:0;if(want){moving=true;steer(f,f.x+dx/dist*want*2,f.z+dz/dist*want*2,spd*.85,dt);}else{f.sp=0;}}}
   else f.sp=0;
   f.cd-=dt;
   if(los&&pAlive){faceTo=Math.atan2(dx,dz);
    if(f.burst>0){f.burstT-=dt;if(f.burstT<=0){f.burstT=.14;f.burst--;foeShoot(f,f.boss?3:1,f.boss?.22:0);if(f.burst<=0)f.cd=f.boss?lr(1.2,1.6):lr(1.3,2.3);}}
    else if(f.aimT>0){f.aimT-=dt;if(f.aimT<=0){
     if(f.type==='heavy'){foeShoot(f,5,.5,12);f.cd=lr(2,2.8);}
     else if(f.boss)bossAttack(f);
     else{f.burst=3;f.burstT=0;}}}
    else if(f.cd<=0&&dist<18&&(!moving||!rifle)){f.aimT=AIM_T[f.type];sfx.aim();}}
   else{f.aimT=0;f.burst=0;}
   if(faceTo==null&&f.sp>.2)faceTo=Math.atan2(f.mvx,f.mvz);
  }else{// 冲锋：直接冲过来，近身挥棒
   f.cd-=dt;
   if(f.atkT>0){f.atkT-=dt;m.gun.rotation.x=-1.2*(1-f.atkT/.35);faceTo=Math.atan2(dx,dz);
    if(f.atkT<=0){m.gun.rotation.x=.6;if(dist<1.55&&pAlive)hurtPlayer(1,f.x,f.z);f.cd=1;fx.dust(f.x+dx/dist*.8,f.z+dz/dist*.8,4);}}
   else{m.gun.rotation.x=angLerp(m.gun.rotation.x,0,dt*6);
    if(pAlive&&dist<1.25&&f.cd<=0){f.atkT=.35;f.sp=0;}
    else{const tx=los?P.x:f.last[0],tz=los?P.z:f.last[1];moveTo(f,tx,tz,4.6,dt);if(f.sp>.2)faceTo=Math.atan2(f.mvx,f.mvz);}}}
 }
 placeModel(f,faceTo,dt);return true;}
// 队长的三种招式轮流用：一圈子弹、扇形、三连扇射
function bossAttack(f){const p=f.pat++%3;
 if(p===0){foeShoot(f,16,Math.PI*2,8.5);f.cd=1.4;hud.floatText(f.x,3,f.z,'弹幕！','#ffb060',14);}
 else if(p===1){foeShoot(f,7,1.1,12);f.cd=1.2;}
 else{f.burst=3;f.burstT=0;}}
function placeModel(f,faceTo,dt){const m=f.m;if(faceTo!=null)f.face=angLerp(f.face,faceTo,Math.min(1,dt*10));m.g.position.set(f.x,0,f.z);m.g.rotation.y=f.face;animWalk(m,dt,f.sp||0,T);
 const aiming=f.aimT>0;m.gun.position.z=.32-(f.recoil||0);f.recoil=Math.max(0,(f.recoil||0)-dt*1.5);
 f.bar.g.visible=f.hp<f.max&&!f.boss;f.bar.g.rotation.y=-f.face;f.bar.f.scale.x=.76*Math.max(0,f.hp/f.max);
 // 瞄准提示：枪口红光
 if(aiming&&Math.random()<dt*(f.boss?60:30)){const mp=f.m.muzzle.getWorldPosition(tmpV);fx.spark(mp.x,mp.y,mp.z,0xff3020,f.boss?3:1,.5);}}
// 分开挤在一起的敌人
function separate(){for(let i=0;i<foes.length;i++){const a=foes[i];if(a.state==='down')continue;for(let j=i+1;j<foes.length;j++){const b=foes[j];if(b.state==='down')continue;const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz),R=a.rad+b.rad;if(d<R&&d>1e-4){const k=(R-d)/2/d;a.x-=dx*k;a.z-=dz*k;b.x+=dx*k;b.z+=dz*k;}}
 const dx=P.x-a.x,dz=P.z-a.z,d=Math.hypot(dx,dz),R=a.rad+.4;if(d<R&&d>1e-4&&P.hp>0){const k=(R-d)/d;a.x-=dx*k*.5;a.z-=dz*k*.5;P.x+=dx*k*.5;P.z+=dz*k*.5;}}}

// ---------- 子弹 ----------
const bullets=[],bulletPool={};
function getBullet(key,foe){const pool=bulletPool[key]||(bulletPool[key]=[]);const g=pool.pop()||makeBullet(foe,foe?undefined:key);g.visible=true;return g;}
function fire(x,z,ang,foe,o={}){const sp=o.speed||(foe?13:26),key=foe?'e':(o.v||'corn'),g=getBullet(key,foe),dx=Math.sin(ang),dz=Math.cos(ang);g.position.set(x,.62,z);g.rotation.y=ang;
 const s=foe?1:Math.min(1.8,.9+(o.dmg||1)*.07+(o.boom?.15:0));g.userData.k.scale.setScalar(s);
 bullets.push({g,key,x,z,ox:x,oz:z,vx:dx*sp,vz:dz*sp,sp,life:(o.range||18)/sp,foe,dmg:o.dmg||1,pierce:o.pierce||0,bounce:o.bounce||0,boom:o.boom||0,fire:o.fire||0,ice:o.ice||0,homing:o.homing||0,crit:o.crit||0,hits:null});}
function foeShoot(f,n=1,spread=0,speed=13){f.m.g.position.set(f.x,0,f.z);f.m.g.rotation.y=f.face;f.m.g.updateMatrixWorld(true);const mp=f.m.muzzle.getWorldPosition(tmpV);
 const a0=Math.atan2(P.x-f.x,P.z-f.z);
 for(let i=0;i<n;i++){const a=n===1?a0+lr(-.07,.07):spread>=Math.PI*2-.01?a0+i/n*Math.PI*2:a0-spread/2+spread*i/(n-1)+lr(-.03,.03);fire(mp.x,mp.z,a,true,{speed,range:speed>10?18:16});}
 fx.muzzle(mp.x,mp.y,mp.z,Math.sin(a0),Math.cos(a0),0xff8040);fx.flashLight(mp.x,mp.y+.2,mp.z,0xff9040,4,.07);f.recoil=.08;sfx.foeShot();}
function updateBullets(dt){for(let i=bullets.length-1;i>=0;i--){const b=bullets[i];b.life-=dt;
 // 追踪：向前方最近的敌人拐弯
 if(b.homing&&!b.foe){let best=null,bd=7.5;const vx=b.vx/b.sp,vz=b.vz/b.sp;for(const f of foes){if(f.state==='down'||(b.hits&&b.hits.includes(f)))continue;const ox=f.x-b.x,oz=f.z-b.z,d=Math.hypot(ox,oz);if(d<bd&&(ox*vx+oz*vz)/d>.2){bd=d;best=f;}}
  if(best){const want=Math.atan2(best.x-b.x,best.z-b.z),cur=Math.atan2(b.vx,b.vz),a=angLerp(cur,want,Math.min(1,dt*(3+2.5*b.homing)));b.vx=Math.sin(a)*b.sp;b.vz=Math.cos(a)*b.sp;b.g.rotation.y=a;}}
 const nx=b.x+b.vx*dt,nz=b.z+b.vz*dt;let hit=null,ht=2;
 const ob=map.bulletHit(b.x,b.z,nx,nz,b.ox,b.oz);if(ob){hit={ob:ob.b};ht=ob.t;}
 const sx=nx-b.x,sz=nz-b.z,L2=sx*sx+sz*sz||1e-9;
 const test=(x,z,r)=>{const fx=b.x-x,fz=b.z-z,t=clamp(-(fx*sx+fz*sz)/L2,0,1),px=fx+sx*t,pz=fz+sz*t;return px*px+pz*pz<r*r?t:2;};
 if(b.foe){if(P.hp>0&&P.roll<=0&&!P.riding){const t=test(P.x,P.z,.42);if(t<ht){ht=t;hit={player:true};}}}
 else for(const f of foes){if(f.state==='down'||(b.hits&&b.hits.includes(f)))continue;const t=test(f.x,f.z,f.rad+.05);if(t<ht){ht=t;hit={foe:f};}}
 if(hit){const hx=b.x+sx*ht,hz=b.z+sz*ht;
  if(hit.player){hurtPlayer(1,b.x-b.vx,b.z-b.vz);fx.spark(hx,.62,hz,0xff8040,5,3);killBullet(i);continue;}
  if(hit.foe){hurtFoe(hit.foe,b.dmg,b.vx,b.vz,b);fx.popcorn(hx,.62,hz,5);if(b.boom)boomAt(hx,hz,b,hit.foe);
   if(b.pierce>0){b.pierce--;(b.hits||(b.hits=[])).push(hit.foe);b.x=hx;b.z=hz;b.g.position.set(hx,.62,hz);continue;}
   killBullet(i);continue;}
  // 障碍物
  if(hit.ob.kind==='barrel')hitBarrel(hit.ob);else if(!b.foe)sfx.thud();
  if(!b.foe&&b.boom)boomAt(hx,hz,b,null);
  if(!b.foe&&b.bounce>0&&hit.ob.alive){const o=hit.ob;let nxn=hx-o.x,nzn=hz-o.z;const l=Math.hypot(nxn,nzn)||1;nxn/=l;nzn/=l;const dot=b.vx*nxn+b.vz*nzn;b.vx-=2*dot*nxn;b.vz-=2*dot*nzn;
   b.x=o.x+nxn*(o.r+.08);b.z=o.z+nzn*(o.r+.08);b.ox=b.x;b.oz=b.z;b.bounce--;b.life=Math.max(b.life,.35);b.g.rotation.y=Math.atan2(b.vx,b.vz);fx.popcorn(hx,.62,hz,2);continue;}
  if(!b.foe)fx.popcorn(hx,.62,hz,3);else fx.spark(hx,.62,hz,0xff8040,5,3);
  killBullet(i);continue;}
 b.x=nx;b.z=nz;b.g.position.set(nx,.62,nz);if(b.life<=0){if(!b.foe)fx.popcorn(nx,.62,nz,2);killBullet(i);}}}
function killBullet(i){const b=bullets[i];b.g.visible=false;(bulletPool[b.key]||(bulletPool[b.key]=[])).push(b.g);bullets.splice(i,1);}
// 爆裂玉米：命中点小范围爆炸
function boomAt(x,z,b,skip){const R=1.1+.35*b.boom;fx.spark(x,.6,z,0xffa030,10,5);fx.dust(x,z,3,0x8a7a60,.3);fx.flashLight(x,.8,z,0xffa040,5,.12,5);
 for(const f of foes){if(f===skip||f.state==='down')continue;const d=Math.hypot(f.x-x,f.z-z);if(d<R+f.rad)hurtFoe(f,b.dmg*.6,f.x-x,f.z-z,{quiet:true});}}
let ftT=0;
function hurtFoe(f,dmg,vx,vz,o={}){if(f.state==='down')return;let crit=false;if(o.crit&&Math.random()<o.crit){dmg*=2;crit=true;}
 f.hp-=dmg;f.hitT=1;const l=Math.hypot(vx,vz)||1,kb=f.boss?.3:f.type==='heavy'?.8:2.2;f.kx+=vx/l*kb;f.kz+=vz/l*kb;hud.hitMark();sfx.pop();
 if(o.fire){f.burn=3;f.burnDps=Math.max(f.burnDps,1.2+o.fire*.9);}
 if(o.ice)f.slow=Math.max(f.slow,1.6+o.ice*.8);
 if(!o.quiet&&(crit||T-ftT>.05)){ftT=T;hud.floatText(f.x+lr(-.3,.3),1.5*(f.rad/.45),f.z,(crit?'暴击 ':'')+Math.round(dmg*10)/10,crit?'#ffd23a':'#ffffff',crit?17:12);}
 if(f.state!=='combat'){alert(f,.15);}else{f.last=[P.x,P.z];f.seenT=0;}
 if(f.hp<=0)knockOut(f);}
function knockOut(f){if(f.state==='down')return;f.state='down';f.downT=0;f.aimT=f.burst=0;f.burn=0;setMark(f.mark,null);f.bar.g.visible=false;flash(f.m,0);if(f.spot){f.spot.taken=null;f.spot=null;}stats.kills++;sfx.down();
 hud.floatText(f.x,1.6*(f.rad/.45),f.z,f.boss?'队长被打倒了！':'晕倒了!','#ffe27a',f.boss?18:13);
 // 掉落：经验 + 几率掉玉米币、爱心、臭蛋
 const xp=FT[f.type].xp,n=Math.min(5,Math.ceil(xp/3));for(let i=0;i<n;i++)dropPickup('xp',f.x+lr(-.5,.5),f.z+lr(-.5,.5),{pop:true,amount:Math.ceil(xp/n)});
 const r=Math.random();if(r<.5)dropPickup('coin',f.x,f.z);else if(r<.66&&P.hp<P.max)dropPickup('heart',f.x,f.z);else if(r<.71)dropPickup('stink',f.x,f.z);
 if(f.type==='heavy'&&Math.random()<.6)dropPickup(lpick(BULLET_BUFFS),f.x+.6,f.z,{pop:true});
 if(f.boss){for(let i=0;i<3;i++)dropPickup('heart',f.x+lr(-1,1),f.z+lr(-1,1),{pop:true});dropPickup('gold',f.x,f.z+1,{pop:true,life:0});fx.boom(f.x,f.z);shake=1;hud.banner('黄鼠狼队长被打倒了！','守住光圈，飞艇就要到了',2.6);}
 // 吸能
 if(P.up.leech){P.kos++;if(P.kos>=LEECH_N[P.up.leech]){P.kos=0;heal(1,'吸能');}}}
function heal(n,why){if(P.hp<=0)return;const h=Math.min(n,P.max-P.hp);if(h<=0)return;P.hp+=h;hud.floatText(P.x,2,P.z,`+${h} ❤️${why?' '+why:''}`,'#ff9ab8',15);}
function hurtPlayer(dmg,sx,sz){if(P.inv>0||P.roll>0||P.hp<=0||P.riding)return;
 if(P.shield){P.shield=false;P.inv=.8;sfx.shield();fx.shellBurst(P.x,.9,P.z);hud.floatText(P.x,1.8,P.z,'蛋壳盾碎了','#9fe6ff');return;}
 P.hp-=dmg;P.inv=.75;P.hurtT=1;shake=Math.max(shake,.35);sfx.hurt();flash(pm,1);
 const dx=P.x-sx,dz=P.z-sz,l=Math.hypot(dx,dz)||1;P.kx=dx/l*4;P.kz=dz/l*4;
 if(P.hp<=0)playerDown();}

// ---------- 油桶：打三下就炸 ----------
function hitBarrel(b){if(!b.alive)return;b.hp--;fx.spark(b.x,.7,b.z,0xffd070,4);sfx.thud();if(b.hp<=0)explode(b);}
function explode(b){if(!b.alive)return;b.alive=false;map.buildGrid();b.ref.visible=false;fx.boom(b.x,b.z);fx.flashLight(b.x,1.2,b.z,0xff8a30,18,.4,12);sfx.boom();shake=Math.max(shake,.9);
 const R=3.4;for(const f of foes){if(f.state==='down')continue;const d=Math.hypot(f.x-b.x,f.z-b.z);if(d<R+f.rad){hurtFoe(f,d<R*.6?24:10,f.x-b.x,f.z-b.z);f.kx+=(f.x-b.x)/(d||1)*6;f.kz+=(f.z-b.z)/(d||1)*6;}}
 const dp=Math.hypot(P.x-b.x,P.z-b.z);if(dp<R)hurtPlayer(dp<R*.6?2:1,b.x,b.z);
 for(const o of map.barrels)if(o.alive&&Math.hypot(o.x-b.x,o.z-b.z)<R)setTimeout(()=>{if(state==='play'||state==='pause'||state==='pick')explode(o);},160);
 noise(b.x,b.z,16);}

// ---------- 臭蛋 ----------
const throws=[];const stinkGeo=new THREE.SphereGeometry(.15,14,10),stinkMat=new THREE.MeshStandardMaterial({color:0x9be05a,roughness:.5,emissive:0x2f5a10});
const stinkR=()=>3.1*(1+.2*(P.up.stink||0));
function throwStink(){if(P.stink<=0||P.hp<=0||P.riding)return;P.stink--;sfx.throw();const dx=aim.x-P.x,dz=aim.z-P.z,d=Math.min(Math.hypot(dx,dz),9),a=Math.atan2(dx,dz);
 const m=new THREE.Mesh(stinkGeo,stinkMat);m.scale.y=1.25;m.castShadow=true;scene.add(m);throws.push({m,x0:P.x,z0:P.z,x1:P.x+Math.sin(a)*d,z1:P.z+Math.cos(a)*d,t:0,dur:.35+d*.05});}
function updateThrows(dt){for(let i=throws.length-1;i>=0;i--){const t=throws[i];t.t+=dt;const k=Math.min(t.t/t.dur,1);t.m.position.set(t.x0+(t.x1-t.x0)*k,.7+Math.sin(k*Math.PI)*2.2,t.z0+(t.z1-t.z0)*k);t.m.rotation.x+=dt*12;
 if(k>=1){scene.remove(t.m);throws.splice(i,1);const R=stinkR();fx.cloud(t.x1,t.z1,R*.85);sfx.splat();clouds.push({x:t.x1,z:t.z1,t:3.2,r:R*.85});
  for(const f of foes){if(f.state==='down')continue;if(Math.hypot(f.x-t.x1,f.z-t.z1)<R+f.rad){f.stun=3.5;f.aimT=f.burst=0;f.atkT=0;f.hitT=.6;if(f.state!=='combat')alert(f,0);hud.floatText(f.x,1.7,f.z,'好臭!','#b8f07a',13);}}}}
 for(let i=clouds.length-1;i>=0;i--){const c=clouds[i];c.t-=dt;if(c.t<=0){clouds.splice(i,1);continue;}if(Math.random()<dt*3)fx.cloud(c.x,c.z,c.r*.85,0x9fd060,2,1.6);
  for(const f of foes)if(f.state!=='down'&&Math.hypot(f.x-c.x,f.z-c.z)<c.r)f.stun=Math.max(f.stun,.6);}}
const clouds=[];

// ---------- 道具 ----------
const picks=[];let pickT=6;
function dropPickup(type,x,z,o={}){const obj=makePickup(type);obj.g.position.set(x,0,z);const p={type,x,z,obj,t:0,life:o.life??(type==='coin'||type==='xp'?24:28),ph:Math.random()*6,vy:o.pop?3:0,y:0,map:!!o.map,amount:o.amount||0};picks.push(p);return p;}
const PICK_W=[['rapid',2.5],['spread',2.5],['fire',2],['ice',1.5],['pierce',2],['boom',2],['homing',1.5],['speed',1.5],['shield',2],['heart',0],['stink',1]];
function spawnMapPickup(){let tot=0;const w=PICK_W.map(([t,v])=>[t,t==='heart'?(P.hp<P.max?3:0):v]);for(const o of w)tot+=o[1];let r=Math.random()*tot,type='rapid';for(const[t,v]of w){r-=v;if(r<=0){type=t;break;}}
 for(let k=0;k<40;k++){const a=Math.random()*6.28,d=lr(6,13),x=P.x+Math.sin(a)*d,z=P.z+Math.cos(a)*d;if(map.freeAt(x,z,.8)){const p=dropPickup(type,x,z,{map:true});hud.floatText(x,1.6,z,PICKUPS[type].name,hex(PICKUPS[type].col),13);return p;}}}
function collect(p){const D=PICKUPS[p.type],col=hex(D.col);let txt=D.name;
 if(D.dur>0){P.buffs[p.type]=D.dur;sfx.pickup();txt+=' · '+D.desc;}
 else if(p.type==='shield'){P.shield=true;sfx.pickup();}
 else if(p.type==='heart'){heal(1);sfx.pickup();txt='';}
 else if(p.type==='stink'){P.stink++;sfx.pickup();txt='+1 臭蛋';}
 else if(p.type==='coin'){const n=p.amount||Math.floor(lr(1,4));P.bag.coin+=n;sfx.coin();txt=`+${n} 玉米币`;}
 else if(p.type==='xp'){addXp(p.amount||1);txt='';}
 else if(p.type==='gold'){P.bag.gold++;sfx.gold();txt='+1 金蛋！';hud.banner('拿到金蛋','被打倒也不会丢失',2);}
 if(txt)hud.floatText(P.x,1.9,P.z,txt,col,15);}
function updatePicks(dt){if(P.hp>0){pickT-=dt;if(pickT<=0){pickT=lr(7,12);if(picks.filter(p=>p.map).length<4)spawnMapPickup();}}
 const mag=2.4+1.6*(P.up.magnet||0);
 for(let i=picks.length-1;i>=0;i--){const p=picks[i];p.t+=dt;if(p.life&&p.t>p.life){scene.remove(p.obj.g);picks.splice(i,1);continue;}
  if(p.vy){p.y+=p.vy*dt;p.vy-=12*dt;if(p.y<0){p.y=0;p.vy=0;}}
  const o=p.obj,small=p.type==='coin'||p.type==='xp';o.ic.position.y=(small?.45:.78)+Math.sin(T*3+p.ph)*.08+p.y;o.ic.rotation.y+=dt*2;o.ring.material.opacity=.55+.3*Math.sin(T*4+p.ph);
  o.g.visible=!(p.life&&p.life-p.t<4&&Math.sin(p.t*18)<0);
  const d=Math.hypot(P.x-p.x,P.z-p.z);
  const pull=p.type==='xp'?16:mag;
  if(small&&d<pull&&P.hp>0&&p.t>.35){const k=Math.min(1,dt*(p.type==='xp'?4+10*(1-d/pull)+p.t*2:6+12*(1-d/mag)));p.x+=(P.x-p.x)*k;p.z+=(P.z-p.z)*k;o.g.position.set(p.x,0,p.z);}
  if(d<.95&&P.hp>0&&!P.riding){collect(p);scene.remove(o.g);picks.splice(i,1);}}}

// ---------- 成长：经验、升级三选一、武器换代 ----------
function addXp(n){P.xp+=n;sfx.coin();
 while(P.xp>=xpNeed(P.lv)){P.xp-=xpNeed(P.lv);P.lv++;P.pending++;heal(1,'升级');
  const t=TIER_LV.reduce((a,l,i)=>P.lv>=l?i:a,0);if(t>P.tier){P.tier=t;pm.gun.scale.setScalar(1+t*.18);hud.banner(`武器升级：${TIERS[t].name}`,`Lv ${P.lv}`,2.6);sfx.capture();fx.spark(P.x,1,P.z,0xfff1a0,20,5);}}
 if(P.pending&&state==='play')openPick();}
function openPick(){state='pick';mouse.down=false;hud.playing(false);sfx.hold();const ch=rollChoices(P);
 const cards=ch.map(k=>k==='heal'?{icon:'❤️',name:'回满生命',desc:'所有强化都满级了',lvText:''}:{icon:UPGRADES[k].icon,name:UPGRADES[k].name,desc:UPGRADES[k].desc,lvText:`Lv ${(P.up[k]||0)} → ${(P.up[k]||0)+1}`});
 hud.picker(cards,i=>{applyUpgrade(ch[i]);P.pending=Math.max(0,P.pending-1);sfx.pickup();if(P.pending>0)openPick();else{state='play';hud.playing(true);last=performance.now();}});}
function applyUpgrade(k){if(k==='heal'){P.hp=P.max;return;}P.up[k]=(P.up[k]||0)+1;const U=UPGRADES[k];hud.floatText(P.x,2.2,P.z,`${U.icon} ${U.name} Lv ${P.up[k]}`,'#c8ff7a',15);
 if(k==='maxhp'){P.max++;P.hp=P.max;}if(k==='stink')P.stink+=2;}

// ---------- 搜箱子 ----------
function updateSearch(dt){let near=null,nd=1.5;if(P.hp>0&&!P.riding)for(const c of map.crates){if(c.looted)continue;const d=Math.hypot(c.x-P.x,c.z-P.z);if(d<nd){nd=d;near=c;}}
 if(!near){P.search=null;P.searchT=0;hud.prompt(0,0,null);return;}
 if(P.search!==near){P.search=near;P.searchT=0;}
 if(keys.KeyE){P.searchT+=dt;if(Math.random()<dt*8)sfx.search();}else P.searchT=Math.max(0,P.searchT-dt*2);
 const[x,y]=project(near.x,1.2,near.z);hud.prompt(x,y,keys.KeyE?'搜索中…':'搜索 木箱',P.searchT/1.1);
 if(P.searchT>=1.1){map.lootCrate(near);P.search=null;P.searchT=0;
  const coins=Math.floor(lr(2,7));dropPickup('coin',near.x+lr(-.6,.6),near.z+.9,{pop:true,amount:coins});
  dropPickup(lpick(BULLET_BUFFS),near.x+lr(-.8,.8),near.z-.9,{pop:true});
  const r=Math.random();if(r<.28)dropPickup('gold',near.x+.7,near.z+.4,{pop:true,life:0});else if(r<.55)dropPickup('stink',near.x-.7,near.z+.4,{pop:true});else if(r<.8)dropPickup(P.hp<P.max?'heart':'shield',near.x-.7,near.z+.4,{pop:true});
  fx.dust(near.x,near.z,5,0xc8a070,.35);sfx.coin();}}

// ---------- 撤离点 ----------
let active=0,holding=false,holdT=0,waveT=0,holdIn=false,reinfT=45,boss=null;
const airship=makeAirship();
const LAST=()=>active===map.EXITS.length-1;
function updateExit(dt){const E=map.EXITS[active];if(!E)return;const d=Math.hypot(P.x-E.x,P.z-E.z),inside=d<map.EXIT_R&&P.hp>0;
 if(inside&&!holding){holding=true;holdT=0;waveT=1.2;sfx.hold();hud.banner(`坚守撤离点 ${active+1}`,`在光圈里坚持 ${E.hold} 秒`,2.4);
  for(const f of foes)if(f.state!=='down'&&Math.hypot(f.x-E.x,f.z-E.z)<24)alert(f,.2);
  if(LAST()){airship.visible=true;airship.position.set(E.x+2,26,E.z-4);spawnBoss(E);}}
 if(holding){holdIn=inside;if(inside)holdT=Math.min(E.hold,holdT+dt);else holdT=Math.max(0,holdT-dt*.35);
  map.setExitProgress(active,holdT/E.hold);
  waveT-=dt;if(waveT<=0){waveT=Math.max(2.4,lr(4.5,6.2)-active*.9-holdT/E.hold*1.2);spawnWave(E);}
  if(LAST()){const k=clamp(holdT/E.hold,0,1);airship.position.y=THREE.MathUtils.lerp(26,0,k*k*(3-2*k));airship.position.x=E.x+2*(1-k);airship.position.z=E.z-4*(1-k);}
  if(holdT>=E.hold&&!(boss&&boss.state!=='down'))captureExit();}}
function spawnAt(cx,cz,r0,r1){for(let k=0;k<40;k++){const a=Math.random()*6.28,d=lr(r0,r1),x=cx+Math.sin(a)*d,z=cz+Math.cos(a)*d;if(map.freeAt(x,z,.8))return[x,z];}return null;}
function waveType(){const r=Math.random();if(active>=1&&r<.1+active*.06)return'heavy';return Math.random()<.45+active*.08?'rush':'rifle';}
function spawnWave(E){const near=foes.filter(f=>f.state!=='down'&&Math.hypot(f.x-E.x,f.z-E.z)<26).length;if(near>6+active*3)return;const n=1+active+(Math.random()<.5?1:0);
 for(let i=0;i<n;i++){const p=spawnAt(E.x,E.z,14,19);if(p)spawnFoe(waveType(),p[0],p[1],{state:'combat',wave:true,face:Math.atan2(E.x-p[0],E.z-p[1])});}}
function spawnBoss(E){const p=spawnAt(E.x,E.z,12,15)||[E.x+12,E.z];boss=spawnFoe('boss',p[0],p[1],{state:'combat',wave:true});hud.banner('黄鼠狼队长来了！','打倒它，飞艇才能降落',2.8);sfx.alert();}
// 不在坚守的时候，定期有一队黄鼠狼增援赶过来
function updateReinforce(dt){if(holding||P.hp<=0||P.riding)return;reinfT-=dt;if(reinfT>0)return;reinfT=lr(28,38);
 const n=Math.min(5,2+Math.floor(stats.time/150));let k=0;
 for(let i=0;i<n;i++){const p=spawnAt(P.x,P.z,18,24);if(!p)continue;const t=stats.time>200&&Math.random()<.25?'heavy':Math.random()<.5?'rush':'rifle';spawnFoe(t,p[0],p[1],{state:'combat',wave:true});k++;}
 if(k)hud.banner('黄鼠狼增援！',`${k} 只巡逻兵正在赶来`,1.8);}
function captureExit(){const E=map.EXITS[active];holding=false;map.exitFx[active].flag.visible=true;map.setExitProgress(active,0);P.hp=P.max;
 active++;reinfT=lr(30,40);if(active>=map.EXITS.length){victory();return;}
 sfx.capture();hud.banner(`撤离点 ${active}/3 已占领`,'生命回满 · 额外升级一次',2.6);
 for(const f of foes)if(f.state!=='down'&&f.wave&&Math.random()<.5){f.state='search';f.wave=false;f.last=[f.x+lr(-6,6),f.z+lr(-6,6)];}
 P.pending++;openPick();}

// ---------- 玩家更新 ----------
function tryRoll(){if(P.roll>0||P.st<.28||P.hp<=0||P.riding)return;let dx=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0),dz=(keys.KeyS||keys.ArrowDown?1:0)-(keys.KeyW||keys.ArrowUp?1:0);
 if(!dx&&!dz){dx=Math.sin(P.face);dz=Math.cos(P.face);}const l=Math.hypot(dx,dz);P.rdx=dx/l;P.rdz=dz/l;P.roll=.34;P.st-=.28;sfx.roll();fx.dust(P.x,P.z,4);}
function playerFire(){const W=weaponStats(P);P.fireCd=W.rate;pm.g.position.set(P.x,0,P.z);pm.g.rotation.y=P.face;pm.g.updateMatrixWorld(true);
 const mp=pm.muzzle.getWorldPosition(tmpV),a=Math.atan2(aim.x-mp.x,aim.z-mp.z)+lr(-.02,.02),px=Math.cos(a),pz=-Math.sin(a);
 const v=W.fire?'fire':W.ice?'ice':W.boom?'boom':'corn',o={dmg:W.dmg,pierce:W.pierce,bounce:W.bounce,boom:W.boom,fire:W.fire,ice:W.ice,homing:W.homing,crit:W.crit,speed:W.speed,range:W.range,v};
 for(const off of W.barrels)fire(mp.x+px*off,mp.z+pz*off,a,false,o);
 for(let k=1;k<=W.spread;k++){const s=Math.ceil(k/2)*.15*(k%2?1:-1);fire(mp.x,mp.z,a+s,false,o);}
 fx.muzzle(mp.x,mp.y,mp.z,Math.sin(a),Math.cos(a),v==='fire'?0xff7030:v==='ice'?0x9fe6ff:0xffd070);fx.flashLight(mp.x,mp.y+.3,mp.z,0xffc060,5,.06);P.recoil=.09;sfx.shot();noise(P.x,P.z,12);}
function updatePlayer(dt){if(P.riding)return;
 if(P.hp<=0){P.downT+=dt;const k=Math.min(P.downT/.4,1);pm.body.rotation.x=-k*1.4;pm.body.position.y=k*.12;return;}
 for(const b in P.buffs)P.buffs[b]=Math.max(0,P.buffs[b]-dt);P.inv=Math.max(0,P.inv-dt);P.hurtT=Math.max(0,P.hurtT-dt*2.5);flash(pm,P.hurtT*.8);
 if(P.up.regen){P.regenT+=dt;if(P.regenT>=REGEN_T[P.up.regen]){P.regenT=0;heal(1,'自愈');}}
 let mx=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0),mz=(keys.KeyS||keys.ArrowDown?1:0)-(keys.KeyW||keys.ArrowUp?1:0);const ml=Math.hypot(mx,mz);if(ml){mx/=ml;mz/=ml;}
 const mv=1+.1*(P.up.move||0),sprint=keys.ShiftLeft||keys.ShiftRight;let sp=5*mv*(P.buffs.speed>0?1.45:1);
 if(sprint&&ml&&P.st>.02){sp*=1.4;P.st=Math.max(0,P.st-dt*.32);}else P.st=Math.min(1,P.st+dt*(ml?.18:.28)*mv);
 const px=P.x,pz=P.z;
 if(P.roll>0){P.roll-=dt;P.x+=P.rdx*12*dt;P.z+=P.rdz*12*dt;pm.body.rotation.x=(1-P.roll/.34)*Math.PI*2;}else{pm.body.rotation.x=0;P.x+=mx*sp*dt;P.z+=mz*sp*dt;}
 P.x+=P.kx*dt;P.z+=P.kz*dt;P.kx*=Math.exp(-dt*9);P.kz*=Math.exp(-dt*9);
 map.collide(P,.42);P.moving=Math.hypot(P.x-px,P.z-pz)/dt;
 const ax=aim.x-P.x,az=aim.z-P.z;P.face=angLerp(P.face,Math.atan2(ax,az),Math.min(1,dt*18));
 P.fireCd-=dt;if(mouse.down&&P.fireCd<=0&&P.roll<=0)playerFire();
 P.recoil=Math.max(0,P.recoil-dt*1.2);pm.gun.position.z=.22-P.recoil;
 pm.g.position.set(P.x,0,P.z);pm.g.rotation.y=P.face;animWalk(pm,dt,P.roll>0?0:P.moving,T);
 shieldMesh.visible=P.shield;if(P.shield)shieldMesh.rotation.y+=dt;
 pm.g.visible=!(P.inv>0&&Math.sin(P.inv*40)>.3)||P.roll>0;
 P.dustT-=dt;if(P.moving>5.5&&P.dustT<=0){P.dustT=.12;fx.dust(P.x,P.z,1,0xc8b080,.18);}}
function playerDown(){P.downT=0;sfx.lose();shake=.6;setTimeout(()=>{if(state==='play'||state==='pick'){hud.picker(null);endRun(false);}},1700);}

// ---------- 镜头 ----------
let zoom=1,shake=0;const camT=new THREE.Vector3(),CAMOFF=new THREE.Vector3(0,22.5,13.6);
function updateCamera(dt,snap){const lead=.2,tx=P.x+clamp(aim.x-P.x,-8,8)*lead,tz=P.z+clamp(aim.z-P.z,-6,6)*lead;
 if(snap)camT.set(tx,0,tz);else{camT.x+=(tx-camT.x)*Math.min(1,dt*5);camT.z+=(tz-camT.z)*Math.min(1,dt*5);}
 shake=Math.max(0,shake-dt*1.8);const s=shake*shake*.6;
 camera.position.set(camT.x+CAMOFF.x*zoom+lr(-s,s),CAMOFF.y*zoom+lr(-s,s),camT.z+CAMOFF.z*zoom+lr(-s,s));camera.lookAt(camT.x,0,camT.z-1);
 const sx=Math.round(camT.x*2)/2,sz=Math.round(camT.z*2)/2;sun.position.set(sx+SUNOFF.x,SUNOFF.y,sz+SUNOFF.z);sun.target.position.set(sx,0,sz);
 POOL.uPP.value.set(P.x,0,P.z);}

// ---------- HUD ----------
const TIPS=['躲在大石头和卡车后面，子弹打不穿','黄鼠狼瞄准时枪口会冒红光，看到就翻滚','油桶打三下就会爆炸，把附近的黄鼠狼一起炸晕','臭蛋能把一群黄鼠狼熏晕好几秒','木箱里有玉米币和子弹增强，运气好还有金蛋','坚守的时候别离开光圈太久，进度会倒退','每升 3 级武器会换代，越打越强','占领撤离点会回满生命，还能额外升级一次','选「自愈」和「吸能」能让你打得更久'];
function updateHud(dt){const E=map.EXITS[active];const bossUp=boss&&boss.state!=='down';
 hud.mission(active,map.EXITS.length,holding?(bossUp&&holdT>=E.hold?'<span style="color:#ffd0a0">打倒黄鼠狼队长，飞艇才能降落</span>':holdIn?'守住光圈！敌人正在围过来':'<span style="color:#ffb0a0">回到光圈里继续坚守</span>'):E?`前往撤离点 ${active+1}，站进绿色光圈`:'登上蛋壳飞艇');
 if(!E)hud.dist('蛋壳飞艇','起飞！',null);
 if(E){const d=Math.hypot(E.x-P.x,E.z-P.z);if(holding)hud.dist('坚守中',holdT>=E.hold?'打倒队长':`${Math.ceil(E.hold-holdT)} 秒`,holdT/E.hold);else hud.dist(`撤离点 ${active+1}`,`${Math.round(d)} 米`,null);
  hud.compass(Math.atan2(E.x-P.x,-(E.z-P.z)));}
 hud.boss(bossUp?'黄鼠狼队长':null,bossUp?boss.hp/boss.max:0);
 hud.hearts(Math.max(0,P.hp),P.max,P.shield);hud.stamina(P.st);hud.level(P.lv,P.xp/xpNeed(P.lv));
 const W=weaponStats(P),B=[];for(const k of[...BULLET_BUFFS,'speed'])if(P.buffs[k]>0)B.push({name:PICKUPS[k].name,t:P.buffs[k],col:hex(PICKUPS[k].col)});
 hud.weapon(W.name,B,{stink:P.stink,coin:P.bag.coin,gold:P.bag.gold});
 hud.wstat(`伤害 ${W.dmg} · 每秒 ${((W.barrels.length+W.spread)/W.rate).toFixed(0)} 发`);
 hud.ups(Object.entries(P.up).map(([k,lv])=>({icon:UPGRADES[k].icon,name:UPGRADES[k].name,lv})));
 hud.tip(stats.time<14?'<k>WASD</k> 移动　<k>鼠标</k> 瞄准　<k>左键</k> 发射玉米粒　<k>空格</k> 翻滚　<k>E</k> 搜箱子　<k>Q</k> 臭蛋':stats.time<26?'打晕黄鼠狼会掉绿色经验，升级时三选一强化；每 3 级武器换代':'');
 hud.cross(mouse.x,mouse.y);hud.updateFloats(dt,project);
 finalPass.uniforms.uHurt.value=Math.max(P.hurtT*.9,P.hp===1?.35+.15*Math.sin(T*5):0,P.hp<=0?.8:0);}

// ---------- 流程 ----------
let state='title',T=0;const stats={kills:0,time:0};
function clearRun(){for(const f of foes)removeFoe(f);foes.length=0;for(let i=bullets.length-1;i>=0;i--)killBullet(i);for(const p of picks)scene.remove(p.obj.g);picks.length=0;
 for(const t of throws)scene.remove(t.m);throws.length=0;clouds.length=0;for(const s of map.coverSpots)s.taken=null;hud.clearFloats();hud.picker(null);hud.boss(null);}
function startRun(){audio.init();clearRun();map.resetMap();map.buildGrid();resetPlayer();active=0;holding=false;holdT=0;pickT=4;reinfT=45;boss=null;stats.kills=0;stats.time=0;placeFoes();airship.visible=false;airship.rotation.set(0,0,0);
 dropPickup('gold',map.OUTPOST_A[0],map.OUTPOST_A[1]-.6,{life:0});dropPickup('gold',map.OUTPOST_B[0],map.OUTPOST_B[1]-.8,{life:0});dropPickup('rapid',map.START[0]+2.5,map.START[1]-4,{map:true,life:0});
 save.runs++;persist();state='play';hud.screen(null);hud.playing(true);updateAim();updateCamera(0,true);sfx.click();
 hud.banner('撤离行动','依次占领 3 个撤离点',2.6);}
function pause(){state='pause';hud.playing(false);hud.screen('pause',{q:quality.high?'高':'低'},{resume,quit:()=>{endRun(false,true);}});}
function resume(){state='play';hud.screen(null);hud.playing(true);last=performance.now();}
const fmt=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
function endRun(win,quit=false){state='end';hud.playing(false);hud.prompt(0,0,null);hud.boss(null);
 const d={points:active,kills:stats.kills,time:fmt(stats.time),gold:P.bag.gold,coin:P.bag.coin,hp:P.hp,lv:P.lv,weapon:TIERS[P.tier].name,tip:lpick(TIPS)};
 save.gold+=P.bag.gold;save.bestLv=Math.max(save.bestLv||0,P.lv);if(win){save.coin+=P.bag.coin;save.wins++;}persist();
 if(quit){showTitle();return;}hud.screen(win?'win':'dead',d,{start:startRun,title:showTitle});}
function showTitle(){state='title';hud.playing(false);hud.screen('title',save,{start:startRun});}
// 胜利：飞艇落地，小鸡跳进吊篮，飞走
let winT=-1;
function victory(){holding=false;P.riding=true;winT=0;sfx.win();hud.banner('突围成功！','蛋壳飞艇起飞',3);
 for(const f of foes)if(f.state!=='down'){f.stun=8;}}
function updateVictory(dt){if(winT<0)return;winT+=dt;const E=map.EXITS[map.EXITS.length-1];
 if(winT<.8){const k=winT/.8;P.x+=(E.x-P.x)*k*.2;P.z+=(E.z-P.z)*k*.2;pm.g.position.set(P.x,Math.sin(k*Math.PI)*1.4,P.z);}
 else{if(pm.g.parent!==airship){airship.attach(pm.g);pm.g.position.set(0,1.05,0);pm.g.rotation.set(0,Math.PI/2,0);}airship.position.y+=dt*(winT-.8)*2.2;airship.position.x+=dt*(winT-.8)*1.2;airship.rotation.z=Math.sin(T*2)*.03;}
 airship.userData.prop.rotation.x+=dt*20;
 if(winT>4.2){winT=-1;scene.attach(pm.g);pm.g.visible=false;endRun(true);}}

// ---------- 主循环 ----------
function tick(dt){stats.time+=dt;updatePlayer(dt);updateExit(dt);updateReinforce(dt);
 for(let i=foes.length-1;i>=0;i--)if(!updateFoe(foes[i],dt))foes.splice(i,1);separate();
 updateBullets(dt);updateThrows(dt);updatePicks(dt);updateSearch(dt);updateVictory(dt);}
let last=performance.now(),slow=0;
function frame(now){requestAnimationFrame(frame);const raw=Math.min(.05,(now-last)/1000);last=now;const dt=state==='play'?raw:0;T+=raw;
 // 帧率太低时自动降画质
 if(quality.high&&raw>.034){slow+=raw;if(slow>3){setQuality(false);slow=0;}}else slow=Math.max(0,slow-raw*.5);
 if(state==='play'){updateAim();tick(dt);updateHud(dt);}
 if(state==='pick')hud.updateFloats(0,project);
 if(state==='title'){// 标题界面：镜头在营地上空缓缓移动
  P.x=Math.sin(T*.05)*12;P.z=8+Math.cos(T*.07)*10;aim.set(P.x,0,P.z);if(!pm.g.parent||pm.g.parent===scene)pm.g.visible=false;}
 if(state==='play'||state==='title')updateCamera(raw,false);
 map.updateMap(raw,T,active,holding&&holdIn);fx.updateFx(state==='pause'||state==='pick'?0:raw);
 if(airship.visible)airship.userData.prop.rotation.x+=raw*12;
 composer.render(raw);}
resetPlayer();P.x=0;P.z=8;updateCamera(0,true);showTitle();requestAnimationFrame(frame);
// 调试用：在控制台里 window.__game 可以看到状态
window.__game={P,foes,map,mouse,aim,keys,bullets,picks,stats,start:startRun,choose:i=>hud.choose(i),addXp,
 step:(n,dt=1/60)=>{for(let i=0;i<n&&state==='play';i++){tick(dt);T+=dt;}},get active(){return active;},set active(v){active=v;},get holding(){return holding;},get holdT(){return holdT;},get boss(){return boss;},
 snap:()=>{updateAim();updateCamera(0,true);},get state(){return state;}};
