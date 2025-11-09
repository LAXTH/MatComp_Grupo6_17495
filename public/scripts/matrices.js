[file name]: image.png
[file content begin]
# Algoritmo de Dijkstra (paso a paso)

**Algoritmo de Dijkstra: A – C**

| Vértice    | Paso 1   | Paso 2   | Paso 3   | Paso 4   | Paso 5   |
|---|---|---|---|---|---|
| A    | (0,A)    | (0,A)    | (0,A)    | (0,A)    | (0,A)    |
| B    | -    | (123,A)  | (123,A)  | (123,A)  | (123,A)  |
| C    | -    | -    | -    | (283,B)  | (283,B)  |
| D    | -    | -    | -    | -    | -    |
| E    | -    | -    | -    | -    | (602,H)  |
| F    | -    | -    | -    | -    | -    |
| G    | -    | -    | (295,I)  | (295,I)  | (295,I)  |
| H    | -    | -    | (242,I)  | (242,I)  | (242,I)  |
| I    | -    | (101,A)  | (101,A)  | (101,A)  | (101,A)  |
| J    | -    | -    | -    | -    | -    |
| K    | -    | -    | -    | (303,B)  | (303,B)  |
| L    | -    | -    | -    | -    | -    |
| M    | -    | -    | -    | -    | -    |
| N    | -    | -    | -    | -    | -    |
| O    | -    | -    | -    | -    | -    |
| P    | -    | -    | -    | -    | -    |


[file content end]

(() => {
  "use strict";
  
  const $ = s => document.querySelector(s);
  const S = sessionStorage;
  const key = (a, b) => `${a}->${b}`;
  
  const OVERRIDE_DEMO = {
    "A->B": 123, "B->A": 123, "B->C": 160, "C->B": 160, "B->K": 180, "K->B": 180,
    "A->I": 101, "I->A": 101, "I->G": 194, "G->I": 194, "I->H": 141, "H->I": 141,
    "K->L": 120, "L->K": 120, "L->P": 130, "P->L": 130, "P->O": 150, "O->P": 150, 
    "O->M": 140, "M->O": 140, "M->E": 160, "E->M": 160, "C->D": 170, "D->C": 170, 
    "D->E": 190, "E->D": 190, "H->E": 360, "E->H": 360
  };

  function load() {
    try {
      const steps = JSON.parse(S.getItem("matcomp_steps") || "null");
      const sum = JSON.parse(S.getItem("matcomp_summary") || "null");
      
      const msgEmpty = $("#msgEmpty");
      
      if (!steps || !steps.length || !sum || !sum.o || !sum.d) {
        if (msgEmpty) {
          msgEmpty.hidden = false;
        }
        document.querySelectorAll('.panel').forEach(panel => panel.style.display = 'none');
        return;
      }
      
      if (msgEmpty) msgEmpty.hidden = true;
      document.querySelectorAll('.panel').forEach(panel => panel.style.display = 'block');
      
    } catch (error) {
      console.error("Error en load():", error);
    }
  }

  function readGraph() {
    const raw = S.getItem("matcomp_graph");
    if (!raw) return { nodes: [], edges: [], activeCount: 16 };
    try { 
      return JSON.parse(raw); 
    } catch { 
      return { nodes: [], edges: [], activeCount: 16 }; 
    }
  }

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const w3 = (A, B) => clamp(Math.round(Math.hypot(A.x - B.x, A.y - B.y) * 2.2 + 70), 100, 999);
  const idsActive = g => g.nodes.filter(n => !n.inactive && !n.hidden).map(n => n.id).sort();
  const coord = (g, id) => g.nodes.find(n => n.id === id);

  function w(g, a, b) {
    if (OVERRIDE_DEMO[key(a, b)] != null) return OVERRIDE_DEMO[key(a, b)];
    const A = coord(g, a), B = coord(g, b); 
    return A && B ? w3(A, B) : Infinity;
  }

  function undirectedEdges(g) {
    const s = new Set(), out = [];
    for (const e of g.edges) {
      const kk = [e.from, e.to].sort().join("-");
      if (s.has(kk)) continue;
      s.add(kk);
      out.push(e);
    }
    return out.filter(e => {
      const A = coord(g, e.from), B = coord(g, e.to);
      return A && B && !A.inactive && !A.hidden && !B.inactive && !B.hidden;
    });
  }

  function buildAdj(g) {
    const ids = idsActive(g), idx = Object.fromEntries(ids.map((v, i) => [v, i]));
    const A = Array.from({ length: ids.length }, () => Array(ids.length).fill(0));
    
    for (const e of undirectedEdges(g)) {
      const i = idx[e.from], j = idx[e.to];
      if (i == null || j == null) continue;
      A[i][j] = A[j][i] = 1;
    }
    return { ids, A };
  }

  function buildW(g) {
    const ids = idsActive(g), idx = Object.fromEntries(ids.map((v, i) => [v, i]));
    const INF = Infinity;
    const W = Array.from({ length: ids.length }, (_, i) => 
      Array.from({ length: ids.length }, (_, j) => i === j ? 0 : INF)
    );
    
    for (const e of undirectedEdges(g)) {
      const i = idx[e.from], j = idx[e.to];
      if (i == null || j == null) continue;
      const ww = w(g, e.from, e.to);
      W[i][j] = W[j][i] = ww;
    }
    return { ids, W };
  }

  // Función para renderizar matriz de adyacencia
  function renderAdjMatrix() {
    const container = $("#mtxAdj");
    if (!container) return;
    
    const g = readGraph();
    const { ids, A } = buildAdj(g);
    
    let html = `
      <table>
        <caption>Matriz de Adyacencia (nodos activos)</caption>
        <thead>
          <tr>
            <th></th>
            ${ids.map(id => `<th>${id}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
    `;
    
    A.forEach((row, i) => {
      html += `
        <tr>
          <th>${ids[i]}</th>
          ${row.map(val => `<td>${val}</td>`).join('')}
        </tr>
      `;
    });
    
    html += `
        </tbody>
      </table>
    `;
    
    container.innerHTML = html;
  }

  // Función para renderizar matriz de pesos
  function renderWeightMatrix() {
    const container = $("#mtxW");
    if (!container) return;
    
    const g = readGraph();
    const { ids, W } = buildW(g);
    
    let html = `
      <table>
        <caption>Matriz de Pesos (distancias en metros)</caption>
        <thead>
          <tr>
            <th></th>
            ${ids.map(id => `<th>${id}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
    `;
    
    W.forEach((row, i) => {
      html += `
        <tr>
          <th>${ids[i]}</th>
          ${row.map(val => 
            `<td>${Number.isFinite(val) ? val.toFixed(0) : "∞"}</td>`
          ).join('')}
        </tr>
      `;
    });
    
    html += `
        </tbody>
      </table>
    `;
    
    container.innerHTML = html;
  }

  // Función para reconstruir el camino óptimo
  function getOptimalPath(steps, sum) {
    const finalStep = steps[steps.length - 1];
    const path = [sum.d];
    let current = sum.d;
    
    while (current !== sum.o && finalStep.prev[current] && finalStep.prev[current].length > 0) {
      current = finalStep.prev[current][0];
      path.unshift(current);
    }
    
    return path;
  }

  // Función para obtener los valores de Dijkstra como en el Excel
  function getDijkstraStepValues(steps, sum) {
    const allVertices = [...new Set(steps.flatMap(step => Object.keys(step.dist || {})))].sort();
    
    // Encontrar en qué paso se alcanzó el destino
    let stepsUntilDestination = steps.length;
    for (let i = 0; i < steps.length; i++) {
      if (steps[i].processed === sum.d) {
        stepsUntilDestination = i + 1;
        break;
      }
    }
    
    const maxSteps = stepsUntilDestination;
    const vertexValues = {};
    
    // Inicializar todos con "–"
    allVertices.forEach(vertex => {
      vertexValues[vertex] = Array(maxSteps).fill("–");
    });

    // Para cada paso
    for (let stepIndex = 0; stepIndex < maxSteps; stepIndex++) {
      const step = steps[stepIndex];
      
      // Para cada vértice en este paso
      for (const vertex of allVertices) {
        const currentDist = step.dist[vertex];
        
        if (Number.isFinite(currentDist)) {
          const predecessors = step.prev[vertex] || [];
          let predecessor = "";
          
          if (predecessors.length > 0) {
            // Encontrar el predecesor correcto
            predecessor = predecessors[0]; // Tomar el primer predecesor
          }
          
          const currentValue = `(${currentDist.toFixed(0)},${predecessor || vertex})`;
          vertexValues[vertex][stepIndex] = currentValue;
        }
      }
      
      // Origen siempre tiene valor
      if (Number.isFinite(step.dist[sum.o])) {
        vertexValues[sum.o][stepIndex] = `(0,${sum.o})`;
      }
    }

    // Mantener los valores en pasos posteriores (no poner "–" si ya tenía valor)
    for (const vertex of allVertices) {
      let lastValue = "–";
      for (let stepIndex = 0; stepIndex < maxSteps; stepIndex++) {
        if (vertexValues[vertex][stepIndex] !== "–") {
          lastValue = vertexValues[vertex][stepIndex];
        } else if (lastValue !== "–") {
          vertexValues[vertex][stepIndex] = lastValue;
        }
      }
    }
    
    return { allVertices, vertexValues, maxSteps };
  }

  // Función para determinar qué nodo pintar (solo el camino óptimo)
  function getNodeToHighlight(stepIndex, optimalPath) {
    // Solo pintar nodos del camino óptimo
    if (stepIndex < optimalPath.length) {
      return optimalPath[stepIndex];
    }
    return null;
  }

  // Función principal para renderizar tabla de Dijkstra
  function renderDijkstraTable() {
    const container = $("#mtxTable");
    if (!container) return;
    
    const steps = JSON.parse(S.getItem("matcomp_steps") || "[]");
    const sum = JSON.parse(S.getItem("matcomp_summary") || "{}");
    
    if (!steps.length) {
      container.innerHTML = '<p class="msg-empty">No hay datos de Dijkstra disponibles</p>';
      return;
    }

    const { allVertices, vertexValues, maxSteps } = getDijkstraStepValues(steps, sum);
    const optimalPath = getOptimalPath(steps, sum);

    // Construir la tabla
    let html = `
      <table>
      <caption>Algoritmo de Dijkstra: ${sum.o || '?'} → ${sum.d || '?'}</caption>
      <thead>
        <tr>
          <th>Vértice</th>
          ${Array.from({length: maxSteps}, (_, i) => `<th>Paso ${i + 1}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
    `;

    allVertices.forEach(vertex => {
      html += `<tr><th>${vertex}</th>`;
      
      for (let stepIndex = 0; stepIndex < maxSteps; stepIndex++) {
        const currentValue = vertexValues[vertex][stepIndex];
        const nodeToHighlight = getNodeToHighlight(stepIndex, optimalPath);
        const isHighlighted = nodeToHighlight === vertex;
        const style = isHighlighted ? 'style="background-color: #ffeb3b;"' : '';
        
        html += `<td ${style}>${currentValue}</td>`;
      }
      
      html += `</tr>`;
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
  }

  // Solo un event listener para DOMContentLoaded
  document.addEventListener("DOMContentLoaded", () => {
    try {
      load();
      renderAdjMatrix();
      renderWeightMatrix();
      renderDijkstraTable();
    } catch (error) {
      console.error("Error en DOMContentLoaded:", error);
    }
  });
})();
