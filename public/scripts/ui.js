// /public/scripts/ui.js

import {
  Animator,
  MAX_PATH_COMBINATIONS,
  addNode,
  allShortestPaths,
  createGraph,
  dijkstra,
  deleteEdge,
  edgeKey,
  normalizeNodeId,
  upsertEdge,
  validateEdge,
  validateNodeCount,
} from './script.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const state = {
  addNodeMode: false,
  zoom: 1,
  pan: { x: 0, y: 0 },
  graph: createGraph(),
  animator: null,
  highlightPath: null,
  selectedPath: null,
  raf: null,
  lastResult: null,
  logEntries: [],
  logRendered: -1,
  currentStep: 1,
};

function samePath(a, b) {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  return a.every((node, index) => node === b[index]);
}

const toastArea = $('#toastArea');
const sidebar = $('.sidebar');
const btnToggleSidebar = $('#btnToggleSidebar');
const btnAddNode = $('#btnAddNode');
const edgeError = $('#edgeError');
const edgeFromInput = $('#edgeFrom');
const edgeToInput = $('#edgeTo');
const edgeWeightInput = $('#edgeWeight');
const edgesTableBody = $('#edgesTable tbody');
const selSource = $('#selSource');
const selTarget = $('#selTarget');
const nodesList = $('#nodesList');
const logStream = $('#logStream');
const pathCost = $('#pathCost');
const pathsList = $('#pathsList');
const liveQueue = $('#liveQueue');
const liveExtracted = $('#liveExtracted');
const liveIteration = $('#liveIteration');
const progress = $('#progress');
const rangeSpeed = $('#rangeSpeed');
const btnRun = $('#btnRun');
const btnPrev = $('#btnPrev');
const btnNext = $('#btnNext');
const btnPlay = $('#btnPlay');
const btnPause = $('#btnPause');
const btnReplay = $('#btnReplay');
const canvas = $('#graphCanvas');
const wrap = $('#canvasWrap');
const ctx = canvas.getContext('2d');
const inpN = $('#inpN');
const nError = $('#nError');

function toast(message, type = 'info', timeout = 2500) {
  const el = document.createElement('div');
  el.className = `toast${type === 'success' ? ' toast--success' : ''}${type === 'error' ? ' toast--error' : ''}`;
  el.textContent = message;
  toastArea.appendChild(el);
  while (toastArea.children.length > 4) {
    toastArea.firstElementChild?.remove();
  }
  const duration = type === 'error' ? Math.max(timeout, 3800) : timeout;
  setTimeout(() => el.remove(), duration);
}

function setActiveStep(step) {
  state.currentStep = Number(step);
  $$('.step').forEach((item) => {
    const isActive = Number(item.dataset.step) === state.currentStep;
    item.classList.toggle('is-active', isActive);
    const button = item.querySelector('.step-btn');
    if (button) {
      button.setAttribute('aria-current', isActive ? 'step' : 'false');
    }
  });
  $$('[data-step-panel]').forEach((panel) => {
    panel.hidden = Number(panel.dataset.stepPanel) !== state.currentStep;
  });
}

function scheduleRender() {
  if (state.raf) return;
  state.raf = requestAnimationFrame(() => {
    state.raf = null;
    renderGraph();
  });
}

function renderGraph() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.translate(state.pan.x, state.pan.y);
  ctx.scale(state.zoom, state.zoom);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const edge of state.graph.edges.values()) {
    const fromNode = state.graph.nodes.get(edge.from);
    const toNode = state.graph.nodes.get(edge.to);
    if (!fromNode || !toNode) continue;

    ctx.strokeStyle = '#93c5fd';
    ctx.lineWidth = 2 / state.zoom;
    ctx.fillStyle = '#e5e7eb';

    ctx.beginPath();
    ctx.moveTo(fromNode.x, fromNode.y);
    ctx.lineTo(toNode.x, toNode.y);
    ctx.stroke();

    const midX = (fromNode.x + toNode.x) / 2;
    const midY = (fromNode.y + toNode.y) / 2;
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(midX - 12, midY - 20, 24, 14);
    ctx.strokeStyle = '#334155';
    ctx.strokeRect(midX - 12, midY - 20, 24, 14);
    ctx.fillStyle = '#e5e7eb';
    ctx.font = `${12 / state.zoom}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(edge.weight), midX, midY - 13);

    drawArrow(fromNode, toNode);
  }

  if (state.highlightPath && state.highlightPath.length > 1) {
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 3 / state.zoom;
    for (let i = 0; i < state.highlightPath.length - 1; i += 1) {
      const a = state.graph.nodes.get(state.highlightPath[i]);
      const b = state.graph.nodes.get(state.highlightPath[i + 1]);
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  for (const node of state.graph.nodes.values()) {
    drawNode(node.id, node.x, node.y);
  }
}

function drawArrow(from, to) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const len = 10 / state.zoom;
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(
    to.x - len * Math.cos(angle - Math.PI / 6),
    to.y - len * Math.sin(angle - Math.PI / 6),
  );
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(
    to.x - len * Math.cos(angle + Math.PI / 6),
    to.y - len * Math.sin(angle + Math.PI / 6),
  );
  ctx.stroke();
}

function drawNode(id, x, y) {
  ctx.beginPath();
  ctx.fillStyle = '#0b1220aa';
  ctx.strokeStyle = '#64748b';
  ctx.arc(x, y, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e5e7eb';
  ctx.font = `${14 / state.zoom}px system-ui`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(id, x, y);
}

function setAddNodeMode(enabled) {
  state.addNodeMode = enabled;
  btnAddNode.classList.toggle('is-active', enabled);
  btnAddNode.setAttribute('aria-pressed', String(enabled));
}

function resetEdgeFormError() {
  edgeError.hidden = true;
  edgeError.textContent = '';
}

function showEdgeErrors(messages) {
  edgeError.hidden = false;
  edgeError.textContent = messages.join(' ');
}

function nextNodeId() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (const letter of letters) {
    if (!state.graph.nodes.has(letter)) return letter;
  }
  let idx = 1;
  while (true) {
    const id = `N${idx}`;
    if (!state.graph.nodes.has(id)) return id;
    idx += 1;
  }
}

function screenToWorld(point) {
  return {
    x: (point.x - state.pan.x) / state.zoom,
    y: (point.y - state.pan.y) / state.zoom,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function requestGraphReset() {
  if (state.animator) {
    state.animator.destroy();
  }
  state.animator = null;
  state.lastResult = null;
  state.selectedPath = null;
  state.highlightPath = null;
  state.logEntries = [];
  state.logRendered = -1;
  logStream.innerHTML = '';
  resetPlayerControls();
  renderResults(null);
  updateDistances();
  liveQueue.textContent = '[]';
  liveExtracted.textContent = '—';
  liveIteration.textContent = '0';
  scheduleRender();
}

function resetPlayerControls() {
  btnPlay.disabled = true;
  btnPrev.disabled = true;
  btnNext.disabled = true;
  btnReplay.disabled = true;
  btnPause.hidden = true;
  btnPlay.hidden = false;
  progress.value = '0';
  progress.max = '0';
}

function fillNodeSelects() {
  const options = Array.from(state.graph.nodes.keys()).sort();
  const render = (value) => options.map((id) => `<option value="${id}">${id}</option>`).join('');
  const previousSource = selSource.value;
  const previousTarget = selTarget.value;
  selSource.innerHTML = '<option value="">—</option>' + render();
  selTarget.innerHTML = '<option value="">—</option>' + render();
  selSource.value = options.includes(previousSource) ? previousSource : '';
  selTarget.value = options.includes(previousTarget) ? previousTarget : '';
  nodesList.innerHTML = options.map((id) => `<option value="${id}">`).join('');
}

function refreshEdgesTable() {
  edgesTableBody.innerHTML = '';
  for (const edge of state.graph.edges.values()) {
    const tr = document.createElement('tr');
    tr.dataset.key = edge.id || edgeKey(edge.from, edge.to);
    tr.innerHTML = `
      <td>${edge.from}</td>
      <td>${edge.to}</td>
      <td>${edge.weight}</td>
      <td>
        <button type="button" class="btn ghost" data-action="edit">Editar</button>
        <button type="button" class="btn danger" data-action="delete">Borrar</button>
      </td>`;
    edgesTableBody.appendChild(tr);
  }
}

function describeStep(step) {
  if (!step) return '';
  if (step.type === 'init') return 'Inicio: cola inicializada.';
  if (step.type === 'extract') return `Extraigo ${step.extracted}.`;
  if (step.type === 'relax-better') {
    return `Mejora ${step.edge.from}→${step.edge.to} (peso ${step.edge.weight}).`;
  }
  if (step.type === 'relax-tie') {
    return `Empate ${step.edge.from}→${step.edge.to}.`;
  }
  return 'Sin mejora.';
}

function updateLog(index) {
  if (!state.logEntries.length) return;
  if (index > state.logRendered) {
    for (let i = state.logRendered + 1; i <= index; i += 1) {
      const li = document.createElement('li');
      li.textContent = state.logEntries[i];
      logStream.appendChild(li);
    }
    state.logRendered = index;
  }
  $$('#logStream li').forEach((li, idx) => {
    li.classList.toggle('is-active', idx === index);
  });
  const active = logStream.children[index];
  active?.scrollIntoView({ block: 'end' });
}

function updateDistances(step = null) {
  const tbody = $('#distTable tbody');
  tbody.innerHTML = '';
  const dist = step?.dist ?? new Map();
  const prev = step?.prev ?? new Map();
  const queue = new Set((step?.queue ?? []).map((item) => item.split('(')[0]));
  const nodes = Array.from(state.graph.nodes.keys()).sort();
  nodes.forEach((nodeId) => {
    const d = dist.get(nodeId);
    const hasValue = dist.has(nodeId);
    const prevSet = prev.get(nodeId) ?? new Set();
    const badge = step?.extracted === nodeId
      ? '<span class="badge badge--visited">visitado</span>'
      : (queue.has(nodeId) ? '<span class="badge badge--queue">en cola</span>' : '<span class="badge badge--relax-worse">—</span>');
    const tr = document.createElement('tr');
    const prevText = prevSet.size ? Array.from(prevSet).join(', ') : '—';
    const distText = Number.isFinite(d)
      ? d
      : (hasValue ? '∞' : '—');
    tr.innerHTML = `<td>${nodeId}</td><td>${distText}</td><td>${prevText}</td><td>${badge}</td>`;
    tbody.appendChild(tr);
  });
}

function renderResults(result) {
  if (!result) {
    pathCost.textContent = '—';
    pathsList.innerHTML = '';
    state.selectedPath = null;
    state.highlightPath = null;
    return;
  }
  const { cost, paths } = result;
  const validPaths = Number.isFinite(cost) ? paths : [];
  const hasPaths = validPaths.length > 0;
  pathCost.textContent = hasPaths ? String(cost) : '—';
  pathsList.innerHTML = '';
  if (!hasPaths) {
    const li = document.createElement('li');
    li.textContent = 'No existe camino.';
    pathsList.appendChild(li);
    state.selectedPath = null;
    state.highlightPath = null;
    scheduleRender();
    return;
  }

  const activeIndexCandidate = state.selectedPath
    ? validPaths.findIndex((candidate) => samePath(candidate, state.selectedPath))
    : 0;
  const activeIndex = activeIndexCandidate >= 0 ? activeIndexCandidate : 0;

  validPaths.slice(0, MAX_PATH_COMBINATIONS).forEach((path, index) => {
    const li = document.createElement('li');
    const checked = index === activeIndex;
    li.innerHTML = `
      <label>
        <input type="radio" name="path" value="${index}" ${checked ? 'checked' : ''} />
        ${path.join('–')} <span class="badge">costo ${cost}</span>
      </label>`;
    if (checked) li.classList.add('is-active');
    pathsList.appendChild(li);
  });

  if (validPaths.length >= MAX_PATH_COMBINATIONS) {
    const warning = document.createElement('li');
    warning.innerHTML = `<span class="hint">Mostrando hasta ${MAX_PATH_COMBINATIONS} caminos.</span>`;
    pathsList.appendChild(warning);
  }

  state.selectedPath = validPaths[activeIndex];
  const atLastStep = state.animator && state.animator.position === state.animator.length - 1;
  state.highlightPath = atLastStep ? state.selectedPath : null;
  scheduleRender();
}

function updateSelectedPath(index) {
  if (!state.lastResult || !state.lastResult.paths) return;
  const idx = Number(index);
  const path = state.lastResult.paths[idx];
  if (!path) return;
  state.selectedPath = path;
  const atLastStep = !state.animator || state.animator.position === state.animator.length - 1;
  state.highlightPath = atLastStep ? path : state.highlightPath;
  $$('#pathsList li').forEach((li) => li.classList.remove('is-active'));
  const targetLi = pathsList.querySelector(`input[value="${idx}"]`)?.closest('li');
  targetLi?.classList.add('is-active');
  scheduleRender();
  toast('Camino resaltado.', 'success', 2000);
}

function configureAnimator(result) {
  if (state.animator) {
    state.animator.destroy();
  }
  state.animator = new Animator(result.steps, (step, index) => {
    updateLog(index);
    updateDistances(step);
    liveIteration.textContent = String(index);
    liveExtracted.textContent = step?.extracted ?? '—';
    liveQueue.textContent = `[${(step?.queue ?? []).join(', ')}]`;
    const lastIndex = state.animator.length - 1;
    progress.value = String(index);
    btnPrev.disabled = index <= 0;
    btnNext.disabled = index >= lastIndex;
    state.highlightPath = index === lastIndex ? state.selectedPath : null;
    scheduleRender();
  });
  state.animator.setSpeed(Number(rangeSpeed.value));
  state.animator.pause();
  btnPlay.disabled = result.steps.length <= 1;
  btnPrev.disabled = true;
  btnNext.disabled = result.steps.length <= 1;
  btnReplay.disabled = result.steps.length === 0;
  btnPause.hidden = true;
  btnPlay.hidden = false;
  progress.max = String(Math.max(0, result.steps.length - 1));
  progress.value = '0';
  state.animator.seek(0);
}

function validateNodeInput() {
  const value = Number(inpN.value);
  const validation = validateNodeCount(value);
  if (!validation.ok) {
    inpN.classList.add('is-invalid');
    nError.hidden = false;
    nError.textContent = validation.message;
    return false;
  }
  inpN.classList.remove('is-invalid');
  nError.hidden = true;
  return true;
}

function generateRandomGraph(n) {
  state.graph = createGraph();
  const radius = 260;
  const cx = 520;
  const cy = 380;
  for (let i = 0; i < n; i += 1) {
    const id = String.fromCharCode(65 + i);
    const angle = (i / n) * Math.PI * 2;
    addNode(state.graph, {
      id,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  }

  const ids = Array.from(state.graph.nodes.keys());
  for (const id of ids) {
    const targets = ids.filter((node) => node !== id);
    targets.sort(() => Math.random() - 0.5);
    const desired = Math.min(3, 2 + Math.floor(Math.random() * 2));
    for (let i = 0; i < desired && i < targets.length; i += 1) {
      const to = targets[i];
      const weight = 1 + Math.floor(Math.random() * 9);
      upsertEdge(state.graph, { from: id, to, weight, id: edgeKey(id, to) });
    }
  }

  requestGraphReset();
  fillNodeSelects();
  refreshEdgesTable();
  scheduleRender();
}

function applySampleGraph() {
  state.graph = createGraph();
  const positions = {
    A: { x: 320, y: 320 },
    B: { x: 520, y: 220 },
    C: { x: 720, y: 320 },
    D: { x: 620, y: 520 },
    E: { x: 420, y: 520 },
  };
  Object.entries(positions).forEach(([id, point]) => {
    addNode(state.graph, { id, ...point });
  });
  const edges = [
    ['A', 'B', 3],
    ['A', 'C', 2],
    ['B', 'D', 5],
    ['C', 'D', 4],
    ['C', 'E', 1],
    ['E', 'D', 1],
  ];
  edges.forEach(([from, to, weight]) => {
    upsertEdge(state.graph, { from, to, weight, id: edgeKey(from, to) });
  });
  requestGraphReset();
  fillNodeSelects();
  refreshEdgesTable();
  selSource.value = 'A';
  selTarget.value = 'D';
  scheduleRender();
}

function runAlgorithm(source, target) {
  if (state.animator) {
    state.animator.destroy();
    state.animator = null;
  }
  state.highlightPath = null;
  const { steps, dist, prev } = dijkstra(state.graph, source, target);
  const cost = dist.get(target);
  const paths = Number.isFinite(cost) ? allShortestPaths(prev, source, target) : [];
  state.lastResult = { steps, dist, prev, cost, paths };
  state.logEntries = steps.map(describeStep);
  state.logRendered = -1;
  logStream.innerHTML = '';
  renderResults(state.lastResult);
  configureAnimator(state.lastResult);
  updateLog(0);
  updateDistances(steps[0] ?? { dist, prev, queue: [], extracted: null });
  toast('Listo. Usa Reproducir o flechas.', 'success');
}

function ensureGraphReadyForRun(source, target) {
  if (!source || !target) {
    toast('Selecciona origen y destino.', 'error');
    return false;
  }
  if (source === target) {
    toast('Origen y destino deben ser distintos.', 'error');
    return false;
  }
  if (!state.graph.nodes.has(source) || !state.graph.nodes.has(target)) {
    toast('Nodos seleccionados inválidos.', 'error');
    return false;
  }
  if (state.graph.edges.size === 0) {
    toast('Añade aristas antes de ejecutar.', 'error');
    return false;
  }
  return true;
}

function centerView() {
  state.zoom = 1;
  state.pan = { x: 0, y: 0 };
  scheduleRender();
}

function zoomBy(factor) {
  const rect = wrap.getBoundingClientRect();
  const mx = rect.width / 2;
  const my = rect.height / 2;
  const before = screenToWorld({ x: mx, y: my });
  state.zoom = clamp(state.zoom * factor, 0.4, 3);
  const after = screenToWorld({ x: mx, y: my });
  state.pan.x += (after.x - before.x) * state.zoom;
  state.pan.y += (after.y - before.y) * state.zoom;
  scheduleRender();
}

function exportPNG() {
  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = 'grafo.png';
  link.click();
  toast('PNG exportado.', 'success');
}

function resetQuickEdgeForm() {
  edgeFromInput.value = '';
  edgeToInput.value = '';
  edgeWeightInput.value = '';
}

function initTabs() {
  const tabs = $$('#panelTabs [role="tab"]');
  const activate = (idx) => {
    tabs.forEach((tab, index) => {
      const active = index === idx;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      const target = $('#' + tab.getAttribute('aria-controls'));
      if (target) target.hidden = !active;
    });
    tabs[idx].focus();
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activate(index));
    tab.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        activate((index + 1) % tabs.length);
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        activate((index - 1 + tabs.length) % tabs.length);
      }
      if (event.key === 'Home') {
        event.preventDefault();
        activate(0);
      }
      if (event.key === 'End') {
        event.preventDefault();
        activate(tabs.length - 1);
      }
    });
  });
}

function initInspectorDemo() {
  $('#btnInspectorSelect').addEventListener('click', () => {
    $('#inspectorElement').value = 'Nodo A';
    $('#inspectorWeight').value = '—';
    toast('Inspector actualizado.', 'success', 1800);
  });
  $('#btnInspectorEdit').addEventListener('click', () => $('#modalEdgeEditor').showModal());
  $('#btnInspectorDelete').addEventListener('click', () => $('#modalConfirm').showModal());
}

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (event) => {
    if (event.altKey) {
      const step = Number(event.key);
      if (step >= 1 && step <= 4) {
        event.preventDefault();
        setActiveStep(step);
      }
    }
    if (event.key === ' ' && !event.target.matches('input,textarea')) {
      if (btnPlay.disabled) return;
      event.preventDefault();
      if (btnPlay.hidden) {
        btnPause.click();
      } else {
        btnPlay.click();
      }
    }
    if (event.key === 'ArrowRight' && !event.target.matches('input[type="range"]')) {
      if (!btnNext.disabled) btnNext.click();
    }
    if (event.key === 'ArrowLeft' && !event.target.matches('input[type="range"]')) {
      if (!btnPrev.disabled) btnPrev.click();
    }
  });
}

function initSidebarToggle() {
  btnToggleSidebar.setAttribute('aria-expanded', 'false');
  btnToggleSidebar.addEventListener('click', () => {
    const isOpen = sidebar.classList.toggle('is-open');
    btnToggleSidebar.setAttribute('aria-expanded', String(isOpen));
  });
  const mql = window.matchMedia('(min-width:641px)');
  mql.addEventListener('change', () => {
    if (mql.matches) {
      sidebar.classList.remove('is-open');
      btnToggleSidebar.setAttribute('aria-expanded', 'false');
    }
  });
}

function bindEvents() {
  $('#btnHelp').addEventListener('click', () => $('#modalHelp').showModal());
  $('#btnReset').addEventListener('click', () => window.location.reload());
  $('#btnLoadSample').addEventListener('click', () => {
    inpN.value = '8';
    validateNodeInput();
    applySampleGraph();
    $('#modeBadge').textContent = 'modo: ejemplo';
    setActiveStep(2);
    toast('Ejemplo cargado.', 'success');
  });

  btnAddNode.addEventListener('click', () => {
    const enabled = !state.addNodeMode;
    setAddNodeMode(enabled);
    toast(enabled ? 'Modo añadir nodo: haz clic en el lienzo.' : 'Modo añadir nodo desactivado.', 'info');
  });

  $('#btnAddEdge').addEventListener('click', () => toast('Usa el formulario "Arista rápida".', 'info'));

  $('#btnQuickAddEdge').addEventListener('click', () => {
    resetEdgeFormError();
    const from = normalizeNodeId(edgeFromInput.value);
    const to = normalizeNodeId(edgeToInput.value);
    const weight = edgeWeightInput.value === '' ? NaN : Number(edgeWeightInput.value);
    const validation = validateEdge({ from, to, weight }, state.graph);
    if (!validation.ok) {
      showEdgeErrors(validation.errors);
      toast(validation.errors[0], 'error');
      return;
    }
    upsertEdge(state.graph, { from, to, weight, id: edgeKey(from, to) });
    refreshEdgesTable();
    requestGraphReset();
    scheduleRender();
    resetEdgeFormError();
    resetQuickEdgeForm();
    toast('Arista añadida.', 'success');
  });

  edgesTableBody.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const row = button.closest('tr');
    if (!row) return;
    const key = row.dataset.key;
    const edge = key ? state.graph.edges.get(key) : null;
    if (!edge) {
      toast('Arista no encontrada.', 'error');
      return;
    }
    if (button.dataset.action === 'edit') {
      $('#editFrom').value = edge.from;
      $('#editTo').value = edge.to;
      $('#editWeight').value = String(edge.weight);
      const modal = $('#modalEdgeEditor');
      modal.showModal();
      modal.addEventListener('close', () => {
        if (modal.returnValue === 'save') {
          const newFrom = normalizeNodeId($('#editFrom').value);
          const newTo = normalizeNodeId($('#editTo').value);
          const newWeightRaw = $('#editWeight').value;
          const newWeight = newWeightRaw === '' ? NaN : Number(newWeightRaw);
          const validation = validateEdge(
            { from: newFrom, to: newTo, weight: newWeight },
            state.graph,
            { allowExisting: edgeKey(newFrom, newTo) === edgeKey(edge.from, edge.to) },
          );
          if (!validation.ok) {
            toast(validation.errors[0], 'error');
            return;
          }
          deleteEdge(state.graph, edge.from, edge.to);
          upsertEdge(state.graph, { from: newFrom, to: newTo, weight: newWeight, id: edgeKey(newFrom, newTo) });
          refreshEdgesTable();
          requestGraphReset();
          scheduleRender();
          toast('Arista actualizada.', 'success');
        }
      }, { once: true });
    }
    if (button.dataset.action === 'delete') {
      const modal = $('#modalConfirm');
      modal.showModal();
      modal.addEventListener('close', () => {
        if (modal.returnValue === 'confirm') {
          deleteEdge(state.graph, edge.from, edge.to);
          refreshEdgesTable();
          requestGraphReset();
          scheduleRender();
          toast('Arista eliminada.', 'success');
        }
      }, { once: true });
    }
  });

  $('#btnAutoComplete').addEventListener('click', () => {
    if (state.graph.nodes.size < 8) {
      const radius = 220;
      const cx = 450;
      const cy = 350;
      'ABCDEFGH'.split('').forEach((id, index) => {
        if (!state.graph.nodes.has(id)) {
          const angle = (index / 8) * Math.PI * 2;
          addNode(state.graph, { id, x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
        }
      });
    }
    const add = (from, to, weight) => upsertEdge(state.graph, { from, to, weight, id: edgeKey(from, to) });
    add('A', 'B', 3);
    add('A', 'C', 2);
    add('B', 'D', 5);
    add('C', 'D', 4);
    add('C', 'E', 1);
    add('E', 'D', 1);
    requestGraphReset();
    fillNodeSelects();
    refreshEdgesTable();
    scheduleRender();
    toast('Ejemplo autocompletado.', 'success');
  });

  $('#btnClearGraph').addEventListener('click', () => {
    state.graph = createGraph();
    fillNodeSelects();
    refreshEdgesTable();
    requestGraphReset();
    scheduleRender();
    toast('Grafo limpiado.', 'success');
  });

  $('#btnGenRandom').addEventListener('click', () => {
    if (!validateNodeInput()) {
      toast('El número de nodos debe estar entre 8 y 16.', 'error');
      return;
    }
    generateRandomGraph(Number(inpN.value));
    $('#modeBadge').textContent = 'modo: aleatorio';
    fillNodeSelects();
    refreshEdgesTable();
    setActiveStep(2);
    toast('Grafo aleatorio listo.', 'success');
  });

  $('#btnGenManual').addEventListener('click', () => {
    if (!validateNodeInput()) {
      toast('El número de nodos debe estar entre 8 y 16.', 'error');
      return;
    }
    state.graph = createGraph();
    requestGraphReset();
    fillNodeSelects();
    refreshEdgesTable();
    $('#modeBadge').textContent = 'modo: manual';
    setActiveStep(2);
    toast('Añade nodos con “Añadir nodo”.', 'success');
  });

  $('#btnZoomIn').addEventListener('click', () => zoomBy(1.15));
  $('#btnZoomOut').addEventListener('click', () => zoomBy(1 / 1.15));
  $('#btnCenter').addEventListener('click', () => centerView());
  $('#btnScreenshot').addEventListener('click', () => exportPNG());
  $('#btnExportPNG').addEventListener('click', () => exportPNG());

  $('#btnExportJSON').addEventListener('click', () => {
    const data = {
      nodes: Array.from(state.graph.nodes.values()),
      edges: Array.from(state.graph.edges.values()),
      source: selSource.value || null,
      target: selTarget.value || null,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'grafo.json';
    link.click();
    URL.revokeObjectURL(url);
    toast('JSON exportado.', 'success');
  });

  btnRun.addEventListener('click', () => {
    const source = selSource.value;
    const target = selTarget.value;
    if (!ensureGraphReadyForRun(source, target)) return;
    runAlgorithm(source, target);
    setActiveStep(3);
  });

  btnPlay.addEventListener('click', () => {
    if (!state.animator) return;
    state.animator.play();
    btnPlay.hidden = true;
    btnPause.hidden = false;
  });

  btnPause.addEventListener('click', () => {
    if (!state.animator) return;
    state.animator.pause();
    btnPlay.hidden = false;
    btnPause.hidden = true;
  });

  btnReplay.addEventListener('click', () => {
    if (!state.animator) return;
    state.animator.pause();
    state.animator.seek(0);
    btnPlay.hidden = false;
    btnPause.hidden = true;
  });

  btnNext.addEventListener('click', () => {
    if (!state.animator) return;
    const targetIndex = clamp(state.animator.position + 1, 0, state.animator.length - 1);
    state.animator.pause();
    btnPlay.hidden = false;
    btnPause.hidden = true;
    state.animator.seek(targetIndex);
  });

  btnPrev.addEventListener('click', () => {
    if (!state.animator) return;
    const targetIndex = clamp(state.animator.position - 1, 0, state.animator.length - 1);
    state.animator.pause();
    btnPlay.hidden = false;
    btnPause.hidden = true;
    state.animator.seek(targetIndex);
  });

  progress.addEventListener('input', (event) => {
    if (!state.animator) return;
    const index = Number(event.target.value);
    state.animator.pause();
    btnPlay.hidden = false;
    btnPause.hidden = true;
    state.animator.seek(index);
  });

  rangeSpeed.addEventListener('input', (event) => {
    const speed = Number(event.target.value);
    if (state.animator) state.animator.setSpeed(speed);
  });

  pathsList.addEventListener('change', (event) => {
    if (event.target.name === 'path') {
      updateSelectedPath(event.target.value);
    }
  });

  edgeFromInput.addEventListener('input', resetEdgeFormError);
  edgeToInput.addEventListener('input', resetEdgeFormError);
  edgeWeightInput.addEventListener('input', resetEdgeFormError);
  inpN.addEventListener('input', validateNodeInput);

  $('.steps').addEventListener('click', (event) => {
    const btn = event.target.closest('.step-btn');
    if (!btn) return;
    const step = Number(btn.parentElement.dataset.step);
    if (Number.isFinite(step)) {
      setActiveStep(step);
    }
  });

  $('#btnHelp').addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      $('#modalHelp').close();
    }
  });

  wrap.addEventListener('click', (event) => {
    if (!state.addNodeMode) return;
    if (wrap.dataset.dragging === 'true') return;
    const point = screenToWorld({ x: event.offsetX, y: event.offsetY });
    const id = nextNodeId();
    addNode(state.graph, { id, x: point.x, y: point.y });
    setAddNodeMode(false);
    requestGraphReset();
    fillNodeSelects();
    scheduleRender();
    toast(`Nodo ${id} añadido.`, 'success');
  });
}

function initCanvasInteractions() {
  let dragging = false;
  let moved = false;
  let last = { x: 0, y: 0 };
  wrap.dataset.dragging = 'false';
  wrap.addEventListener('mousedown', (event) => {
    dragging = true;
    moved = false;
    last = { x: event.offsetX, y: event.offsetY };
    wrap.dataset.dragging = 'false';
  });
  window.addEventListener('mouseup', () => {
    if (dragging && moved) wrap.dataset.dragging = 'true';
    dragging = false;
    setTimeout(() => { wrap.dataset.dragging = 'false'; }, 0);
  });
  wrap.addEventListener('mousemove', (event) => {
    if (!dragging) return;
    const dx = event.offsetX - last.x;
    const dy = event.offsetY - last.y;
    if (Math.abs(dx) > 0 || Math.abs(dy) > 0) {
      moved = true;
    }
    state.pan.x += dx;
    state.pan.y += dy;
    last = { x: event.offsetX, y: event.offsetY };
    scheduleRender();
  });
  wrap.addEventListener('wheel', (event) => {
    if (event.ctrlKey) {
      event.preventDefault();
      const scale = Math.exp(-event.deltaY * 0.0015);
      const before = screenToWorld({ x: event.offsetX, y: event.offsetY });
      state.zoom = clamp(state.zoom * scale, 0.4, 3);
      const after = screenToWorld({ x: event.offsetX, y: event.offsetY });
      state.pan.x += (after.x - before.x) * state.zoom;
      state.pan.y += (after.y - before.y) * state.zoom;
      scheduleRender();
    }
  }, { passive: false });
}

function init() {
  setActiveStep(1);
  requestGraphReset();
  resetEdgeFormError();
  bindEvents();
  initCanvasInteractions();
  initTabs();
  initInspectorDemo();
  setupKeyboardShortcuts();
  initSidebarToggle();
  scheduleRender();
}

init();
