(()=>{"use strict";

/* -------- util -------- */
const $ = s => document.querySelector(s);
const fmt = n => Number.isFinite(n)? n.toFixed(0) : "–";
const dist = (a,b) => Math.hypot(a.x-b.x, a.y-b.y);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const key=(a,b)=>`${a}->${b}`;

/* -------- estado -------- */
const state = {
  nodes:new Map(), edges:new Map(),
  activeCount:16,
  modes:{addNode:false, addEdge:false, del:false},
  selection:{a:null,b:null},
  steps:[],
  paths:[], pathIndex:0,
  playing:false,
  zoomPct:85,              // por defecto 85%
  tieDemo:true
};

const svg=$("#mapSvg"), gEdges=$("#edges"), gRoute=$("#route"), gWeights=$("#weights"), gNodes=$("#nodes");

/* Nodos más abiertos para “llenar” el 85% */
const FIXED = [
  {id:"A",x:5 ,y:60},{id:"I",x:20,y:64},{id:"B",x:22,y:50},{id:"C",x:36,y:40},
  {id:"D",x:50,y:28},{id:"E",x:68,y:38},{id:"F",x:90,y:50},{id:"G",x:70,y:62},
  {id:"H",x:48,y:56},{id:"J",x:95,y:42},{id:"K",x:12,y:28},{id:"L",x:28,y:18},
  {id:"M",x:70,y:16},{id:"N",x:84,y:24},{id:"O",x:52,y:10},{id:"P",x:38,y:12}
];
const EDGES0 = [
  ["A","I"],["A","B"],["B","C"],["C","D"],["D","E"],["E","F"],["F","G"],["G","I"],
  ["I","H"],["H","C"],["H","E"],["E","J"],["D","M"],["M","N"],["N","J"],
  ["M","O"],["O","P"],["P","L"],["L","K"],["K","B"],
  ["M","E"]
];

/* Empate K→E con pesos realistas de 3 dígitos (m). Total 700 m en ambas rutas. */
const OVERRIDE_DEMO = {
  // Ruta 1: K-L-P-O-M-E = 120 + 130 + 150 + 140 + 160 = 700
  "K->L":120,"L->K":120,"L->P":130,"P->L":130,"P->O":150,"O->P":150,"O->M":140,"M->O":140,"M->E":160,"E->M":160,
  // Ruta 2: K-B-C-D-E = 180 + 160 + 170 + 190 = 700
  "K->B":180,"B->K":180,"B->C":160,"C->B":160,"C->D":170,"D->C":170,"D->E":190,"E->D":190
};

/* -------- grafo -------- */
function addEdge(a,b){ state.edges.set(key(a,b),{from:a,to:b}); state.edges.set(key(b,a),{from:b,to:a}); persistGraph(); }
function delEdge(a,b){ state.edges.delete(key(a,b)); state.edges.delete(key(b,a)); persistGraph(); }
function uniqUndirected(){
  const s=new Set(), out=[];
  for(const e of state.edges.values()){
    const kk=[e.from,e.to].sort().join("-");
    if(s.has(kk)) continue; s.add(kk); out.push(e);
  }
  return out;
}
function realWeight(a,b){
  // Si está en OVERRIDE, usar ese (3 dígitos). Si no, generar “realista”: >=100 m.
  if(state.tieDemo && OVERRIDE_DEMO[key(a,b)]!=null) return OVERRIDE_DEMO[key(a,b)];
  const A=state.nodes.get(a), B=state.nodes.get(b);
  return Math.max(100, Math.round(dist(A,B)*2.2 + 70)); // todos en 3 dígitos
}
function hasEdges(){
  for(const e of state.edges.values()){
    if(!state.nodes.get(e.from).hidden && !state.nodes.get(e.to).hidden) return true;
  }
  return false;
}

/* -------- init / persist -------- */
function snapshotGraph(){
  return {
    nodes:[...state.nodes.values()].map(n=>({id:n.id,x:n.x,y:n.y,hidden:n.hidden})),
    edges:[...state.edges.values()].map(e=>({from:e.from,to:e.to})),
    activeCount:state.activeCount, tieDemo:state.tieDemo
  };
}
function persistGraph(){ localStorage.setItem("matcomp_graph", JSON.stringify(snapshotGraph())); }
function persistSelection(){
  const o=$("#origin").value||null, d=$("#destination").value||null;
  const sum=JSON.parse(localStorage.getItem("matcomp_summary")||"{}");
  localStorage.setItem("matcomp_summary", JSON.stringify({...sum, o, d}));
}
function restoreSelection(){
  const sum=JSON.parse(localStorage.getItem("matcomp_summary")||"{}");
  const {o,d}=sum;
  if(o && state.nodes.has(o) && !state.nodes.get(o).hidden) $("#origin").value=o;
  if(d && state.nodes.has(d) && !state.nodes.get(d).hidden) $("#destination").value=d;
}
function loadGraphIfAny(){
  const raw=localStorage.getItem("matcomp_graph");
  if(!raw) return false;
  try{
    const g=JSON.parse(raw);
    state.nodes = new Map(g.nodes.map(n=>[n.id,{...n}]));
    state.edges = new Map(g.edges.map(e=>[key(e.from,e.to),{...e}]));
    state.activeCount = g.activeCount ?? 16;
    state.tieDemo = !!g.tieDemo;
    return true;
  }catch{ return false; }
}

function init(){
  // usa grafo guardado si existe; si no, inicial por defecto
  if(!loadGraphIfAny()){
    FIXED.forEach(n=> state.nodes.set(n.id,{...n,hidden:false}));
    EDGES0.forEach(([a,b])=> addEdge(a,b));
  }
  applyNodeCount(state.activeCount);
  fillSelects();
  restoreSelection();             // ← mantiene “Me encuentro en / Quiero ir a”
  $("#zoom").value = state.zoomPct; setZoom(state.zoomPct);
  render();
}
document.addEventListener("DOMContentLoaded", init);

/* ocultar/mostrar sin borrar aristas */
function applyNodeCount(n){
  state.activeCount=n;
  const order=[...state.nodes.keys()].sort();
  order.forEach((id,idx)=> state.nodes.get(id).hidden = idx>=n );
  persistGraph();
}

/* selects */
function fillSelects(){
  const opts=[...state.nodes.values()].filter(n=>!n.hidden).sort((a,b)=>a.id.localeCompare(b.id))
    .map(n=>`<option value="${n.id}">${n.id}</option>`).join("");
  $("#origin").innerHTML=`<option disabled selected>Selecciona…</option>${opts}`;
  $("#destination").innerHTML=`<option disabled selected>Selecciona…</option>${opts}`;
}

/* render */
function render(){
  gEdges.innerHTML=""; gNodes.innerHTML=""; gRoute.innerHTML=""; gWeights.innerHTML="";

  for(const e of uniqUndirected()){
    const A=state.nodes.get(e.from), B=state.nodes.get(e.to);
    if(A.hidden||B.hidden) continue;

    const line=document.createElementNS("http://www.w3.org/2000/svg","line");
    line.setAttribute("x1",A.x); line.setAttribute("y1",A.y);
    line.setAttribute("x2",B.x); line.setAttribute("y2",B.y);
    line.classList.add("edge");
    line.addEventListener("click",(ev)=>{ if(!state.modes.del) return; ev.stopPropagation(); delEdge(e.from,e.to); render(); });
    gEdges.appendChild(line);

    if($("#chkWeights").checked){
      const tx=(A.x+B.x)/2, ty=(A.y+B.y)/2 - .8;
      const t=document.createElementNS("http://www.w3.org/2000/svg","text");
      t.setAttribute("x",tx); t.setAttribute("y",ty);
      t.classList.add("weight");
      t.textContent=`${fmt(realWeight(e.from,e.to))} m`;
      gWeights.appendChild(t);
    }
  }

  for(const n of state.nodes.values()){
    const g=document.createElementNS("http://www.w3.org/2000/svg","g");
    g.dataset.id=n.id; g.classList.add("node"); if(n.hidden) g.classList.add("node--hidden");

    const c=document.createElementNS("http://www.w3.org/2000/svg","circle");
    c.setAttribute("cx",n.x); c.setAttribute("cy",n.y); c.setAttribute("r",1.8);

    const t=document.createElementNS("http://www.w3.org/2000/svg","text");
    t.setAttribute("x",n.x); t.setAttribute("y",n.y);
    t.textContent=n.id;

    g.append(c,t);
    g.addEventListener("click", ()=> onNodeClick(n.id));
    gNodes.appendChild(g);
  }

  drawRoute(true);
}

/* modos */
function setMode(m){
  Object.keys(state.modes).forEach(k=> state.modes[k]=false);
  if(m) state.modes[m]=true;
  $("#modeAddNode").setAttribute("aria-pressed", state.modes.addNode);
  $("#modeAddEdge").setAttribute("aria-pressed", state.modes.addEdge);
  $("#modeDelete").setAttribute("aria-pressed", state.modes.del);
  state.selection.a=state.selection.b=null;
}
$("#modeAddNode").onclick=()=> setMode(state.modes.addNode?null:"addNode");
$("#modeAddEdge").onclick=()=> setMode(state.modes.addEdge?null:"addEdge");
$("#modeDelete").onclick =()=> setMode(state.modes.del?null:"del");

/* click en nodo */
function onNodeClick(id){
  if(state.modes.del){
    const order=[...state.nodes.keys()].sort();
    if(order.indexOf(id)<8){ toast("No se eliminan los 8 nodos base."); return; }
    [...state.edges.values()].forEach(e=>{ if(e.from===id||e.to===id) delEdge(e.from,e.to); });
    state.nodes.delete(id); fillSelects(); persistGraph(); render(); return;
  }
  if(state.modes.addEdge){
    if(!state.selection.a){ state.selection.a=id; return; }
    if(state.selection.a===id){ state.selection.a=null; return; }
    state.selection.b=id; addEdge(state.selection.a,state.selection.b);
    state.selection.a=state.selection.b=null; render(); return;
  }
  const o=$("#origin"), d=$("#destination");
  if(!o.value || o.value===id) o.value=id; else d.value=id;
  persistSelection();  // ← guarda la selección al vuelo
}

/* punto manual */
$("#mapHost").addEventListener("click",(ev)=>{
  if(!state.modes.addNode) return;
  const pt=svg.createSVGPoint(); pt.x=ev.clientX; pt.y=ev.clientY;
  const loc=pt.matrixTransform(svg.getScreenCTM().inverse());
  const id=nextId();
  state.nodes.set(id,{id,x:clamp(loc.x,0,100),y:clamp(loc.y,0,70),hidden:false});
  const near=nearestVisible(id); if(near) addEdge(id,near.id);
  fillSelects(); persistGraph(); render();
});
function nextId(){ const letters="ABCDEFGHIJKLMNOPQRSTUVWXYZ"; for(const ch of letters){ if(!state.nodes.has(ch)) return ch; } let i=1; while(state.nodes.has("Z"+i)) i++; return "Z"+i; }
function nearestVisible(id){
  const n=state.nodes.get(id); let best=null,bd=1e9;
  for(const m of state.nodes.values()){ if(m.id===id || m.hidden) continue; const d=dist(n,m); if(d<bd){bd=d; best=m;} }
  return best;
}

/* slider 8–16 */
$("#nodeCount").addEventListener("input",(e)=>{
  $("#nodeCountOut").value=e.target.value;
  applyNodeCount(e.target.valueAsNumber);
  fillSelects(); restoreSelection(); render();
});

/* mostrar pesos / zoom */
$("#chkWeights").addEventListener("change", render);
function setZoom(pct){
  state.zoomPct=pct;
  const scale=pct/100, w=100/scale, h=70/scale, x=50-w/2, y=35-h/2;
  svg.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
  $("#zoomOutVal").value=`${pct}%`;
}
$("#zoom").addEventListener("input",(e)=> setZoom(+e.target.value));
$("#zoomOut").addEventListener("click", ()=>{ const p=Math.max(75,state.zoomPct-5); $("#zoom").value=p; setZoom(p); });
$("#zoomIn").addEventListener("click",  ()=>{ const p=Math.min(125,state.zoomPct+5); $("#zoom").value=p; setZoom(p); });

/* Dijkstra */
function dijkstra(src){
  const ids=[...state.nodes.values()].filter(n=>!n.hidden).map(n=>n.id);
  const Q=new Set(ids);
  const D=Object.fromEntries(ids.map(id=>[id,Infinity]));
  const P=Object.fromEntries(ids.map(id=>[id,[]]));
  D[src]=0; state.steps=[]; let it=0;

  const adj=u=> [...state.edges.values()].filter(e=>e.from===u && !state.nodes.get(e.to).hidden);

  while(Q.size){
    let u=null,best=Infinity; for(const id of Q){ if(D[id]<best){best=D[id]; u=id;} }
    if(u===null) break; Q.delete(u);

    state.steps.push({i:++it, processed:u, visited:ids.filter(x=>!Q.has(x)), dist:{...D}, prev:JSON.parse(JSON.stringify(P))});

    for(const e of adj(u)){
      if(!Q.has(e.to)) continue;
      const alt = D[u] + realWeight(e.from,e.to);
      if(alt < D[e.to]-1e-9){ D[e.to]=alt; P[e.to]=[u]; }
      else if(Math.abs(alt-D[e.to])<=1e-9){ if(!P[e.to].includes(u)) P[e.to].push(u); }
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

/* animación */
const anim={seg:0,segT:0,t0:null,playing:false,raf:null};
const SPEED=28;

function currentPts(){
  const path=state.paths[state.pathIndex]||[];
  return path.map(id=>{const n=state.nodes.get(id); return [n.x,n.y];});
}
function ensureDot(){
  let dot=gRoute.querySelector(".route-dot");
  if(!dot){
    dot=document.createElementNS("http://www.w3.org/2000/svg","circle");
    dot.setAttribute("r","1.2");
    dot.classList.add("route-dot");
    gRoute.appendChild(dot);
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
    if(u>=1){ anim.seg++; anim.segT=0; if(anim.seg>=pts.length-1){ anim.playing=false; $("#playerStatus").textContent="Animación finalizada"; return; } }
    anim.raf=requestAnimationFrame(step);
  };
  anim.raf=requestAnimationFrame(step);
}

/* controles */
$("#btnPlay").onclick = ()=>{ if(!state.paths.length) return; state.playing=true; anim.playing=true; anim.t0=null; $("#playerStatus").textContent="Reproduciendo…"; drawRoute(true); };
$("#btnPause").onclick= ()=>{ anim.playing=false; state.playing=false; $("#playerStatus").textContent="Pausado"; };
$("#btnReset").onclick= ()=>{ anim.playing=false; state.playing=false; anim.seg=0; anim.segT=0; $("#playerStatus").textContent="Listo"; drawRoute(true); };

/* resolver / alternar */
function solve(){
  const o=$("#origin").value, d=$("#destination").value;
  if(!o || !d) return toast("Selecciona origen y destino.");
  if(o===d)     return toast("El origen y el destino deben ser diferentes.");
  if(!hasEdges()) return toast("No hay aristas. Crea conexiones con 🔗 Arista.");

  const {D,P}=dijkstra(o); const dOD=D[d];
  if(!isFinite(dOD)) return toast("No existe un camino entre los puntos seleccionados.");

  state.paths=allShortestPaths(P,o,d); state.pathIndex=0;

  $("#outDistance").textContent=fmt(dOD)+" m";
  $("#outStart").textContent=o; $("#outEnd").textContent=d;
  $("#outPath").textContent=state.paths[0].join(" → ");
  $("#outAlt").textContent=state.paths.length>1?`${state.paths.length} alternativas`:"Única";
  $("#btnAltPath").disabled=state.paths.length<=1;

  // Guardar todo (para que pasos/matrices lean esto)
  localStorage.setItem("matcomp_steps", JSON.stringify(state.steps));
  localStorage.setItem("matcomp_paths", JSON.stringify(state.paths));
  localStorage.setItem("matcomp_pathIndex", String(state.pathIndex));
  localStorage.setItem("matcomp_summary", JSON.stringify({o,d,dist:dOD}));

  anim.playing=false; anim.seg=0; anim.segT=0;
  drawRoute(true);
}
$("#btnSolve").onclick=solve;

$("#btnAltPath").onclick=()=>{
  if(state.paths.length<=1) return;
  state.pathIndex=(state.pathIndex+1)%state.paths.length;
  $("#outPath").textContent=state.paths[state.pathIndex].join(" → ");
  anim.playing=false; anim.seg=0; anim.segT=0;
  drawRoute(true);
};

$("#btnClear").onclick=()=>{
  $("#origin").value=""; $("#destination").value="";
  ["outDistance","outStart","outEnd","outPath","outAlt"].forEach(id=>$("#"+id).textContent="–");
  state.paths=[]; state.pathIndex=0; state.steps=[];
  localStorage.setItem("matcomp_summary", JSON.stringify({o:null,d:null,dist:null}));
  gRoute.innerHTML=""; $("#playerStatus").textContent="Listo";
};

/* helpers */
function toast(msg){ $("#playerStatus").textContent=msg; }
})();
