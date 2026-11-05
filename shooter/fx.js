// 特效：爆米花、火花、烟雾（InstancedMesh 粒子池）+ 闪光灯
import {THREE,scene,lr} from './engine.js';

class Pool{constructor(geo,mat,n,o={}){this.im=new THREE.InstancedMesh(geo,mat,n);this.im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.im.castShadow=!!o.shadow;this.im.frustumCulled=false;
  this.im.setColorAt(0,new THREE.Color());this.n=n;this.ps=[];this.o=o;scene.add(this.im);this.m=new THREE.Matrix4();this.q=new THREE.Quaternion();this.e=new THREE.Euler();this.v=new THREE.Vector3();this.s=new THREE.Vector3();this.c=new THREE.Color();}
 add(p){if(this.ps.length>=this.n)this.ps.shift();this.ps.push(Object.assign({vx:0,vy:0,vz:0,g:0,t:0,life:1,s0:.1,s1:0,rx:Math.random()*6,ry:Math.random()*6,spin:lr(-8,8),col:0xffffff,bounce:0,drag:0},p));}
 update(dt){const ps=this.ps;let w=0;
  for(const p of ps){p.t+=dt;if(p.t>=p.life)continue;p.vy-=p.g*dt;if(p.drag){const k=Math.exp(-p.drag*dt);p.vx*=k;p.vz*=k;p.vy*=p.g?1:k;}
   p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;if(p.bounce&&p.y<p.s0*.6){p.y=p.s0*.6;p.vy=Math.abs(p.vy)*p.bounce;p.vx*=.6;p.vz*=.6;p.spin*=.5;}
   p.rx+=p.spin*dt;p.ry+=p.spin*dt*.7;ps[w++]=p;}
  ps.length=w;const im=this.im;
  for(let i=0;i<this.n;i++){const p=ps[i];if(!p){this.m.makeScale(0,0,0);im.setMatrixAt(i,this.m);continue;}
   const k=p.t/p.life,sc=p.s1?p.s0+(p.s1-p.s0)*Math.sqrt(k):p.s0*(k>.7?1-(k-.7)/.3:1);
   this.e.set(p.rx,p.ry,0);this.q.setFromEuler(this.e);this.m.compose(this.v.set(p.x,p.y,p.z),this.q,this.s.set(sc,sc,sc));im.setMatrixAt(i,this.m);
   this.c.set(p.col);if(this.o.fade)this.c.multiplyScalar(1-k);im.setColorAt(i,this.c);}
  im.instanceMatrix.needsUpdate=true;im.instanceColor.needsUpdate=true;}}

// 爆米花：一团团白色小疙瘩
const popGeo=(()=>{const g=new THREE.IcosahedronGeometry(1,1),p=g.attributes.position,v=new THREE.Vector3();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);v.multiplyScalar(1+.28*Math.sin(v.x*5+v.y*7)*Math.cos(v.z*6));p.setXYZ(i,v.x,v.y,v.z);}g.computeVertexNormals();return g;})();
const pops=new Pool(popGeo,new THREE.MeshStandardMaterial({roughness:.8,flatShading:true}),260,{shadow:true});
const sparks=new Pool(new THREE.SphereGeometry(1,6,4),new THREE.MeshBasicMaterial({blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}),200,{fade:true});
const smoke=new Pool(new THREE.IcosahedronGeometry(1,2),new THREE.MeshStandardMaterial({roughness:1,transparent:true,opacity:.5,depthWrite:false}),160);

export function popcorn(x,y,z,n=5,col=0xfff6dc){for(let i=0;i<n;i++){const a=Math.random()*6.28,s=lr(1.2,3.2);pops.add({x,y,z,vx:Math.cos(a)*s,vy:lr(2.5,5),vz:Math.sin(a)*s,g:14,life:lr(.8,1.3),s0:lr(.05,.09),col:Math.random()<.2?0xffd86a:col,bounce:.35});}
 for(let i=0;i<4;i++){const a=Math.random()*6.28;sparks.add({x,y,z,vx:Math.cos(a)*lr(2,5),vy:lr(0,2),vz:Math.sin(a)*lr(2,5),life:.18,s0:.06,col:0xffc040,drag:6});}}
export function spark(x,y,z,col=0xffd070,n=6,sp=4){for(let i=0;i<n;i++){const a=Math.random()*6.28;sparks.add({x,y,z,vx:Math.cos(a)*lr(1,sp),vy:lr(-.5,1.5),vz:Math.sin(a)*lr(1,sp),life:lr(.12,.25),s0:lr(.04,.08),col,drag:5});}}
export function muzzle(x,y,z,dx,dz,col=0xffd070){for(let i=0;i<4;i++)sparks.add({x,y,z,vx:dx*lr(4,9)+lr(-1,1),vy:lr(-.3,.6),vz:dz*lr(4,9)+lr(-1,1),life:.08,s0:lr(.07,.12),col,drag:8});}
export function dust(x,z,n=3,col=0xbfa780,s=.25){for(let i=0;i<n;i++){const a=Math.random()*6.28;smoke.add({x:x+Math.cos(a)*.2,y:.15,z:z+Math.sin(a)*.2,vx:Math.cos(a)*lr(.3,1),vy:lr(.3,.8),vz:Math.sin(a)*lr(.3,1),life:lr(.5,.9),s0:s*.5,s1:s*1.6,col,drag:2});}}
export function cloud(x,z,r,col=0x9fd060,n=14,life=3){for(let i=0;i<n;i++){const a=Math.random()*6.28,d=Math.sqrt(Math.random())*r;smoke.add({x:x+Math.cos(a)*d,y:lr(.3,1.1),z:z+Math.sin(a)*d,vx:lr(-.3,.3),vy:lr(.05,.25),vz:lr(-.3,.3),life:life*lr(.8,1.1),s0:lr(.5,.8),s1:lr(.9,1.4),col,drag:1});}}
export function boom(x,z){for(let i=0;i<26;i++){const a=Math.random()*6.28,s=lr(3,10);sparks.add({x,y:.6,z,vx:Math.cos(a)*s,vy:lr(1,7),vz:Math.sin(a)*s,life:lr(.25,.5),s0:lr(.1,.22),col:Math.random()<.5?0xff9a30:0xffe070,drag:3});}
 for(let i=0;i<16;i++){const a=Math.random()*6.28,d=Math.random()*1.5;smoke.add({x:x+Math.cos(a)*d,y:lr(.4,1.4),z:z+Math.sin(a)*d,vx:Math.cos(a)*lr(.5,2),vy:lr(.8,2),vz:Math.sin(a)*lr(.5,2),life:lr(1.2,2),s0:lr(.5,.8),s1:lr(1.2,1.9),col:Math.random()<.5?0x4a4540:0x6a625a,drag:1.5});}
 for(let i=0;i<10;i++){const a=Math.random()*6.28,s=lr(2,6);pops.add({x,y:.6,z,vx:Math.cos(a)*s,vy:lr(4,8),vz:Math.sin(a)*s,g:16,life:lr(1,1.6),s0:lr(.06,.12),col:Math.random()<.5?0x8e231a:0x3a1410,bounce:.3});}}
export function shellBurst(x,y,z){for(let i=0;i<10;i++){const a=Math.random()*6.28,s=lr(1.5,4);pops.add({x,y,z,vx:Math.cos(a)*s,vy:lr(2,5),vz:Math.sin(a)*s,g:14,life:lr(.8,1.2),s0:lr(.05,.09),col:0xfff3df,bounce:.3});}}

// 闪光灯：固定数量的点光源轮流用（数量不变就不会触发着色器重编译）
const lights=[];for(let i=0;i<3;i++){const l=new THREE.PointLight(0xffc060,0,7,2);scene.add(l);lights.push({l,t:0,d:1,i0:0});}
let li=0;
export function flashLight(x,y,z,col=0xffc060,intensity=6,dur=.08,dist=7){const L=lights[li++%lights.length];L.l.position.set(x,y,z);L.l.color.set(col);L.l.distance=dist;L.i0=intensity;L.t=0;L.d=dur;L.l.intensity=intensity;}

export function updateFx(dt){pops.update(dt);sparks.update(dt);smoke.update(dt);
 for(const L of lights){if(L.l.intensity<=0)continue;L.t+=dt;L.l.intensity=L.t>=L.d?0:L.i0*(1-L.t/L.d);}}
