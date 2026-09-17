// Original vector illustration. Rebuild with node scripts/draw-key-art.js.
const fs = require('node:fs');
const path = require('node:path');
let seed = 83;
const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const leaf = (x,y,r,color) => `<path d="M${x-r},${y} Q${x-r*.8},${y-r*1.7} ${x+r*.2},${y-r} Q${x+r*1.6},${y-r*.9} ${x+r},${y+r*.2} Q${x},${y+r} ${x-r},${y}" fill="${color}"/>`;
function pine(x,y,s,color){return `<g transform="translate(${x} ${y}) scale(${s})" fill="${color}"><path d="M-4 0L-4-95 4-95 4 0Z"/><path d="M0-235L-48-145-25-150-65-85-38-92-81-22 81-22 38-92 65-85 25-150 48-145Z"/></g>`;}
let sky='',forest='',crown='',motes='',flowers='';
for(let i=0;i<80;i++){const x=random()*1600,y=random()*590,r=random()*1.6+.4;sky+=`<circle cx="${x}" cy="${y}" r="${r}" fill="#e6f3cf" opacity="${random()*.4+.12}"/>`;}
for(let layer=0;layer<3;layer++)for(let i=0;i<23;i++){const x=i*80-40+random()*25,y=590+layer*110+Math.sin(i*.7)*30;forest+=pine(x,y,.4+layer*.22+random()*.25,['#1c5a59','#184846','#123936'][layer]);}
for(let ring=0;ring<4;ring++)for(let i=0;i<12;i++){const a=i/12*Math.PI*2,r=ring*40+35,x=1060+Math.cos(a)*r*1.6,y=325+Math.sin(a)*r*.62+ring*9;crown+=leaf(x,y,42+random()*33,['#398475','#36796a','#28685d','#20594f'][ring]);}
for(let i=0;i<26;i++){const x=825+random()*400,y=225+random()*230;crown+=leaf(x,y,13+random()*22,['#68a881','#84b990','#51977b'][i%3]);}
for(let i=0;i<28;i++){const x=760+random()*560,y=240+random()*475;motes+=`<circle cx="${x}" cy="${y}" r="${2+random()*3}" fill="#f5d98b" opacity="${.2+random()*.7}"/>`;}
for(let i=0;i<140;i++){const x=random()*1600,y=770+random()*230;flowers+=`<path d="M${x} ${y}q-7-18-5-25M${x} ${y}q5-15 9-19" fill="none" stroke="${['#29534a','#407261','#203f38'][i%3]}" stroke-width="2"/>`;if(i%5===0)flowers+=`<circle cx="${x+9}" cy="${y-19}" r="3" fill="#daa95d"/>`;}
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1000" viewBox="0 0 1600 1000">
<defs>
<linearGradient id="sky" x2=".3" y2="1"><stop stop-color="#081e28"/><stop offset=".6" stop-color="#174844"/><stop offset="1" stop-color="#39766b"/></linearGradient>
<radialGradient id="halo"><stop stop-color="#d4d8a1" stop-opacity=".27"/><stop offset="1" stop-color="#83baa4" stop-opacity="0"/></radialGradient>
<linearGradient id="river" x2=".5" y2="1"><stop stop-color="#abcba1"/><stop offset=".5" stop-color="#73a59a"/><stop offset="1" stop-color="#254b4b"/></linearGradient>
<linearGradient id="bark"><stop stop-color="#283f38"/><stop offset=".48" stop-color="#5c6242"/><stop offset=".7" stop-color="#a18350"/><stop offset="1" stop-color="#385348"/></linearGradient>
<radialGradient id="heart"><stop stop-color="#fffadd"/><stop offset=".2" stop-color="#ffe2a0"/><stop offset=".55" stop-color="#e4a857" stop-opacity=".6"/><stop offset="1" stop-color="#e4a857" stop-opacity="0"/></radialGradient>
<linearGradient id="island" x2="0" y2="1"><stop stop-color="#3d6854"/><stop offset="1" stop-color="#152e2c"/></linearGradient>
</defs>
<path fill="url(#sky)" d="M0 0h1600v1000H0Z"/>${sky}
<ellipse cx="1110" cy="300" rx="480" ry="410" fill="url(#halo)"/>
<circle cx="1150" cy="183" r="68" fill="#e1d7a4" opacity=".68"/><circle cx="1168" cy="165" r="64" fill="#214945"/>
<path d="M0 480Q180 270 370 485Q530 335 680 490Q880 320 1010 455Q1220 300 1420 450L1600 400V850H0Z" fill="#215551" opacity=".55"/>${forest}
<path d="M0 635Q240 565 510 640T930 630Q1180 600 1600 580V1000H0Z" fill="#123c36"/>
<path d="M1000 583Q1360 630 1200 695Q1100 735 1240 780Q1450 850 720 1000H1170Q1650 850 1330 765Q1200 716 1360 680Q1440 622 1120 580Z" fill="url(#river)" opacity=".8"/>
<path d="M996 587Q1360 630 1190 701M1250 790Q1430 850 845 975" fill="none" stroke="#d6d1a1" stroke-width="2" opacity=".3"/>
<path d="M700 685Q738 603 968 582Q1220 575 1360 662L1300 704 1160 733 897 719Z" fill="#102c2a"/>
<path d="M700 670Q770 596 968 573Q1220 562 1360 650L1250 681 1080 705 870 691Z" fill="url(#island)"/>
<path d="M750 660Q1010 549 1297 647" fill="none" stroke="#79a177" stroke-width="4" opacity=".45"/>
<ellipse cx="1070" cy="631" rx="139" ry="31" fill="#152e2b"/>
<g fill="none" stroke="#69805a" stroke-linecap="round"><path d="M1050 554Q1010 626 899 644M1070 530Q1140 613 1232 641M1080 550Q1100 661 1195 669M1046 576Q1000 655 954 672" stroke-width="13"/><path d="M1050 554Q1010 626 899 644M1070 530Q1140 613 1232 641" stroke="#abb27a" stroke-width="3"/></g>
<path d="M1010 620Q1040 559 1020 463Q1000 400 937 350L976 330Q1015 381 1048 391L1045 286 1080 269 1090 395Q1152 361 1178 303L1203 331Q1160 427 1100 451Q1078 535 1120 622Q1066 650 1010 620Z" fill="url(#bark)"/>
<path d="M1065 602Q1048 526 1068 451M1073 401L1067 318M1091 441Q1156 390 1173 355M1046 443Q1017 402 982 374" fill="none" stroke="#bba36a" stroke-width="3" opacity=".55"/>
${crown}
<path d="M987 354Q1050 394 1150 347M1082 314Q1134 298 1160 306" fill="none" stroke="#9bb781" stroke-width="2" opacity=".4"/>
<g fill="none" stroke="#dfc485" opacity=".45"><ellipse cx="1065" cy="443" rx="158" ry="175" stroke-width="1"/><ellipse cx="1065" cy="443" rx="171" ry="189" stroke-width="1" stroke-dasharray="2 13"/><path d="M1065 250v30M1065 609v25M890 443h24M1218 443h26" stroke-width="2"/></g>
<circle cx="1065" cy="485" r="99" fill="url(#heart)"/>
<path d="M1065 444Q1030 477 1065 513Q1100 477 1065 444Z" fill="#e8ba6c" stroke="#ffdf9a" stroke-width="2"/><path d="M1065 456L1053 481 1065 501 1076 481Z" fill="#fff3be"/>
<g fill="#facd73">${[[955,340],[1096,343],[1204,378],[983,397],[1030,291],[1165,309]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="6"/><circle cx="${x}" cy="${y}" r="13" opacity=".1"/>`).join('')}</g>
${motes}
<path d="M0 845Q250 711 554 813Q760 747 970 832L1120 1000H0ZM1440 780Q1520 760 1600 776V1000H1360Z" fill="#0e2b28"/>${flowers}
<g transform="translate(861 816)"><ellipse cy="33" rx="43" ry="11" fill="#051b19"/><path d="M-22 24l-7 17 16-2 8-17M15 21l6 19 16 1-8-23" fill="#574f36"/><path d="M-30 1Q-29-32 2-38Q35-26 33 4Q33 30 0 32Q-31 30-30 1" fill="#a6804a" stroke="#c49c59" stroke-width="2"/><path d="M-39-14Q-31-48 0-46Q27-43 39-20L-1-9Z" fill="#394e35" stroke="#5e7044" stroke-width="3"/><path d="M0-41Q-4-73 18-67Q16-46 0-41" fill="#87a663"/><ellipse cx="-10" cy="5" rx="4" ry="6" fill="#162b24"/><ellipse cx="13" cy="5" rx="4" ry="6" fill="#162b24"/><path d="M-3 18q5 4 8-1" fill="none" stroke="#574229" stroke-width="2"/><path d="M33 5L55-10 58-55" fill="none" stroke="#917f4b" stroke-width="6"/><path d="M47-45h23v28H47Z" fill="#e0b36a" stroke="#a48755" stroke-width="3"/><path d="M54-39h9v17h-9Z" fill="#ffecb2"/><circle cx="59" cy="-30" r="50" fill="url(#heart)" opacity=".4"/></g>
<path d="M0 0h50Q-4 294 80 490L10 1000H0ZM1600 0h-74Q1580 200 1523 356L1555 670 1600 799Z" fill="#0a2524"/>
<path d="M0 0H600Q420 80 260 67Q134 116 0 188ZM1600 0H1330Q1343 85 1430 119Q1506 104 1600 179Z" fill="#0c2c28"/>
</svg>`;
fs.writeFileSync(path.join(__dirname,'../resources/scenes/frontier.svg'),svg);
console.log('Original forest key art built.');
