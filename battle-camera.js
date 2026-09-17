(function () {
  const board=document.getElementById('game'), frame=board.closest('.canvas-frame');
  const viewport=document.createElement('div');
  viewport.className='map-viewport';viewport.tabIndex=0;viewport.setAttribute('aria-label','战场视图');
  frame.prepend(viewport);viewport.append(board);
  const toolbar=document.createElement('div');toolbar.className='camera-tools';toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label','战场视图');
  toolbar.innerHTML='<button id="zoomOutBtn" title="缩小战场" aria-label="缩小战场"><i data-lucide="zoom-out"></i></button><button id="zoomInBtn" title="放大战场" aria-label="放大战场"><i data-lucide="zoom-in"></i></button><button id="panMapBtn" title="拖动平移" aria-label="拖动平移" aria-pressed="false"><i data-lucide="hand"></i></button><button id="fitMapBtn" title="完整战场" aria-label="完整战场"><i data-lucide="maximize"></i></button>';
  frame.append(toolbar);window.lucide?.createIcons();
  let zoom=1,pan=false,pointer=null;
  const button=id=>document.getElementById(id);
  function refresh() {
    button('zoomOutBtn').disabled=zoom<=1;button('zoomInBtn').disabled=zoom>=3;
    button('panMapBtn').disabled=zoom<=1;button('fitMapBtn').disabled=zoom<=1;
    button('panMapBtn').setAttribute('aria-pressed',String(pan));
    viewport.classList.toggle('panning',pan);frame.classList.toggle('zoomed',zoom>1);
    button('zoomInBtn').title=`放大战场 · 当前 ${Math.round(zoom*100)}%`;
  }
  function setZoom(value) {
    const next=Math.max(1,Math.min(3,value));
    const x=(viewport.scrollLeft+viewport.clientWidth/2)/zoom,y=(viewport.scrollTop+viewport.clientHeight/2)/zoom;
    zoom=next;board.style.width=`${zoom*100}%`;
    viewport.scrollLeft=x*zoom-viewport.clientWidth/2;viewport.scrollTop=y*zoom-viewport.clientHeight/2;
    if(zoom===1){pan=false;viewport.scrollLeft=0;viewport.scrollTop=0;}
    refresh();
  }
  button('zoomInBtn').onclick=()=>setZoom(zoom+.5);
  button('zoomOutBtn').onclick=()=>setZoom(zoom-.5);
  button('fitMapBtn').onclick=()=>setZoom(1);
  button('panMapBtn').onclick=()=>{pan=!pan;refresh();};
  viewport.addEventListener('pointerdown',event=>{
    if(!pan || zoom===1 || (event.button && event.button!==0))return;
    event.preventDefault();event.stopImmediatePropagation();
    pointer={id:event.pointerId,x:event.clientX,y:event.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};
    viewport.setPointerCapture(event.pointerId);
  },true);
  viewport.addEventListener('pointermove',event=>{
    if(!pointer || pointer.id!==event.pointerId)return;
    event.preventDefault();event.stopImmediatePropagation();
    viewport.scrollLeft=pointer.left+pointer.x-event.clientX;viewport.scrollTop=pointer.top+pointer.y-event.clientY;
  },true);
  for(const type of ['pointerup','pointercancel','lostpointercapture'])viewport.addEventListener(type,event=>{
    if(!pointer || pointer.id!==event.pointerId)return;
    event.stopImmediatePropagation();pointer=null;
  },true);
  viewport.addEventListener('keydown',event=>{
    const offset={ArrowLeft:[-80,0],ArrowRight:[80,0],ArrowUp:[0,-80],ArrowDown:[0,80]}[event.key];
    if(!offset || zoom===1)return;
    event.preventDefault();viewport.scrollLeft+=offset[0];viewport.scrollTop+=offset[1];
  });
  window.BattleCamera={reset:()=>setZoom(1),zoom:()=>zoom};refresh();
})();
