// 渲染核心：随机数、渲染器、灯光、「光圈」着色、后期（泛光 + 移轴 + 调色）
import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
export {THREE};

// ---------- 随机数：rnd 固定种子（地图每次一样），Math.random 用于每局变化 ----------
let seed=20261105;
export const rnd=()=>{seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
export const rr=(a,b)=>a+(b-a)*rnd(),pick=a=>a[Math.floor(rnd()*a.length)];
export const lr=(a,b)=>a+(b-a)*Math.random(),lpick=a=>a[Math.floor(Math.random()*a.length)];
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const angLerp=(a,b,k)=>{let d=(b-a)%(Math.PI*2);if(d>Math.PI)d-=Math.PI*2;if(d<-Math.PI)d+=Math.PI*2;return a+d*k;};
export function segDist(x,z,ax,az,bx,bz){const ux=bx-ax,uz=bz-az,t=clamp(((x-ax)*ux+(z-az)*uz)/(ux*ux+uz*uz||1),0,1);return Math.hypot(x-ax-ux*t,z-az-uz*t);}

// ---------- 渲染器、场景、灯光（午后暖阳，从左上方照下来，影子落向右下） ----------
export const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'});
renderer.setSize(innerWidth,innerHeight);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.9;
document.body.prepend(renderer.domElement);
export const scene=new THREE.Scene();scene.background=new THREE.Color(0x3f5a2a);
// 户外天空环境：给金属、油漆、头盔一点天空反光
{const sky=new THREE.Scene(),g=new THREE.SphereGeometry(50,32,16),c=[],p=g.attributes.position,col=new THREE.Color();
 for(let i=0;i<p.count;i++){const y=p.getY(i)/50;if(y>0)col.setRGB(.55,.72,1).lerp(new THREE.Color(1,.93,.8),Math.pow(1-y,4));else col.setRGB(.24,.32,.14).lerp(new THREE.Color(.6,.62,.45),Math.pow(1+y,6));c.push(col.r,col.g,col.b);}
 g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));sky.add(new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide})));
 const s=new THREE.Mesh(new THREE.SphereGeometry(4,16,8),new THREE.MeshBasicMaterial({color:new THREE.Color(12,10,8)}));s.position.set(-26,34,-22);sky.add(s);
 const pm=new THREE.PMREMGenerator(renderer);scene.environment=pm.fromScene(sky,0.02).texture;scene.environmentIntensity=0.28;}
export const camera=new THREE.PerspectiveCamera(30,innerWidth/innerHeight,1,220);
export const hemi=new THREE.HemisphereLight(0xbcd2ff,0x3a4a22,.42);scene.add(hemi);
// 补光：从太阳对面来的一点冷色天光，让暗面不发死
export const fill=new THREE.DirectionalLight(0x9ab8ff,.22);fill.position.set(14,10,18);scene.add(fill,fill.target);
export const sun=new THREE.DirectionalLight(0xffd59c,4.6);sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);
Object.assign(sun.shadow.camera,{left:-24,right:24,top:24,bottom:-24,near:1,far:110});sun.shadow.bias=-0.00025;sun.shadow.normalBias=0.03;
scene.add(sun,sun.target);
export const SUNOFF=new THREE.Vector3(-22,25,-17);   // 太阳低一些，影子更长

// ---------- 光圈：玩家周围明亮，圈外压暗、降饱和（之后也是潜行机制）。树冠挡住玩家时做镂空 ----------
export const POOL={uPP:{value:new THREE.Vector3()},uPoolR:{value:7.2},uPoolOn:{value:1},uTime:{value:0}};
const POOL_GLSL=`uniform vec3 uPP;uniform float uPoolR,uPoolOn,uTime;uniform vec4 uDet;uniform vec3 uRim;varying vec3 vPoolW;
float poolHash(){vec2 p=mod(floor(gl_FragCoord.xy),4.);int i=int(p.x)+int(p.y)*4;float m[16]=float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);return (m[i]+.5)/16.;}   // 4×4 有序抖动，镂空边缘更干净
float dHash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float dNoise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
 return mix(mix(mix(dHash(i),dHash(i+vec3(1,0,0)),f.x),mix(dHash(i+vec3(0,1,0)),dHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(dHash(i+vec3(0,0,1)),dHash(i+vec3(1,0,1)),f.x),mix(dHash(i+vec3(0,1,1)),dHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float dFbm(vec3 p){return dNoise(p)*.55+dNoise(p*2.63)*.3+dNoise(p*6.9)*.15;}
vec3 detPerturb(vec3 sp,vec3 sn,vec2 dH,float fd){vec3 sx=normalize(dFdx(sp)),sy=normalize(dFdy(sp)),r1=cross(sy,sn),r2=cross(sn,sx);float det=dot(sx,r1)*fd;return normalize(abs(det)*sn-sign(det)*(dH.x*r1+dH.y*r2));}
// 云影：大片缓慢飘过的阴影
float cloudShade(vec3 w){float n=dNoise(vec3(w.xz*.032+uTime*vec2(.018,.009),uTime*.01))*.65+dNoise(vec3(w.xz*.11+uTime*vec2(.03,.012),1.7))*.35;return mix(.86,1.,smoothstep(.38,.62,n));}
vec3 poolApply(vec3 c){vec2 d=vPoolW.xz-uPP.xz;d.y*=1.08;float r=length(d);
 float k=1.0-smoothstep(uPoolR*.62,uPoolR*1.08,r);k=mix(1.0,k,uPoolOn);
 float l=dot(c,vec3(.299,.587,.114));vec3 dk=mix(vec3(l),c,.88)*vec3(.74,.77,.84);
 vec3 lt=c*vec3(1.1,1.06,.97);return mix(dk,lt,k)*cloudShade(vPoolW);}`;
// o.det = [噪声频率, 凹凸强度, 颜色起伏, 竖向拉伸]：给表面加细小的颗粒、布纹、木纹感；o.rim = 边缘光颜色
export function pooled(m,o={}){
 m.defines=Object.assign(m.defines||{},o.cut?{CUTAWAY:''}:{},o.det?{DETAIL:''}:{},o.rim?{RIM:''}:{});
 const uDet={value:new THREE.Vector4(...(o.det||[0,0,0,1]))},uRim={value:new THREE.Color(...(o.rim||[0,0,0]))};m.userData.uDet=uDet;
 const prev=m.onBeforeCompile;
 m.onBeforeCompile=(sh,r)=>{Object.assign(sh.uniforms,POOL);sh.uniforms.uDet=uDet;sh.uniforms.uRim=uRim;
  sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vPoolW;').replace('#include <project_vertex>',`#include <project_vertex>
vec4 poolP=vec4(transformed,1.0);
#ifdef USE_INSTANCING
poolP=instanceMatrix*poolP;
#endif
vPoolW=(modelMatrix*poolP).xyz;`);
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\n'+POOL_GLSL)
   .replace('#include <color_fragment>',`#include <color_fragment>
#ifdef DETAIL
float dh=dFbm(vPoolW*uDet.x*vec3(1.,uDet.w,1.));diffuseColor.rgb*=1.+(dh-.5)*uDet.z;
#endif`)
   .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
#ifdef DETAIL
roughnessFactor=clamp(roughnessFactor*(1.+(dh-.5)*.5),.04,1.);
#endif`)
   .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
#ifdef DETAIL
normal=detPerturb(-vViewPosition,normal,vec2(dFdx(dh),dFdy(dh))*uDet.y,faceDirection);
#endif`)
   .replace('#include <opaque_fragment>',`#include <opaque_fragment>
#ifdef RIM
{float fr=pow(1.-max(dot(normal,normalize(vViewPosition)),0.),3.);gl_FragColor.rgb+=fr*uRim;}
#endif
#ifdef CUTAWAY
{vec3 ca=uPP+vec3(0.,.9,0.);vec3 cb=cameraPosition-ca;float ch=dot(vPoolW-ca,cb)/dot(cb,cb);float cd=length(vPoolW-ca-cb*clamp(ch,0.,1.));
if(ch>0.015&&vPoolW.y>1.25&&smoothstep(2.35,2.85,cd)<poolHash()) discard;}
#endif
gl_FragColor.rgb=poolApply(gl_FragColor.rgb);`);
  if(prev)prev(sh,r);};
 return m;}
export const STD=(p,o)=>pooled(new THREE.MeshStandardMaterial(p),o);

// 太阳影子跟着镜头走：按影子贴图的像素对齐，移动时影子边缘不会闪
const _up=new THREE.Vector3(0,1,0),_ld=SUNOFF.clone().normalize(),_lr=new THREE.Vector3().crossVectors(_up,_ld).normalize(),_lu=new THREE.Vector3().crossVectors(_ld,_lr);
export function placeSun(x,z){const t=(sun.shadow.camera.right-sun.shadow.camera.left)/sun.shadow.mapSize.x;
 const a=Math.round((x*_lr.x+z*_lr.z)/t)*t,b=Math.round((x*_lu.x+z*_lu.z)/t)*t,c=x*_ld.x+z*_ld.z;
 sun.target.position.set(_lr.x*a+_lu.x*b+_ld.x*c,_lr.y*a+_lu.y*b+_ld.y*c,_lr.z*a+_lu.z*b+_ld.z*c);sun.position.copy(sun.target.position).add(SUNOFF);}

// ---------- 后期 ----------
// 只有场景本身需要 4 倍抗锯齿；后面的全屏处理写进不带抗锯齿的缓冲，省显存带宽
const rt=new THREE.WebGLRenderTarget(innerWidth,innerHeight,{type:THREE.HalfFloatType,samples:4});
export const composer=new EffectComposer(renderer,rt);composer.renderTarget2.samples=0;
composer.addPass(new RenderPass(scene,camera));
export const ao=new GTAOPass(scene,camera,innerWidth,innerHeight);ao.updateGtaoMaterial({radius:.6,distanceExponent:1.6,thickness:1,scale:1.15});ao.blendIntensity=.9;composer.addPass(ao);
// 环境光遮蔽只看实心物体：头顶标记、光柱、脚下软阴影这类半透明东西不参与，否则会压出黑方块
ao.overrideVisibility=function(){const cache=this._visibilityCache;this.scene.traverse(o=>{cache.set(o,o.visible);if(o.isPoints||o.isLine||o.isSprite||(o.material&&o.material.transparent))o.visible=false;});};
// 环境光遮蔽用半分辨率算（柔和的东西看不出差别，开销降到四分之一）；
// 直接乘到当前画面上，省掉一次整屏复制；画法线时不再重画一遍影子贴图
const AO_SCALE=.5,aoSetSize=ao.setSize.bind(ao);
ao.setSize=(w,h)=>aoSetSize(Math.max(1,Math.round(w*AO_SCALE)),Math.max(1,Math.round(h*AO_SCALE)));
ao.needsSwap=false;
ao.render=function(r,writeBuffer,readBuffer){
 const sm=r.shadowMap.autoUpdate;r.shadowMap.autoUpdate=false;
 this.overrideVisibility();this.renderOverride(r,this.normalMaterial,this.normalRenderTarget,0x7777ff,1);this.restoreVisibility();
 r.shadowMap.autoUpdate=sm;
 const u=this.gtaoMaterial.uniforms,cam=this.camera;u.cameraNear.value=cam.near;u.cameraFar.value=cam.far;
 u.cameraProjectionMatrix.value.copy(cam.projectionMatrix);u.cameraProjectionMatrixInverse.value.copy(cam.projectionMatrixInverse);u.cameraWorldMatrix.value.copy(cam.matrixWorld);
 this.renderPass(r,this.gtaoMaterial,this.gtaoRenderTarget,0xffffff,1);
 this.pdMaterial.uniforms.cameraProjectionMatrixInverse.value.copy(cam.projectionMatrixInverse);
 this.renderPass(r,this.pdMaterial,this.pdRenderTarget,0xffffff,1);
 this.blendMaterial.uniforms.intensity.value=this.blendIntensity;this.blendMaterial.uniforms.tDiffuse.value=this.pdRenderTarget.texture;
 this.renderPass(r,this.blendMaterial,readBuffer);};
ao.setSize(innerWidth,innerHeight);
export const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.32,.55,.92);composer.addPass(bloom);
composer.addPass(new OutputPass());
// 移轴模糊（上下边缘）+ 调色 + 暗角 + 受伤红边
export const finalPass=new ShaderPass({uniforms:{tDiffuse:{value:null},uRes:{value:new THREE.Vector2(innerWidth,innerHeight)},uHurt:{value:0},uTilt:{value:1},uTime:{value:0},uShaft:{value:1}},
 vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:`uniform sampler2D tDiffuse;uniform vec2 uRes;uniform float uHurt,uTilt,uTime,uShaft;varying vec2 vUv;
void main(){float b=smoothstep(.2,.52,abs(vUv.y-.5))*4.2*uTilt;vec3 c=vec3(0.);
 // 画面中间不模糊，只采一次
 if(b<.08)c=texture2D(tDiffuse,vUv).rgb;
 else{for(int i=0;i<12;i++){float a=float(i)*2.39996;float r=sqrt((float(i)+.5)/12.);c+=texture2D(tDiffuse,vUv+vec2(cos(a),sin(a))*r*b/uRes).rgb;}c/=12.;}float l=dot(c,vec3(.299,.587,.114));c=mix(vec3(l),c,1.18);c=mix(c,c*c*(3.-2.*c),.16);
 // 冷暖分离：暗部偏青蓝，亮部偏暖金
 float sh=1.-smoothstep(.05,.45,l),hi=smoothstep(.45,.95,l);c*=mix(vec3(1.),vec3(.88,.97,1.1),sh*.55);c*=mix(vec3(1.),vec3(1.07,1.0,.88),hi*.6);
 // 阳光光束：从左上角斜射下来，慢慢飘动
 {vec2 o=vUv-vec2(-.05,1.1);vec2 sd=normalize(vec2(1.,-.75*uRes.x/uRes.y));float across=dot(o,vec2(-sd.y,sd.x)),along=dot(o,sd);
  float b=.5+.5*sin(across*31.+uTime*.35)*sin(across*13.7-uTime*.21+1.3);b=b*b*b;b+=.35*pow(.5+.5*sin(across*7.3+uTime*.12),4.);
  float k=b*(1.-smoothstep(.05,1.25,along))*smoothstep(0.,.25,along)*.2*uShaft;c+=k*vec3(1.,.86,.6)*(.3+l);}
 vec2 q=vUv-.5;float v=dot(q,q);c*=1.-v*.6;c=mix(c,vec3(.78,.08,.05),clamp(v*2.6-.12,0.,1.)*uHurt);gl_FragColor=vec4(c,1.);}`});
composer.addPass(finalPass);

// ---------- 画质：高（环境光遮蔽、4096 影子）/ 低 ----------
// 渲染像素有上限：大屏、高分屏不会按满分辨率硬算（移轴、泛光本来就是柔的，略低一点看不出来）。
// 再按实际帧率动态调渲染分辨率（scale），一直卡才关环境光遮蔽。
const BUDGET={high:2.4e6,low:1.5e6};
export const quality={high:true,scale:1};
function targetPR(){const w=innerWidth,h=innerHeight,cap=Math.min(devicePixelRatio,quality.high?1.5:1);
 return Math.max(.5,Math.min(cap,Math.sqrt(BUDGET[quality.high?'high':'low']/(w*h)))*quality.scale);}
export function setQuality(high){quality.high=high;ao.enabled=high;const ms=high?4096:2048;if(sun.shadow.mapSize.x!==ms){sun.shadow.mapSize.set(ms,ms);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}}resize();}
function resize(){const w=innerWidth,h=innerHeight,pr=targetPR();camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setPixelRatio(pr);renderer.setSize(w,h);composer.setPixelRatio(pr);composer.setSize(w,h);finalPass.uniforms.uRes.value.set(w*pr,h*pr);}
addEventListener('resize',resize);
setQuality(!/[?&]low\b/.test(location.search));
// 每秒看一次平均帧时间：低于约 50 帧就降一档分辨率，持续流畅再慢慢升回去（升上去又卡就记住这个上限）
let aSum=0,aN=0,aT=0,good=0,ceil=1,lastUp=-1e9,worst=0;
export function adapt(ms,now){if(ms>250||window.__noAdapt)return;   // 测性能时可在控制台设 __noAdapt=true 关掉自动调节aSum+=ms;aN++;if(now-aT<1000)return;
 const avg=aSum/aN;aSum=aN=0;aT=now;const s0=quality.scale;
 if(avg>20){good=0;if(now-lastUp<4000)ceil=Math.max(.6,s0-.1);
  if(s0>.6){quality.scale=Math.round((s0-.1)*10)/10;resize();}
  else if(quality.high&&avg>25&&++worst>=3){worst=0;setQuality(false);}}
 else{worst=0;if(avg<17.8&&s0<ceil&&++good>=4){good=0;quality.scale=Math.min(ceil,Math.round((s0+.1)*10)/10);lastUp=now;resize();}}}
