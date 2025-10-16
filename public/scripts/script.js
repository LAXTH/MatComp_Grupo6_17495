/**
 * Utilidades puras para la UI de Dijkstra.
 * TODO: sustituir este módulo por Graph/dijkstra/Animator/allPaths reales al conectar la lógica definitiva.
 * @module graphToolkit
 */

const EDGE_KEY_SEPARATOR = '->';
export const MAX_PATH_COMBINATIONS = 50;

/**
 * Crea un grafo vacío.
 * TODO(Graph): reemplazar por una implementación robusta con IDs persistentes.
 * @returns {{nodes: Map<string, GraphNode>, edges: Map<string, GraphEdge>}}
 */
export function createGraph() {
  return { nodes: new Map(), edges: new Map() };
}

/**
 * @typedef {{id:string,x:number,y:number}} GraphNode
 * @typedef {{id:string,from:string,to:string,weight:number}} GraphEdge
 */

/**
 * Normaliza un ID de nodo.
 * @param {string} raw
 * @returns {string}
 */
export function normalizeNodeId(raw) {
  return (raw ?? '').trim().toUpperCase();
}

/**
 * Valida el número de nodos permitido.
 * @param {number} value
 * @returns {{ok:boolean,message?:string}}
 */
export function validateNodeCount(value) {
  if (!Number.isFinite(value)) {
    return { ok: false, message: 'Introduce un número válido.' };
  }
  if (value < 8 || value > 16) {
    return { ok: false, message: 'El número de nodos debe estar entre 8 y 16.' };
  }
  return { ok: true };
}

/**
 * Genera la clave única de una arista dirigida.
 * @param {string} from
 * @param {string} to
 * @returns {string}
 */
export function edgeKey(from, to) {
  return `${from}${EDGE_KEY_SEPARATOR}${to}`;
}

/**
 * Valida una arista antes de insertarla.
 * @param {{from:string,to:string,weight:number}} edge
 * @param {{nodes:Map<string,GraphNode>, edges:Map<string,GraphEdge>}} graph
 * @param {{allowExisting?:boolean}} [options]
 * @returns {{ok:boolean, errors:string[]}}
 */
export function validateEdge(edge, graph, options = {}) {
  const errors = [];
  const from = normalizeNodeId(edge.from);
  const to = normalizeNodeId(edge.to);
  const weight = Number(edge.weight);

  if (!from) errors.push('El nodo origen es obligatorio.');
  if (!to) errors.push('El nodo destino es obligatorio.');
  if (from && to && from === to) errors.push('No se permiten bucles (origen igual a destino).');
  if (!Number.isFinite(weight)) {
    errors.push('El peso debe ser un número.');
  } else if (weight < 0) {
    errors.push('El peso no puede ser negativo.');
  }
  if (from && !graph.nodes.has(from)) errors.push(`El nodo "${from}" no existe.`);
  if (to && !graph.nodes.has(to)) errors.push(`El nodo "${to}" no existe.`);

  if (!options.allowExisting && from && to) {
    const key = edgeKey(from, to);
    if (graph.edges.has(key)) errors.push('La arista ya existe.');
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Inserta un nodo si no existe.
 * @param {{nodes:Map<string,GraphNode>, edges:Map<string,GraphEdge>}} graph
 * @param {GraphNode} node
 */
export function addNode(graph, node) {
  if (!graph.nodes.has(node.id)) {
    graph.nodes.set(node.id, node);
  }
}

/**
 * Inserta o reemplaza una arista.
 * @param {{nodes:Map<string,GraphNode>, edges:Map<string,GraphEdge>}} graph
 * @param {GraphEdge} edge
 */
export function upsertEdge(graph, edge) {
  const key = edgeKey(edge.from, edge.to);
  graph.edges.set(key, { ...edge, id: key });
}

/**
 * Elimina una arista del grafo.
 * @param {{nodes:Map<string,GraphNode>, edges:Map<string,GraphEdge>}} graph
 * @param {string} from
 * @param {string} to
 */
export function deleteEdge(graph, from, to) {
  graph.edges.delete(edgeKey(from, to));
}

/**
 * Obtiene las aristas salientes de un nodo.
 * @param {{nodes:Map<string,GraphNode>, edges:Map<string,GraphEdge>}} graph
 * @param {string} from
 * @returns {GraphEdge[]}
 */
export function outgoingEdges(graph, from) {
  const out = [];
  for (const edge of graph.edges.values()) {
    if (edge.from === from) out.push(edge);
  }
  return out;
}

/**
 * Ejecuta Dijkstra y devuelve un rastro detallado.
 * TODO(dijkstra): sustituir por la implementación final (cola de prioridad eficiente).
 * @param {{nodes:Map<string,GraphNode>, edges:Map<string,GraphEdge>}} graph
 * @param {string} source
 * @param {string} target
 * @returns {{steps:TraceStep[], dist:Map<string,number>, prev:Map<string,Set<string>>}}
 */
export function dijkstra(graph, source, target) {
  /** @type {TraceStep[]} */
  const steps = [];
  const nodes = Array.from(graph.nodes.keys());
  const dist = new Map(nodes.map((id) => [id, Infinity]));
  const prev = new Map(nodes.map((id) => [id, new Set()]));
  const visited = new Set();
  /** @type {[number,string][] */
  const pq = [];

  const pushPQ = (d, u) => {
    pq.push([d, u]);
    pq.sort((a, b) => a[0] - b[0]);
  };
  const snapshotPQ = () => pq.slice().map(([d, u]) => `${u}(${d})`);

  dist.set(source, 0);
  pushPQ(0, source);
  steps.push({ type: 'init', queue: snapshotPQ(), extracted: null, dist: new Map(dist), prev: clonePrev(prev) });

  while (pq.length) {
    const [du, u] = pq.shift();
    if (visited.has(u)) continue;
    visited.add(u);
    steps.push({ type: 'extract', queue: snapshotPQ(), extracted: u, dist: new Map(dist), prev: clonePrev(prev) });
    if (u === target) break;

    for (const edge of outgoingEdges(graph, u)) {
      const alt = du + edge.weight;
      const current = dist.get(edge.to);
      /** @type {'relax-none' | 'relax-better' | 'relax-tie'} */
      let type = 'relax-none';
      if (alt < current) {
        dist.set(edge.to, alt);
        const set = prev.get(edge.to);
        if (set) {
          set.clear();
          set.add(u);
        }
        pushPQ(alt, edge.to);
        type = 'relax-better';
      } else if (alt === current) {
        const set = prev.get(edge.to);
        if (set) set.add(u);
        type = 'relax-tie';
      }
      steps.push({ type, edge, queue: snapshotPQ(), extracted: u, dist: new Map(dist), prev: clonePrev(prev) });
    }
  }

  return { steps, dist, prev };
}

/**
 * Enumeración de caminos mínimos a partir de la tabla de predecesores.
 * TODO(allPaths): optimizar para grandes grafos y cortar por heurísticas.
 * @param {Map<string,Set<string>>} prev
 * @param {string} source
 * @param {string} target
 * @param {number} [limit]
 * @returns {string[][]}
 */
export function allShortestPaths(prev, source, target, limit = MAX_PATH_COMBINATIONS) {
  const results = [];
  const seen = new Set();

  function dfs(node, suffix) {
    if (results.length >= limit) return;
    if (node === source) {
      const path = [source, ...suffix];
      const key = path.join('>');
      if (!seen.has(key)) {
        seen.add(key);
        results.push(path);
      }
      return;
    }
    const parents = prev.get(node);
    if (!parents || parents.size === 0) return;
    for (const parent of parents) {
      dfs(parent, [node, ...suffix]);
      if (results.length >= limit) return;
    }
  }

  dfs(target, []);
  return results;
}

/**
 * Pequeño ayudante para copiar los Sets de predecesores en los pasos.
 * @param {Map<string,Set<string>>} prev
 */
function clonePrev(prev) {
  return new Map(Array.from(prev.entries(), ([k, v]) => [k, new Set(v)]));
}

/**
 * Controla la animación de los pasos.
 * TODO(Animator): extraer en clase independiente con soporte de pausa/resume externo.
 */
export class Animator {
  /**
   * @param {TraceStep[]} trace
   * @param {(step:TraceStep,index:number)=>void} onStep
   */
  constructor(trace, onStep) {
    this.trace = trace;
    this.onStep = onStep;
    this.index = 0;
    this.speed = 1;
    this.playing = false;
    this._raf = null;
    this._last = 0;
  }

  current() {
    return this.trace[this.index];
  }

  get length() {
    return this.trace.length;
  }

  get position() {
    return this.index;
  }

  setSpeed(speed) {
    this.speed = speed > 0 ? speed : 1;
  }

  seek(index) {
    const clamped = Math.max(0, Math.min(index, this.trace.length - 1));
    this.index = clamped;
    if (this.onStep) this.onStep(this.current(), this.index);
  }

  play() {
    if (this.playing || this.trace.length === 0) return;
    this.playing = true;
    this._last = performance.now();
    this._tick(this._last);
  }

  pause() {
    this.playing = false;
    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
    }
  }

  destroy() {
    this.pause();
    this.onStep = null;
  }

  _tick(ts) {
    if (!this.playing) return;
    const interval = 700 / this.speed;
    if (ts - this._last >= interval) {
      this._last = ts;
      if (this.index < this.trace.length - 1) {
        this.index += 1;
        if (this.onStep) this.onStep(this.current(), this.index);
      } else {
        this.pause();
        return;
      }
    }
    this._raf = requestAnimationFrame((nextTs) => this._tick(nextTs));
  }
}

/**
 * @typedef {Object} TraceStep
 * @property {'init'|'extract'|'relax-better'|'relax-tie'|'relax-none'} type
 * @property {GraphEdge} [edge]
 * @property {string|null} [extracted]
 * @property {string[]} [queue]
 * @property {Map<string,number>} [dist]
 * @property {Map<string,Set<string>>} [prev]
 */
