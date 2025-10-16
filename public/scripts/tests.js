// /public/scripts/tests.js
// Mini test runner sin dependencias externas. Ejecutar en consola con: DijkstraValidationTests()

import {
  addNode,
  allShortestPaths,
  createGraph,
  dijkstra,
  edgeKey,
  normalizeNodeId,
  upsertEdge,
  validateEdge,
  validateNodeCount,
} from './script.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function test(title, fn) {
  try {
    fn();
    return { title, ok: true };
  } catch (error) {
    return { title, ok: false, error };
  }
}

function runValidationTests() {
  const cases = [];
  cases.push(test('validateNodeCount rechaza valores fuera de rango', () => {
    assert(!validateNodeCount(7).ok, 'Debe invalidar 7');
    assert(validateNodeCount(8).ok, 'Debe aceptar 8');
    assert(validateNodeCount(16).ok, 'Debe aceptar 16');
    assert(!validateNodeCount(17).ok, 'Debe invalidar 17');
  }));

  cases.push(test('normalizeNodeId convierte a mayúsculas y recorta', () => {
    assert(normalizeNodeId(' a ') === 'A', 'Debe normalizar a "A"');
  }));

  cases.push(test('validateEdge detecta nodos ausentes y bucles', () => {
    const graph = createGraph();
    addNode(graph, { id: 'A', x: 0, y: 0 });
    const result = validateEdge({ from: 'A', to: 'A', weight: 1 }, graph);
    assert(!result.ok, 'Debe rechazar bucles');
    const missing = validateEdge({ from: 'A', to: 'B', weight: 1 }, graph);
    assert(!missing.ok && missing.errors.some((msg) => msg.includes('"B"')), 'Debe avisar nodo faltante');
  }));

  cases.push(test('validateEdge detecta duplicados', () => {
    const graph = createGraph();
    addNode(graph, { id: 'A', x: 0, y: 0 });
    addNode(graph, { id: 'B', x: 0, y: 0 });
    upsertEdge(graph, { from: 'A', to: 'B', weight: 1, id: edgeKey('A', 'B') });
    const duplicated = validateEdge({ from: 'A', to: 'B', weight: 1 }, graph);
    assert(!duplicated.ok, 'Debe rechazar duplicados');
  }));

  cases.push(test('allShortestPaths devuelve múltiples caminos mínimos', () => {
    const graph = createGraph();
    ['A', 'B', 'C', 'D'].forEach((id, index) => {
      addNode(graph, { id, x: index * 10, y: 0 });
    });
    upsertEdge(graph, { from: 'A', to: 'B', weight: 1, id: edgeKey('A', 'B') });
    upsertEdge(graph, { from: 'B', to: 'D', weight: 2, id: edgeKey('B', 'D') });
    upsertEdge(graph, { from: 'A', to: 'C', weight: 1, id: edgeKey('A', 'C') });
    upsertEdge(graph, { from: 'C', to: 'D', weight: 2, id: edgeKey('C', 'D') });

    const { prev } = dijkstra(graph, 'A', 'D');
    const paths = allShortestPaths(prev, 'A', 'D');
    const formatted = paths.map((p) => p.join('')); // ['ABD', 'ACD']
    assert(formatted.includes('ABD') && formatted.includes('ACD'), 'Debe listar ambos caminos');
  }));

  const summary = cases.map((c) => (c.ok ? `✅ ${c.title}` : `❌ ${c.title} → ${c.error.message}`));
  console.group('Dijkstra validation tests');
  summary.forEach((line) => console.log(line));
  console.log(`Total: ${cases.filter((c) => c.ok).length}/${cases.length} ok.`);
  console.groupEnd();
  return cases;
}

if (typeof window !== 'undefined') {
  window.DijkstraValidationTests = runValidationTests;
}

export { runValidationTests };
