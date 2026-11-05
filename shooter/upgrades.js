// 武器与成长：武器每 3 级换代；每次升级三选一强化；地图上的限时子弹增强
// 武器换代（Lv 3 / 6 / 9）
export const TIERS=[
 {name:'玉米发射器',dmg:2,rate:.16,barrels:[0]},
 {name:'双管玉米枪',dmg:2.5,rate:.14,barrels:[-.17,.17]},
 {name:'玉米机枪',dmg:2.5,rate:.085,barrels:[-.17,.17]},
 {name:'爆米花加农炮',dmg:3.5,rate:.08,barrels:[-.22,0,.22],boom:1},
];
export const TIER_LV=[1,3,6,9];
// 升级三选一：每项都能叠加到上限
export const UPGRADES={
 dmg:{icon:'💪',name:'玉米加粗',desc:'每发伤害 +1',max:5},
 rate:{icon:'⚡',name:'连射',desc:'射速 +16%',max:5},
 multi:{icon:'🌾',name:'多管齐发',desc:'每次多射 1 发（扇形）',max:3},
 pierce:{icon:'🗡️',name:'穿透',desc:'子弹多穿过 1 个敌人',max:3},
 bounce:{icon:'🏓',name:'弹跳',desc:'打到障碍物后弹开 1 次',max:2},
 boom:{icon:'💥',name:'爆裂',desc:'命中时小范围爆炸',max:3},
 fire:{icon:'🔥',name:'火焰玉米',desc:'点燃敌人，持续掉血',max:3},
 ice:{icon:'❄️',name:'冰霜玉米',desc:'被打中的敌人变慢',max:2},
 homing:{icon:'🎯',name:'追踪',desc:'子弹会拐弯追向敌人',max:2},
 crit:{icon:'⭐',name:'暴击',desc:'12% 几率造成双倍伤害',max:4},
 range:{icon:'🔭',name:'远射',desc:'射程和弹速 +20%',max:2},
 maxhp:{icon:'❤️',name:'鸡壮',desc:'生命上限 +1，并回满',max:3},
 regen:{icon:'🌿',name:'自愈',desc:'每隔一段时间回 1 颗心',max:3},
 leech:{icon:'🍗',name:'吸能',desc:'每打晕几只黄鼠狼回 1 颗心',max:2},
 move:{icon:'👟',name:'轻快',desc:'移速 +10%，体力恢复更快',max:2},
 stink:{icon:'💨',name:'臭蛋包',desc:'+2 颗臭蛋，熏晕范围 +20%',max:2},
 magnet:{icon:'🧲',name:'磁铁',desc:'从更远的地方吸来玉米币',max:2},
};
export const REGEN_T=[0,16,11,8],LEECH_N=[0,6,4];
// 地图上的限时子弹增强（秒）
export const BULLET_BUFFS=['rapid','spread','fire','ice','pierce','boom','homing'];
export const xpNeed=lv=>Math.round(8+lv*6+lv*lv*.6);

// 当前武器数值：武器代数 + 强化 + 限时增强
export function weaponStats(P){const t=TIERS[P.tier],u=P.up,b=P.buffs,on=k=>b[k]>0?1:0;
 const range=1+.2*(u.range||0);
 return{name:t.name,dmg:t.dmg+(u.dmg||0),rate:t.rate*Math.pow(.86,u.rate||0)*(on('rapid')?.55:1),barrels:t.barrels,
  spread:(u.multi||0)+on('spread')*2,pierce:(u.pierce||0)+on('pierce')*2,bounce:u.bounce||0,boom:(u.boom||0)+(t.boom||0)+on('boom'),
  fire:(u.fire||0)+on('fire'),ice:(u.ice||0)+on('ice'),homing:(u.homing||0)+on('homing'),crit:(u.crit||0)*.12,speed:26*range,range:18*range};}
// 随机抽 3 个还没满级的强化
export function rollChoices(P){const pool=Object.keys(UPGRADES).filter(k=>(P.up[k]||0)<UPGRADES[k].max);
 const out=[];while(out.length<3&&pool.length){const i=Math.floor(Math.random()*pool.length);out.push(pool.splice(i,1)[0]);}
 if(!out.length)out.push('heal');return out;}
