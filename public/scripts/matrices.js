(()=>{"use strict";
const $=s=>document.querySelector(s);
const S=sessionStorage;
const key=(a,b)=>`${a}->${b}`;
const OVERRIDE_DEMO={
  "K->L":120,"L->K":120,"L->P":130,"P->L":130,"P->O":150,"O->P":150,"O->M":140,"M->O":140,"M->E":160,"E->M":160,
  "K->B":180,"B->K":180,"B->C":160,"C->B":160,"C->D":170,"D->C":170,"D->E":190,"E->D":190
};

function readGraph(){
  const raw=S.getItem("matcomp_graph");
  if(!raw) return {nodes:[],edges:[],activeCount:16};
  try{ return JSON.parse(raw); }catch{ return {nodes:[],edges:[],activeCount:16}; }
}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const w3=(A,B)=>clamp(Math.round(Math.hypot(A.x-B.x,A.y-B.y)*2.2+70),100,999);
const idsActive=g=> g.nodes.filter(n=>!n.inactive).map(n=>n.id).sort();
const coord=(g,id)=> g.nodes.find(n=>n.id===id);

function w(g,a,b){
  if(OVERRIDE_DEMO[key(a,b)]!=null) return OVERRIDE_DEMO[key(a,b)];
  const A=coord(g,a),B=coord(g,b); return w3(A,B);
}
function undirectedEdges(g){
  const s=new Set(), out=[];
  for(const e of g.edges){
    const kk=[e.from,e.to].sort().join("-");
    if(s.has(kk)) continue;
    s.add(kk);
    out.push(e);
  }
  return out.filter(e=>{
    const A=coord(g,e.from), B=coord(g.to);
    return A && B && !A.inactive && !B.inactive;
  });
}

function buildAdj(g){
  const ids=idsActive(g), idx=Object.fromEntries(ids.map((v,i)=>[v,i]));
  const A=Array.from({length:ids.length},()=>Array(ids.length).fill(0));
  for(const e of undirectedEdges(g)){
    const i=idx[e.from], j=idx[e.to];
    if(i==null || j==null) continue;
    A[i][j]=A[j][i]=1;
  }
  return {ids,A};
}
function buildW(g){
  const ids=idsActive(g), idx=Object.fromEntries(ids.map((v,i)=>[v,i]));
  const INF=Infinity, W=Array.from({length:ids.length},(_,i)=>Array.from({length:ids.length},(_,j)=> i===j?0:INF));
  for(const e of undirectedEdges(g)){
    const i=idx[e.from], j=idx[e.to];
    if(i==null || j==null) continue;
    const ww=w(g,e.from,e.to);
    W[i][j]=W[j][i]=ww;
  }
  return {ids,W};
}

const headerFor=ids=> `<tr>${["",...ids].map(x=>`<th>${x}</th>`).join("")}</tr>`;
const bodyMatrix=(ids,M,cell)=> M.map((row,i)=>`<tr><th>${ids[i]}</th>${row.map(v=>`<td>${cell(v)}</td>`).join("")}</tr>`).join("");

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
})();
