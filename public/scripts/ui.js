// /public/scripts/ui.js

// Dijkstra funcional + UI/UX. Oscuro fijo, cuadrícula siempre, sin emojis.
// Pan/zoom sólo sobre el canvas. Sin dependencias.

/* ------------------ Helpers ------------------ */
(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));

  /* ====== Estado global ====== */
  const state = {
    addNodeMode: false,
    zoom: 1,
    pan: {x:0,y:0},
    graph: createGraph(),
    anim: null, // {steps, idx, playing, speed, result}
    highlightPath: null,
  };

  function createGraph(){
    return { nodes: new Map(), edges: new Map() };
  }

  /* ====== Toast ====== */
  const toastArea = $('#toastArea');
  function toast(msg, type='info', t=2000){
    const el = document.createElement('div');
    el.className = `toast ${type==='success'?'toast--success':''} ${type==='error'?'toast--error':''}`;
    el.textContent = msg;
    toastArea.appendChild(el);
    setTimeout(()=>el.remove(), t);
  }

  /* ====== Steps ====== */
  function setActiveStep(n){
    $$('.step').forEach(li => li.classList.toggle('is-active', li.dataset.step === String(n)));
    $$('[data-step-panel]').forEach(p => p.hidden = p.dataset.stepPanel !== String(n));
  }

  /* ====== Sidebar/UI básicos ====== */
  $('#btnHelp').addEventListener('click', ()=> $('#modalHelp').showModal());
  $('#btnReset').addEventListener('click', ()=> location.reload());
  $('#btnToggleSidebar').addEventListener('click', ()=> $('.sidebar').classList.toggle('is-open'));
  $$('.step .step-btn').forEach(btn => btn.addEventListener('click', () => setActiveStep(btn.parentElement.dataset.step)));

  /* ====== Selects y tabla ====== */
  function fillNodeSelects(){
    const opts = Array.from(state.graph.nodes.keys());
    const selSource = $('#selSource');
    const selTarget = $('#selTarget');
    [selSource, selTarget].forEach(sel=>{
      sel.innerHTML = '<option value="">—</option>' + opts.map(o=>`<option>${o}</option>`).join('');
    });
    const dl = $('#nodesList'); dl.innerHTML = opts.map(o=>`<option value="${o}">`).join('');
  }
  function refreshEdgesTable(){
    const tbody = $('#edgesTable tbody');
    tbody.innerHTML = '';
    for (const e of state.graph.edges.values()){
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${e.from}</td><td>${e.to}</td><td>${e.weight}</td>
        <td><button class="btn ghost btn-edit-edge">Editar</button>
            <button class="btn danger btn-del-edge">Borrar</button></td>`;
      tbody.appendChild(tr);
    }
  }

  /* ====== Canvas y render ====== */
  const canvas = $('#graphCanvas');
  const wrap = $('#canvasWrap');
  const ctx = canvas.getContext('2d');

  function worldToScreen(p){ return { x: p.x*state.zoom + state.pan.x, y: p.y*state.zoom + state.pan.y }; }
  function screenToWorld(p){ return { x: (p.x - state.pan.x) / state.zoom, y: (p.y - state.pan.y) / state.zoom }; }
  function clamp(v,min,max){ return Math.max(min, Math.min(max,v)); }

  function redraw(){
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.translate(state.pan.x, state.pan.y);
    ctx.scale(state.zoom, state.zoom);

    // edges
    ctx.lineWidth = 2/state.zoom;
    for (const e of state.graph.edges.values()){
      const u = state.graph.nodes.get(e.from), v = state.graph.nodes.get(e.to);
      if(!u||!v) continue;
      ctx.strokeStyle = '#93c5fd';
      ctx.fillStyle = '#e5e7eb';
      ctx.beginPath(); ctx.moveTo(u.x,u.y); ctx.lineTo(v.x,v.y); ctx.stroke();
      const mx = (u.x+v.x)/2, my = (u.y+v.y)/2;
      ctx.fillStyle = '#0b1220';
      ctx.fillRect(mx-12,my-20,24,14);
      ctx.strokeStyle = '#334155';
      ctx.strokeRect(mx-12,my-20,24,14);
      ctx.fillStyle = '#e5e7eb';
      ctx.font = `${12/state.zoom}px system-ui`; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(String(e.weight), mx, my-13);
      drawArrow(u,v);
    }
    // path highlight
    if (state.highlightPath && state.highlightPath.length>1){
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 3/state.zoom;
      for (let i=0;i<state.highlightPath.length-1;i++){
        const a = state.graph.nodes.get(state.highlightPath[i]);
        const b = state.graph.nodes.get(state.highlightPath[i+1]);
        if(!a||!b) continue;
        ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
      }
    }
    // nodes
    for (const n of state.graph.nodes.values()) drawNode(n.id, n.x, n.y);
  }

  function drawArrow(u,v){
    const angle = Math.atan2(v.y-u.y, v.x-u.x);
    const len = 10/state.zoom, x=v.x, y=v.y;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - len*Math.cos(angle - Math.PI/6), y - len*Math.sin(angle - Math.PI/6));
    ctx.moveTo(x, y);
    ctx.lineTo(x - len*Math.cos(angle + Math.PI/6), y - len*Math.sin(angle + Math.PI/6));
    ctx.stroke();
  }
  function drawNode(id,x,y){
    ctx.beginPath(); ctx.fillStyle = '#0b1220aa'; ctx.strokeStyle = '#64748b';
    ctx.arc(x,y,18,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e5e7eb'; ctx.font = `${14/state.zoom}px system-ui`; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(id,x,y);
  }

  // Pan y zoom sólo en canvas
  let dragging=false, last={x:0,y:0};
  wrap.addEventListener('mousedown', e => { dragging = true; last={x:e.offsetX,y:e.offsetY}; });
  window.addEventListener('mouseup', ()=> dragging=false);
  wrap.addEventListener('mousemove', e => {
    if (dragging){
      state.pan.x += e.offsetX - last.x;
      state.pan.y += e.offsetY - last.y;
      last = {x:e.offsetX,y:e.offsetY};
      redraw();
    }
  });
  wrap.addEventListener('wheel', e => {
    if (e.ctrlKey){
      e.preventDefault();
      const scale = Math.exp(-e.deltaY * 0.0015);
      const mx = e.offsetX, my = e.offsetY;
      const before = screenToWorld({x:mx,y:my});
      state.zoom = clamp(state.zoom*scale, 0.4, 3);
      const after = screenToWorld({x:mx,y:my});
      state.pan.x += (after.x - before.x) * state.zoom;
      state.pan.y += (after.y - before.y) * state.zoom;
      redraw();
    }
  }, {passive:false});

  $('#btnZoomIn').addEventListener('click', ()=> zoomBy(1.15));
  $('#btnZoomOut').addEventListener('click', ()=> zoomBy(1/1.15));
  $('#btnCenter').addEventListener('click', ()=> { state.zoom=1; state.pan={x:0,y:0}; redraw(); });

  function zoomBy(f){
    const rect = wrap.getBoundingClientRect();
    const mx = rect.width/2, my = rect.height/2;
    const before = screenToWorld({x:mx,y:my});
    state.zoom = clamp(state.zoom*f, 0.4, 3);
    const after = screenToWorld({x:mx,y:my});
    state.pan.x += (after.x - before.x) * state.zoom;
    state.pan.y += (after.y - before.y) * state.zoom;
    redraw();
  }

  $('#btnScreenshot').addEventListener('click', exportPNG);
  $('#btnExportPNG').addEventListener('click', exportPNG);
  function exportPNG(){
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png'); a.download = 'grafo.png'; a.click();
    toast('PNG exportado.', 'success');
  }

  /* ====== Edición del grafo ====== */
  const nameSeq = () => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let i=0;i<letters.length;i++){ const id = letters[i]; if(!state.graph.nodes.has(id)) return id; }
    let idx=0; while(true){ const id='N'+(++idx); if(!state.graph.nodes.has(id)) return id; }
  };

  $('#btnAddNode').addEventListener('click', ()=>{
    state.addNodeMode = !state.addNodeMode;
    toast(state.addNodeMode ? 'Modo añadir nodo: haz clic en el lienzo.' : 'Modo añadir nodo desactivado.', 'success');
  });
  wrap.addEventListener('click', (e)=>{
    if(!state.addNodeMode) return;
    const pt = screenToWorld({x:e.offsetX, y:e.offsetY});
    const id = nameSeq();
    state.graph.nodes.set(id, {id, x: pt.x, y: pt.y});
    state.addNodeMode = false;
    fillNodeSelects(); redraw(); toast(`Nodo ${id} añadido.`, 'success');
  });

  $('#btnQuickAddEdge').addEventListener('click', ()=>{
    const from = ($('#edgeFrom').value||'').trim().toUpperCase();
    const to = ($('#edgeTo').value||'').trim().toUpperCase();
    const w = Math.max(0, Number($('#edgeWeight').value||''));
    if(!state.graph.nodes.has(from) || !state.graph.nodes.has(to)) return toast('Nodos inválidos.', 'error');
    if(!(w>=0)) return toast('Peso inválido (≥ 0).', 'error');
    state.graph.edges.set(`${from}->${to}`, {from,to,weight:w});
    refreshEdgesTable(); redraw(); toast('Arista añadida.', 'success');
  });
  $('#btnAddEdge').addEventListener('click', ()=> toast('Usa el formulario "Arista rápida".', 'success'));

  $('#edgesTable tbody').addEventListener('click', (e)=>{
    const btn = e.target.closest('button'); if(!btn) return;
    const row = e.target.closest('tr'); const [from,to,w] = $$('td',row).map(td=>td.textContent);
    if(btn.classList.contains('btn-edit-edge')){
      $('#editFrom').value = from; $('#editTo').value = to; $('#editWeight').value = w;
      $('#modalEdgeEditor').showModal();
      $('#modalEdgeEditor').addEventListener('close', ()=>{
        if($('#modalEdgeEditor').returnValue==='save'){
          const nf = $('#editFrom').value.trim().toUpperCase();
          const nt = $('#editTo').value.trim().toUpperCase();
          const nw = Math.max(0, Number($('#editWeight').value||0));
          state.graph.edges.delete(`${from}->${to}`);
          state.graph.edges.set(`${nf}->${nt}`, {from:nf,to:nt,weight:nw});
          refreshEdgesTable(); redraw(); toast('Arista actualizada.', 'success');
        }
      }, {once:true});
    }
    if(btn.classList.contains('btn-del-edge')){
      $('#modalConfirm').showModal();
      $('#modalConfirm').addEventListener('close', ()=>{
        if($('#modalConfirm').returnValue==='confirm'){
          state.graph.edges.delete(`${from}->${to}`);
          refreshEdgesTable(); redraw(); toast('Arista eliminada.', 'success');
        }
      }, {once:true});
    }
  });

  $('#btnAutoComplete').addEventListener('click', ()=>{
    if(state.graph.nodes.size < 8){
      const R = 220, cx=450, cy=350;
      'ABCDEFGH'.split('').forEach((id,i)=>{
        if(!state.graph.nodes.has(id)){
          const a = (i/8)*Math.PI*2;
          state.graph.nodes.set(id, {id, x: cx+R*Math.cos(a), y: cy+R*Math.sin(a)});
        }
      });
    }
    const add = (u,v,w)=> state.graph.edges.set(`${u}->${v}`, {from:u,to:v,weight:w});
    add('A','B',3); add('A','C',2); add('B','D',5); add('C','D',4); add('C','E',1); add('E','D',1);
    fillNodeSelects(); refreshEdgesTable(); redraw();
    toast('Ejemplo autocompletado.', 'success');
  });

  $('#btnClearGraph').addEventListener('click', ()=>{
    state.graph = createGraph(); state.highlightPath=null;
    fillNodeSelects(); refreshEdgesTable(); redraw(); toast('Grafo limpiado.', 'success');
  });

  /* ====== Paso 1: validación/modos ====== */
  const inpN = $('#inpN'), nError = $('#nError');
  function validateN(){ const v=Number(inpN.value); const ok=v>=8 && v<=16; inpN.classList.toggle('is-invalid', !ok); nError.hidden=ok; return ok; }
  inpN.addEventListener('input', validateN);

  $('#btnGenRandom').addEventListener('click', ()=>{
    if(!validateN()) return toast('El número de nodos debe estar entre 8 y 16.', 'error');
    generateRandomGraph(Number(inpN.value)); $('#modeBadge').textContent='modo: aleatorio';
    setActiveStep(2); toast('Grafo aleatorio listo.', 'success');
  });
  $('#btnGenManual').addEventListener('click', ()=>{
    if(!validateN()) return toast('El número de nodos debe estar entre 8 y 16.', 'error');
    state.graph = createGraph();
    $('#modeBadge').textContent='modo: manual';
    fillNodeSelects(); refreshEdgesTable(); redraw();
    setActiveStep(2); toast('Añade nodos con “Añadir nodo”.', 'success');
  });
  $('#btnLoadSample').addEventListener('click', ()=>{
    inpN.value=8; validateN(); $('#btnAutoComplete').click(); setActiveStep(2);
    $('#modeBadge').textContent='modo: ejemplo'; $('#selSource').value='A'; $('#selTarget').value='D';
    toast('Ejemplo cargado.', 'success');
  });

  /* ====== Random ====== */
  function generateRandomGraph(n){
    state.graph = createGraph();
    const R = 260, cx=520, cy=380;
    for(let i=0;i<n;i++){
      const id = String.fromCharCode(65+i);
      const a = (i/n)*Math.PI*2;
      state.graph.nodes.set(id, {id, x: cx+R*Math.cos(a), y: cy+R*Math.sin(a)});
    }
    const ids = Array.from(state.graph.nodes.keys());
    for(let i=0;i<n;i++){
      const u = ids[i];
      const out = 2 + Math.floor(Math.random()*2);
      for(let k=1;k<=out;k++){
        const v = ids[(i+k)%n];
        const w = 1 + Math.floor(Math.random()*9);
        state.graph.edges.set(`${u}->${v}`, {from:u,to:v,weight:w});
      }
    }
    fillNodeSelects(); refreshEdgesTable(); redraw();
  }

  /* ====== Dijkstra ====== */
  function runDijkstra(source, target){
    const nodes = Array.from(state.graph.nodes.keys());
    const dist = new Map(nodes.map(id=>[id, Infinity]));
    const prev = new Map(nodes.map(id=>[id, null]));
    const visited = new Set();
    const steps = [];
    const pq = [];

    const pushPQ = (d,u)=>{ pq.push([d,u]); pq.sort((a,b)=>a[0]-b[0]); };
    const snapshotPQ = ()=> pq.slice().map(([d,u])=>`${u}(${d})`);

    dist.set(source, 0); pushPQ(0, source);
    steps.push({type:'init', queue:snapshotPQ(), extracted:null, dist:new Map(dist), prev:new Map(prev)});

    while(pq.length){
      const [du, u] = pq.shift();
      if(visited.has(u)) continue;
      visited.add(u);
      steps.push({type:'extract', queue:snapshotPQ(), extracted:u, dist:new Map(dist), prev:new Map(prev)});
      if(u===target) break;

      for (const e of outgoing(u)){
        const alt = du + e.weight;
        const dv = dist.get(e.to);
        let type='relax-none';
        if (alt < dv){
          dist.set(e.to, alt); prev.set(e.to, u);
          pushPQ(alt, e.to); type='relax-better';
        } else if (alt === dv){
          type='relax-tie';
        }
        steps.push({type, edge:e, queue:snapshotPQ(), extracted:u, dist:new Map(dist), prev:new Map(prev)});
      }
    }
    const path = rebuildPath(prev, target);
    return {steps, dist, prev, path};
  }
  function outgoing(u){ return Array.from(state.graph.edges.values()).filter(e=>e.from===u); }
  function rebuildPath(prev, t){ const path=[]; let cur=t; while(cur){ path.unshift(cur); cur = prev.get(cur); } return path; }

  /* ====== Animación ====== */
  const btnRun = $('#btnRun'), btnPlay=$('#btnPlay'), btnPause=$('#btnPause');
  const btnPrev=$('#btnPrev'), btnNext=$('#btnNext'), btnReplay=$('#btnReplay');
  const progress=$('#progress'), liveQueue=$('#liveQueue'), liveExtracted=$('#liveExtracted'), liveIteration=$('#liveIteration');
  let playTimer=null;

  $('#btnRun').addEventListener('click', ()=>{
    const s = $('#selSource').value, t = $('#selTarget').value;
    if(!s || !t || s===t) return toast('Seleccione origen y destino distintos.', 'error');
    const res = runDijkstra(s,t);
    state.anim = {steps: res.steps, idx:0, playing:false, speed:1, result:res};
    progress.max = String(Math.max(0, res.steps.length-1));
    updateByStep(0);
    [btnPlay, btnPrev, btnNext, btnReplay].forEach(b=> b.disabled=false);
    toast('Listo. Usa Reproducir o flechas.', 'success');
    updateDistances(res.steps.at(-1));
    renderResults(res);
    setActiveStep(3);
  });

  $('#rangeSpeed').addEventListener('input', (e)=> { if(state.anim) state.anim.speed = Number(e.target.value); });

  btnPlay.addEventListener('click', ()=> setPlayState(true));
  btnPause.addEventListener('click', ()=> setPlayState(false));
  btnReplay.addEventListener('click', ()=> { if(!state.anim) return; gotoStep(0); });
  btnNext.addEventListener('click', ()=> stepDelta(1));
  btnPrev.addEventListener('click', ()=> stepDelta(-1));
  progress.addEventListener('input', (e)=>{ if(state.anim) gotoStep(Number(e.target.value)); });

  function setPlayState(on){
    if(!state.anim) return;
    state.anim.playing = on;
    btnPlay.hidden = on; btnPause.hidden = !on;
    clearInterval(playTimer);
    if(on){
      playTimer = setInterval(()=>{
        if(state.anim.idx >= state.anim.steps.length-1){ setPlayState(false); return; }
        stepDelta(1);
      }, 700 / (state.anim.speed||1));
    }
  }
  function stepDelta(d){ if(!state.anim) return; gotoStep(clamp(state.anim.idx + d, 0, state.anim.steps.length-1)); }
  function gotoStep(i){ state.anim.idx = i; progress.value = String(i); updateByStep(i); }

  function updateByStep(i){
    const st = state.anim.steps[i];
    liveIteration.textContent = String(i);
    liveExtracted.textContent = st.extracted ?? '—';
    liveQueue.textContent = `[${(st.queue||[]).join(', ')}]`;
    addLog(describeStep(st));
    updateDistances(st);
    if(i===state.anim.steps.length-1){ state.highlightPath = state.anim.result.path; }
    redraw();
  }
  function describeStep(st){
    if(st.type==='init') return 'Inicio: cola inicializada.';
    if(st.type==='extract') return `Extraigo ${st.extracted}.`;
    if(st.type==='relax-better') return `Mejora: ${st.edge.from}→${st.edge.to} = ${st.edge.weight}.`;
    if(st.type==='relax-tie') return `Empate: ${st.edge.from}→${st.edge.to} mantiene distancia.`;
    return 'Sin mejora.';
  }
  function addLog(text){ const li=document.createElement('li'); li.textContent=text; $('#logStream').appendChild(li); li.scrollIntoView({block:'end'}); }

  function updateDistances(st){
    const tbody = $('#distTable tbody'); tbody.innerHTML='';
    const dist = st.dist || new Map(); const prev = st.prev || new Map();
    const nodes = Array.from(state.graph.nodes.keys()).sort();
    nodes.forEach(n=>{
      const d = dist.get(n); const p = prev.get(n);
      const badge = st.extracted===n ? '<span class="badge badge--visited">visitado</span>'
                 : (String(st.queue||[]).includes(n+'(') ? '<span class="badge badge--queue">en cola</span>' : '<span class="badge badge--relax-worse">—</span>');
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${n}</td><td>${Number.isFinite(d)?d:'∞'}</td><td>${p??'—'}</td><td>${badge}</td>`;
      tbody.appendChild(tr);
    });
  }

  function renderResults(res){
    const cost = res.dist.get($('#selTarget').value);
    $('#pathCost').textContent = Number.isFinite(cost) ? String(cost) : '—';
    const ul = $('#pathsList'); ul.innerHTML='';
    const best = res.path;
    if(best.length){
      const li = document.createElement('li'); li.className='is-active';
      li.innerHTML = `<label><input type="radio" name="path" checked /> ${best.join('–')} <span class="badge">costo ${cost}</span></label>`;
      ul.appendChild(li);
      state.highlightPath = best;
    }else{
      ul.innerHTML = '<li>No existe camino.</li>'; state.highlightPath = null;
    }
    const approxAlt = computeSecondBest($('#selSource').value, $('#selTarget').value, best);
    if(approxAlt){
      const li2=document.createElement('li');
      li2.innerHTML = `<label><input type="radio" name="path" /> ${approxAlt.path.join('–')} <span class="badge badge--muted">costo ${approxAlt.cost} (no mínimo)</span></label>`;
      ul.appendChild(li2);
    }
    ul.addEventListener('change', (e)=>{
      if(e.target.name==='path'){
        $$('#pathsList li').forEach(li=>li.classList.remove('is-active'));
        const li = e.target.closest('li'); li.classList.add('is-active');
        const text = e.target.closest('label').textContent;
        const path = text.split('costo')[0].trim().split('–').filter(Boolean);
        state.highlightPath = path; redraw(); toast('Camino resaltado.', 'success');
      }
    }, {once:true});
  }
  function computeSecondBest(s,t,bestPath){
    if(!bestPath || bestPath.length<2) return null;
    let altBest=null;
    for(let i=0;i<bestPath.length-1;i++){
      const u=bestPath[i], v=bestPath[i+1];
      const key=`${u}->${v}`;
      const removed = state.graph.edges.get(key);
      if(!removed) continue;
      state.graph.edges.delete(key);
      const res = runDijkstra(s,t);
      if(res.path.length){
        const cost = res.dist.get(t);
        if(!altBest || cost < altBest.cost) altBest = {path: res.path, cost};
      }
      state.graph.edges.set(key, removed);
    }
    return altBest;
  }

  /* ====== Tabs accesibles ====== */
  const tabs = $$('#panelTabs [role="tab"]');
  function activateTab(idx){
    tabs.forEach((t,i)=>{
      const active = i===idx;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', String(active));
      t.tabIndex = active?0:-1;
      $('#'+t.getAttribute('aria-controls')).hidden = !active;
    });
    tabs[idx].focus();
  }
  tabs.forEach((t,i)=>{
    t.addEventListener('click', ()=>activateTab(i));
    t.addEventListener('keydown', (e)=>{
      if(e.key==='ArrowRight') activateTab((i+1)%tabs.length);
      if(e.key==='ArrowLeft') activateTab((i-1+tabs.length)%tabs.length);
      if(e.key==='Home') activateTab(0);
      if(e.key==='End') activateTab(tabs.length-1);
    });
  });

  /* ====== Inspector demo ====== */
  $('#btnInspectorSelect').addEventListener('click', ()=>{
    $('#inspectorElement').value = 'Nodo A'; $('#inspectorWeight').value = '—'; toast('Inspector actualizado.', 'success');
  });
  $('#btnInspectorEdit').addEventListener('click', ()=> $('#modalEdgeEditor').showModal());
  $('#btnInspectorDelete').addEventListener('click', ()=> $('#modalConfirm').showModal());

  /* ====== Atajos ====== */
  document.addEventListener('keydown', (e)=>{
    if(e.altKey){
      const n = Number(e.key); if(n>=1 && n<=4){ e.preventDefault(); setActiveStep(n); }
    }
    if(e.key===' ' && !e.target.matches('input,textarea')){
      if($('#btnPlay').disabled) return;
      e.preventDefault();
      if($('#btnPlay').hidden) $('#btnPause').click(); else $('#btnPlay').click();
    }
    if(e.key==='ArrowRight' && !e.target.matches('input[type="range"]')){ if(!$('#btnNext').disabled) $('#btnNext').click(); }
    if(e.key==='ArrowLeft' && !e.target.matches('input[type="range"]')){ if(!$('#btnPrev').disabled) $('#btnPrev').click(); }
  });

  /* ====== Export JSON ====== */
  $('#btnExportJSON').addEventListener('click', ()=>{
    const data = {
      nodes: Array.from(state.graph.nodes.values()),
      edges: Array.from(state.graph.edges.values()),
      source: $('#selSource').value || null,
      target: $('#selTarget').value || null,
    };
    const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='grafo.json'; a.click();
    URL.revokeObjectURL(url); toast('JSON exportado.', 'success');
  });

  /* ====== Sidebar responsive ====== */
  const mql = window.matchMedia('(min-width:641px)');
  mql.addEventListener('change', ()=>{ if(mql.matches) $('.sidebar').classList.remove('is-open'); });

  /* ====== Inicial ====== */
  setActiveStep(1);
  redraw();
})();
