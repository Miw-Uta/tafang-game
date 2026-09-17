/* Original, deterministic canvas scenery. Static paint is cached per biome. */
(function (root) {
  const cache=new Map();
  const palettes={
    grove:{light:'#a9c584',ground:'#7da575',shade:'#50745b',leaf:'#4c815a',rim:'#b3c982',stone:'#788d67',flower:'#e9d297'},
    wetland:{light:'#88b6a6',ground:'#588f83',shade:'#34645d',leaf:'#326e63',rim:'#8cbba0',stone:'#608e88',flower:'#a5d3ce'},
    ember:{light:'#c8a477',ground:'#a47f59',shade:'#785444',leaf:'#705f46',rim:'#d4ad72',stone:'#917451',flower:'#edb872'},
    frost:{light:'#c1d9d1',ground:'#96b5b1',shade:'#678b91',leaf:'#658f8b',rim:'#dfebe0',stone:'#8ba4a4',flower:'#eef7ea'}
  };
  function strokePath(c,path){c.beginPath();path.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();}
  function ellipse(c,x,y,rx,ry,color){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();}
  function randomFor(key){let seed=[...key].reduce((n,s)=>n+s.charCodeAt(0),713);return()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);}
  function distance(x,y,path){let result=Infinity;for(let i=1;i<path.length;i++){const[a,b]=[path[i-1],path[i]],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));result=Math.min(result,Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t));}return result;}
  function paint(field) {
    const buffer=document.createElement('canvas');buffer.width=960;buffer.height=540;const c=buffer.getContext('2d'),p=palettes[field.key]||palettes.grove,rand=randomFor(field.key),paths=field.routes||[field.path];
    const ground=c.createLinearGradient(0,0,960,540);ground.addColorStop(0,p.light);ground.addColorStop(.55,p.ground);ground.addColorStop(1,p.shade);c.fillStyle=ground;c.fillRect(0,0,960,540);
    for(let i=0;i<45;i++){const x=rand()*960,y=rand()*540;c.globalAlpha=.1+rand()*.08;ellipse(c,x,y,50+rand()*110,12+rand()*40,i%3?p.light:p.shade);}c.globalAlpha=1;
    // Recessed banks surround roads and keep unit silhouettes readable.
    c.lineJoin='round';c.lineCap='round';c.lineWidth=84;c.strokeStyle=p.shade+'38';paths.forEach(path=>strokePath(c,path));c.lineWidth=73;c.strokeStyle=p.light+'6b';paths.forEach(path=>strokePath(c,path));
    for(let i=0;i<1350;i++){
      const x=rand()*960,y=rand()*540;if(paths.some(path=>distance(x,y,path)<37))continue;
      const len=2+rand()*5;c.globalAlpha=.2+rand()*.3;c.strokeStyle=i%3?p.shade:p.rim;c.lineWidth=.6+rand();c.beginPath();c.moveTo(x-2,y);c.quadraticCurveTo(x-4,y-len,x-1,y-len-2);c.moveTo(x,y);c.quadraticCurveTo(x+1,y-len-2,x+3,y-len);c.stroke();
      if(i%19===0){c.globalAlpha=.6;ellipse(c,x+3,y-len-2,1.5,1.1,p.flower);}
      if(i%31===0){c.globalAlpha=.25;ellipse(c,x,y,4,2,p.shade);c.globalAlpha=.5;ellipse(c,x-1,y-2,3,1.8,p.stone);}
    }c.globalAlpha=1;
    // Terraced moss islands in the corners and behind the line of defense.
    for(const [col,row] of field.blockedCells||[]){const x=col*60+30,y=row*60+32;
      ellipse(c,x+5,y+20,40,14,p.shade+'70');ellipse(c,x,y+15,35,14,p.leaf);ellipse(c,x,y+9,33,13,p.rim);ellipse(c,x,y+7,29,11,p.ground);
      c.strokeStyle=p.light+'77';c.lineWidth=1;c.beginPath();c.ellipse(x-2,y+6,24,8,0,.2,Math.PI);c.stroke();
    }
    // Soft canopy light without moving anything under the player's cursor.
    const light=c.createRadialGradient(250,100,20,340,210,600);light.addColorStop(0,'#fff4ca18');light.addColorStop(1,'#13362c26');c.fillStyle=light;c.fillRect(0,0,960,540);
    return buffer;
  }
  function ground(c,field){if(!cache.has(field.key))cache.set(field.key,paint(field));c.drawImage(cache.get(field.key),0,0);}
  function canopy(c,field,clock,reduced){
    const p=palettes[field.key]||palettes.grove;
    c.save();
    // Leaves, reeds, embers and snow share a bounded ambient budget.
    for(let i=0;i<18;i++){
      const t=reduced?0:clock*.22,x=(i*131+Math.sin(t+i)*14+960)%960,y=(i*83+t*(field.key==='frost'?15:4))%540;
      c.globalAlpha=.13+Math.sin(i+1.2)*.07;c.fillStyle=p.flower;c.beginPath();c.ellipse(x,y,field.key==='grove'?3:1.4,1.4,t+i,0,Math.PI*2);c.fill();
    }
    // A subtle vignette contains the illustration; labels remain unfiltered.
    const shade=c.createRadialGradient(470,250,200,470,250,580);shade.addColorStop(0,'#10352700');shade.addColorStop(1,'#082d2b36');c.globalAlpha=1;c.fillStyle=shade;c.fillRect(0,0,960,540);c.restore();
  }
  function tree(c,end,field,clock,reduced){
    const p=palettes[field.key]||palettes.grove,x=Math.min(912,end[0]-46),y=end[1],s=reduced?0:Math.sin(clock*.85)*.7;
    c.save();c.translate(x,y);ellipse(c,1,36,43,12,'#173c364d');
    const halo=c.createRadialGradient(0,-25,1,0,-25,72);halo.addColorStop(0,'#ffda7940');halo.addColorStop(1,'#e0de9200');c.fillStyle=halo;c.fillRect(-75,-100,150,150);
    c.lineCap='round';c.strokeStyle='#586449';c.lineWidth=8;
    for(let i=0;i<5;i++){c.beginPath();c.moveTo(0,15);c.quadraticCurveTo((i-2)*12,25,(i-2)*19,32);c.stroke();}
    const bark=c.createLinearGradient(-15,0,15,0);bark.addColorStop(0,'#5e5d3d');bark.addColorStop(.65,'#9a8250');bark.addColorStop(1,'#65704c');
    c.fillStyle=bark;c.beginPath();c.moveTo(-12,29);c.quadraticCurveTo(-5,0,-16,-30);c.lineTo(-6,-29);c.lineTo(1,-7);c.lineTo(11,-37);c.lineTo(19,-29);c.quadraticCurveTo(8,0,13,29);c.closePath();c.fill();
    const crowns=[[-24,-37,23], [21,-43,27], [-6,-60,26], [-29,-56,18], [14,-72,20], [0,-42,25]];
    crowns.forEach(([cx,cy,r],i)=>{ellipse(c,cx+s,cy+3,r,r*.8,p.shade);const g=c.createRadialGradient(cx-6,cy-8,2,cx,cy,r);g.addColorStop(0,i%2?p.rim:p.light);g.addColorStop(1,p.leaf);ellipse(c,cx+s,cy,r,r*.77,g);c.strokeStyle=p.rim+'55';c.lineWidth=1;c.beginPath();c.arc(cx+s-3,cy-3,r*.6,3.3,4.6);c.stroke();});
    [[-22,-48],[23,-34],[7,-65],[-4,-31]].forEach(([cx,cy])=>{ellipse(c,cx,cy,5.5,5.5,'#c18435');ellipse(c,cx,cy-1.2,4.5,4.5,'#f3c666');ellipse(c,cx-1,cy-2.5,1.5,1.5,'#fff1b4');});
    c.fillStyle='#ffde8c';c.beginPath();c.moveTo(1,-9);c.quadraticCurveTo(-10,1,1,11);c.quadraticCurveTo(12,1,1,-9);c.fill();
    c.strokeStyle='#c0bd8060';c.lineWidth=1;c.beginPath();c.ellipse(0,-26,48,60,0,0,Math.PI*2);c.stroke();
    c.fillStyle='#203e31ed';c.fillRect(-25,40,50,14);c.fillStyle='#edd59e';c.font='10px "Noto Sans SC"';c.textAlign='center';c.fillText('世界树',0,51);c.restore();
  }
  root.WorldRenderer={ground,canopy,tree};
})(typeof globalThis!=='undefined'?globalThis:window);
