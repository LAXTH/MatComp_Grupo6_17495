(()=>{"use strict";
const $=s=>document.querySelector(s);
const S=sessionStorage;
const fmt=n=>Number.isFinite(n)?n.toFixed(0):"∞";

function load(){
  const steps=JSON.parse(S.getItem("matcomp_steps")||"null");
  const sum=JSON.parse(S.getItem("matcomp_summary")||"null");
  if(!steps || !steps.length || !sum || !sum.o || !sum.d){
    $("#summary").innerHTML="No hay datos. Ve a <a href='index.html'>Planificar</a>, calcula una ruta y regresa.";
    return;
  }
  $("#summary").textContent=`Ruta ${sum.o} → ${sum.d} | Distancia: ${fmt(sum.dist)} m`;

  const ids=Object.keys(steps[steps.length-1].dist);
  const tbody=$("#tbl tbody"); tbody.innerHTML="";
  for(const s of steps){
    const distRow=ids.map(k=>`${k}:${fmt(s.dist[k])}`).join(" · ");
    const prevRow=ids.map(k=>`${k}←${(s.prev[k]||[]).join("/")||"–"}`).join(" · ");
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${s.i}</td><td>${s.processed}</td><td>${s.visited.join(", ")}</td><td>${distRow}</td><td>${prevRow}</td>`;
    tbody.appendChild(tr);
  }
}
document.addEventListener("DOMContentLoaded",load);
})();
