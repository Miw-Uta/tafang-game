/* Original Canvas silhouettes for evolved guardians. The caller supplies the
   existing tower-local transform; this module never loads images or uses fonts. */
(function installGuardianRenderer(root) {
  'use strict';
  const TAU=Math.PI*2;
  const palettes=Object.freeze({
    metal:{body:'#9c8054',light:'#e7c77c',dark:'#4a5554',glow:'#fff0ba'},
    wood:{body:'#78985c',light:'#bdce83',dark:'#3b6150',glow:'#e4efae'},
    water:{body:'#48949e',light:'#9bdae0',dark:'#315d73',glow:'#e4fbf4'},
    fire:{body:'#ce6849',light:'#f1b85d',dark:'#773f43',glow:'#fff1b7'},
    earth:{body:'#9b856b',light:'#d2b993',dark:'#5d6252',glow:'#e8deb8'},
    yin:{body:'#6d638d',light:'#b7add6',dark:'#373b59',glow:'#e6ddff'},
    yang:{body:'#d59949',light:'#ffe29a',dark:'#906246',glow:'#fff8d6'},
    wind:{body:'#65a69a',light:'#bce2c6',dark:'#3b6a70',glow:'#ebf7da'},
    thunder:{body:'#8679b4',light:'#c5b8ee',dark:'#464f7c',glow:'#f4edc9'}
  });
  const pentad=['#d4b66c','#9bbc75','#70bfcc','#e88f64','#b4a183'];
  const shapes=Object.freeze({
    torso:[-15,-8,-12,10,-4,15,8,15,15,9,15,-9,7,-17,-7,-17],
    helmet:[-17,-9,-15,-23,-7,-30,7,-30,15,-23,17,-9,9,-4,-9,-4],
    earthBody:[-19,-10,-14,-23,-3,-27,12,-24,19,-12,19,6,11,14,-10,14,-20,5],
    crest:[-12,-27,-11,-36,-5,-32,0,-40,5,-32,11,-36,12,-27],
    bolt:[3,-39,-7,-24,0,-23,-4,-12,10,-29,3,-29],
    diamond:[0,-6,5,0,0,6,-5,0],
    leaf:[0,-12,8,-5,6,4,0,9,-6,4,-8,-5]
  });
  function polygon(c,points,fill,stroke='#33473c',width=1.65) {
    c.beginPath();c.moveTo(points[0],points[1]);for(let i=2;i<points.length;i+=2)c.lineTo(points[i],points[i+1]);c.closePath();
    if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}
  }
  function oval(c,x,y,rx,ry,fill,stroke=null,rotation=0) {
    c.beginPath();c.ellipse(x,y,rx,ry,rotation,0,TAU);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=1.7;c.stroke();}
  }
  function line(c,x1,y1,x2,y2,color,width=2) { c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke(); }
  function gem(c,x,y,size,fill,stroke=null) { c.save();c.translate(x,y);c.scale(size/6,size/6);polygon(c,shapes.diamond,fill,stroke);c.restore(); }
  function eyes(c,y=-12,color='#f0f1d6',dark='#283e3e',gap=5) {
    oval(c,-gap,y,2.4,3.8,color);oval(c,gap,y,2.4,3.8,color);
    oval(c,-gap+.4,y+.6,1.05,2,dark);oval(c,gap+.4,y+.6,1.05,2,dark);
  }
  function boots(c,p) { oval(c,-8,13,7,4,p.dark);oval(c,8,13,7,4,p.dark); }
  function mask(c,p,y=-13,width=12) { oval(c,0,y,width,8,p.dark);eyes(c,y,p.glow); }
  function body(c,p) { boots(c,p);polygon(c,shapes.torso,p.body,p.dark);oval(c,-4,1,8,9,p.light); }
  function branchMark(c,p,variant) {
    if(!variant)return;
    c.save();c.translate(0,3);c.strokeStyle=p.glow;c.fillStyle=p.glow;c.lineWidth=1.5;
    if(variant===1){line(c,0,-5,0,5,p.glow);line(c,-4,-1,0,-5,p.glow);line(c,4,-1,0,-5,p.glow);}
    else if(variant===2){c.beginPath();c.arc(0,0,4,Math.PI*.1,Math.PI*.9);c.arc(0,-2,4,Math.PI*1.1,Math.PI*1.9);c.stroke();}
    else if(variant===3){polygon(c,[-4,-5,4,-5,5,1,0,6,-5,1],null,p.glow,1.3);}
    else if(variant===4){gem(c,0,0,5,null,p.glow);gem(c,0,0,2,p.glow);}
    else if(variant===5){for(let i=0;i<3;i++)line(c,-4+i*4,3,-2+i*4,-4,p.glow,1.4);}
    else if(variant===6){polygon(c,[1,-6,-4,0,0,0,-1,6,5,-2,1,-2],p.glow,null);}
    else {oval(c,0,0,5,5,null,p.glow);line(c,-6,0,6,0,p.glow,1.3);line(c,0,-6,0,6,p.glow,1.3);}
    c.restore();
  }
  function coronet(c,p,variant) {
    if(!variant)return;
    c.save();c.translate(0,-28);c.strokeStyle=p.dark;c.lineWidth=1.3;
    if(variant===1)polygon(c,[-6,2,0,-10,6,2],p.light,p.dark);
    else if(variant===2){for(let side=-1;side<=1;side+=2)polygon(c,[side*5,2,side*13,-7,side*11,3],p.light,p.dark);}
    else if(variant===3)polygon(c,[-12,3,-10,-7,-4,-2,0,-8,4,-2,10,-7,12,3],p.light,p.dark);
    else if(variant===4){oval(c,0,-3,8,5,null,p.light);gem(c,0,-5,4,p.glow,p.dark);}
    else if(variant===5){for(let i=-1;i<=1;i++)gem(c,i*7,-4-Math.abs(i)*2,4,p.light,p.dark);}
    else if(variant===6){polygon(c,[-12,3,-10,-8,-3,-4,0,-12,3,-4,10,-8,12,3],p.light,p.dark);}
    else{c.strokeStyle=p.glow;c.beginPath();c.arc(0,-5,9,Math.PI,TAU);c.stroke();gem(c,0,-10,3,p.glow);}
    c.restore();
  }
  function metal(c,p) {
    body(c,p);
    polygon(c,[-24,-7,-21,-19,-13,-17,-12,0,-22,1],p.light,p.dark);
    polygon(c,[24,-7,21,-19,13,-17,12,0,22,1],p.light,p.dark);
    polygon(c,shapes.helmet,p.light,p.dark);
    polygon(c,[-12,-17,12,-17,11,-7,-11,-7],p.dark,null);eyes(c,-12,p.glow);
    polygon(c,[-3,-31,0,-40,4,-31,3,-18,-3,-18],p.body,p.dark,1.1);
    line(c,-10,1,10,1,p.dark,2);gem(c,0,3,4,p.glow,p.dark);
  }
  function wood(c,p,t) {
    for(let side=-1;side<=1;side+=2){
      c.strokeStyle=p.dark;c.lineWidth=3;c.beginPath();c.moveTo(side*10,-16);c.lineTo(side*16,-28);c.lineTo(side*13,-37);c.moveTo(side*16,-28);c.lineTo(side*24,-34);c.stroke();
      oval(c,side*23,-34,8,3.7,p.light,p.dark,side*.45+t*.025);oval(c,side*13,-36,6,3,p.body,null,-side*.7);
    }
    body(c,p);oval(c,0,-15,16,16,p.body,p.dark);oval(c,0,-10,11,10,p.light);eyes(c,-14,p.dark,p.glow);
    c.strokeStyle=p.dark;c.lineWidth=2;c.beginPath();c.moveTo(-7,0);c.quadraticCurveTo(-11,7,-5,12);c.moveTo(7,1);c.quadraticCurveTo(11,7,6,12);c.stroke();
    oval(c,-3,-30,9,4,p.light,p.dark,-.3);
  }
  function water(c,p,t) {
    for(let side=-1;side<=1;side+=2){polygon(c,[side*11,-19,side*27,-29,side*23,-11,side*29,-4,side*16,1],p.light,p.dark);line(c,side*15,-13,side*23,-23,p.body,1.4);}
    body(c,p);oval(c,0,-15,16,17,p.body,p.dark);mask(c,p);
    c.fillStyle=p.light;c.strokeStyle=p.dark;c.beginPath();c.moveTo(-5,-29);c.quadraticCurveTo(4,-43,7,-36);c.quadraticCurveTo(8,-28,15,-24);c.quadraticCurveTo(4,-23,-5,-29);c.fill();c.stroke();
    c.strokeStyle=p.glow;c.lineWidth=1.4;c.beginPath();c.moveTo(-8,3);c.quadraticCurveTo(-3,-1,2,3);c.quadraticCurveTo(7,7,11,3);c.stroke();
    oval(c,-20,-31+Math.sin(t)*1.2,2.5,2.5,null,p.glow);
  }
  function fire(c,p,t) {
    c.fillStyle=p.body;c.strokeStyle=p.dark;c.lineWidth=1.7;c.beginPath();c.moveTo(-15,6);c.bezierCurveTo(-27,-2,-19,-19,-15,-23);c.lineTo(-11,-14);c.bezierCurveTo(-10,-28,0,-37,1,-40-Math.sin(t)*1.5);c.bezierCurveTo(11,-31,7,-22,13,-20);c.lineTo(18,-28);c.bezierCurveTo(27,-12,24,2,14,9);c.closePath();c.fill();c.stroke();
    boots(c,p);oval(c,0,-7,14,19,p.light,p.dark);mask(c,p,-12,10);
    c.fillStyle=p.glow;c.beginPath();c.moveTo(-7,9);c.quadraticCurveTo(-9,0,0,-4);c.quadraticCurveTo(8,4,5,10);c.closePath();c.fill();
    gem(c,17,-34,2.5,p.light);gem(c,-20,-27,2,p.glow);
  }
  function earth(c,p) {
    boots(c,p);polygon(c,shapes.earthBody,p.body,p.dark);
    polygon(c,[-24,-6,-22,-19,-13,-24,-10,-10,-15,4,-24,3],p.light,p.dark);
    polygon(c,[24,-6,22,-19,13,-24,10,-10,15,4,24,3],p.light,p.dark);
    polygon(c,[-15,-23,-9,-34,2,-38,14,-29,14,-20,3,-15],p.light,p.dark);
    polygon(c,[-10,-18,11,-18,10,-8,-9,-8],p.dark,null);eyes(c,-13,p.glow);
    line(c,-8,-1,-1,3,p.dark,1.5);line(c,-1,3,-3,11,p.dark,1.5);line(c,5,-1,12,4,p.dark,1.5);
  }
  function yin(c,p,t) {
    c.save();c.translate(-3,-15);c.rotate(-.35+Math.sin(t)*.035);c.fillStyle=p.light;c.beginPath();c.arc(0,0,23,.45,5.2);c.quadraticCurveTo(-4,-9,10,9);c.closePath();c.fill();c.restore();
    polygon(c,[-19,12,-13,-12,0,-31,13,-12,20,12,8,8,0,14,-8,8],p.body,p.dark);
    oval(c,0,-11,11,10,p.dark);eyes(c,-12,p.glow,p.dark,4);
    polygon(c,[-10,-21,0,-32,10,-21,0,-25],p.light,p.dark,1.2);
    gem(c,0,3,5,p.glow);gem(c,22,-21,2.2,p.glow);
  }
  function yang(c,p,t) {
    c.save();c.translate(0,-16);c.rotate(t*.07);
    for(let i=0;i<8;i++){c.save();c.rotate(i*TAU/8);polygon(c,[-3,-21,0,-29,3,-21],p.light,p.dark,1);c.restore();}
    oval(c,0,0,22,22,null,p.light);c.restore();
    body(c,p);oval(c,0,-15,16,17,p.light,p.dark);mask(c,p,-13,11);
    polygon(c,[-8,-27,0,-34,8,-27,0,-22],p.glow,p.dark,1.2);
    c.strokeStyle=p.glow;c.lineWidth=2;c.beginPath();c.arc(0,2,5,0,TAU);c.stroke();
  }
  function wind(c,p,t) {
    for(let side=-1;side<=1;side+=2){
      c.save();c.rotate(side*Math.sin(t)*.035);
      polygon(c,[side*10,-19,side*29,-32,side*25,-16,side*29,-18,side*24,-7,side*15,1],p.light,p.dark);
      line(c,side*12,-10,side*24,-24,p.body,1.3);line(c,side*17,-9,side*25,-15,p.body,1.3);c.restore();
    }
    body(c,p);oval(c,0,-15,14,17,p.body,p.dark);mask(c,p,-12,10);
    c.fillStyle=p.light;c.beginPath();c.moveTo(-8,-28);c.quadraticCurveTo(4,-37,16,-35);c.quadraticCurveTo(9,-26,-8,-23);c.fill();
    c.strokeStyle=p.glow;c.lineWidth=1.7;c.beginPath();c.moveTo(-8,4);c.quadraticCurveTo(0,-2,7,4);c.quadraticCurveTo(13,10,17,4);c.stroke();
  }
  function thunder(c,p,t) {
    for(let side=-1;side<=1;side+=2)polygon(c,[side*7,-24,side*13,-40,side*15,-31,side*22,-37,side*17,-20],p.light,p.dark);
    body(c,p);polygon(c,[-16,-19,-9,-30,9,-30,16,-19,13,-4,0,0,-13,-4],p.body,p.dark);mask(c,p,-14,11);
    gem(c,0,-27,4,p.glow,p.dark);polygon(c,[1,-1,-6,6,0,5,-2,13,8,2,3,3],p.glow,null);
    if(t!==0){c.globalAlpha=.55+.25*Math.sin(t*1.7);line(c,-24,-24,-21,-31,p.glow,1.5);line(c,23,-28,26,-20,p.glow,1.5);c.globalAlpha=1;}
  }
  const figures={metal,wood,water,fire,earth,yin,yang,wind,thunder};
  function fusion(c,key,t) {
    if(key==='emberwood') {
      wood(c,palettes.wood,t);c.fillStyle='#e18b50';c.beginPath();c.moveTo(-6,-29);c.quadraticCurveTo(-7,-38,1,-43);c.quadraticCurveTo(0,-35,7,-32);c.lineTo(4,-25);c.closePath();c.fill();gem(c,0,3,5,'#ffdc8c','#684a37');
    } else if(key==='ironwood') {
      earth(c,palettes.earth);for(let side=-1;side<=1;side+=2){line(c,side*9,-30,side*15,-40,'#43664b',3);oval(c,side*19,-37,7,3.5,'#a3bc7d','#43664b',side*.4);}polygon(c,[-10,-4,10,-4,9,7,0,13,-9,7],'#798f77','#3e5b52');branchMark(c,palettes.wood,3);
    } else if(key==='froststorm') {
      water(c,palettes.water,t);polygon(c,shapes.bolt,'#e4d6fc','#766ca4',1);gem(c,-22,-5,5,'#d9f7f2','#4d869b');gem(c,22,-5,5,'#d9f7f2','#4d869b');branchMark(c,palettes.thunder,6);
    } else if(key==='voidstar') {
      c.save();c.translate(0,-14);c.rotate(t*.045);
      for(let i=0;i<6;i++){c.save();c.rotate(i*TAU/6);polygon(c,[-3,-18,0,-31,3,-18],'#c7b6dc','#635580',1);c.restore();}c.restore();
      yin(c,palettes.yin,0);gem(c,0,-15,11,'#bdb4de','#534c76');gem(c,0,-15,6,'#344455');oval(c,0,-15,2.2,2.2,'#f6e9ca');
    } else if(key==='taiji') {
      body(c,palettes.yin);c.save();c.translate(0,-17);c.rotate(t*.04);oval(c,0,0,23,23,'#e8edda','#3b5351');
      c.fillStyle='#43545c';c.beginPath();c.arc(0,0,21,-Math.PI/2,Math.PI/2);c.arc(0,10.5,10.5,Math.PI/2,-Math.PI/2,true);c.arc(0,-10.5,10.5,Math.PI/2,-Math.PI/2);c.fill();
      oval(c,0,-10.5,3.1,3.1,'#e8edda');oval(c,0,10.5,3.1,3.1,'#43545c');c.restore();gem(c,0,7,4,'#e8edda');
    } else {
      c.save();c.translate(0,-14);c.rotate(t*.04);
      for(let i=0;i<5;i++){const angle=i*TAU/5-Math.PI/2;gem(c,Math.cos(angle)*24,Math.sin(angle)*24,6,pentad[i],'#466155');}c.restore();
      body(c,palettes.metal);polygon(c,[-18,-19,-10,-31,10,-31,18,-19,12,-5,-12,-5],'#bdc597','#496658');mask(c,palettes.metal,-17,11);
      for(let i=0;i<5;i++)gem(c,(i-2)*5,-3,2.7,pentad[i]);gem(c,0,7,5,'#fff0bc','#496658');
    }
  }
  const fusionKeys=new Set(['fiveSpirit','taiji','emberwood','froststorm','voidstar','ironwood']);
  function draw(c,tower,data,options={}) {
    if(!c||!tower||!data)return false;
    const key=tower.evo||'',lineage=options.lineage||data.parent||tower.evolutionPath||key;
    if(!fusionKeys.has(key)&&!Object.hasOwn(figures,lineage))return false;
    const phase=options.reducedMotion?0:(Number(options.time)||0)+(Number(tower.col)||0)*.29;
    const branchMatch=key.match(/Branch(\d+)$/),variant=branchMatch?Math.max(1,Math.min(7,Number(branchMatch[1]))):0;
    c.save();c.lineJoin='round';c.lineCap='round';
    if(fusionKeys.has(key))fusion(c,key,phase);
    else { const p=palettes[lineage];figures[lineage](c,p,phase);coronet(c,p,variant);branchMark(c,p,variant); }
    c.restore();return true;
  }
  root.GuardianRenderer=Object.freeze({draw});
})(typeof window!=='undefined'?window:globalThis);
