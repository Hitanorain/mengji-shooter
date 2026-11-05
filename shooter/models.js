// 角色和物件模型：头盔萌鸡、黄鼠狼士兵、玉米粒子弹、道具、蛋壳飞艇（全部程序化几何体）
import {THREE,scene,STD} from './engine.js';

const sph=(r,ws=24,hs=16)=>new THREE.SphereGeometry(r,ws,hs);
function kit(){const mats=[],M=(p,o)=>{const m=STD(p,o);m.userData.e=m.emissive.clone();mats.push(m);return m;};
 const add=(par)=>(geo,m,x,y,z,s=[1,1,1])=>{const me=new THREE.Mesh(geo,m);me.position.set(x,y,z);me.scale.set(...s);me.castShadow=me.receiveShadow=true;par.add(me);return me;};
 return{mats,M,add};}
// 受击闪白：k = 0..1
export function flash(d,k){for(const m of d.mats)m.emissive.copy(m.userData.e).lerp(WHITE,k);}
const WHITE=new THREE.Color(1,1,1);

// 脚下的软阴影
const blobTex=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.5,'rgba(255,255,255,.55)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);})();
const blobMat=new THREE.MeshBasicMaterial({color:0x0a1205,alphaMap:blobTex,transparent:true,opacity:.42,depthWrite:false});
function blob(g,r){const m=new THREE.Mesh(new THREE.PlaneGeometry(r*2,r*2),blobMat);m.rotation.x=-Math.PI/2;m.position.y=.025;m.renderOrder=1;g.add(m);return m;}
// ---------- 萌鸡士兵：圆身体、绿头盔、小背包、玉米发射器 ----------
export function makeChick(o={}){const{mats,M,add}=kit(),g=new THREE.Group(),body=new THREE.Group(),feet=[];g.add(body);const mk=add(body);
 const mB=M({color:o.body??0xffd447,roughness:.85},{det:[18,.2,.07,1],rim:[.38,.32,.18]}),mBelly=M({color:0xfff0b4,roughness:.9},{det:[20,.15,.05,1],rim:[.3,.28,.2]}),mO=M({color:0xf2942a,roughness:.5}),mK=M({color:0x141414,roughness:.25}),
  mW=M({color:0xffffff,emissive:0xffffff,emissiveIntensity:.6}),mP=M({color:0xff9a9a,roughness:.9}),mH=M({color:o.helmet??0x5f7d38,roughness:.5,metalness:.2},{det:[9,.3,.16,1],rim:[.12,.15,.1]}),mH2=M({color:0x4a6229,roughness:.7},{det:[12,.25,.15,1]}),
  mPack=M({color:0x7a6038,roughness:.9},{det:[16,.4,.18,1]}),mRoll=M({color:0x6f7d42,roughness:.95},{det:[18,.45,.15,1]}),mGun=M({color:0x3c4628,roughness:.5,metalness:.4},{det:[10,.15,.2,1]}),mMet=M({color:0x2a2b27,roughness:.4,metalness:.7}),
  mCorn=M({color:0xf7c83a,roughness:.5,emissive:0x3a2a00}),mLeaf=M({color:0x8cc04a,roughness:.8});
 mk(sph(.42),mB,0,.5,0,[1,.92,1.04]);mk(sph(.3),mBelly,0,.46,.17,[1,.95,.72]);
 mk(sph(.31),mB,0,.98,.06);
 // 头盔
 mk(new THREE.SphereGeometry(.35,24,12,0,Math.PI*2,0,Math.PI*.5),mH,0,1.03,.03,[1,.84,1.04]);
 mk(new THREE.CylinderGeometry(.37,.38,.045,24),mH2,0,1.03,.03);
 const lf=mk(new THREE.ConeGeometry(.05,.24,5),mLeaf,.14,1.3,-.06);lf.rotation.z=-.5;const lf2=mk(new THREE.ConeGeometry(.04,.18,5),mLeaf,.2,1.24,.04);lf2.rotation.z=-.9;
 // 脸
 for(const s of[-1,1]){mk(sph(.046,12,8),mK,.12*s,.98,.33);mk(sph(.016,6,4),mW,.13*s,1.0,.37);mk(sph(.055,10,6),mP,.2*s,.9,.27,[1,.6,.4]);}
 mk(new THREE.ConeGeometry(.075,.16,10),mO,0,.9,.4).rotation.x=Math.PI/2;
 // 翅膀、尾巴、脚
 for(const s of[-1,1]){mk(sph(.2),mB,.4*s,.55,-.02,[.3,.6,.9]).rotation.z=.35*s;
  const f=new THREE.Group();f.position.set(.14*s,0,.04);g.add(f);feet.push(f);const fk=add(f);
  fk(new THREE.CylinderGeometry(.035,.035,.2,6),mO,0,.12,0);fk(new THREE.BoxGeometry(.16,.04,.22),mO,0,.02,.06);}
 mk(new THREE.ConeGeometry(.12,.22,8),mB,0,.62,-.44).rotation.x=-2.2;
 // 背包 + 铺盖卷
 mk(new THREE.BoxGeometry(.42,.42,.22),mPack,0,.62,-.42);mk(new THREE.BoxGeometry(.34,.14,.06),M({color:0x5e4828,roughness:.9}),0,.52,-.54);
 mk(new THREE.CylinderGeometry(.09,.09,.48,12),mRoll,0,.88,-.42).rotation.z=Math.PI/2;
 // 玉米发射器（右翅膀抱着）
 const gun=new THREE.Group();gun.position.set(.3,.58,.22);body.add(gun);const gk=add(gun);
 gk(new THREE.BoxGeometry(.13,.15,.5),mGun,0,0,0);gk(new THREE.CylinderGeometry(.036,.04,.3,10),mMet,0,.02,.38).rotation.x=Math.PI/2;
 gk(new THREE.BoxGeometry(.08,.16,.08),mGun,0,-.12,-.08);
 gk(new THREE.CapsuleGeometry(.065,.2,4,10),mCorn,0,.13,.02).rotation.x=Math.PI/2;
 for(const a of[-.5,0,.5]){const l=gk(new THREE.ConeGeometry(.035,.16,4),mLeaf,a*.06,.14,-.17);l.rotation.x=-Math.PI/2-.5;l.rotation.z=a;}
 const muzzle=new THREE.Object3D();muzzle.position.set(0,.02,.56);gun.add(muzzle);
 blob(g,.62);
 if(o.scale)g.scale.setScalar(o.scale);
 (o.parent||scene).add(g);return{g,body,feet,gun,muzzle,mats,ph:0};}

// ---------- 黄鼠狼士兵：黑头盔、红围巾、长尾巴，拿步枪或木棒 ----------
export function makeWeasel(o={}){const{mats,M,add}=kit(),g=new THREE.Group(),body=new THREE.Group(),feet=[];g.add(body);const mk=add(body);
 const mF=M({color:o.fur??0x9a683a,roughness:.9},{det:[16,.3,.12,.6],rim:[.22,.16,.1]}),mC=M({color:0xf0dcb8,roughness:.9},{det:[18,.2,.08,1],rim:[.2,.18,.14]}),mK=M({color:0x111111,roughness:.3}),mW=M({color:0xffffff,emissive:0xffffff,emissiveIntensity:.5}),
  mHel=M({color:o.helmet??0x262626,roughness:.4,metalness:o.helmet?.6:.3},{det:[10,.22,.15,1],rim:[.1,.1,.1]}),mR=M({color:o.scarf??0xc8261c,roughness:.85},{det:[22,.35,.15,1]}),mGun=M({color:0x2b2b2b,roughness:.4,metalness:.6}),mStock=M({color:0x6a4426,roughness:.8});
 const tr=mk(new THREE.CapsuleGeometry(.25,.6,6,14),mF,0,.62,-.04);tr.rotation.x=.3;
 const bl=mk(new THREE.CapsuleGeometry(.18,.48,6,12),mC,0,.64,.08);bl.rotation.x=.3;
 mk(sph(.22),mF,0,1.14,.16,[1,.95,1.15]);
 mk(sph(.11),mC,0,1.08,.36,[1.1,.8,1]);mk(sph(.04,8,6),mK,0,1.11,.47);
 for(const s of[-1,1]){mk(sph(.036,10,8),mK,.09*s,1.19,.34);mk(sph(.012,6,4),mW,.1*s,1.205,.37);
  const br=mk(new THREE.BoxGeometry(.08,.018,.02),mK,.09*s,1.25,.35);br.rotation.z=-.45*s;     // 皱眉
  mk(sph(.07,10,8),mF,.16*s,1.32,.08,[1,1,.5]);
  const arm=mk(new THREE.CapsuleGeometry(.06,.26,4,8),mF,.25*s,.76,.14);arm.rotation.x=-1;arm.rotation.z=.15*s;
  const f=new THREE.Group();f.position.set(.13*s,0,.02);g.add(f);feet.push(f);const fk=add(f);
  fk(new THREE.CapsuleGeometry(.06,.14,4,8),mF,0,.12,0);fk(new THREE.BoxGeometry(.13,.05,.22),mF,0,.025,.06);}
 const tail=mk(new THREE.CapsuleGeometry(.08,.7,4,10),mF,0,.36,-.6);tail.rotation.x=-1.15;mk(sph(.09),M({color:0x3a2614,roughness:.9}),0,.2,-.96);
 // 黑头盔 + 红围巾
 mk(new THREE.SphereGeometry(.26,22,12,0,Math.PI*2,0,Math.PI*.5),mHel,0,1.22,.14,[1,.85,1.08]);mk(new THREE.CylinderGeometry(.28,.29,.035,22),mHel,0,1.22,.14);
 const sc=mk(new THREE.TorusGeometry(.2,.07,8,22),mR,0,.95,.12);sc.rotation.x=Math.PI/2-.2;
 const st=mk(new THREE.BoxGeometry(.12,.28,.05),mR,-.12,.82,-.12);st.rotation.set(.3,0,.25);
 // 武器
 const gun=new THREE.Group();gun.position.set(.22,.74,.32);body.add(gun);const gk=add(gun);let muzzle;
 if(o.club){const c=gk(new THREE.CylinderGeometry(.06,.035,.7,8),mStock,0,.2,.1);c.rotation.x=-.9;muzzle=new THREE.Object3D();muzzle.position.set(0,.45,.4);gun.add(muzzle);}
 else{gk(new THREE.BoxGeometry(.08,.12,.6),mGun,0,0,.1);gk(new THREE.BoxGeometry(.09,.14,.3),mStock,0,-.02,-.28);gk(new THREE.CylinderGeometry(.025,.025,.3,8),mGun,0,.02,.52).rotation.x=Math.PI/2;
  gk(new THREE.BoxGeometry(.05,.16,.07),mGun,0,-.12,.08);muzzle=new THREE.Object3D();muzzle.position.set(0,.02,.7);gun.add(muzzle);}
 blob(g,.6);
 if(o.scale)g.scale.setScalar(o.scale);
 scene.add(g);return{g,body,feet,gun,muzzle,mats,ph:0,tail};}

// 走路：左右摇摆 + 抬脚
export function animWalk(d,dt,sp,t){d.ph+=dt*sp*3.4;const m=Math.min(sp/3,1),s=Math.sin(d.ph),c=Math.cos(d.ph);
 d.body.rotation.z=s*.1*m;d.body.position.y=Math.abs(c)*.06*m;d.body.scale.y=1+Math.sin(t*2.4)*.015*(1-m);
 d.feet[0].position.z=.04+s*.16*m;d.feet[1].position.z=.04-s*.16*m;d.feet[0].position.y=Math.max(0,c)*.08*m;d.feet[1].position.y=Math.max(0,-c)*.08*m;}

// ---------- 子弹 ----------
const kernelGeo=new THREE.SphereGeometry(.1,12,8);kernelGeo.scale(1,.8,1.35);
const KV={corn:[0xffd040,0xffa000,[1.6,1.1,.3]],fire:[0xff6a20,0xff3a00,[2.6,.7,.15]],ice:[0xbff2ff,0x40c8ff,[.5,1.6,2.6]],boom:[0xffb030,0xff7000,[2.2,1.1,.2]]};
const kMats={},tMats={};for(const k in KV){const[c,e,t]=KV[k];kMats[k]=new THREE.MeshStandardMaterial({color:c,emissive:e,emissiveIntensity:1.5,roughness:.4});
 tMats[k]=new THREE.MeshBasicMaterial({color:new THREE.Color(...t),transparent:true,opacity:.5,blending:THREE.AdditiveBlending,depthWrite:false});}
const mFoe=new THREE.MeshBasicMaterial({color:new THREE.Color(4,1.1,.35)});
const trailGeo=new THREE.ConeGeometry(.07,1,8,1,true);trailGeo.translate(0,-.5,0);trailGeo.rotateX(-Math.PI/2);
const mTrailP=new THREE.MeshBasicMaterial({color:new THREE.Color(1.6,1.1,.3),transparent:true,opacity:.45,blending:THREE.AdditiveBlending,depthWrite:false});
const mTrailE=new THREE.MeshBasicMaterial({color:new THREE.Color(2.4,.6,.2),transparent:true,opacity:.55,blending:THREE.AdditiveBlending,depthWrite:false});
const foeGeo=new THREE.CapsuleGeometry(.07,.22,4,8);foeGeo.rotateX(Math.PI/2);
export function makeBullet(foe,v='corn'){const g=new THREE.Group();const k=new THREE.Mesh(foe?foeGeo:kernelGeo,foe?mFoe:kMats[v]);k.castShadow=true;g.add(k);
 const tr=new THREE.Mesh(trailGeo,foe?mTrailE:tMats[v]);tr.scale.set(1,1,foe?1.4:1.2);g.add(tr);g.userData.k=k;scene.add(g);return g;}

// ---------- 道具 ----------
export const PICKUPS={
 rapid:{name:'连发玉米',desc:'射速翻倍',col:0xffd23a,dur:15},
 spread:{name:'三连玉米',desc:'扇形散射',col:0xff9a2a,dur:15},
 speed:{name:'火辣椒',desc:'跑得飞快',col:0xff4a3a,dur:12},
 shield:{name:'蛋壳盾',desc:'挡一次伤害',col:0x9fe6ff,dur:0},
 heart:{name:'爱心',desc:'恢复 1 颗心',col:0xff7aa8,dur:0},
 stink:{name:'臭蛋',desc:'+1 颗臭蛋',col:0x9be05a,dur:0},
 coin:{name:'玉米币',desc:'',col:0xffe27a,dur:0},
 xp:{name:'经验',desc:'',col:0xb6ff6a,dur:0},
 fire:{name:'火焰玉米',desc:'子弹点燃敌人',col:0xff5a20,dur:15},
 ice:{name:'冰霜玉米',desc:'子弹让敌人变慢',col:0x7fd8ff,dur:15},
 pierce:{name:'穿甲玉米',desc:'子弹穿透 2 个敌人',col:0xd8e0ea,dur:15},
 boom:{name:'爆裂玉米',desc:'命中时爆炸',col:0xffa030,dur:15},
 homing:{name:'追踪玉米',desc:'子弹自动拐弯',col:0xff7ad8,dur:15},
 gold:{name:'金蛋',desc:'',col:0xffcf3a,dur:0},
};
const pm=(c,e=.25)=>new THREE.MeshStandardMaterial({color:c,roughness:.45,emissive:c,emissiveIntensity:e});
function icon(type){const g=new THREE.Group(),add=(geo,m,x,y,z)=>{const me=new THREE.Mesh(geo,m);me.position.set(x,y,z);me.castShadow=true;g.add(me);return me;};
 if(type==='rapid'||type==='coin'){const c=add(new THREE.CapsuleGeometry(.13,.3,6,12),pm(0xf7c83a,.35),0,0,0);c.rotation.z=.4;
  for(const a of[-.6,0,.6]){const l=add(new THREE.ConeGeometry(.07,.32,5),pm(0x7fbf3a,.15),Math.sin(.4)*-.2+a*.05,-.26,0);l.rotation.z=.4+a+Math.PI;}
  if(type==='coin')g.scale.setScalar(.6);}
 else if(type==='spread'){for(const a of[-.45,0,.45]){const k=add(kernelGeo,pm(0xffc030,.5),Math.sin(a)*.25,Math.cos(a)*.25-.1,0);k.rotation.z=-a;k.scale.setScalar(1.3);}}
 else if(type==='speed'){const c=add(new THREE.ConeGeometry(.12,.5,12),pm(0xe8321e,.3),0,0,0);c.rotation.z=2.6;add(new THREE.CylinderGeometry(.03,.03,.12,6),pm(0x4f9a2a,.2),.12,.24,0).rotation.z=-.6;}
 else if(type==='shield'){const s=add(new THREE.SphereGeometry(.24,20,12,0,Math.PI*2,0,Math.PI*.62),pm(0xfff6e4,.3),0,0,0);s.scale.y=1.25;s.rotation.x=-.4;}
 else if(type==='heart'){const m=pm(0xff4f7a,.4);add(new THREE.SphereGeometry(.13,14,10),m,-.1,.06,0);add(new THREE.SphereGeometry(.13,14,10),m,.1,.06,0);const c=add(new THREE.ConeGeometry(.19,.3,14),m,0,-.12,0);c.rotation.z=Math.PI;}
 else if(type==='stink'){const e=add(new THREE.SphereGeometry(.17,16,12),pm(0x9be05a,.35),0,0,0);e.scale.y=1.25;}
 else if(type==='xp'){const e=add(new THREE.OctahedronGeometry(.13,0),new THREE.MeshStandardMaterial({color:0xc8ff7a,emissive:0x7acc20,emissiveIntensity:1.4,roughness:.3}),0,0,0);e.scale.y=1.4;g.scale.setScalar(.8);}
 else if(type==='fire'){const k=add(kernelGeo,pm(0xff6a20,.8),0,0,0);k.scale.setScalar(1.8);const f=add(new THREE.ConeGeometry(.11,.3,8),new THREE.MeshBasicMaterial({color:new THREE.Color(2.5,.9,.2)}),0,.26,0);}
 else if(type==='ice'){const c=add(new THREE.OctahedronGeometry(.2,0),pm(0xbff2ff,.7),0,0,0);c.scale.y=1.5;}
 else if(type==='pierce'){const c=add(new THREE.ConeGeometry(.1,.5,6),pm(0xdfe6ee,.4),0,0,0);c.rotation.z=-Math.PI/2;add(new THREE.CylinderGeometry(.03,.03,.3,6),pm(0x9a7a50,.1),-.3,0,0).rotation.z=Math.PI/2;}
 else if(type==='boom'){add(new THREE.SphereGeometry(.18,16,12),pm(0x2a2a2a,.05),0,0,0);add(new THREE.CylinderGeometry(.03,.03,.14,6),pm(0x9a7a50,.1),0,.22,0);add(new THREE.SphereGeometry(.05,8,6),new THREE.MeshBasicMaterial({color:new THREE.Color(3,1.5,.3)}),0,.31,0);}
 else if(type==='homing'){const t=add(new THREE.TorusGeometry(.18,.04,8,24),pm(0xff7ad8,.6),0,0,0);add(new THREE.SphereGeometry(.06,10,8),pm(0xff7ad8,.8),0,0,0);}
 else if(type==='gold'){const e=add(new THREE.SphereGeometry(.2,20,14),new THREE.MeshStandardMaterial({color:0xffcf3a,emissive:0x9a6400,emissiveIntensity:.8,metalness:.85,roughness:.2}),0,0,0);e.scale.y=1.3;}
 return g;}
const[bc,bx]=(()=>{const c=document.createElement('canvas');c.width=4;c.height=64;return[c,c.getContext('2d')];})();{const gr=bx.createLinearGradient(0,0,0,64);gr.addColorStop(0,'#000');gr.addColorStop(1,'#fff');bx.fillStyle=gr;bx.fillRect(0,0,4,64);}
const beamAlpha=new THREE.CanvasTexture(bc);
export function makePickup(type){const P=PICKUPS[type],g=new THREE.Group(),ic=icon(type);ic.position.y=.75;g.add(ic);
 const small=type==='coin'||type==='xp';
 const ring=new THREE.Mesh(new THREE.RingGeometry(.38,.46,40),new THREE.MeshBasicMaterial({color:P.col,transparent:true,opacity:.8,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.04;g.add(ring);
 let beam=null;if(!small){beam=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,2.6,24,1,true),new THREE.MeshBasicMaterial({color:P.col,alphaMap:beamAlpha,transparent:true,opacity:.35,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));beam.position.y=1.3;g.add(beam);}
 if(small){ring.scale.setScalar(.6);ic.position.y=.45;}
 scene.add(g);return{g,ic,ring,beam};}

// ---------- 头顶标记、血条、晕倒的星星 ----------
function markTex(ch,col){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');x.font='900 54px system-ui,sans-serif';x.textAlign='center';x.textBaseline='middle';x.lineWidth=8;x.strokeStyle='rgba(0,0,0,.75)';x.strokeText(ch,32,35);x.fillStyle=col;x.fillText(ch,32,35);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
const markMat={'!':new THREE.SpriteMaterial({map:markTex('!','#ff4a3a'),depthTest:false,transparent:true}),'?':new THREE.SpriteMaterial({map:markTex('?','#ffd23a'),depthTest:false,transparent:true})};
export function makeMark(par){const s=new THREE.Sprite(markMat['!']);s.scale.set(.55,.55,1);s.position.y=1.95;s.visible=false;s.renderOrder=10;par.add(s);return s;}
export function setMark(s,ch){if(!ch){s.visible=false;return;}s.visible=true;s.material=markMat[ch];}
const barBg=new THREE.SpriteMaterial({color:0x1a1a1a,depthTest:false,transparent:true,opacity:.7}),barFg=new THREE.SpriteMaterial({color:0xff5a4a,depthTest:false});
export function makeBar(par){const g=new THREE.Group();g.position.y=1.7;g.visible=false;par.add(g);
 const b=new THREE.Sprite(barBg);b.scale.set(.8,.09,1);b.renderOrder=10;g.add(b);const f=new THREE.Sprite(barFg);f.center.set(0,.5);f.position.x=-.38;f.scale.set(.76,.055,1);f.renderOrder=11;g.add(f);return{g,f};}
const starShape=new THREE.Shape();for(let i=0;i<10;i++){const a=i/10*Math.PI*2-Math.PI/2,r=i%2?.045:.11;i?starShape.lineTo(Math.cos(a)*r,Math.sin(a)*r):starShape.moveTo(Math.cos(a)*r,Math.sin(a)*r);}
const starGeo=new THREE.ExtrudeGeometry(starShape,{depth:.03,bevelEnabled:false});const mStar=new THREE.MeshBasicMaterial({color:new THREE.Color(2,1.7,.4)});
export function makeStars(par){const g=new THREE.Group();g.position.y=1.5;g.visible=false;par.add(g);for(let i=0;i<3;i++){const s=new THREE.Mesh(starGeo,mStar);const a=i/3*Math.PI*2;s.position.set(Math.cos(a)*.32,0,Math.sin(a)*.32);g.add(s);}return g;}

// ---------- 蛋壳飞艇 ----------
export function makeAirship(){const g=new THREE.Group(),m=(c,r=.7,mt=0)=>STD({color:c,roughness:r,metalness:mt});
 const add=(geo,mat,x,y,z,par=g)=>{const me=new THREE.Mesh(geo,mat);me.position.set(x,y,z);me.castShadow=me.receiveShadow=true;par.add(me);return me;};
 const shell=m(0xfbf1dc,.55),dark=m(0x7a5432,.9),rope=m(0xc8b48a,.9),wood=m(0x8b6238,.85);
 const e=add(new THREE.SphereGeometry(1.6,32,22),shell,0,4.2,0);e.scale.set(1.35,1,1);
 // 裂纹腰带：锯齿状的深色环
 const pts=[];for(let i=0;i<=48;i++){const a=i/48*Math.PI*2,y=(i%2?.16:-.16);pts.push(new THREE.Vector3(Math.cos(a)*1.62*1.35,4.2+y,Math.sin(a)*1.62));}
 add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts,true,'catmullrom',0),96,.06,6,true),dark,0,0,0);
 for(const s of[-1,1]){const f=add(new THREE.BoxGeometry(.06,.8,.6),m(0xe2632e,.7),s*0,4.3+s*0,0);f.position.set(-2.2,4.2+s*.55,0);f.rotation.x=s*.5;}
 const prop=new THREE.Group();prop.position.set(-2.35,4.2,0);g.add(prop);for(let i=0;i<3;i++){const b=add(new THREE.BoxGeometry(.04,.9,.14),m(0x6a6a6a,.4,.6),0,0,0,prop);b.rotation.x=i/3*Math.PI*2;b.geometry.translate(0,.45,0);}
 const bk=add(new THREE.BoxGeometry(1.6,.7,1.2),wood,0,1.35,0);add(new THREE.BoxGeometry(1.7,.1,1.3),dark,0,1.72,0);
 for(const[x,z]of[[-.7,-.5],[.7,-.5],[-.7,.5],[.7,.5]]){const r=add(new THREE.CylinderGeometry(.025,.025,1.9,5),rope,x*.9,2.6,z*.9);r.rotation.z=x*.25;r.rotation.x=-z*.25;}
 g.userData.prop=prop;scene.add(g);g.visible=false;return g;}
