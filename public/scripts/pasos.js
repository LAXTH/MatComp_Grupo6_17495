/* Lee de localStorage los pasos guardados en Planificar y los muestra */
const $=s=>document.querySelector(s);
const fmt=n=>Number.isFinite(n)? n.toFixed(0) : "∞";

function load(){
  const steps = JSON.parse(localStorage.getItem("matcomp_steps")||"[]");
  const summary = JSON.parse(localStorage.getItem("matcomp_summary")||"null");

  if(!steps.length || !summary){
    $("#summary").textContent = "No hay datos. Calcula una ruta en la página Planificar.";
    return;
  }

  $("#summary").textContent = `Última ruta: ${summary.o} → ${summary.d} (distancia ${Number(summary.dist).toFixed(0)} u)`;

  const tb=$("#stepsTable tbody"); tb.innerHTML="";
  for(const s of steps){
    const dStr=Object.entries(s.dist).map(([k,v])=>`${k}:${fmt(v)}`).join("  ");
    const pStr=Object.entries(s.prev).map(([k,a])=>a.length?`${k}←${a.join("|")}`:`${k}←–`).join("  ");
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${s.i}</td><td>${s.processed}</td><td>${s.visited.join(", ")}</td>
      <td style="font-family:ui-monospace,Consolas">${dStr}</td>
      <td style="font-family:ui-monospace,Consolas">${pStr}</td>`;
    tb.appendChild(tr);
  }
}
document.addEventListener("DOMContentLoaded", load);
