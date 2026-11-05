// 音效：全部实时合成（WebAudio），外加鸟叫和风声做环境音
let ctx=null,master=null,noiseBuf=null,muted=false,amb=null;
export function init(){if(ctx)return;ctx=new (window.AudioContext||window.webkitAudioContext)();master=ctx.createGain();master.gain.value=muted?0:.55;master.connect(ctx.destination);
 noiseBuf=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
 ambience();}
export function toggleMute(){muted=!muted;if(master)master.gain.value=muted?0:.55;return muted;}
const now=()=>ctx.currentTime;
function env(g,t,a,peak,d){g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+a);g.gain.exponentialRampToValueAtTime(.0001,t+a+d);}
function tone(type,f0,f1,dur,vol,t=now(),dest=master){const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(f0,t);if(f1)o.frequency.exponentialRampToValueAtTime(f1,t+dur);env(g,t,.005,vol,dur);o.connect(g);g.connect(dest);o.start(t);o.stop(t+dur+.05);}
function noise(dur,vol,ftype,freq,q=1,t=now(),f1){const s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();s.buffer=noiseBuf;f.type=ftype;f.frequency.setValueAtTime(freq,t);if(f1)f.frequency.exponentialRampToValueAtTime(f1,t+dur);f.Q.value=q;env(g,t,.003,vol,dur);s.connect(f);f.connect(g);g.connect(master);s.start(t,Math.random()*.5);s.stop(t+dur+.05);}
const ok=()=>ctx&&!muted;
export const sfx={
 shot(){if(!ok())return;tone('triangle',720,180,.07,.22);noise(.04,.18,'bandpass',2400,1.2);},
 pop(){if(!ok())return;noise(.035,.25,'highpass',3000,.7);tone('sine',1400+Math.random()*400,600,.05,.12);},
 thud(){if(!ok())return;noise(.06,.18,'lowpass',900,1);},
 foeShot(){if(!ok())return;tone('square',260,80,.09,.07);noise(.08,.16,'bandpass',1200,.8);},
 aim(){if(!ok())return;tone('sine',1800,2200,.12,.05);},
 hurt(){if(!ok())return;tone('sawtooth',420,110,.28,.16);noise(.12,.2,'lowpass',1500,1);},
 shield(){if(!ok())return;tone('triangle',1200,500,.2,.18);noise(.1,.15,'highpass',4000,.7);},
 down(){if(!ok())return;tone('sine',600,140,.35,.18);tone('triangle',300,80,.3,.1,now()+.05);},
 pickup(){if(!ok())return;const t=now();[660,880,1320].forEach((f,i)=>tone('sine',f,0,.12,.14,t+i*.06));},
 coin(){if(!ok())return;const t=now();tone('square',1320,0,.06,.05,t);tone('square',1760,0,.1,.05,t+.05);},
 gold(){if(!ok())return;const t=now();[784,988,1175,1568].forEach((f,i)=>tone('triangle',f,0,.25,.13,t+i*.08));},
 boom(){if(!ok())return;noise(1.1,.55,'lowpass',1800,.7,now(),80);tone('sine',90,30,.6,.4);},
 throw(){if(!ok())return;noise(.18,.12,'bandpass',800,2,now(),2400);},
 splat(){if(!ok())return;noise(.3,.3,'lowpass',700,1,now(),200);tone('sine',180,60,.25,.15);},
 alert(){if(!ok())return;const t=now();tone('square',880,0,.07,.06,t);tone('square',1175,0,.09,.06,t+.08);},
 roll(){if(!ok())return;noise(.18,.1,'bandpass',600,1.5,now(),300);},
 search(){if(!ok())return;noise(.05,.06,'bandpass',1800,3);},
 hold(){if(!ok())return;const t=now();[523,659,784].forEach((f,i)=>tone('triangle',f,0,.3,.12,t+i*.1));},
 capture(){if(!ok())return;const t=now();[523,659,784,1047].forEach((f,i)=>tone('triangle',f,0,.35,.15,t+i*.1));},
 win(){if(!ok())return;const t=now();[523,659,784,1047,784,1047,1319].forEach((f,i)=>tone('triangle',f,0,.4,.15,t+i*.13));},
 lose(){if(!ok())return;const t=now();[523,466,392,330].forEach((f,i)=>tone('triangle',f,0,.45,.14,t+i*.18));},
 click(){if(!ok())return;tone('sine',900,0,.05,.08);},
};
// 环境音：低低的风声 + 偶尔的鸟叫
function ambience(){const s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();s.buffer=noiseBuf;s.loop=true;f.type='lowpass';f.frequency.value=420;g.gain.value=.035;s.connect(f);f.connect(g);g.connect(master);s.start();
 const bird=()=>{if(ok()){const t=now(),b=1800+Math.random()*1600,n=2+Math.floor(Math.random()*4);for(let i=0;i<n;i++)tone('sine',b*(1+Math.random()*.15),b*.8,.08,.025,t+i*.12);}setTimeout(bird,2500+Math.random()*6000);};setTimeout(bird,2000);}
