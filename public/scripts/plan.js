/* ==========================================
   public/scripts/plan.js — Versión corregida
   ========================================== */
(()=>{"use strict";

/* ===== Utils ===== */
const $ = (s)=>document.querySelector(s);
const S = sessionStorage;                           // Reinicia al cerrar pestaña/ventana
const fmt = (n)=>Number.isFinite(n)?n.toFixed(0):"–";
const dist = (a,b)=>Math.hypot(a.x-b.x, a.y-b.y);
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const key = (a,b)=>`${a}->${b}`;

/* ===== Rotulado (puestos del zoológico) ===== */
const NAMES={
  A:"Entrada Principal", I:"Aves", B:"Felinos", C:"Reptiles",
  D:"Anfibios", E:"Herbívoros", F:"Mariposario", G:"Laguna",
  H:"Andinos", J:"Restaurante", K:"Baños", L:"Tienda",
  M:"Zona Infantil", N:"Museo", O:"Anfiteatro", P:"Salida"
};

/* ===== Estado ===== */
const state={
  nodes:new Map(),     // { id,x,y, base:boolean, hidden:boolean }
  edges:new Map(),     // mapa dirigido: "A->B" y "B->A"
  activeCount:16,
  modes:{addNode:false, addEdge:false, del:false},
  selection:{a:null,b:null},
  steps:[],
  paths:[], pathIndex:0,
  playing:false,
  zoomPct:85,
  showWeights:true
};

/* SVG / capas */
const svg=$("#mapSvg"),
      gEdges=$("#edges"), gRoute=$("#route"), gWeights=$("#weights"),
      gNodes=$("#nodes"), gGhost=$("#ghost");

/* ===== Layout fijo (más separado) ===== */
const FIXED_ORDER=["A","I","B","C","D","E","F","G","H","J","K","L","M","N","O","P"];
const FIXED_POS={
  A:{x:6 ,y:62}, I:{x:20,y:64}, B:{x:24,y:46}, C:{x:36,y:28},
  D:{x:52,y:18}, E:{x:76,y:26}, F:{x:94,y:42}, G:{x:76,y:60},
  H:{x:50,y:52}, J:{x:96,y:34}, K:{x:12,y:18}, L:{x:28,y:10},
  M:{x:76,y:10}, N:{x:90,y:18}, O:{x:56,y:6 }, P:{x:40,y:8 }
};
/* Aristas base */
const EDGES0 = [
  ["A","I"],["A","B"],["B","C"],["C","D"],["D","E"],["E","F"],["F","G"],["G","I"],
  ["I","H"],["H","C"],["H","E"],["E","J"],["D","M"],["M","N"],["N","J"],
  ["M","O"],["O","P"],["P","L"],["L","K"],["K","B"],["M","E"]
];

/* ===== Demo “empate” 700 m entre K y E =====
   R1: K-L-P-O-M-E = 120+130+150+140+160
   R2: K-B-C-D-E   = 180+160+170+190
   Se “blinda” C–H y H–E (y C–E) para evitar atajos más baratos. */
const OVERRIDE_DEMO={
  "K->L":120,"L->K":120,"L->P":130,"P->L":130,"P->O":150,"O->P":150,"O->M":140,"M->O":140,"M->E":160,"E->M":160,
  "K->B":180,"B->K":180,"B->C":160,"C->B":160,"C->D":170,"D->C":170,"D->E":190,"E->D":190,
  "C->H":380,"H->C":380,"H->E":360,"E->H":360,"C->E":420,"E->C":420
};
const TIE_EDGES=[["K","L"],["L","P"],["P","O"],["O","M"],["M","E"],["K","B"],["B","C"],["C","D"],["D","E"],["C","H"],["H","E"],["C","E"]];

/* ===== Grafo ===== */
function addEdge(a,b){
  state.edges.set(key(a,b),{from:a,to:b});
  state.edges.set(key(b,a),{from:b,to:a});
  persistGraph();
}
function delEdge(a,b){
  state.edges.delete(key(a,b));
  state.edges.delete(key(b,a));
  persistGraph();
}
function uniqUndirected(){
  const s=new Set(), out=[];
  for(const e of state.edges.values()){
    const kk=[e.from,e.to].sort().join("-");
    if(s.has(kk)) continue;
    s.add(kk); out.push(e);
  }
  return out;
}
/* Pesos enteros 3 dígitos (m) + overrides del demo */
function realWeight(a,b){
  if(OVERRIDE_DEMO[key(a,b)]!=null) return OVERRIDE_DEMO[key(a,b)];
  const A=state.nodes.get(a), B=state.nodes.get(b);
  return clamp(Math.round(dist(A,B)*2.2 + 70), 100, 999);
}
function hasEdges(){
  for(const e of state.edges.values()){
    const A=state.nodes.get(e.from), B=state.nodes.get(e.to);
    if(!A.hidden && !B.hidden) return true;
  } return false;
}

/* ===== Persistencia (sessionStorage) ===== */
function snapshotGraph(){
  return {
    nodes:[...state.nodes.values()].map(n=>({id:n.id,x:n.x,y:n.y,base:n.base??false,hidden:n.hidden??false})),
    edges:[...state.edges.values()].map(e=>({from:e.from,to:e.to})),
    activeCount:state.activeCount
  };
}
function persistGraph(){ S.setItem("matcomp_graph", JSON.stringify(snapshotGraph())); }
function persistSelection(){
  const o=$("#origin").value||null, d=$("#destination").value||null;
  const sum=JSON.parse(S.getItem("matcomp_summary")||"{}");
  S.setItem("matcomp_summary", JSON.stringify({...sum, o, d}));
}
function restoreSelection(){
  const sum=JSON.parse(S.getItem("matcomp_summary")||"{}");
  const {o,d}=sum||{};
  if(o && state.nodes.has(o) && !state.nodes.get(o).hidden) $("#origin").value=o;
  if(d && state.nodes.has(d) && !state.nodes.get(d).hidden) $("#destination").value=d;
}

/* ===== Init ===== */
function loadGraphIfAny(){
  const raw=S.getItem("matcomp_graph"); if(!raw) return false;
  try{
    const g=JSON.parse(raw);
    state.nodes=new Map(g.nodes.map(n=>{
      const base=FIXED_ORDER.includes(n.id);
      const pos=base?FIXED_POS[n.id]:{x:n.x,y:n.y};
      return [n.id,{id:n.id,x:pos.x,y:pos.y,base,hidden:!!(n.hidden||n.inactive)}];
    }));
    state.edges=new Map(g.edges.map(e=>[key(e.from,e.to),{...e}]));
    state.activeCount=g.activeCount??16;
    return true;
  }catch{ return false; }
}
function seedFixed(){
  FIXED_ORDER.forEach(id=>{
    const p=FIXED_POS[id];
    state.nodes.set(id,{id,x:p.x,y:p.y,base:true,hidden:false});
  });
  EDGES0.forEach(([a,b])=> addEdge(a,b));
}
function ensureTieEdges(){ TIE_EDGES.forEach(([a,b])=>{ if(!state.edges.has(key(a,b))) addEdge(a,b); }); }

function applyNodeCount(n){
  state.activeCount=n;
  FIXED_ORDER.forEach((id,idx)=>{
    const node=state.nodes.get(id);
    if(node) node.hidden = idx>=n;      // ahora se OCULTAN (no atenuados)
  });
  persistGraph(); render();
}
function fillSelects(){
  const opts=[...state.nodes.values()]
    .filter(n=>!n.hidden)
    .sort((a,b)=>a.id.localeCompare(b.id))
    .map(n=>`<option value="${n.id}">${n.id} — ${NAMES[n.id]||n.id}</option>`).join("");
  $("#origin").innerHTML=`<option disabled selected>Selecciona…</option>${opts}`;
  $("#destination").innerHTML=`<option disabled selected>Selecciona…</option>${opts}`;
}
["origin","destination"].forEach(id=>{
  document.addEventListener("change",(e)=>{ if(e.target && e.target.id===id) persistSelection(); });
});

function init(){
  if(!loadGraphIfAny()) seedFixed();
  ensureTieEdges();

  applyNodeCount(state.activeCount);
  fillSelects(); restoreSelection();

  $("#zoom").value=state.zoomPct; setZoom(state.zoomPct);
  setupGhost();
  render();

  // Restaurar ruta (misma sesión/pestaña)
  const paths=JSON.parse(S.getItem("matcomp_paths")||"null");
  const pIndex=+S.getItem("matcomp_pathIndex");
  const summary=JSON.parse(S.getItem("matcomp_summary")||"{}");
  if(paths && paths.length){
    state.paths=paths; state.pathIndex=Number.isFinite(pIndex)?pIndex:0;
    if(summary?.o) $("#outStart").textContent=summary.o;
    if(summary?.d) $("#outEnd").textContent=summary.d;
    if(Number.isFinite(summary?.dist)) $("#outDistance").textContent=fmt(summary.dist)+" m";
    $("#outPath").textContent=state.paths[state.pathIndex].join(" ⇒ ");
    $("#outAlt").textContent=state.paths.length>1?`${state.paths.length} alternativas`:"Única";
    $("#btnAltPath").disabled=state.paths.length<=1;
    drawRoute(true);
  }

  $("#btnToggleWeights").addEventListener("click",()=>{
    state.showWeights=!state.showWeights;
    $("#btnToggleWeights").setAttribute("aria-pressed", String(state.showWeights));
    render();
  });
}
document.addEventListener("DOMContentLoaded",init);

/* ===== Render ===== */
function render(){
  gEdges.innerHTML=""; gNodes.innerHTML=""; gRoute.innerHTML=""; gWeights.innerHTML="";

  // Aristas + pesos (peso en el centro exacto del segmento)
  for(const e of uniqUndirected()){
    const A=state.nodes.get(e.from), B=state.nodes.get(e.to);
    if(A.hidden || B.hidden) continue;

    const line=document.createElementNS("http://www.w3.org/2000/svg","line");
    line.setAttribute("x1",A.x); line.setAttribute("y1",A.y);
    line.setAttribute("x2",B.x); line.setAttribute("y2",B.y);
    line.classList.add("edge");
    line.addEventListener("click",(ev)=>{ if(!state.modes.del) return; ev.stopPropagation(); delEdge(e.from,e.to); render(); });
    gEdges.appendChild(line);

    if(state.showWeights){
      const tx=(A.x+B.x)/2, ty=(A.y+B.y)/2;   // medio exacto
      const t=document.createElementNS("http://www.w3.org/2000/svg","text");
      t.setAttribute("x",tx); t.setAttribute("y",ty);
      t.classList.add("weight");
      t.textContent=`${fmt(realWeight(e.from,e.to))} m`;
      gWeights.appendChild(t);
    }
  }

  // Nodos
  for(const n of state.nodes.values()){
    if(n.hidden) continue;
    const g=document.createElementNS("http://www.w3.org/2000/svg","g");
    g.dataset.id=n.id; g.classList.add("node");

    const c=document.createElementNS("http://www.w3.org/2000/svg","circle");
    c.setAttribute("cx",n.x); c.setAttribute("cy",n.y); c.setAttribute("r",2.6);

    const tLetter=document.createElementNS("http://www.w3.org/2000/svg","text");
    tLetter.setAttribute("x",n.x); tLetter.setAttribute("y",n.y);
    tLetter.setAttribute("class","letter"); tLetter.textContent=n.id;

    const tName=document.createElementNS("http://www.w3.org/2000/svg","text");
    tName.setAttribute("x",n.x); tName.setAttribute("y",n.y+3.1);
    tName.setAttribute("class","name"); tName.textContent=NAMES[n.id]||n.id;

    g.append(c,tLetter,tName);
    g.addEventListener("click",()=>onNodeClick(n.id));
    gNodes.appendChild(g);
  }

  drawRoute(true);
  updateGhostVisibility();
}

/* ===== Modos ===== */
function setMode(m){
  Object.keys(state.modes).forEach(k=> state.modes[k]=false);
  if(m) state.modes[m]=true;
  $("#modeAddNode").setAttribute("aria-pressed",state.modes.addNode);
  $("#modeAddEdge").setAttribute("aria-pressed",state.modes.addEdge);
  $("#modeDelete").setAttribute("aria-pressed",state.modes.del);
  state.selection.a=state.selection.b=null;
  updateGhostVisibility();
}
$("#modeAddNode").onclick=()=>setMode(state.modes.addNode?null:"addNode");
$("#modeAddEdge").onclick=()=>setMode(state.modes.addEdge?null:"addEdge"); // Botón “RUTA”
$("#modeDelete").onclick =()=>setMode(state.modes.del?null:"del");

/* Click en nodo (selección / edición) */
function onNodeClick(id){
  if(state.modes.del){
    const node=state.nodes.get(id);
    if(node?.base){ toast("Los nodos base no se eliminan."); return; }
    // borra aristas incidentes
    [...state.edges.values()].forEach(e=>{ if(e.from===id||e.to===id) delEdge(e.from,e.to); });
    state.nodes.delete(id); fillSelects(); persistGraph(); render(); return;
  }
  if(state.modes.addEdge){
    if(!state.selection.a){ state.selection.a=id; return; }
    if(state.selection.a===id){ state.selection.a=null; return; }
    state.selection.b=id; addEdge(state.selection.a,state.selection.b);
    state.selection.a=state.selection.b=null; render(); return;
  }
  // si no está en modo edición, rellenamos origen/destino rápidamente
  const o=$("#origin"), d=$("#destination");
  if(!o.value || o.value===id) o.value=id; else d.value=id;
  persistSelection();
}

/* ===== Preview de punto (ghost) ===== */
let ghost={el:null,label:null,visible:false};
function setupGhost(){
  ghost.el=document.createElementNS("http://www.w3.org/2000/svg","circle");
  ghost.el.setAttribute("r",2.6); ghost.el.setAttribute("class","ghost-circle");
  ghost.label=document.createElementNS("http://www.w3.org/2000/svg","text");
  ghost.label.setAttribute("class","ghost-label");
  gGhost.append(ghost.el,ghost.label);

  $("#mapHost").addEventListener("mousemove",(ev)=>{
    if(!state.modes.addNode) return;
    const pt=clientToSvg(ev); moveGhost(pt.x,pt.y);
  });
  $("#mapHost").addEventListener("mouseleave",()=>{ ghost.visible=false; updateGhostVisibility(); });
  $("#mapHost").addEventListener("mouseenter",()=>{ if(state.modes.addNode){ ghost.visible=true; updateGhostVisibility(); } });
}
function clientToSvg(ev){
  const pt=svg.createSVGPoint(); pt.x=ev.clientX; pt.y=ev.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}
function moveGhost(x,y){
  const nx=clamp(x,0,100), ny=clamp(y,0,70);
  ghost.el.setAttribute("cx",nx); ghost.el.setAttribute("cy",ny);
  ghost.label.setAttribute("x",nx); ghost.label.setAttribute("y",ny);
  ghost.label.textContent=nextId();
  if(!ghost.visible){ ghost.visible=true; updateGhostVisibility(); }
}
function updateGhostVisibility(){ gGhost.style.display=(state.modes.addNode && ghost.visible)?"block":"none"; }

/* Agregar punto manual (no base) */
$("#mapHost").addEventListener("click",(ev)=>{
  if(!state.modes.addNode) return;
  const pt=clientToSvg(ev);
  const id=nextId();
  state.nodes.set(id,{id,x:clamp(pt.x,0,100),y:clamp(pt.y,0,70),base:false,hidden:false});
  const near=nearestAny(id); if(near) addEdge(id,near.id);
  fillSelects(); persistGraph(); render();
});
function nextId(){
  const letters="ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for(const ch of letters){ if(!state.nodes.has(ch)) return ch; }
  let i=1; while(state.nodes.has("Z"+i)) i++; return "Z"+i;
}
function nearestAny(id){
  const n=state.nodes.get(id); let best=null, bd=1e9;
  for(const m of state.nodes.values()){
    if(m.id===id) continue;
    const d=dist(n,m); if(d<bd){bd=d; best=m;}
  } return best;
}

/* ===== Sliders / Zoom ===== */
$("#nodeCount").addEventListener("input",(e)=>{
  $("#nodeCountOut").value=e.target.value;
  applyNodeCount(e.target.valueAsNumber);
  fillSelects(); restoreSelection();
});
function setZoom(pct){
  state.zoomPct=pct;
  const scale=pct/100, w=100/scale, h=70/scale, x=50-w/2, y=35-h/2;
  svg.setAttribute("viewBox",`${x} ${y} ${w} ${h}`);
}
$("#zoom").addEventListener("input",(e)=> setZoom(+e.target.value));
$("#zoomOut").addEventListener("click",()=>{ const p=Math.max(75,state.zoomPct-5); $("#zoom").value=p; setZoom(p);});
$("#zoomIn").addEventListener("click", ()=>{ const p=Math.min(125,state.zoomPct+5); $("#zoom").value=p; setZoom(p);});

/* ===== Dijkstra ===== */
function dijkstra(src){
  const ids=[...state.nodes.values()].filter(n=>!n.hidden).map(n=>n.id);
  const Q=new Set(ids);
  const D=Object.fromEntries(ids.map(id=>[id,Infinity]));
  const P=Object.fromEntries(ids.map(id=>[id,[]]));
  D[src]=0; state.steps=[]; let it=0;

  const adj=u=> [...state.edges.values()].filter(e=>{
    const A=state.nodes.get(e.from), B=state.nodes.get(e.to);
    return e.from===u && !A.hidden && !B.hidden;
  });

  while(Q.size){
    let u=null,best=Infinity; for(const id of Q){ if(D[id]<best){best=D[id]; u=id;} }
    if(u===null) break; Q.delete(u);

    state.steps.push({i:++it, processed:u, visited:ids.filter(x=>!Q.has(x)), dist:{...D}, prev:JSON.parse(JSON.stringify(P))});

    for(const e of adj(u)){
      if(!Q.has(e.to)) continue;
      const alt = D[u] + realWeight(e.from,e.to);
      if(alt < D[e.to]-1e-9){ D[e.to]=alt; P[e.to]=[u]; }
      else if(Math.abs(alt-D[e.to])<=1e-9){ if(!P[e.to].includes(u)) P[e.to].push(u); } // empates
    }
  }
  return {D,P};
}
function allShortestPaths(P,start,goal){
  const out=[], st=[[goal,[goal]]];
  while(st.length){
    const [v,path]=st.pop();
    if(v===start){ out.push([...path].reverse()); continue; }
    for(const p of (P[v]||[])) st.push([p,[...path,p]]);
  }
  return out.sort((a,b)=>a.length-b.length);
}

/* ===== Animación ===== */
const anim={seg:0,segT:0,t0:null,playing:false,raf:null};
const SPEED=28; // “velocidad” del punto animado
const currentPts=()=> (state.paths[state.pathIndex]||[]).map(id=>{const n=state.nodes.get(id); return [n.x,n.y];});
function ensureDot(){
  let dot=gRoute.querySelector(".route-dot");
  if(!dot){
    dot=document.createElementNS("http://www.w3.org/2000/svg","circle");
    dot.setAttribute("r","1.2"); dot.classList.add("route-dot"); gRoute.appendChild(dot);
  }
  return dot;
}
function drawRoute(reset){
  const pts=currentPts();
  gRoute.innerHTML="";
  if(pts.length<2) return;

  const pl=document.createElementNS("http://www.w3.org/2000/svg","polyline");
  pl.setAttribute("points", pts.map(p=>p.join(",")).join(" "));
  pl.setAttribute("fill","none"); pl.classList.add("route-line"); gRoute.appendChild(pl);

  const dot=ensureDot();
  if(reset){ anim.seg=0; anim.segT=0; anim.t0=null; }
  const i=Math.min(anim.seg, Math.max(0, pts.length-1));
  moveDot(dot, pts[i][0], pts[i][1]);
  if(anim.playing) animate(dot, pts);
}
function moveDot(el,x,y){ el.setAttribute("cx",x); el.setAttribute("cy",y); }
function animate(dot,pts){
  cancelAnimationFrame(anim.raf);
  const step=(t)=>{
    if(!anim.playing) return;
    if(!anim.t0) anim.t0=t; const dt=(t-anim.t0)/1000; anim.t0=t;
    const a=pts[anim.seg], b=pts[anim.seg+1]; const L=Math.hypot(b[0]-a[0], b[1]-a[1]), dur=L/SPEED;
    anim.segT+=dt; const u=Math.min(anim.segT/dur,1);
    moveDot(dot, a[0]+(b[0]-a[0])*u, a[1]+(b[1]-a[1])*u);
    if(u>=1){
      anim.seg++; anim.segT=0;
      if(anim.seg>=pts.length-1){ anim.playing=false; $("#playerStatus").textContent="Animación finalizada"; return; }
    }
    anim.raf=requestAnimationFrame(step);
  };
  anim.raf=requestAnimationFrame(step);
}

/* ===== Botones ===== */
$("#btnPlay").onclick = ()=>{ if(!state.paths.length) return; state.playing=true; anim.playing=true; anim.t0=null; $("#playerStatus").textContent="Reproduciendo…"; drawRoute(true); };
$("#btnPause").onclick= ()=>{ anim.playing=false; state.playing=false; $("#playerStatus").textContent="Pausado"; };
$("#btnReset").onclick= ()=>{ anim.playing=false; state.playing=false; anim.seg=0; anim.segT=0; $("#playerStatus").textContent="Listo"; drawRoute(true); };

function solve(){
  const o=$("#origin").value, d=$("#destination").value;
  if(!o || !d){ toast("Selecciona origen y destino."); return; }
  if(o===d){ toast("El origen y el destino deben ser diferentes."); return; }
  if(!hasEdges()){ toast("No hay rutas activas. Usa RUTA para conectar puntos."); return; }

  const {D,P}=dijkstra(o); const dOD=D[d];
  if(!isFinite(dOD)){ toast("No existe un camino entre los puntos seleccionados."); return; }

  state.paths=allShortestPaths(P,o,d); state.pathIndex=0;

  $("#outDistance").textContent=fmt(dOD)+" m";
  $("#outStart").textContent=o; $("#outEnd").textContent=d;
  $("#outPath").textContent=state.paths[0].join(" ⇒ ");
  $("#outAlt").textContent=state.paths.length>1?`${state.paths.length} alternativas`:"Única";
  $("#btnAltPath").disabled=state.paths.length<=1;

  S.setItem("matcomp_steps", JSON.stringify(state.steps));
  S.setItem("matcomp_paths", JSON.stringify(state.paths));
  S.setItem("matcomp_pathIndex", String(state.pathIndex));
  S.setItem("matcomp_summary", JSON.stringify({o,d,dist:dOD}));

  anim.playing=false; anim.seg=0; anim.segT=0; drawRoute(true);
}
$("#btnSolve").onclick=solve;

$("#btnAltPath").onclick=()=>{
  if(state.paths.length<=1) return;
  state.pathIndex=(state.pathIndex+1)%state.paths.length;
  S.setItem("matcomp_pathIndex", String(state.pathIndex));
  $("#outPath").textContent=state.paths[state.pathIndex].join(" ⇒ ");
  anim.playing=false; anim.seg=0; anim.segT=0; drawRoute(true);
};

$("#btnClear").onclick=()=>{
  $("#origin").value=""; $("#destination").value="";
  ["outDistance","outStart","outEnd","outPath","outAlt"].forEach(id=>$("#"+id).textContent="–");
  state.paths=[]; state.pathIndex=0; state.steps=[];
  S.setItem("matcomp_summary", JSON.stringify({o:null,d:null,dist:null}));
  S.removeItem("matcomp_paths"); S.removeItem("matcomp_pathIndex");
  gRoute.innerHTML=""; $("#playerStatus").textContent="Listo";
};

function toast(msg){ $("#playerStatus").textContent=msg; }

})();
