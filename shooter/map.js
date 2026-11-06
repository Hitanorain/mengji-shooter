// 地图「林间营地」：土路、军绿卡车、电线杆、两个沙袋哨站、石头、灌木、树、成片的草和野花
// 碰撞全部用圆：tall = 高掩体（挡视线、挡所有子弹）；其余是矮掩体（挡子弹，但贴着它开枪时子弹能越过去）
import {THREE,scene,rnd,rr,pick,clamp,segDist,STD,POOL} from './engine.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// ---------- 布局 ----------
export const BOUNDS={x0:-33,x1:33,z0:-36,z1:29};
export const START=[-2,25];
export const EXITS=[{x:-15,z:13,hold:45},{x:21,z:-4,hold:60},{x:-12,z:-29,hold:75}];
export const EXIT_R=2.4;
export const OUTPOST_A=[12,13],OUTPOST_B=[3,-25.5];
const TRUCK=[-20.4,-8.6],TRUCK_A=-.3;
const ROAD_K=[[-50,-1],[-34,-4],[-20,-7.6],[-6,-11.5],[8,-14],[22,-18.5],[36,-24],[50,-29]];
const RW=3.1;   // 土路半宽
export const ROAD=new THREE.CatmullRomCurve3(ROAD_K.map(([x,z])=>new THREE.Vector3(x,0,z))).getSpacedPoints(220).map(v=>[v.x,v.z]);
export function roadDist(x,z){let d=1e9;for(let i=0;i<ROAD.length-1;i++){const[ax,az]=ROAD[i],[bx,bz]=ROAD[i+1];if(Math.abs(ax-x)>6&&Math.abs(bx-x)>6)continue;d=Math.min(d,segDist(x,z,ax,az,bx,bz));}return d;}
function roadAt(x){for(let i=0;i<ROAD.length-1;i++){const[ax,az]=ROAD[i],[bx,bz]=ROAD[i+1];if(x>=ax&&x<=bx){const t=(x-ax)/(bx-ax),dz=bz-az,dx=bx-ax,l=Math.hypot(dx,dz);return{z:az+dz*t,nx:-dz/l,nz:dx/l,a:Math.atan2(dz,dx)};}}return{z:0,nx:0,nz:1,a:0};}

// ---------- 碰撞、子弹、视线 ----------
export const obs=[];        // {x,z,r,tall,bullet,kind,ref}
export const bushes=[];     // 灌木（之后做潜行）
export const crates=[];     // 可搜索的箱子
export const barrels=[];    // 可引爆的油桶
function ob(x,z,r,o={}){const b={x,z,r,tall:!!o.tall,bullet:o.bullet!==false,kind:o.kind||'',alive:true};obs.push(b);return b;}
export function collide(p,r=.42){for(const b of obs){if(!b.alive)continue;const dx=p.x-b.x,dz=p.z-b.z,R=r+b.r,d2=dx*dx+dz*dz;if(d2>=R*R)continue;const d=Math.sqrt(d2)||1e-4;p.x=b.x+dx/d*R;p.z=b.z+dz/d*R;}
 p.x=clamp(p.x,BOUNDS.x0,BOUNDS.x1);p.z=clamp(p.z,BOUNDS.z0,BOUNDS.z1);}
// 线段 a→b 碰到的第一个障碍物。矮掩体离开枪点 (ox,oz) 很近时不算（越过掩体射击）
export function bulletHit(ax,az,bx,bz,ox,oz){const dx=bx-ax,dz=bz-az,L2=dx*dx+dz*dz||1e-9;let best=null,bt=2;
 for(const b of obs){if(!b.alive||!b.bullet)continue;
  if(!b.tall&&Math.hypot(b.x-ox,b.z-oz)<b.r+1.35)continue;
  const fx=ax-b.x,fz=az-b.z,B=fx*dx+fz*dz,C=fx*fx+fz*fz-b.r*b.r;if(C<0){if(0<bt){bt=0;best=b;}continue;}
  const D=B*B-L2*C;if(D<0)continue;const t=(-B-Math.sqrt(D))/L2;if(t>=0&&t<=1&&t<bt){bt=t;best=b;}}
 return best?{b:best,t:bt}:null;}
export function losClear(ax,az,bx,bz){const dx=bx-ax,dz=bz-az,L2=dx*dx+dz*dz||1e-9;
 for(const b of obs){if(!b.alive||!b.tall)continue;const fx=ax-b.x,fz=az-b.z,t=clamp(-(fx*dx+fz*dz)/L2,0,1),px=fx+dx*t,pz=fz+dz*t;if(px*px+pz*pz<b.r*b.r*.85)return false;}return true;}
export function freeAt(x,z,pad=.5){if(x<BOUNDS.x0+1||x>BOUNDS.x1-1||z<BOUNDS.z0+1||z>BOUNDS.z1-1)return false;for(const b of obs)if(b.alive&&Math.hypot(x-b.x,z-b.z)<b.r+pad)return false;return true;}
export function inBush(x,z){for(const h of bushes)if(Math.hypot(x-h.x,z-h.z)<h.r)return true;return false;}

// ---------- 贴图工具 ----------
function cnv(n,m=n){const c=document.createElement('canvas');c.width=n;c.height=m;return[c,c.getContext('2d')];}
export function tex(c,srgb=true){const t=new THREE.CanvasTexture(c);if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;return t;}
function speck(x,x0,y0,w,h,n,cols,s0,s1){for(let i=0;i<n;i++){x.fillStyle=pick(cols);const s=rr(s0,s1);x.fillRect(x0+rnd()*w,y0+rnd()*h,s,s*rr(.8,1.6));}}
function blob(x,px,py,r,col,a){const g=x.createRadialGradient(px,py,0,px,py,r);g.addColorStop(0,`rgba(${col},${a})`);g.addColorStop(1,`rgba(${col},0)`);x.fillStyle=g;x.fillRect(px-r,py-r,r*2,r*2);}
function planks(N,n,cols){const[c,x]=cnv(N),ph=N/n;
 for(let i=0;i<n;i++){x.fillStyle=pick(cols);x.fillRect(0,i*ph,N,ph);x.strokeStyle='rgba(40,25,12,.2)';x.lineWidth=1;
  for(let k=0;k<12;k++){const y=i*ph+rr(3,ph-3);x.beginPath();x.moveTo(0,y);for(let u=0;u<=N;u+=16)x.lineTo(u,y+Math.sin(u*.05+k)*rr(.5,2));x.stroke();}
  x.fillStyle='rgba(30,18,8,.8)';x.fillRect(0,i*ph,N,2);}
 return[c,x];}
function makeCrateTex(){const N=256,[c,x]=planks(N,4,['#a87a4a','#9a6d40','#b38654']);
 x.strokeStyle='#6e4b2a';x.lineWidth=28;x.strokeRect(14,14,N-28,N-28);x.lineWidth=24;x.beginPath();x.moveTo(24,N-24);x.lineTo(N-24,24);x.stroke();
 x.strokeStyle='rgba(0,0,0,.35)';x.lineWidth=2;x.strokeRect(28,28,N-56,N-56);x.strokeRect(1,1,N-2,N-2);
 speck(x,0,0,N,N,1400,['rgba(0,0,0,.14)','rgba(255,230,190,.1)'],1,3);return c;}
function makeAmmoTex(){const N=256,[c,x]=cnv(N);x.fillStyle='#56603a';x.fillRect(0,0,N,N);speck(x,0,0,N,N,5000,['rgba(0,0,0,.08)','rgba(255,255,255,.06)'],1,3);
 x.fillStyle='rgba(0,0,0,.25)';x.fillRect(0,N*.12,N,8);x.fillRect(0,N*.82,N,8);x.fillStyle='#3e4528';x.fillRect(N*.08,N*.2,N*.84,N*.6);
 x.fillStyle='rgba(235,225,190,.75)';x.font='bold 58px "Microsoft YaHei",sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText('玉米',N/2,N/2+4);return c;}
function makeDetail(){const N=512,[c,x]=cnv(N);x.fillStyle='rgb(128,128,128)';x.fillRect(0,0,N,N);x.lineCap='round';
 for(let i=0;i<10000;i++){const g=Math.round(rr(80,180)),px=rnd()*N,py=rnd()*N,a=-Math.PI/2+rr(-.7,.7),l=rr(3,9);x.strokeStyle=`rgba(${g},${g},${g},.5)`;x.lineWidth=rr(1,2);x.beginPath();x.moveTo(px,py);x.lineTo(px+Math.cos(a)*l,py+Math.sin(a)*l);x.stroke();}
 return c;}

// ---------- 地面 ----------
const WM=100,GS=2048,PX=GS/WM,gp=v=>(v+WM/2)*PX;
function strokeLine(x,pts,w,style,off=0){x.beginPath();pts.forEach((p,i)=>{let px=p[0],pz=p[1];if(off){const q=pts[Math.min(i+1,pts.length-1)],o=pts[Math.max(i-1,0)],tx=q[0]-o[0],tz=q[1]-o[1],l=Math.hypot(tx,tz)||1;px+=-tz/l*off;pz+=tx/l*off;}
 i?x.lineTo(gp(px),gp(pz)):x.moveTo(gp(px),gp(pz));});x.strokeStyle=style;x.lineWidth=w;x.stroke();}
function makeGround(){const[c,x]=cnv(GS);x.fillStyle='#5f9234';x.fillRect(0,0,GS,GS);
 for(let i=0;i<900;i++)blob(x,rnd()*GS,rnd()*GS,rr(40,220),pick(['104,150,52','80,126,40','122,160,62','90,134,46','70,112,36','130,150,58']),.3);
 for(let i=0;i<2600;i++)blob(x,rnd()*GS,rnd()*GS,rr(6,22),pick(['96,130,52','74,108,42','126,150,70','140,160,74']),.3);
 // 踩秃的泥地：哨站、撤离点、出发点
 for(const[px,pz,r]of[[...OUTPOST_A,5],[...OUTPOST_B,6],[...START,3.5],[TRUCK[0]+2,TRUCK[1]+3,4]])for(let k=0;k<6;k++)blob(x,gp(px+rr(-1.5,1.5)),gp(pz+rr(-1.5,1.5)),r*PX*rr(.6,1),'124,100,64',.38);
 for(const e of EXITS)blob(x,gp(e.x),gp(e.z),3.2*PX,'132,112,72',.45);
 // 土路
 const[rc,rx]=cnv(GS);rx.lineCap=rx.lineJoin='round';
 strokeLine(rx,ROAD,(RW+1.1)*2*PX,'rgba(118,88,54,.45)');strokeLine(rx,ROAD,RW*2*PX,'#80593a');
 rx.globalCompositeOperation='source-atop';
 for(let i=0;i<500;i++)blob(rx,rnd()*GS,rnd()*GS,rr(20,80),pick(['150,112,74','100,70,44','134,98,62']),.35);
 speck(rx,0,0,GS,GS,90000,['#6c4a30','#94694a','#5c3e28','#a07a58','#7a5438','#b09a80'],.8,2.6);
 for(const o of[-2.1,-1.35,1.35,2.1])strokeLine(rx,ROAD,.28*PX,'rgba(62,44,28,.32)',o);
 for(const o of[-1.72,1.72])strokeLine(rx,ROAD,.9*PX,'rgba(150,118,84,.16)',o);
 rx.globalCompositeOperation='source-over';x.drawImage(rc,0,0);
 // 路边的草渗进土里
 for(let i=0;i<9000;i++){const k=Math.floor(rnd()*ROAD.length),[px,pz]=ROAD[k],q=ROAD[Math.min(k+1,ROAD.length-1)],tx=q[0]-px,tz=q[1]-pz,l=Math.hypot(tx,tz)||1,s=rnd()<.5?1:-1,o=(RW-rr(-.3,.7))*s;
  x.fillStyle=pick(['#5d8d33','#6f9c3c','#4f7d2c']);x.fillRect(gp(px-tz/l*o),gp(pz+tx/l*o),rr(1.5,4),rr(1.5,4));}
 return c;}
const detT=tex(makeDetail(),false);detT.repeat.set(26,26);
{const gm=STD({map:tex(makeGround()),roughness:1}),ob0=gm.onBeforeCompile;
 gm.onBeforeCompile=(sh,r)=>{ob0(sh,r);sh.uniforms.tDet={value:detT};sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D tDet;')
  .replace('#include <map_fragment>','#include <map_fragment>\n{vec3 dt=texture2D(tDet,vMapUv*26.).rgb*.6+texture2D(tDet,vMapUv*9.7).rgb*.4;diffuseColor.rgb*=mix(vec3(1.),dt*2.,.75);}');};
 const g=new THREE.Mesh(new THREE.PlaneGeometry(WM,WM),gm);g.rotation.x=-Math.PI/2;g.receiveShadow=true;scene.add(g);
 const o=new THREE.Mesh(new THREE.PlaneGeometry(400,400),STD({color:0x3f5a26,roughness:1}));o.rotation.x=-Math.PI/2;o.position.y=-.03;scene.add(o);}

// ---------- 几何工具 ----------
function colorize(g,fn){g=g.index?g.toNonIndexed():g;if(g.attributes.uv)g.deleteAttribute('uv');const p=g.attributes.position,col=new Float32Array(p.count*3),c=new THREE.Color();
 for(let i=0;i<p.count;i+=3){fn(c,p.getY(i),p.getX(i),p.getZ(i));for(let k=0;k<3;k++)c.toArray(col,(i+k)*3);}g.setAttribute('color',new THREE.BufferAttribute(col,3));return g;}
function lumpy(g,amt){const p=g.attributes.position,v=new THREE.Vector3();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);const n=Math.sin(v.x*12.9+v.y*7.3+v.z*4.1)*.5+Math.sin(v.x*3.1-v.z*5.7+v.y*2.3)*.5;v.multiplyScalar(1+n*amt);p.setXYZ(i,v.x,v.y,v.z);}g.computeVertexNormals();return g;}
export function mesh(geo,m,x,y,z,par=scene){const me=new THREE.Mesh(geo,m);me.position.set(x,y,z);me.castShadow=me.receiveShadow=true;par.add(me);return me;}
function scatter(geo,mat,list,shadow=true){if(!list.length)return null;const im=new THREE.InstancedMesh(geo,mat,list.length),m=new THREE.Matrix4(),q=new THREE.Quaternion(),c=new THREE.Color();
 list.forEach((o,i)=>{q.setFromEuler(new THREE.Euler(o.rx||0,o.ry??rnd()*6.28,o.rz||0));m.compose(new THREE.Vector3(o.x,o.y||0,o.z),q,new THREE.Vector3(o.sx||o.s||1,o.sy||o.s||1,o.sz||o.s||1));im.setMatrixAt(i,m);im.setColorAt(i,c.setHSL(o.h??0,o.sat??0,o.l??1));});
 im.castShadow=shadow;im.receiveShadow=true;scene.add(im);return im;}
const mVeg=STD({vertexColors:true,flatShading:true,roughness:.85},{cut:true,det:[3.2,.25,.16,1]});
const mVegSolid=STD({vertexColors:true,flatShading:true,roughness:.85},{det:[4,.3,.18,1]});
// 树冠、灌木随风轻轻摇
function sway(m,h0,amp){const ob=m.onBeforeCompile;m.onBeforeCompile=(sh,r)=>{ob(sh,r);sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float uTime;').replace('#include <begin_vertex>',`#include <begin_vertex>
#ifdef USE_INSTANCING
{vec4 wp=instanceMatrix*vec4(0.,0.,0.,1.);float h=max(position.y-${h0.toFixed(2)},0.);transformed.x+=sin(uTime*1.1+wp.x*.4+wp.z*.3)*h*${amp.toFixed(3)};transformed.z+=cos(uTime*.9+wp.z*.5+wp.x*.2)*h*${(amp*.7).toFixed(3)};}
#endif`);};}
sway(mVeg,1.6,.035);sway(mVegSolid,.2,.04);

// 关键区域：装饰物不要放进去
const KEEP=[[...START,3.5],[...OUTPOST_A,5],[...OUTPOST_B,6],[TRUCK[0],TRUCK[1],5],...EXITS.map(e=>[e.x,e.z,EXIT_R+1.6])];
function blocked(x,z,pad=0,road=true){if(road&&roadDist(x,z)<RW+.6+pad)return true;for(const[kx,kz,r]of KEEP)if(Math.hypot(x-kx,z-kz)<r+pad)return true;
 for(const b of obs)if(Math.hypot(x-b.x,z-b.z)<b.r+.5+pad)return true;return false;}
function freeSpot(x0,x1,z0,z1,pad=0){for(let k=0;k<300;k++){const x=rr(x0,x1),z=rr(z0,z1);if(!blocked(x,z,pad))return[x,z];}return null;}
const IN=[BOUNDS.x0+1,BOUNDS.x1-1,BOUNDS.z0+1,BOUNDS.z1-1];

// ---------- 道具材质 ----------
const crateT=tex(makeCrateTex()),ammoT=tex(makeAmmoTex());
const mCrate=STD({map:crateT,bumpMap:crateT,bumpScale:1.4,roughness:.85},{det:[9,.12,.12,.3]}),mCrateOpen=STD({map:crateT,color:0x777066,roughness:.9});
const mAmmo=STD({map:ammoT,roughness:.65,metalness:.25},{det:[7,.15,.18,1]});
const mBarrel=STD({color:0xb02a1e,roughness:.4,metalness:.45},{det:[5,.12,.22,.4]}),mBand=STD({color:0x3a1410,roughness:.45,metalness:.6},{det:[8,.1,.2,1]}),mBarrelTop=STD({color:0x8e231a,roughness:.45,metalness:.5},{det:[6,.15,.25,1]});
const mWood=STD({color:0x6e4a2e,roughness:.92},{det:[6,.35,.3,.25]}),mWoodTop=STD({color:0xc9a273,roughness:.85},{det:[14,.2,.22,1]}),mPole=STD({color:0x5e4129,roughness:.9},{cut:true,det:[8,.3,.28,.15]}),mWire=new THREE.MeshBasicMaterial({color:0x1a1a1a});
const mFence=STD({color:0x8a6440,roughness:.9},{det:[8,.3,.28,.2]});

// ---------- 木箱、弹药箱、油桶 ----------
function crate(x,z,s=.9,ry=rr(-.4,.4),search=false,y0=0){const m=mesh(new THREE.BoxGeometry(s,s,s),mCrate,x,y0+s/2,z);m.rotation.y=ry;
 const o=y0?null:ob(x,z,s*.6,{kind:'crate'});
 if(search){const mk=new THREE.Mesh(new THREE.OctahedronGeometry(.12,0),new THREE.MeshBasicMaterial({color:0xfff4c0}));mk.position.set(x,y0+s+.45,z);scene.add(mk);
  crates.push({x,z,mesh:m,marker:mk,looted:false,ph:rnd()*6,y:y0+s+.45,open:mCrateOpen,closed:mCrate});}
 return m;}
function ammo(x,z,ry=rr(-.5,.5),y0=0){const m=mesh(new THREE.BoxGeometry(.85,.42,.5),mAmmo,x,y0+.21,z);m.rotation.y=ry;
 mesh(new THREE.BoxGeometry(.87,.05,.52),mBand,0,.13,0,m);if(!y0)ob(x,z,.42,{kind:'ammo'});return m;}
function barrel(x,z,tip=false){const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);
 mesh(new THREE.CylinderGeometry(.32,.32,.95,20),mBarrel,0,.475,0,g);mesh(new THREE.CylinderGeometry(.3,.3,.02,20),mBarrelTop,0,.955,0,g);
 for(const y of[.22,.5,.75]){const r=mesh(new THREE.TorusGeometry(.322,.022,6,28),mBand,0,y,0,g);r.rotation.x=Math.PI/2;}
 const b=ob(x,z,.36,{kind:'barrel'});b.hp=3;b.ref=g;barrels.push(b);return b;}

// ---------- 沙袋墙：一圈压扁的布袋，三层错缝 ----------
const bagList=[];
function sandbagArc(cx,cz,R,a0,a1,layers=3){const n=Math.ceil(Math.abs(a1-a0)*R/.62);
 for(let l=0;l<layers;l++)for(let i=0;i<=n;i++){const t=(i+(l%2)*.5)/n;if(t>1)continue;const a=a0+(a1-a0)*t,x=cx+Math.cos(a)*R,z=cz+Math.sin(a)*R;if(l==layers-1&&rnd()<.18)continue;
  bagList.push({x:x+rr(-.04,.04),y:.14+l*.25,z:z+rr(-.04,.04),ry:-a+Math.PI/2+rr(-.12,.12),sx:.36,sy:.15,sz:.21,h:.1,sat:rr(.18,.26),l:rr(.56,.66)});
  if(l==0&&i%1==0)ob(x,z,.33,{kind:'bag'});}}
function sandbagLine(ax,az,bx,bz,layers=3){const L=Math.hypot(bx-ax,bz-az),n=Math.ceil(L/.62),a=Math.atan2(bz-az,bx-ax);
 for(let l=0;l<layers;l++)for(let i=0;i<=n;i++){const t=(i+(l%2)*.5)/n;if(t>1)continue;const x=ax+(bx-ax)*t,z=az+(bz-az)*t;
  bagList.push({x,y:.14+l*.25,z,ry:-a+rr(-.12,.12),sx:.36,sy:.15,sz:.21,h:.1,sat:rr(.18,.26),l:rr(.56,.66)});if(l==0)ob(x,z,.33,{kind:'bag'});}}
{// 让沙袋是圆鼓鼓的枕头形
 const g=new THREE.SphereGeometry(1,14,8),p=g.attributes.position;for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);p.setXYZ(i,Math.sign(x)*Math.pow(Math.abs(x),.7),y*(1-.25*x*x),Math.sign(z)*Math.pow(Math.abs(z),.8));}g.computeVertexNormals();
 var bagGeo=g;}

// ---------- 哨站 A（草地上，朝南） ----------
sandbagArc(OUTPOST_A[0],OUTPOST_A[1],3.1,Math.PI*.14,Math.PI*.86);
barrel(OUTPOST_A[0]-3.6,OUTPOST_A[1]-.6);barrel(OUTPOST_A[0]-4.1,OUTPOST_A[1]-1.3);
ammo(OUTPOST_A[0]-2.8,OUTPOST_A[1]-1.6,.2);crate(OUTPOST_A[0]+3.4,OUTPOST_A[1]-.8,.95,.3,true);crate(OUTPOST_A[0]+1.2,OUTPOST_A[1]-1.8,.8,-.2);
// ---------- 哨站 B（路北边的大营地） ----------
sandbagArc(OUTPOST_B[0],OUTPOST_B[1],3.8,Math.PI*.08,Math.PI*.92);
sandbagLine(OUTPOST_B[0]-6.5,OUTPOST_B[1]-3,OUTPOST_B[0]-4.2,OUTPOST_B[1]+1.5);
sandbagLine(OUTPOST_B[0]+5.6,OUTPOST_B[1]-2.4,OUTPOST_B[0]+7.6,OUTPOST_B[1]+1.8);
for(const[dx,dz]of[[-2.2,-2.4],[-1.5,-3]])barrel(OUTPOST_B[0]+dx,OUTPOST_B[1]+dz);barrel(OUTPOST_B[0]+4.6,OUTPOST_B[1]-3.2);
crate(OUTPOST_B[0]+1.8,OUTPOST_B[1]-2.6,1,.15,true);crate(OUTPOST_B[0]+1.8,OUTPOST_B[1]-2.6,.7,.5,false,1);ammo(OUTPOST_B[0]+.2,OUTPOST_B[1]-3.3,-.1);ammo(OUTPOST_B[0]+.2,OUTPOST_B[1]-3.3,.1,.42);
crate(OUTPOST_B[0]-3.4,OUTPOST_B[1]-4.4,.9,.2,true);
// 旗杆 + 红旗
{const[cx,cz]=OUTPOST_B;mesh(new THREE.CylinderGeometry(.06,.07,4.4,8),mPole,cx-1,2.2,cz-4.4);
 const fl=new THREE.Mesh(new THREE.PlaneGeometry(1.4,.85,8,2),STD({color:0xb3261e,roughness:.8,side:THREE.DoubleSide},{det:[20,.25,.15,1]}));fl.position.set(cx-.28,3.9,cz-4.4);fl.castShadow=true;scene.add(fl);flag=fl;}
var flag;

// ---------- 军绿卡车（停在土路上） ----------
{const g=new THREE.Group(),mg=STD({color:0x4a5730,roughness:.55,metalness:.35},{cut:true,det:[4,.15,.2,1]}),mc=STD({color:0x5b6a3a,roughness:.95},{cut:true,det:[11,.4,.16,1]}),gl=STD({color:0x1c262c,roughness:.12,metalness:.7}),
  tire=STD({color:0x1d1d1b,roughness:.85},{det:[16,.5,.2,1]}),hub=STD({color:0x3c4428,roughness:.5,metalness:.5},{det:[8,.1,.2,1]}),dk=STD({color:0x24251f,roughness:.75},{det:[6,.15,.25,1]}),lamp=STD({color:0xfff2c0,emissive:0xffe090,emissiveIntensity:.6});
 mesh(new THREE.BoxGeometry(5.6,.38,2.1),dk,0,.7,0,g);
 mesh(new THREE.BoxGeometry(1.6,1.35,2.05),mg,1.85,1.55,0,g);mesh(new THREE.BoxGeometry(1.05,.85,1.95),mg,2.85,1.27,0,g);
 mesh(new THREE.BoxGeometry(.08,.6,1.7),gl,2.36,1.9,0,g);for(const s of[-1,1])mesh(new THREE.BoxGeometry(.95,.55,.06),gl,1.85,1.88,s*1.03,g);
 for(const s of[-1,1])mesh(new THREE.BoxGeometry(.06,.16,.3),lamp,3.39,1.2,s*.72,g);
 mesh(new THREE.BoxGeometry(.1,.5,1.7),dk,3.4,.95,0,g);   // 保险杠
 mesh(new THREE.BoxGeometry(3.5,.6,2.15),mg,-.85,1.18,0,g);
 const cv=mesh(new THREE.CylinderGeometry(1.08,1.08,3.5,16,1,false,0,Math.PI),mc,-.85,1.48,0,g);cv.rotation.set(0,Math.PI/2,Math.PI/2);cv.scale.set(1,1,.78);
 for(const[x,z]of[[2.1,1],[2.1,-1],[-.5,1],[-.5,-1],[-1.8,1],[-1.8,-1]]){const t=mesh(new THREE.CylinderGeometry(.46,.46,.34,18),tire,x,.46,z,g);t.rotation.x=Math.PI/2;const h=mesh(new THREE.CylinderGeometry(.22,.22,.36,10),hub,x,.46,z,g);h.rotation.x=Math.PI/2;}
 g.position.set(TRUCK[0],0,TRUCK[1]);g.rotation.y=-TRUCK_A;scene.add(g);
 const ux=Math.cos(TRUCK_A),uz=Math.sin(TRUCK_A);for(const u of[-2,-.4,1.2,2.6])ob(TRUCK[0]+ux*u,TRUCK[1]+uz*u,1.12,{tall:true,kind:'truck'});
 // 车旁的油桶和弹药箱
 const sx=TRUCK[0]-uz*1.9,sz=TRUCK[1]+ux*1.9;barrel(sx+2.6,sz+.5);barrel(sx+3.3,sz+.2);barrel(sx+2.9,sz+1.1);ammo(sx-1.6,sz+.8,.3);ammo(sx-.7,sz+1.6,-.4);crate(sx-2.8,sz+.4,.9,.1,true);}

// ---------- 电线杆（路北）+ 电线，木栅栏（路南） ----------
{const poles=[];for(let x=-44;x<=44;x+=12.5){const r=roadAt(x),off=-RW-1.9;poles.push([x+r.nx*off,r.z+r.nz*off,r.a]);}
 for(const[x,z,a]of poles){mesh(new THREE.CylinderGeometry(.13,.16,7.2,8),mPole,x,3.6,z);const cr=mesh(new THREE.BoxGeometry(2,.14,.14),mPole,x,6.5,z);cr.rotation.y=-a+Math.PI/2;
  if(x>BOUNDS.x0&&x<BOUNDS.x1)ob(x,z,.24,{tall:true,kind:'pole'});}
 for(let i=0;i<poles.length-1;i++){const[x0,z0,a0]=poles[i],[x1,z1,a1]=poles[i+1];
  for(const s of[-.8,.8]){const p0=new THREE.Vector3(x0-Math.sin(a0)*s,6.6,z0+Math.cos(a0)*s),p1=new THREE.Vector3(x1-Math.sin(a1)*s,6.6,z1+Math.cos(a1)*s),m=p0.clone().lerp(p1,.5);m.y-=1;
   const t=new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(p0,m,p1),20,.018,4),mWire);t.castShadow=true;scene.add(t);}}
 const fenceRun=(xa,xb)=>{const pts=[];for(let x=xa;x<=xb+.01;x+=1.9){const r=roadAt(x),off=RW+1.2;pts.push([x+r.nx*off,r.z+r.nz*off]);}
  for(const[x,z]of pts){mesh(new THREE.BoxGeometry(.14,1.05,.14),mFence,x,.52,z).rotation.y=rr(-.1,.1);ob(x,z,.14,{kind:'fence',bullet:false});}
  for(let i=0;i<pts.length-1;i++){const[ax,az]=pts[i],[bx,bz]=pts[i+1],L=Math.hypot(bx-ax,bz-az),a=Math.atan2(bz-az,bx-ax);
   for(const y of[.45,.82]){const r=mesh(new THREE.BoxGeometry(L+.1,.1,.06),mFence,(ax+bx)/2,y+rr(-.03,.03),(az+bz)/2);r.rotation.y=-a;}
   for(let u=.4;u<L;u+=.45)ob(ax+(bx-ax)*u/L,az+(bz-az)*u/L,.12,{kind:'fence',bullet:false});}};
 fenceRun(-31,-24);fenceRun(-12,-2);fenceRun(10,17);fenceRun(26,33);}

// ---------- 树：边缘一圈密林 + 场内少量 ----------
const trunkC=c=>c.setHSL(.07,.42,rr(.2,.27));
function pine(){const parts=[colorize(new THREE.CylinderGeometry(.14,.2,1.8,6).translate(0,.9,0),trunkC)];
 for(const[y,r,h]of[[2.1,1.9,2.6],[3.3,1.5,2.3],[4.4,1.1,2],[5.3,.65,1.4]])parts.push(colorize(new THREE.ConeGeometry(r,h,8).translate(0,y,0),(c,yy,xx,zz)=>c.setHSL(rr(.25,.3),rr(.5,.62),.2+(xx-zz)*.04+rr(-.03,.05))));
 return mergeGeometries(parts);}
function broadleaf(){const parts=[colorize(new THREE.CylinderGeometry(.14,.22,2.4,7).translate(0,1.2,0),trunkC)];
 for(const[x,y,z,r]of[[0,3.1,0,1.25],[.85,2.7,.4,.95],[-.8,2.8,-.3,1],[.1,3.9,.1,.85],[.4,3.3,-.75,.8],[-.4,3.4,.75,.75]])parts.push(colorize(lumpy(new THREE.IcosahedronGeometry(r,0),.12).translate(x,y,z),(c,yy)=>c.setHSL(rr(.2,.26),rr(.55,.7),.26+(yy-2.2)*.07+rr(-.03,.04))));
 return mergeGeometries(parts);}
{const tp=[],tb=[];
 for(let x=-50;x<=50;x+=2.8)for(let z=-50;z<=46;z+=2.8){const px=x+rr(-1.1,1.1),pz=z+rr(-1.1,1.1);if(px>BOUNDS.x0-1.5&&px<BOUNDS.x1+1.5&&pz>BOUNDS.z0-1.5&&pz<BOUNDS.z1+6)continue;if(roadDist(px,pz)<RW+.8)continue;
  (rnd()<.55?tp:tb).push({x:px,z:pz,s:rr(.95,1.5),l:1});}
 for(let i=0;i<26;i++){const p=freeSpot(...IN,1.6);if(!p)continue;const big=rnd()<.6;(big?tp:tb).push({x:p[0],z:p[1],s:rr(.85,1.2),l:1});ob(p[0],p[1],.3,{tall:true,kind:'tree'});}
 // 几片小树林：草地上要有大块的树荫
 for(let g=0;g<7;g++){const c=freeSpot(...IN,3.2);if(!c)continue;const n=3+Math.floor(rnd()*3);
  for(let i=0;i<n;i++){const a=rnd()*6.28,d=i?rr(1.6,2.8):0,x=c[0]+Math.cos(a)*d,z=c[1]+Math.sin(a)*d;if(i&&blocked(x,z,.4))continue;
   (rnd()<.45?tp:tb).push({x,z,s:rr(1,1.4),l:1});ob(x,z,.32,{tall:true,kind:'tree'});}}
 scatter(pine(),mVeg,tp);scatter(broadleaf(),mVeg,tb);}

// ---------- 石头（大块 = 高掩体，中块 = 矮掩体，小块装饰） ----------
{const big=[],mid=[],small=[];
 for(let i=0;i<20;i++){const p=freeSpot(...IN,1.2);if(!p)continue;const s=rr(1.1,1.6);big.push({x:p[0],z:p[1],y:-.1,s,sy:s*rr(.7,.9),rx:rr(-.15,.15),l:1});ob(p[0],p[1],s*.62,{tall:true,kind:'rock'});}
 // 哨站 A 旁、出发点附近各放一块，方便新手找掩体
 for(const[x,z,s]of[[5.6,17.6,1.3],[-6.2,22.4,1.25],[19.5,17,1.2],[-9,9,1.2]])if(!blocked(x,z,-1.6,true)){big.push({x,z,y:-.1,s,sy:s*.8,l:1});ob(x,z,s*.62,{tall:true,kind:'rock'});}
 for(let i=0;i<22;i++){const p=freeSpot(...IN,.6);if(!p)continue;const s=rr(.55,.8);mid.push({x:p[0],z:p[1],y:-.05,s,sy:s*rr(.55,.7),l:1});ob(p[0],p[1],s*.58,{kind:'rock'});}
 for(let i=0;i<120;i++){const x=rr(-40,40),z=rr(-42,38);if(blocked(x,z,-.4,false))continue;small.push({x,z,y:-.02,s:rr(.1,.26),sy:rr(.08,.18),l:1});}
 const rockGeo=colorize(lumpy(new THREE.DodecahedronGeometry(.62,1),.1),(c,y)=>c.setHSL(rr(.07,.1),.06,.36+y*.14+rr(-.03,.03))),m=STD({vertexColors:true,flatShading:true,roughness:.82},{det:[2.6,.9,.32,1]});
 scatter(rockGeo,m,big);scatter(rockGeo,m,mid);scatter(colorize(new THREE.DodecahedronGeometry(1,0),c=>c.setHSL(.08,.05,rr(.36,.5))),m,small,false);}

// ---------- 树桩、倒木 ----------
{for(let i=0;i<10;i++){const p=freeSpot(...IN,.4);if(!p)continue;const r=rr(.34,.46),h=rr(.32,.5);mesh(new THREE.CylinderGeometry(r,r*1.18,h,10),mWood,p[0],h/2,p[1]);mesh(new THREE.CylinderGeometry(r*.92,r*.92,.02,10),mWoodTop,p[0],h+.01,p[1]);ob(p[0],p[1],r,{kind:'stump'});}
 for(let i=0;i<7;i++){const p=freeSpot(...IN,1.4);if(!p)continue;const L=rr(2.6,3.6),a=rr(0,Math.PI),lg=mesh(new THREE.CylinderGeometry(.3,.36,L,10),mWood,p[0],.32,p[1]);lg.rotation.z=Math.PI/2;lg.rotation.y=-a;
  const ex=Math.cos(a)*L/2,ez=Math.sin(a)*L/2,cap=mesh(new THREE.CylinderGeometry(.28,.28,.02,10),mWoodTop,p[0]+ex,.32,p[1]+ez);cap.rotation.z=Math.PI/2;cap.rotation.y=-a;
  for(let u=-L/2+.3;u<=L/2-.2;u+=.5)ob(p[0]+Math.cos(a)*u,p[1]+Math.sin(a)*u,.34,{kind:'log'});}}

// ---------- 散落的木箱、弹药箱、油桶 ----------
for(let i=0;i<5;i++){const p=freeSpot(...IN,1);if(p)crate(p[0],p[1],rr(.8,.95),rr(0,1),true);}
for(let i=0;i<5;i++){const p=freeSpot(...IN,1);if(p)ammo(p[0],p[1]);}
for(let i=0;i<4;i++){const p=freeSpot(...IN,1.2);if(p){barrel(p[0],p[1]);if(rnd()<.6)barrel(p[0]+.7,p[1]+.2);}}

// ---------- 灌木：许多小叶团挤在一起 ----------
{const parts=[];for(let i=0;i<12;i++){const a=rnd()*6.28,r=rr(0,.55),s=rr(.26,.44);parts.push(new THREE.IcosahedronGeometry(s,0).translate(Math.cos(a)*r,rr(.25,.8),Math.sin(a)*r));}
 const geo=colorize(mergeGeometries(parts),(c,y)=>c.setHSL(rr(.25,.3),rr(.55,.7),.07+y*.1+rr(-.02,.02)));
 const list=[];for(let i=0;i<260;i++){const x=rr(-40,40),z=rr(-42,38);if(blocked(x,z,.2))continue;const s=rnd()<.25?rr(1.3,1.8):rr(.8,1.25);list.push({x,z,s,sy:s*rr(.75,.95),l:1});
  if(x>BOUNDS.x0&&x<BOUNDS.x1&&z>BOUNDS.z0&&z<BOUNDS.z1)bushes.push({x,z,r:s*.62});}
 scatter(geo,mVegSolid,list);}

// ---------- 草和野花：随风摆、被玩家挤开 ----------
const mGrass=STD({vertexColors:true,side:THREE.DoubleSide,roughness:1});
{const ob0=mGrass.onBeforeCompile;mGrass.onBeforeCompile=(sh,r)=>{ob0(sh,r);
 sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform vec3 uPP;uniform float uTime;').replace('#include <begin_vertex>',`#include <begin_vertex>
{vec4 wp=instanceMatrix*vec4(0.,0.,0.,1.);float h=max(position.y,0.);float s=sin(uTime*1.7+wp.x*.31+wp.z*.23)+.5*sin(uTime*2.9+wp.x*.7-wp.z*.4);transformed.x+=s*h*.28;transformed.z+=cos(uTime*1.3+wp.z*.4)*h*.1;
 vec2 d=wp.xz-uPP.xz;float l=length(d);float pr=max(0.,1.-l/1.1);transformed.xz+=d/max(l,.01)*pr*h*.45;transformed.y-=pr*h*.2;}`);};}
const lin=v=>Math.pow(v,2.2);
function tuft(n,h0,h1,base,tip,spread=.18){const v=[],col=[];for(let b=0;b<n;b++){const a=rnd()*6.28,r=rr(0,spread),x=Math.cos(a)*r,z=Math.sin(a)*r,h=rr(h0,h1),lx=rr(-.18,.18),lz=rr(-.18,.18),w=rr(.03,.055),o=rnd()*3.14;
  const tc=tip.map(t=>lin(t*rr(.88,1.1))),bc=base.map(lin);v.push(x-Math.cos(o)*w,0,z-Math.sin(o)*w, x+Math.cos(o)*w,0,z+Math.sin(o)*w, x+lx,h,z+lz);col.push(...bc,...bc,...tc);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(v.map((_,i)=>i%3==1?1:0),3));g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));return g;}
function flower(petal){const parts=[],stem=new THREE.BufferGeometry();stem.setAttribute('position',new THREE.Float32BufferAttribute([-.012,0,0,.012,0,0,0,.32,0],3));
 parts.push(colorize(stem,c=>c.setRGB(lin(.22),lin(.42),lin(.1))));
 parts.push(colorize(new THREE.CircleGeometry(.08,5).rotateX(-Math.PI/2).translate(0,.32,0),c=>c.setRGB(...petal.map(lin))));
 parts.push(colorize(new THREE.CircleGeometry(.032,6).rotateX(-Math.PI/2).translate(0,.325,0),c=>c.setRGB(1,lin(.78),lin(.15))));
 for(const g of parts)g.setAttribute('normal',new THREE.Float32BufferAttribute(new Array(g.attributes.position.count*3).fill(0).map((_,i)=>i%3==1?1:0),3));
 return mergeGeometries(parts);}
{const ok=(x,z)=>{if(roadDist(x,z)<RW-.2)return false;for(const b of obs)if(Math.abs(x-b.x)<b.r+.1&&Math.hypot(x-b.x,z-b.z)<b.r+.05)return false;return true;};
 const tall=[],short=[],fl=[[],[],[]];
 for(let i=0;i<1500;i++){const cx=rr(-44,44),cz=rr(-44,40);if(!ok(cx,cz))continue;const n=Math.floor(rr(5,14));
  for(let k=0;k<n;k++){const x=cx+rr(-1.3,1.3),z=cz+rr(-1.3,1.3);if(ok(x,z))tall.push({x,z,s:rr(.8,1.4),l:1});}
  if(rnd()<.75)for(let k=0;k<Math.floor(rr(3,11));k++){const x=cx+rr(-1.7,1.7),z=cz+rr(-1.7,1.7);if(ok(x,z))fl[rnd()<.55?0:rnd()<.72?1:2].push({x,z,s:rr(.8,1.25),l:1});}}
 for(let i=0;i<26000&&short.length<9000;i++){const x=rr(-44,44),z=rr(-44,40);if(ok(x,z))short.push({x,z,s:rr(.8,1.4),l:1});}
 // 路边一溜高草
 for(let i=0;i<1600;i++){const k=Math.floor(rnd()*ROAD.length),[px,pz]=ROAD[k],q=ROAD[Math.min(k+1,ROAD.length-1)],tx=q[0]-px,tz=q[1]-pz,l=Math.hypot(tx,tz)||1,s=rnd()<.5?1:-1,o=(RW+rr(.1,.9))*s,x=px-tz/l*o,z=pz+tx/l*o;if(ok(x,z))tall.push({x,z,s:rr(.9,1.5),l:1});}
 scatter(tuft(9,.35,.85,[.2,.36,.09],[.6,.8,.27]),mGrass,tall.slice(0,20000),false);
 scatter(tuft(6,.16,.36,[.24,.4,.1],[.52,.72,.22],.2),mGrass,short,false);
 for(const[i,petal]of[[1,.97,.92],[1,.85,.2],[.8,.64,1]].entries())scatter(flower(petal),mGrass,fl[i],false);}
scatter(bagGeo,STD({roughness:.95},{det:[13,.45,.2,1]}),bagList);

// ---------- 矮掩体旁的掩护点（敌人用） ----------
export const coverSpots=[];
for(const b of obs){if(b.tall||!b.bullet||b.kind==='barrel')continue;for(let k=0;k<8;k++){const a=k/8*Math.PI*2,x=b.x+Math.cos(a)*(b.r+.55),z=b.z+Math.sin(a)*(b.r+.55);
 if(!freeAt(x,z,.4))continue;if(coverSpots.some(s=>Math.hypot(s.x-x,s.z-z)<.7))continue;coverSpots.push({x,z,b,taken:null});}}

// ---------- 撤离点：地上的光环 + 光柱 ----------
export const exitFx=EXITS.map((e,i)=>{const g=new THREE.Group();g.position.set(e.x,0,e.z);scene.add(g);
 const ring=new THREE.Mesh(new THREE.RingGeometry(EXIT_R-.18,EXIT_R,72),new THREE.MeshBasicMaterial({color:0x7dffa0,transparent:true,opacity:.9,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.06;g.add(ring);
 const fill=new THREE.Mesh(new THREE.CircleGeometry(EXIT_R-.18,72),new THREE.MeshBasicMaterial({color:0x7dffa0,transparent:true,opacity:.12,depthWrite:false}));fill.rotation.x=-Math.PI/2;fill.position.y=.05;g.add(fill);
 // 坚守进度：沿圆环走一圈的亮弧
 const prog=new THREE.Mesh(new THREE.RingGeometry(EXIT_R+.06,EXIT_R+.32,72,1,0,.001),new THREE.MeshBasicMaterial({color:0xfff1a0,transparent:true,opacity:.95,depthWrite:false}));prog.rotation.x=-Math.PI/2;prog.rotation.z=Math.PI/2;prog.position.y=.07;g.add(prog);
 const[gc,gx]=cnv(4,64);const gr=gx.createLinearGradient(0,0,0,64);gr.addColorStop(0,'#000');gr.addColorStop(1,'#fff');gx.fillStyle=gr;gx.fillRect(0,0,4,64);
 const beam=new THREE.Mesh(new THREE.CylinderGeometry(EXIT_R,EXIT_R,6,56,1,true),new THREE.MeshBasicMaterial({color:0x5cff88,alphaMap:new THREE.CanvasTexture(gc),transparent:true,opacity:.3,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));beam.position.y=3;g.add(beam);
 // 完成后插一面小旗
 const fg=new THREE.Group();fg.visible=false;g.add(fg);mesh(new THREE.CylinderGeometry(.04,.04,1.8,6),mPole,0,.9,0,fg);const f=mesh(new THREE.PlaneGeometry(.7,.42),STD({color:0x7dd35a,side:THREE.DoubleSide,roughness:.8}),.36,1.55,0,fg);
 const light=new THREE.PointLight(0x7dffa0,0,8,2);light.position.y=1.2;g.add(light);
 return{g,ring,fill,prog,beam,flag:fg,light,e};});
export function setExitProgress(i,k){const f=exitFx[i];f.prog.geometry.dispose();f.prog.geometry=new THREE.RingGeometry(EXIT_R+.06,EXIT_R+.32,72,1,0,Math.max(.001,k*Math.PI*2));}

// ---------- 每帧 ----------
export function updateMap(dt,T,active,holding){POOL.uTime.value=T;
 for(const f of exitFx){const on=f.e===EXITS[active],pu=.5+.5*Math.sin(T*3);f.ring.visible=f.fill.visible=f.beam.visible=f.prog.visible=on;f.light.intensity=on?(holding?6:3):0;
  if(on){f.ring.material.opacity=.6+.35*pu;f.beam.material.opacity=(holding?.38:.22)+.12*pu;f.beam.rotation.y+=dt*.4;f.fill.material.opacity=holding?.2:.1;}}
 for(const c of crates){if(c.looted)continue;c.marker.position.y=c.y+Math.sin(T*2.4+c.ph)*.08;c.marker.rotation.y+=dt*1.6;}
 if(flag){const p=flag.geometry.attributes.position;if(!flag.userData.b)flag.userData.b=p.array.slice();const b=flag.userData.b;for(let i=0;i<p.count;i++){const x=b[i*3]+.7;p.setZ(i,Math.sin(T*4+x*3)*.12*x);}p.needsUpdate=true;flag.geometry.computeVertexNormals();}}
export function lootCrate(c){c.looted=true;c.marker.visible=false;c.mesh.material=c.open;}
export function resetMap(){for(const c of crates){c.looted=false;c.marker.visible=true;c.mesh.material=c.closed;}
 for(const b of barrels){b.alive=true;b.hp=3;b.ref.visible=true;}for(const f of exitFx)f.flag.visible=false;for(let i=0;i<EXITS.length;i++)setExitProgress(i,0);}

// ---------- 寻路：0.5 米网格 + A*，路径做拉直 ----------
const CS=.5,GW=Math.ceil((BOUNDS.x1-BOUNDS.x0)/CS)+1,GH=Math.ceil((BOUNDS.z1-BOUNDS.z0)/CS)+1,GN=GW*GH;
const grid=new Uint8Array(GN);
const ci=(x,z)=>{const i=Math.round((x-BOUNDS.x0)/CS),j=Math.round((z-BOUNDS.z0)/CS);return i<0||j<0||i>=GW||j>=GH?-1:j*GW+i;};
export function buildGrid(){grid.fill(1);for(const b of obs){if(!b.alive)continue;const R=b.r+.42,i0=Math.floor((b.x-R-BOUNDS.x0)/CS),i1=Math.ceil((b.x+R-BOUNDS.x0)/CS),j0=Math.floor((b.z-R-BOUNDS.z0)/CS),j1=Math.ceil((b.z+R-BOUNDS.z0)/CS);
 for(let j=Math.max(0,j0);j<=Math.min(GH-1,j1);j++)for(let i=Math.max(0,i0);i<=Math.min(GW-1,i1);i++){const x=BOUNDS.x0+i*CS,z=BOUNDS.z0+j*CS;if(Math.hypot(x-b.x,z-b.z)<R)grid[j*GW+i]=0;}}}
buildGrid();
const walk=(x,z)=>{const k=ci(x,z);return k>=0&&grid[k]===1;};
export function walkClear(ax,az,bx,bz){const L=Math.hypot(bx-ax,bz-az),n=Math.ceil(L/.3);for(let k=1;k<=n;k++){const t=k/n;if(!walk(ax+(bx-ax)*t,az+(bz-az)*t))return false;}return true;}
const gS=new Float32Array(GN),from=new Int32Array(GN),stamp=new Uint32Array(GN),closed=new Uint32Array(GN);let gen=0;
const heap=[];const hpush=(k,f)=>{heap.push([f,k]);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(heap[p][0]<=heap[i][0])break;[heap[p],heap[i]]=[heap[i],heap[p]];i=p;}};
const hpop=()=>{const top=heap[0],last=heap.pop();if(heap.length){heap[0]=last;let i=0;for(;;){const l=2*i+1,r=l+1;let m=i;if(l<heap.length&&heap[l][0]<heap[m][0])m=l;if(r<heap.length&&heap[r][0]<heap[m][0])m=r;if(m===i)break;[heap[m],heap[i]]=[heap[i],heap[m]];i=m;}}return top;};
function nearestWalk(k){if(k<0)return-1;if(grid[k])return k;const i0=k%GW,j0=(k/GW)|0;for(let r=1;r<8;r++)for(let dj=-r;dj<=r;dj++)for(let di=-r;di<=r;di++){if(Math.max(Math.abs(di),Math.abs(dj))!==r)continue;const i=i0+di,j=j0+dj;if(i>=0&&j>=0&&i<GW&&j<GH&&grid[j*GW+i])return j*GW+i;}return-1;}
export function findPath(sx,sz,tx,tz){const s=nearestWalk(ci(sx,sz)),t=nearestWalk(ci(tx,tz));if(s<0||t<0)return null;gen++;heap.length=0;
 const ti=t%GW,tj=(t/GW)|0,h=k=>{const dx=Math.abs(k%GW-ti),dz=Math.abs(((k/GW)|0)-tj);return(dx+dz+(1.4142-2)*Math.min(dx,dz));};
 gS[s]=0;stamp[s]=gen;from[s]=-1;hpush(s,h(s));let it=0,found=false;
 while(heap.length&&it++<9000){const[,k]=hpop();if(closed[k]===gen)continue;closed[k]=gen;if(k===t){found=true;break;}const i=k%GW,j=(k/GW)|0;
  for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){if(!di&&!dj)continue;const ni=i+di,nj=j+dj;if(ni<0||nj<0||ni>=GW||nj>=GH)continue;const n=nj*GW+ni;if(!grid[n]||closed[n]===gen)continue;
   if(di&&dj&&(!grid[j*GW+ni]||!grid[nj*GW+i]))continue;const g=gS[k]+(di&&dj?1.4142:1);if(stamp[n]===gen&&g>=gS[n])continue;stamp[n]=gen;gS[n]=g;from[n]=k;hpush(n,g+h(n));}}
 if(!found)return null;const pts=[];for(let k=t;k!==-1;k=from[k])pts.push([BOUNDS.x0+(k%GW)*CS,BOUNDS.z0+((k/GW)|0)*CS]);pts.reverse();
 // 拉直：能直接走到的中间点去掉
 const out=[];let cx=sx,cz=sz,i=0;while(i<pts.length){let j=pts.length-1;while(j>i&&!walkClear(cx,cz,pts[j][0],pts[j][1]))j--;out.push(pts[j]);[cx,cz]=pts[j];i=j+1;}
 out[out.length-1]=[tx,tz];return out;}
