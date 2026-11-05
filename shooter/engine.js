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
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.92;
document.body.prepend(renderer.domElement);
export const scene=new THREE.Scene();scene.background=new THREE.Color(0x3f5a2a);
// 户外天空环境：给金属、油漆、头盔一点天空反光
{const sky=new THREE.Scene(),g=new THREE.SphereGeometry(50,32,16),c=[],p=g.attributes.position,col=new THREE.Color();
 for(let i=0;i<p.count;i++){const y=p.getY(i)/50;if(y>0)col.setRGB(.55,.72,1).lerp(new THREE.Color(1,.93,.8),Math.pow(1-y,4));else col.setRGB(.24,.32,.14).lerp(new THREE.Color(.6,.62,.45),Math.pow(1+y,6));c.push(col.r,col.g,col.b);}
 g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));sky.add(new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide})));
 const s=new THREE.Mesh(new THREE.SphereGeometry(4,16,8),new THREE.MeshBasicMaterial({color:new THREE.Color(12,10,8)}));s.position.set(-26,34,-22);sky.add(s);
 const pm=new THREE.PMREMGenerator(renderer);scene.environment=pm.fromScene(sky,0.02).texture;scene.environmentIntensity=0.45;}
export const camera=new THREE.PerspectiveCamera(30,innerWidth/innerHeight,1,220);
export const hemi=new THREE.HemisphereLight(0xcfe2ff,0x4a5e2a,.7);scene.add(hemi);
// 补光：从太阳对面来的一点冷色天光，让暗面不发死
export const fill=new THREE.DirectionalLight(0xa8c4ff,.42);fill.position.set(14,10,18);scene.add(fill,fill.target);
export const sun=new THREE.DirectionalLight(0xffdcae,3.3);sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);
Object.assign(sun.shadow.camera,{left:-24,right:24,top:24,bottom:-24,near:1,far:110});sun.shadow.bias=-0.00025;sun.shadow.normalBias=0.03;
scene.add(sun,sun.target);
export const SUNOFF=new THREE.Vector3(-22,25,-17);   // 太阳低一些，影子更长

// ---------- 光圈：玩家周围明亮，圈外压暗、降饱和（之后也是潜行机制）。树冠挡住玩家时做镂空 ----------
export const POOL={uPP:{value:new THREE.Vector3()},uPoolR:{value:7.2},uPoolOn:{value:1},uTime:{value:0}};
const POOL_GLSL=`uniform vec3 uPP;uniform float uPoolR,uPoolOn,uTime;uniform vec4 uDet;uniform vec3 uRim;varying vec3 vPoolW;
float poolHash(){return fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);}
float dHash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float dNoise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
 return mix(mix(mix(dHash(i),dHash(i+vec3(1,0,0)),f.x),mix(dHash(i+vec3(0,1,0)),dHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(dHash(i+vec3(0,0,1)),dHash(i+vec3(1,0,1)),f.x),mix(dHash(i+vec3(0,1,1)),dHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float dFbm(vec3 p){return dNoise(p)*.55+dNoise(p*2.63)*.3+dNoise(p*6.9)*.15;}
vec3 detPerturb(vec3 sp,vec3 sn,vec2 dH,float fd){vec3 sx=normalize(dFdx(sp)),sy=normalize(dFdy(sp)),r1=cross(sy,sn),r2=cross(sn,sx);float det=dot(sx,r1)*fd;return normalize(abs(det)*sn-sign(det)*(dH.x*r1+dH.y*r2));}
// 云影：大片缓慢飘过的阴影
float cloudShade(vec3 w){float n=dNoise(vec3(w.xz*.045+uTime*vec2(.018,.009),uTime*.01))*.65+dNoise(vec3(w.xz*.11+uTime*vec2(.03,.012),1.7))*.35;return mix(.8,1.,smoothstep(.36,.62,n));}
vec3 poolApply(vec3 c){vec2 d=vPoolW.xz-uPP.xz;d.y*=1.08;float r=length(d);
 float k=1.0-smoothstep(uPoolR*.62,uPoolR*1.08,r);k=mix(1.0,k,uPoolOn);
 float l=dot(c,vec3(.299,.587,.114));vec3 dk=mix(vec3(l),c,.8)*vec3(.62,.66,.72);
 vec3 lt=c*vec3(1.12,1.09,1.0);return mix(dk,lt,k)*cloudShade(vPoolW);}`;
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
if(ch>0.015&&vPoolW.y>1.25&&smoothstep(2.3,3.1,cd)<poolHash()) discard;}
#endif
gl_FragColor.rgb=poolApply(gl_FragColor.rgb);`);
  if(prev)prev(sh,r);};
 return m;}
export const STD=(p,o)=>pooled(new THREE.MeshStandardMaterial(p),o);

// ---------- 后期 ----------
const rt=new THREE.WebGLRenderTarget(innerWidth,innerHeight,{type:THREE.HalfFloatType,samples:4});
export const composer=new EffectComposer(renderer,rt);
composer.addPass(new RenderPass(scene,camera));
export const ao=new GTAOPass(scene,camera,innerWidth,innerHeight);ao.updateGtaoMaterial({radius:.6,distanceExponent:1.6,thickness:1,scale:1.15});ao.blendIntensity=.9;composer.addPass(ao);
// 环境光遮蔽只看实心物体：头顶标记、光柱、脚下软阴影这类半透明东西不参与，否则会压出黑方块
ao.overrideVisibility=function(){const cache=this._visibilityCache;this.scene.traverse(o=>{cache.set(o,o.visible);if(o.isPoints||o.isLine||o.isSprite||(o.material&&o.material.transparent))o.visible=false;});};
export const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.28,.5,1.05);composer.addPass(bloom);
composer.addPass(new OutputPass());
// 移轴模糊（上下边缘）+ 调色 + 暗角 + 受伤红边
export const finalPass=new ShaderPass({uniforms:{tDiffuse:{value:null},uRes:{value:new THREE.Vector2(innerWidth,innerHeight)},uHurt:{value:0},uTilt:{value:1}},
 vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:`uniform sampler2D tDiffuse;uniform vec2 uRes;uniform float uHurt,uTilt;varying vec2 vUv;
void main(){float b=smoothstep(.2,.52,abs(vUv.y-.5))*4.2*uTilt;vec3 c=vec3(0.);
 for(int i=0;i<12;i++){float a=float(i)*2.39996;float r=sqrt((float(i)+.5)/12.);c+=texture2D(tDiffuse,vUv+vec2(cos(a),sin(a))*r*b/uRes).rgb;}
 c/=12.;float l=dot(c,vec3(.299,.587,.114));c=mix(vec3(l),c,1.2);c=mix(c,c*c*(3.-2.*c),.12);c*=vec3(1.03,1.0,.94);
 vec2 q=vUv-.5;float v=dot(q,q);c*=1.-v*.6;c=mix(c,vec3(.78,.08,.05),clamp(v*2.6-.12,0.,1.)*uHurt);gl_FragColor=vec4(c,1.);}`});
composer.addPass(finalPass);

// ---------- 画质：高（环境光遮蔽、1.5 倍像素）/ 低。帧率太低时自动降档 ----------
export const quality={high:true};
export function setQuality(high){quality.high=high;ao.enabled=high;const ms=high?4096:2048;if(sun.shadow.mapSize.x!==ms){sun.shadow.mapSize.set(ms,ms);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null;}}renderer.setPixelRatio(high?Math.min(devicePixelRatio,1.5):1);resize();}
function resize(){const w=innerWidth,h=innerHeight,pr=renderer.getPixelRatio();camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);composer.setPixelRatio(pr);composer.setSize(w,h);finalPass.uniforms.uRes.value.set(w*pr,h*pr);}
addEventListener('resize',resize);
setQuality(!/[?&]low\b/.test(location.search));
