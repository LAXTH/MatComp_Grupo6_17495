/* Matrices — pesos enteros (m) y coherentes con index */
const $=s=>document.querySelector(s);

function readGraph(){
  const raw=localStorage.getItem("matcomp_graph");
  if(raw) return JSON.parse(raw);
  // fallback (si se abre directo esta página)
  return {
    nodes:[
      {id:"A",x:5 ,y:60,hidden:false},{id:"I",x:20,y:64,hidden:false},{id:"B",x:22,y:50,hidden:false},{id:"C",x:36,y:40,hidden:false},
      {id:"D",x:50,y:28,hidden:false},{id:"E",x:68,y:38,hidden:false},{id:"F",x:90,y:50,hidden:false},{id:"G",x:70,y:62,hidden:false},
      {id:"H",x:48,y:56,hidden:false},{id:"J",x:95,y:42,hidden:false},{id:"K",x:12,y:28,hidden:false},{id:"L",x:28,y:18,hidden:false},
      {id:"M",x:70,y:16,hidden:false},{id:"N",x:84,y:24,hidden:false},{id:"O",x:52,y:10,hidden:false},{id:"P",x:38,y:12,hidden:false}
    ],
    edges:[
      {from:"A",to:"I"},{from:"I",to:"A"},{from:"A",to:"B"},{from:"B",to:"A"},
      {from:"B",to:"C"},{from:"C",to:"B"},{from:"C",to:"D"},{from:"D",to:"C"},
      {from:"D",to:"E"},{from:"E",to:"D"},{from:"E",to:"F"},{from:"F",to:"E"},
      {from:"F",to:"G"},{from:"G",to:"F"},{from:"G",to:"I"},{from:"I",to:"G"},
      {from:"I",to:"H"},{from:"H",to:"I"},{from:"H",to:"C"},{from:"C",to:"H"},
      {from:"H",to:"E"},{from:"E",to:"H"},{from:"E",to:"J"},{from:"J",to:"E"},
      {from:"D",to:"M"},{from:"M",to:"D"},{from:"M",to:"N"},{from:"N",to:"M"},
      {from:"N",to:"J"},{from:"J",to:"N"},{from:"M",to:"O"},{from:"O",to:"M"},
      {from:"O",to:"P"},{from:"P",to:"O"},{from:"P",to:"L"},{from:"L",to:"P"},
      {from:"L",to:"K"},{from:"K",to:"L"},{from:"K",to:"B"},{from:"B",to:"K"},
      {from:"M",to:"E"},{from:"E",to:"M"}
    ],
    activeCount:16, tieDemo:true
  };
}

/* Empate 700 m coherente con plan.js */
const OVERRIDE_DEMO = {
  "K->L":120,"L->K":120,"L->P":130,"P->L":130,"P->O":150,"O->P":150,"O->M":140,"M->O":140,"M->E":160,"E->M":160,
  "K->B":180,"B->K":180,"B->C":160,"C->B":160,"C->D":170,"D->C":170,"D->E":190,"E->D":190
};
const key=(a,b)=>`${a}->${b}`;
const w3 = (A,B)=>Math.max(100, Math.round(Math.hypot(A.x-B.x, A.y-B.y)*2.2 + 70));

function idsActive(g){ return g.nodes.filter(n=>!n.hidden).map(n=>n.id).sort(); }
function coord(g,id){ return g.nodes.find(n=>n.id===id); }
function w(g,a,b){
  if(g.tieDemo && OVERRIDE_DEMO[key(a,b)]!=null) return OVERRIDE_DEMO[key(a,b)];
  const A=coord(g,a), B=coord(g,b);
  return w3(A,B);
}
function undirectedEdges(g){
  const s=new Set(), out=[];
  for(const e of g.edges){
    const kk=[e.from,e.to].sort().join("-");
    if(s.has(kk)) continue; s.add(kk); out.push(e);
  }
  return out.filter(e=>{
    const A=coord(g,e.from), B=coord(g,e.to);
    return !A.hidden && !B.hidden;
  });
}

function buildAdj(g){
  const ids=idsActive(g), idx=Object.fromEntries(ids.map((v,i)=>[v,i]));
  const A=Array.from({length:ids.length},()=>Array(ids.length).fill(0));
  for(const e of undirectedEdges(g)){ const i=idx[e.from], j=idx[e.to]; A[i][j]=A[j][i]=1; }
  return {ids,A};
}
function buildW(g){
  const ids=idsActive(g), idx=Object.fromEntries(ids.map((v,i)=>[v,i]));
  const INF=Infinity, W=Array.from({length:ids.length},(_,i)=>Array.from({length:ids.length},(_,j)=> i===j?0:INF));
  for(const e of undirectedEdges(g)){ const i=idx[e.from], j=idx[e.to]; W[i][j]=W[j][i]=w(g,e.from,e.to); }
  return {ids,W};
}

function headerFor(ids){ return `<tr>${["",...ids].map(x=>`<th>${x}</th>`).join("")}</tr>`; }
function bodyMatrix(ids,M,cell){ return M.map((row,i)=>`<tr><th>${ids[i]}</th>${row.map(v=>`<td>${cell(v)}</td>`).join("")}</tr>`).join(""); }

function currentType(){ return document.querySelector('input[name="mtx"]:checked')?.value || "adj"; }
function render(){
  const g=readGraph(); const thead=$("#mtxTable thead"), tbody=$("#mtxTable tbody");
  if(currentType()==="adj"){ const {ids,A}=buildAdj(g); thead.innerHTML=headerFor(ids); tbody.innerHTML=bodyMatrix(ids,A,v=>v); }
  else{ const {ids,W}=buildW(g); thead.innerHTML=headerFor(ids); tbody.innerHTML=bodyMatrix(ids,W,v=>Number.isFinite(v)?v.toFixed(0):"∞"); }
}
document.addEventListener("DOMContentLoaded", ()=>{
  document.querySelectorAll('input[name="mtx"]').forEach(r=> r.addEventListener("change", render));
  $("#btnCSV").addEventListener("click", ()=>{
    const g=readGraph(); let ids,M,title;
    if(currentType()==="adj"){ ({ids,A:M}=buildAdj(g)); title="adjacency"; }
    else{ ({ids,W:M}=buildW(g)); title="weights"; }
    const rows=[["",...ids], ...M.map((row,i)=>[ids[i],...row.map(v=>Number.isFinite(v)?(+v.toFixed(0)):v)])];
    const csv=rows.map(r=>r.join(",")).join("\n");
    const blob=new Blob([csv],{type:"text/csv"}), url=URL.createObjectURL(blob);
    const a=document.createElement("a"); a.href=url; a.download=`matrix_${title}.csv`; a.click(); URL.revokeObjectURL(url);
  });
  render();
});
