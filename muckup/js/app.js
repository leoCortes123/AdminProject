/* ============================================================
   DevCycle — Mockup · Lógica de navegación y renderizado
   Solo prototipo: datos ficticios (MOCK), sin backend.
   ============================================================ */
'use strict';
const D = window.MOCK;
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
const esc = s => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

const toastWrap = $('#toastWrap');
function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  toastWrap.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}
const mockAction = label => () => toast(`Mockup · acción simulada: ${label}`);

/* ============ 1. Navegación entre vistas ============ */
const CRUMB = {
  productos: ['Organización general', 'Productos'],
  resumen: [null, 'Resumen'],
  arbol: [null, 'Arquitectura funcional'],
  docs: [null, 'Documentación'],
  tareas: [null, 'Tareas'],
  incidencias: [null, 'Incidencias'],
  modificaciones: [null, 'Modificaciones'],
  trazabilidad: [null, 'Trazabilidad'],
  seguimiento: [null, 'Seguimiento'],
  agentes: [null, 'Agentes IA'],
  config: [null, 'Configuración'],
  sitemap: ['Sistema', 'Mapa del sistema']
};
let currentView = 'resumen';
let currentProduct = 'kanora';

function switchView(key) {
  currentView = key;
  $$('.view').forEach(v => v.classList.toggle('active', v.id === `view-${key}`));
  $$('.nav-item[data-nav]').forEach(b => b.classList.toggle('active', b.dataset.nav === key));
  const [crumbOrg, crumb] = CRUMB[key] || ['—', key];
  $('#crumbProduct').textContent = crumbOrg === null ? productName(currentProduct) : crumbOrg;
  $('#crumbView').textContent = crumb;
  $('.screen').scrollTop = 0;
}
function productName(id) { return (D.products.find(p => p.id === id) || {}).name || id; }

$('#sideNav').addEventListener('click', e => {
  const btn = e.target.closest('.nav-item[data-nav]');
  if (btn) switchView(btn.dataset.nav);
});

/* ============ 2. Contexto: organización ↔ producto ============ */
$('#productSwitcher').addEventListener('change', e => {
  const value = e.target.value;
  if (value === 'org') {
    document.body.dataset.context = 'org';
    switchView('productos');
    toast('Vista organización general · los espacios de producto están aislados');
    return;
  }
  document.body.dataset.context = 'product';
  currentProduct = value;
  $('#navProductName').textContent = productName(value);
  renderProductContext();
  renderTree();
  switchView('resumen');
  toast(`Espacio de trabajo: ${productName(value)}`);
});

function renderProductContext() {
  const p = D.products.find(x => x.id === currentProduct);
  if (!p) return;
  $('#productLogo').textContent = p.name.charAt(0);
  $('#productName').textContent = p.name;
  $('#productTagline').textContent = p.tagline;
  $('#productState').textContent = p.estado;
  $('#productState').className = 'pill ' + (p.estado === 'Activo' ? 'pill-ok' : p.estado === 'Mantenimiento' ? 'pill-info' : 'pill-warn');
  $('#productRepo').textContent = p.repo;
  $('#productDesc').textContent = p.descripcion;
  $('#productObjectives').innerHTML = p.objetivos.map(o => `<li>${esc(o)}</li>`).join('');
  $('#productStack').innerHTML = p.stack.map(s => `<span class="stack-chip">${esc(s)}</span>`).join('');
  $('#memberCount').textContent = D.members.length;
  $('#memberPreview').innerHTML = D.members.map(m => `
    <div class="member-row">
      <span class="member-avatar" style="background:${esc(m.color)}">${esc(m.iniciales)}</span>
      <span><strong>${esc(m.nombre)}</strong><br><span class="m-mail">${esc(m.email)}</span></span>
      <span class="pill pill-neutral" style="margin-left:auto">${esc(m.rol)}</span>
    </div>`).join('');
  renderActivity($('#activityFeed'));
  $('#moduleProgressResumen').innerHTML = D.moduleProgress.map(moduleProgressHTML).join('');
}
function renderActivity(ul) {
  ul.innerHTML = D.activity.map(a => `
    <li class="${a.ia ? 'ia' : ''}">
      <div class="t-time">${esc(a.time)}</div>
      <div class="t-text"><strong>${esc(a.actor)}</strong>${a.ia ? '<span class="actor-ia">AGENTE IA</span>' : '<span class="actor-human">HUMANO</span>'}<br>${esc(a.text)}</div>
    </li>`).join('');
}
function moduleProgressHTML(m) {
  const subs = (m.sub || []).map(([name, pct]) => `
    <div class="sub-row"><span class="m-name">${esc(name)}</span>
      <div class="progress" style="flex:1"><span style="width:${pct}%"></span></div>
      <span class="m-pct">${pct}%</span>
    </div>`).join('');
  return `
    <div class="module-row">
      <div class="m-top"><span class="m-name">${esc(m.name)}</span>
        <div class="progress" style="flex:1"><span style="width:${m.pct}%"></span></div>
        <span class="m-pct">${m.pct}%</span>
      </div>${subs}
    </div>`;
}

/* ============ 3. Vista Productos (tabla organización) ============ */
function renderProductsTable() {
  $('#productsTable tbody').innerHTML = D.products.map(p => `
    <tr class="clickable" data-product="${esc(p.id)}" tabindex="0" role="button" aria-label="Abrir espacio de trabajo de ${esc(p.name)}">
      <td><strong>${esc(p.name)}</strong><br><span style="color:var(--ink-2);font-size:10.5px">${esc(p.tagline)}</span></td>
      <td>${p.estado === 'Activo' ? '<span class="pill pill-ok">Activo</span>' : p.estado === 'Mantenimiento' ? '<span class="pill pill-info">Mantenimiento</span>' : '<span class="pill pill-warn">En desarrollo</span>'}</td>
      <td><div class="progress"><span style="width:${p.avance}%"></span></div><span class="mono" style="font-size:9.5px">${p.avance}%</span></td>
      <td>${p.modulos}</td><td>${p.nodos}</td><td>${p.tareasAbiertas}</td><td>${p.incidencias}</td><td>${esc(p.actividad)}</td>
    </tr>`).join('');
}
$('#productsTable').addEventListener('click', e => {
  const tr = e.target.closest('tr[data-product]');
  if (tr) enterProduct(tr.dataset.product);
});
$('#productsTable').addEventListener('keydown', e => {
  if (e.key === 'Enter') { const tr = e.target.closest('tr[data-product]'); if (tr) enterProduct(tr.dataset.product); }
});
function enterProduct(id) {
  $('#productSwitcher').value = id;
  document.body.dataset.context = 'product';
  currentProduct = id;
  $('#navProductName').textContent = productName(id);
  renderProductContext();
  renderTree();
  switchView('resumen');
}

/* ============ 4. Árbol funcional + ficha de elemento ============ */
const typeMeta = Object.fromEntries(D.nodeTypes.map(t => [t.id, t]));
let selectedNode = 'PANT-02';
const fichaTimelineSeed = name => [
  { time: '2026-11-05 10:02', actor: 'R. Ibáñez', ia: false, text: `Actualizó el avance de ${name} al 68%` },
  { time: '2026-11-05 10:41', actor: 'Claude Code', ia: true, text: 'Ejecutó tests de reasignación vía MCP · 12/12 OK (registrado en agent_executions)' },
  { time: '2026-11-04 17:58', actor: 'Claude Code', ia: true, text: 'Propuso MOD-031 (cambio propuesto) vinculada a INC-087' },
  { time: '2026-10-28 13:20', actor: 'L. Gutiérrez', ia: false, text: 'Publicó DOC-101 v7 con ajustes tras revisión funcional' },
  { time: '2026-10-21 09:15', actor: 'R. Ibáñez', ia: false, text: 'Vinculó TAR-231 y TAR-232 al nodo; INC-084 reportada desde esta pantalla' }
];

function flattenTree(nodes, depth = 0, path = []) {
  return nodes.flatMap(n => [
    { ...n, depth, path: [...path, n.name].join(' / ') },
    ...flattenTree(n.children || [], depth + 1, [...path, n.name])
  ]);
}
function nodeMatchesFilter(n, filter) {
  if (!filter) return true;
  if (n.type === filter) return true;
  return (n.children || []).some(c => nodeMatchesFilter(c, filter));
}
function renderTree() {
  const container = $('#functionalTree');
  const filter = $('#nodeTypeFilter').value;
  const tree = D.trees[currentProduct] || [];
  const buildRows = (nodes, depth) => nodes
    .filter(n => nodeMatchesFilter(n, filter))
    .map(n => {
      const hasChildren = (n.children || []).length > 0;
      const meta = typeMeta[n.type] || typeMeta.otro;
      const open = filter ? true : depth < 2;
      return `
        <button class="tree-row ${hasChildren ? '' : 'leaf'} ${n.id === selectedNode ? 'selected' : ''}" role="treeitem" data-node="${esc(n.id)}" style="padding-left:${8 + depth * 4}px" aria-expanded="${open}">
          <span class="caret ${open ? 'open' : ''}">▶</span>
          <span class="type-dot"><i style="background:${meta.color}"></i></span>
          <span class="node-id">${esc(n.id)}</span>
          <span>${esc(n.name)}</span>
        </button>
        ${hasChildren ? `<div class="tree-children ${open ? '' : 'collapsed'}" data-children-of="${esc(n.id)}">${buildRows(n.children, depth + 1)}</div>` : ''}`;
    }).join('');
  container.innerHTML = buildRows(tree, 0) || '<div class="empty-state">Sin nodos de este tipo en el producto.</div>';
}
$('#functionalTree').addEventListener('click', e => {
  const row = e.target.closest('.tree-row');
  if (!row) return;
  const caret = e.target.closest('.caret');
  const id = row.dataset.node;
  if (caret && !row.classList.contains('leaf')) {
    const children = $(`[data-children-of="${CSS.escape(id)}"]`, $('#functionalTree'));
    if (children) { children.classList.toggle('collapsed'); caret.classList.toggle('open'); row.setAttribute('aria-expanded', String(!children.classList.contains('collapsed'))); }
    return;
  }
  selectNode(id);
});
$('#nodeTypeFilter').addEventListener('change', renderTree);
$('#expandAllBtn').addEventListener('click', () => { $$('#functionalTree .tree-children').forEach(c => c.classList.remove('collapsed')); $$('#functionalTree .caret').forEach(c => c.classList.add('open')); });
$('#collapseAllBtn').addEventListener('click', () => { $$('#functionalTree .tree-children').forEach(c => c.classList.add('collapsed')); $$('#functionalTree .caret').forEach(c => c.classList.remove('open')); });

function findNode(nodes, id) {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findNode(n.children || [], id);
    if (found) return found;
  }
  return null;
}
function selectNode(id) {
  selectedNode = id;
  const tree = D.trees[currentProduct] || [];
  const node = findNode(tree, id);
  if (!node) return;
  const meta = typeMeta[node.type] || typeMeta.otro;
  const flat = flattenTree(tree);
  const info = flat.find(n => n.id === id);
  const docs = D.docs.filter(d => d.nodo === id);
  const tasks = D.tasks.filter(t => t.nodo === id);
  const incs = D.incidents.filter(i => i.nodo === id);
  const summary = D.nodeSummary[id] || { estado: 'Pendiente', responsable: 'Por asignar', actualizado: '—', avance: 0, descripcion: `Elemento estructural de tipo ${meta.label}. Sin descripción funcional registrada todavía — vinculada desde la pestaña Funcionalidad.` };

  $('#fichaCode').textContent = id;
  $('#fichaName').textContent = node.name;
  $('#fichaTypeLabel').textContent = meta.label;
  $('#fichaTypeDot').style.background = meta.color;
  $('#fichaTypeBadge').textContent = meta.label.charAt(0).toUpperCase();
  $('#fichaTypeBadge').style.background = meta.color;
  $('#fichaPath').textContent = info.path.split(' / ').slice(0, -1).join(' / ') || 'Raíz';
  $('#fichaState').textContent = summary.estado;
  $('#fichaState').className = 'pill ' + (summary.estado === 'En desarrollo' ? 'pill-warn' : 'pill-neutral');
  $('#fichaDesc').textContent = summary.descripcion;
  $('#fichaOwner').textContent = summary.responsable;
  $('#fichaUpdated').textContent = summary.actualizado;
  const adv = $('#tab-resumen .progress span'); if (adv) adv.style.width = `${summary.avance || 0}%`;

  $$('[data-doc-count]').forEach(el => el.textContent = docs.length);
  $$('[data-task-count]').forEach(el => el.textContent = tasks.length);
  $$('[data-inc-count]').forEach(el => el.textContent = incs.length);

  $('#fichaDocs').innerHTML = docs.length
    ? docs.map(docItemHTML).join('')
    : '<div class="empty-state">Sin documentos vinculados.<br>Vincula una especificación, caso de uso o regla de negocio a este nodo.</div>';
  $('#fichaTasks').innerHTML = tasks.length
    ? tasks.map(t => `<div class="doc-item"><span class="type-dot"><i style="background:${prioColor(t.prioridad)}"></i></span><div><h4>${esc(t.titulo)}</h4><small>${esc(t.id)} · ${esc(t.tipo)} · ${esc(t.estado)} · ${esc(t.responsable)} · límite ${esc(t.limite)}</small></div></div>`).join('')
    : '<div class="empty-state">Sin tareas vinculadas.</div>';
  $('#fichaIncidents').innerHTML = incs.length
    ? incs.map(i => `<div class="doc-item"><span class="type-dot"><i style="background:var(--crit)"></i></span><div><h4>${esc(i.titulo)}</h4><small>${esc(i.id)} · Sev. ${esc(i.severidad)} · ${esc(i.estado)}</small></div></div>`).join('')
    : '<div class="empty-state">Sin incidencias reportadas en este elemento.</div>';

  const relOut = D.relations.filter(r => r.origen === id || r.origen.startsWith(id));
  const relIn = D.relations.filter(r => r.destino === id);
  $('#relationsOut').innerHTML = relationTableHTML(relOut, 'Sin relaciones salientes.');
  $('#relationsIn').innerHTML = relationTableHTML(relIn, 'Sin relaciones entrantes.');

  $('#fichaTimeline').innerHTML = fichaTimelineSeed(node.name).map(a => `
    <li class="${a.ia ? 'ia' : ''}"><div class="t-time">${esc(a.time)}</div>
    <div class="t-text"><strong>${esc(a.actor)}</strong>${a.ia ? '<span class="actor-ia">AGENTE IA</span>' : '<span class="actor-human">HUMANO</span>'}<br>${esc(a.text)}</div></li>`).join('');

  $$('#functionalTree .tree-row').forEach(r => r.classList.toggle('selected', r.dataset.node === id));
}
function relationTableHTML(rows, empty) {
  if (!rows.length) return `<div class="empty-state">${esc(empty)}</div>`;
  return `<table class="tbl"><thead><tr><th>Origen</th><th>Relación</th><th>Destino</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td class="mono">${esc(r.origen)}</td><td><span class="relation-tag">${esc(r.tipo)}</span></td><td class="mono">${esc(r.destino)}</td></tr>`).join('')}
  </tbody></table>`;
}
function prioColor(p) { return p === 'Crítica' ? 'var(--crit)' : p === 'Alta' ? 'var(--warn)' : p === 'Media' ? '#eab308' : '#94a3b8'; }
function docItemHTML(d) {
  return `<div class="doc-item"><div class="doc-icon">MD</div><div style="min-width:0"><h4>${esc(d.titulo)}</h4><small>${esc(d.id)} · ${esc(d.tipo)} · v${esc(String(d.version).replace(/^v/, ''))} · ${esc(d.autor)} · ${esc(d.fecha)}</small></div></div>`;
}

/* Tabs genéricos (ficha + configuración) */
$$('.ficha-tabs .tab').forEach(tab => tab.addEventListener('click', () => {
  $$('.ficha-tabs .tab').forEach(t => t.classList.toggle('active', t === tab));
  $$('#view-arbol .tab-panel').forEach(p => p.classList.toggle('active', p.id === tab.dataset.tab));
}));
$$('.config-tabs .tab').forEach(tab => tab.addEventListener('click', () => {
  $$('.config-tabs .tab').forEach(t => t.classList.toggle('active', t === tab));
  $$('#view-config .tab-panel').forEach(p => p.classList.toggle('active', p.id === tab.dataset.configpanel));
}));

/* ============ 5. Documentación ============ */
function renderDocs() {
  const type = $('#docTypeFilter').value, state = $('#docStateFilter').value, q = $('#docSearch').value.trim().toLowerCase();
  const filtered = D.docs.filter(d =>
    (!type || d.tipo === type) && (!state || d.estado === state) &&
    (!q || [d.titulo, d.autor, d.nodo, d.id, d.nodoPath].join(' ').toLowerCase().includes(q))
  );
  $('#docListCount').textContent = filtered.length;
  $('#docCountLabel').textContent = `${filtered.length} de ${D.docs.length} documentos`;
  $('#docList').innerHTML = filtered.map(d => `
    <button class="doc-item" data-doc="${esc(d.id)}" style="width:100%;text-align:left;cursor:pointer;background:#fff">
      <div class="doc-icon">MD</div>
      <div style="min-width:0">
        <h4>${esc(d.titulo)}</h4>
        <small>${esc(d.id)} · ${esc(d.tipo)}</small><br>
        <small>${esc(d.nodoPath)} · ${esc(d.autor)} · ${esc(d.fecha)}</small>
      </div>
      <span class="pill ${d.estado === 'Vigente' ? 'pill-ok' : d.estado === 'Borrador' ? 'pill-neutral' : 'pill-warn'}" style="margin-left:auto">${esc(d.estado)}</span>
    </button>`).join('') || '<div class="empty-state">Ningún documento coincide con el filtro.</div>';
}
$('#docTypeFilter').innerHTML = '<option value="">Todos los tipos</option>' + [...new Set(D.docs.map(d => d.tipo))].sort().map(t => `<option>${esc(t)}</option>`).join('');
$('#docTypeFilter').addEventListener('change', renderDocs);
$('#docStateFilter').addEventListener('change', renderDocs);
$('#docSearch').addEventListener('input', renderDocs);
$('#docList').addEventListener('click', e => {
  const btn = e.target.closest('[data-doc]');
  if (!btn) return;
  const d = D.docs.find(x => x.id === btn.dataset.doc);
  if (!d) return;
  $('#docPreviewId').textContent = `${d.id} · ${d.version}`;
  $('#docPreviewTitle').textContent = d.titulo;
  $('#docPreviewMeta').textContent = `${d.tipo} · ${d.nodo} · ${d.nodoPath} · ${d.autor} · actualizado ${d.fecha}`;
  $('#docPreviewBody').innerHTML = `
    <h3 style="font-size:15px;margin-bottom:8px">${esc(d.titulo)}</h3>
    <p style="color:var(--ink-2);font-size:11px;margin-bottom:12px">${esc(d.id)} · ${esc(d.version)} · estado: <strong>${esc(d.estado)}</strong> · autor: ${esc(d.autor)}</p>
    <h4 style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-2);margin:12px 0 6px">1 · Contexto</h4>
    <p>Este documento describe el comportamiento esperado del elemento funcional <span class="mono">${esc(d.nodo)}</span> y sus regla asociadas. En la aplicación real, aquí se renderiza el Markdown almacenado con vista previa en vivo.</p>
    <h4 style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-2);margin:12px 0 6px">2 · Contenido (simulado)</h4>
    <ul style="padding-left:18px;line-height:1.9"><li>Criterios de aceptación verificables.</li><li>Relaciones con otros documentos y nodos.</li><li>Historial de versiones con autor, fecha y diff.</li><li>Adjuntos: diagramas y recursos.</li></ul>
    <h4 style="font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-2);margin:12px 0 6px">3 · Versionado</h4>
    <p>Cada publicación conserva la versión anterior (<span class="mono">item_versions</span>): autor, fecha, mensaje de cambio y diff completo. Ningún documento se sobrescribe.</p>`;
});

/* ============ 6. Tareas: árbol / tabla / kanban ============ */
const statePill = s => ({ 'Pendiente': 'pill-neutral', 'En curso': 'pill-info', 'Bloqueada': 'pill-crit', 'En revisión': 'pill-warn', 'Hecha': 'pill-ok' }[s] || 'pill-neutral');
const prioPill = p => ({ 'Crítica': 'pill-crit', 'Alta': 'pill-warn', 'Media': 'pill-neutral', 'Baja': 'pill-neutral' }[p] || 'pill-neutral');

function filteredTasks() {
  const tipo = $('#taskFilterTipo').value, estado = $('#taskFilterEstado').value,
        prioridad = $('#taskFilterPrioridad').value, resp = $('#taskFilterResponsable').value,
        q = $('#taskSearch').value.trim().toLowerCase();
  return D.tasks.filter(t =>
    (!tipo || t.tipo === tipo) && (!estado || t.estado === estado) &&
    (!prioridad || t.prioridad === prioridad) && (!resp || t.responsable === resp) &&
    (!q || [t.titulo, t.id, t.nodo, t.nodoPath].join(' ').toLowerCase().includes(q))
  );
}
function renderTaskResponsables() {
  $('#taskFilterResponsable').innerHTML = '<option value="">Todos</option>' +
    [...new Set(D.tasks.map(t => t.responsable))].sort().map(r => `<option>${esc(r)}</option>`).join('');
}
function renderTaskTable(list) {
  $('#tasksTable tbody').innerHTML = list.map(t => `
    <tr><td class="mono">${esc(t.id)}</td><td><strong>${esc(t.titulo)}</strong></td><td>${esc(t.tipo)}</td>
      <td style="max-width:220px;white-space:normal">${esc(t.nodoPath)}</td>
      <td><span class="pill ${statePill(t.estado)}">${esc(t.estado)}</span></td>
      <td><span class="pill ${prioPill(t.prioridad)}">${esc(t.prioridad)}</span></td>
      <td>${esc(t.responsable)}</td><td class="mono">${esc(t.limite)}</td></tr>`).join('')
    || '<tr><td colspan="8" style="color:var(--ink-3)">Sin tareas con estos filtros.</td></tr>';
}
function renderTaskKanban(list) {
  const cols = ['Pendiente', 'En curso', 'Bloqueada', 'En revisión', 'Hecha'];
  $('#tasksKanbanWrap').innerHTML = cols.map(col => {
    const items = list.filter(t => t.estado === col);
    return `<div class="kanban-col"><header>${esc(col)}<span class="cnt">${items.length}</span></header><div class="kanban-body">
      ${items.map(t => `
        <button class="task-card" style="border-left-color:${prioColor(t.prioridad)}" data-task="${esc(t.id)}">
          <span class="tc-id"><span>${esc(t.id)}</span><span>${esc(t.estimacion)}</span></span>
          <h4>${esc(t.titulo)}</h4>
          <span class="tc-foot"><span class="type-dot"><span class="prio-bar" style="background:${prioColor(t.prioridad)}"></span>${esc(t.prioridad)}</span><span>${esc(t.responsable)}</span></span>
        </button>`).join('')}
    </div></div>`;
  }).join('');
}
function renderTaskTree(list) {
  const groups = {};
  list.forEach(t => { (groups[t.nodoPath] = groups[t.nodoPath] || []).push(t); });
  $('#tasksTreeWrap').innerHTML = `<div class="panel-title">Tareas agrupadas por elemento funcional</div>` +
    (Object.keys(groups).length ? Object.entries(groups).map(([path, items]) => `
      <div class="module-row">
        <div class="m-top"><span class="m-name" style="min-width:0">${esc(path)}</span><span class="pill pill-neutral">${items.length}</span></div>
        ${items.map(t => `<div class="sub-row"><span class="mono" style="min-width:64px">${esc(t.id)}</span><span style="flex:1">${esc(t.titulo)}</span><span class="pill ${statePill(t.estado)}">${esc(t.estado)}</span></div>`).join('')}
      </div>`).join('') : '<div class="empty-state">Sin tareas con estos filtros.</div>');
}
function renderTasks() {
  const list = filteredTasks();
  $('#taskCountLabel').textContent = `${list.length} de ${D.tasks.length} tareas`;
  renderTaskTable(list); renderTaskKanban(list); renderTaskTree(list);
}
let taskView = 'table';
function setTaskView(v) {
  taskView = v;
  $$('#view-tareas .view-toggle button').forEach(b => b.classList.toggle('active', b.dataset.taskview === v));
  $('#tasksTableWrap').hidden = v !== 'table';
  $('#tasksKanbanWrap').hidden = v !== 'kanban';
  $('#tasksTreeWrap').hidden = v !== 'tree';
}
$('#view-tareas .view-toggle').addEventListener('click', e => {
  const b = e.target.closest('[data-taskview]');
  if (b) setTaskView(b.dataset.taskview);
});
['taskFilterTipo', 'taskFilterEstado', 'taskFilterPrioridad', 'taskFilterResponsable'].forEach(id => $('#' + id).addEventListener('change', renderTasks));
$('#taskSearch').addEventListener('input', renderTasks);
$('#tasksKanbanWrap').addEventListener('click', e => { const c = e.target.closest('[data-task]'); if (c) toast(`Mockup · abrir ${c.dataset.task} (detalle en la ficha del nodo vinculado)`); });

/* ============ 7. Incidencias: maestro-detalle ============ */
let incFilter = '', selectedIncident = D.incidents[0].id;
function renderIncidents() {
  const list = D.incidents.filter(i => !incFilter || i.severidad === incFilter);
  $('#incCount').textContent = list.length;
  $('#incList').innerHTML = list.map(i => `
    <button class="inc-item ${i.id === selectedIncident ? 'selected' : ''}" data-inc="${esc(i.id)}">
      <span class="type-dot"><i style="background:${prioColor(i.prioridad)}"></i><span class="mono" style="font-size:9.5px;color:var(--ink-3)">${esc(i.id)} · ${esc(i.fecha)}</span></span>
      <h4>${esc(i.titulo)}</h4>
      <small>Sev. ${esc(i.severidad)} · <span class="pill ${i.estado === 'Verificada' ? 'pill-ok' : i.estado === 'En corrección' ? 'pill-info' : 'pill-warn'}" style="font-size:9px">${esc(i.estado)}</span> · ${esc(i.responsable)}</small>
    </button>`).join('') || '<div class="empty-state">Sin incidencias con esta severidad.</div>';
  const i = D.incidents.find(x => x.id === selectedIncident) || list[0];
  if (!i) { $('#incDetail').innerHTML = '<div class="empty-state">Selecciona una incidencia.</div>'; return; }
  $('#incDetail').innerHTML = `
    <div style="display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap">
      <div><div class="mono" style="font-size:9.5px;color:var(--ink-3)">${esc(i.id)} · ${esc(i.fecha)} · ${esc(i.nodo)}</div>
        <h2 style="font-size:15px;margin-top:3px;max-width:520px">${esc(i.titulo)}</h2></div>
      <div style="margin-left:auto;display:flex;gap:6px">
        <span class="pill ${i.severidad === 'Crítica' ? 'pill-crit' : i.severidad === 'Alta' ? 'pill-warn' : 'pill-neutral'}">Sev. ${esc(i.severidad)}</span>
        <span class="pill ${i.estado === 'Verificada' ? 'pill-ok' : 'pill-info'}">${esc(i.estado)}</span>
      </div>
    </div>
    <div class="split-even" style="margin-top:14px">
      <div><div class="panel-title">Comportamiento esperado</div><p style="font-size:12px;line-height:1.55">${esc(i.esperado)}</p></div>
      <div><div class="panel-title">Comportamiento observado</div><p style="font-size:12px;line-height:1.55">${esc(i.observado)}</p></div>
    </div>
    <div class="panel-title" style="margin-top:12px">Pasos de reproducción</div>
    <ol class="steps-list">${i.pasos.map(p => `<li>${esc(p)}</li>`).join('')}</ol>
    ${i.evidencias.length ? `<div class="panel-title" style="margin-top:12px">Evidencias</div><div>${i.evidencias.map(e => `<span class="evidence-chip">📎 ${esc(e)}</span>`).join('')}</div>` : ''}
    <div class="split-even" style="margin-top:14px">
      <div><div class="panel-title">Tareas vinculadas</div>${i.tareas.length ? i.tareas.map(t => `<span class="evidence-chip" style="border-color:var(--accent);color:var(--accent-ink)">${esc(t)}</span>`).join('') : '<p style="font-size:12px;color:var(--ink-3)">Ninguna</p>'}</div>
      <div><div class="panel-title">Cambios correctivos</div>${i.cambios.length ? i.cambios.map(c => `<span class="evidence-chip" style="border-color:#86efac;color:#065f46">${esc(c)}</span>`).join('') : '<p style="font-size:12px;color:var(--ink-3)">Pendiente · se vinculará al ejecutar la corrección</p>'}</div>
    </div>
    <div style="margin-top:14px;display:flex;gap:8px"><button class="btn btn-sm" id="incLinkTaskBtn">Vincular tarea</button><button class="btn btn-sm" id="incCreateChangeBtn">Crear modificación correctiva</button></div>`;
  const link = $('#incLinkTaskBtn'); if (link) link.addEventListener('click', mockAction(`vincular tarea a ${i.id}`));
  const chg = $('#incCreateChangeBtn'); if (chg) chg.addEventListener('click', mockAction(`crear MOD correctiva para ${i.id}`));
}
$('#incList').addEventListener('click', e => { const b = e.target.closest('[data-inc]'); if (b) { selectedIncident = b.dataset.inc; renderIncidents(); } });
$$('#view-incidencias [data-sevfilter]').forEach(b => b.addEventListener('click', () => {
  incFilter = b.dataset.sevfilter;
  $$('#view-incidencias [data-sevfilter]').forEach(x => x.classList.toggle('btn-primary', x === b));
  renderIncidents();
}));

/* ============ 8. Modificaciones ============ */
let modFilter = '';
function renderChanges() {
  const list = D.changes.filter(c => !modFilter || c.estado === modFilter);
  $('#changesTable tbody').innerHTML = list.map(c => `
    <tr><td class="mono">${esc(c.id)}</td><td class="mono">${esc(c.fecha)}</td><td>${esc(c.tipo)}</td>
      <td style="max-width:280px;white-space:normal">${esc(c.descripcion)}</td>
      <td><span class="pill ${c.estado === 'Ejecutado' ? 'pill-ok' : 'pill-info'}">${esc(c.estado)}</span></td>
      <td>${esc(c.elementos)}</td><td class="mono">${esc(c.tareas)}</td><td class="mono">${esc(c.incidencias)}</td><td class="mono">${c.git !== '—' ? `<span title="Commit en kanora-core">${esc(c.git)}</span>` : '—'}</td></tr>`).join('')
    || '<tr><td colspan="9" style="color:var(--ink-3)">Sin modificaciones en este estado.</td></tr>';
}
$$('#view-modificaciones [data-modfilter]').forEach(b => b.addEventListener('click', () => {
  modFilter = b.dataset.modfilter;
  $$('#view-modificaciones [data-modfilter]').forEach(x => x.classList.toggle('btn-primary', x === b));
  renderChanges();
}));

/* ============ 9. Trazabilidad ============ */
function renderTraceQueries() {
  $('#traceQueries').innerHTML = D.traceQueries.map((q, i) => `
    <button class="query-item" data-query="${i}"><span class="q-num">Q${i + 1}</span><span>${esc(q.q)}</span></button>`).join('');
}
$('#traceQueries').addEventListener('click', e => {
  const b = e.target.closest('[data-query]'); if (!b) return;
  const q = D.traceQueries[Number(b.dataset.query)];
  $('#traceDestination').innerHTML = `<strong>${esc(q.destino)}</strong> · ${q.filas.length} resultado(s)`;
  $('#traceResults tbody').innerHTML = q.filas.map(([a, b2, c]) => `<tr><td class="mono">${esc(a)}</td><td>${esc(b2)}</td><td>${esc(c)}</td></tr>`).join('');
});

/* ============ 10. Seguimiento ============ */
function renderSeguimiento() {
  $('#moduleProgressList').innerHTML = D.moduleProgress.map(moduleProgressHTML).join('');
  renderActivity($('#activityFeedSeguimiento'));
  const openIncs = D.incidents.filter(i => i.estado !== 'Verificada');
  $('#openIncidentsList').innerHTML = openIncs.map(i => `<li><span class="pill ${i.severidad === 'Crítica' ? 'pill-crit' : 'pill-warn'}" style="min-width:64px;justify-content:center">${esc(i.severidad)}</span><span style="flex:1">${esc(i.titulo)}</span><span class="mono">${esc(i.id)}</span></li>`).join('');
  $('#noDocList').innerHTML = D.noDoc.map(x => `<li><span class="type-dot"><i style="background:var(--warn)"></i></span><span>${esc(x)}</span><button class="btn btn-sm btn-ghost" style="margin-left:auto" data-toast="Mockup · crear documento para ${esc(x)}">+ Doc</button></li>`).join('');
  $('#noTestsList').innerHTML = D.noTests.map(x => `<li><span class="type-dot"><i style="background:#eab308"></i></span><span>${esc(x)}</span></li>`).join('');
  $('#blockedList').innerHTML = D.blocked.map(x => `<li><span class="type-dot"><i style="background:var(--crit)"></i></span><span>${esc(x)}</span></li>`).join('');
}
$('#view-seguimiento').addEventListener('click', e => { const b = e.target.closest('[data-toast]'); if (b) toast(b.dataset.toast); });

/* ============ 11. Agentes IA ============ */
const integStatus = e => e === 'Conectado' ? 'status-ok' : e === 'Activo' ? 'status-info' : 'status-plan';
function renderAgentes() {
  $('#integrationsGrid').innerHTML = D.integrations.map(i => `
    <div class="integration-card"><h4><span class="status-dot ${integStatus(i.estado)}"></span>${esc(i.name)}</h4>
      <p>${esc(i.desc)}</p><small>${esc(i.detalle)}</small>
      <div style="margin-top:8px;display:flex;justify-content:space-between;align-items:center"><span class="pill ${i.estado === 'Conectado' || i.estado === 'Activo' ? 'pill-ok' : 'pill-neutral'}">${esc(i.estado)}</span><button class="btn btn-sm btn-ghost" data-toast="Mockup · configurar ${esc(i.name)}">Configurar</button></div>
    </div>`).join('');
  $('#agentOpsTable tbody').innerHTML = D.agentOps.map(o => `<tr><td>${esc(o.op)}</td><td>${esc(o.mech)}</td><td class="mono" style="font-size:10px">${esc(o.permiso)}</td><td style="color:var(--ink-2)">${esc(o.ultimo)}</td></tr>`).join('');
  $('#agentRunsTable tbody').innerHTML = D.agentRuns.map(r => `<tr><td>${esc(r.agente)}</td><td style="max-width:220px;white-space:normal">${esc(r.op)}</td><td class="mono">${esc(r.resultado)}</td><td>${r.actor === 'IA' ? '<span class="actor-ia" style="margin:0">IA</span>' : '<span class="actor-human" style="margin:0">HUMANO</span>'}</td><td class="mono" style="font-size:10px">${esc(r.fecha)}</td></tr>`).join('');
}
$('#view-agentes').addEventListener('click', e => { const b = e.target.closest('[data-toast]'); if (b) toast(b.dataset.toast); });

/* ============ 12. Configuración ============ */
function renderConfig() {
  $('#membersList').innerHTML = D.members.map(m => `
    <div class="member-row"><span class="member-avatar" style="background:${esc(m.color)}">${esc(m.iniciales)}</span>
      <span><strong>${esc(m.nombre)}</strong><br><span class="m-mail">${esc(m.email)}</span></span>
      <select aria-label="Rol de ${esc(m.nombre)}" data-role-select>${['Administrador de producto', 'Colaborador', 'Consulta'].map(r => `<option ${r === m.rol ? 'selected' : ''}>${r}</option>`).join('')}${m.rol === 'Administrador global' ? '<option selected>Administrador global</option>' : ''}</select>
    </div>`).join('');
  $('#rolesTable').innerHTML = D.roles.map(r => `<tr><td><strong>${esc(r.rol)}</strong></td><td>${esc(r.alcance)}</td><td style="max-width:280px;white-space:normal">${esc(r.permisos)}</td></tr>`).join('');
  $('#nodeTypesList').innerHTML = D.nodeTypes.map(t => `
    <div class="member-row"><span class="type-dot"><i style="background:${esc(t.color)};width:12px;height:12px"></i><strong>${esc(t.label)}</strong></span>
      <span class="mono" style="color:var(--ink-3);font-size:10px">${esc(t.count)} nodos · code: ${esc(t.id)}</span>
      <button class="btn btn-sm btn-ghost" style="margin-left:auto" data-toast="Mockup · editar tipo ${esc(t.label)}">Editar</button>
    </div>`).join('');
  $('#stateFlow').innerHTML = D.taskStates.map((s, i) => `${i ? '<span class="state-arrow">→</span>' : ''}<span class="state-chip">${esc(s)}</span>`).join('');
  $('#integrationToggles').innerHTML = D.integrations.map((i, idx) => `
    <div class="member-row"><div style="min-width:0"><strong>${esc(i.name)}</strong><br><span class="m-mail">${esc(i.desc)}</span></div>
      <button class="toggle ${i.estado === 'Conectado' || i.estado === 'Activo' ? 'on' : ''}" role="switch" aria-checked="${i.estado === 'Conectado' || i.estado === 'Activo'}" aria-label="Activar ${esc(i.name)}" data-toggle-idx="${idx}"></button>
    </div>`).join('');
}
$('#membersList').addEventListener('change', e => { if (e.target.matches('[data-role-select]')) toast('Mockup · rol actualizado (se registraría en activity_log)'); });
$('#integrationToggles').addEventListener('click', e => { const t = e.target.closest('[data-toggle-idx]'); if (!t) return; t.classList.toggle('on'); t.setAttribute('aria-checked', String(t.classList.contains('on'))); toast('Mockup · integración ' + (t.classList.contains('on') ? 'activada' : 'desactivada')); });
$('#view-config').addEventListener('click', e => { const b = e.target.closest('[data-toast]'); if (b) toast(b.dataset.toast); });

/* ============ 13. Botones mock y notificaciones ============ */
[['exportProductsBtn', 'resumen de productos (CSV)'], ['newProductBtn', 'alta de producto'], ['newNodeBtn', 'creación de nodo'],
 ['duplicateNodeBtn', 'duplicar estructura del nodo'], ['moveNodeBtn', 'mover nodo de rama'], ['editNodeBtn', 'edición de nodo'],
 ['nodeHistoryBtn', 'historial completo'], ['attachDocBtn', 'adjuntar documento'], ['attachTaskBtn', 'crear tarea vinculada'],
 ['reportIncidentBtn', 'reportar incidencia'], ['newDocBtn', 'nuevo documento'], ['docVersionsBtn', 'historial de versiones'],
 ['docEditBtn', 'editor Markdown'], ['exportDocsBtn', 'exportar documentos a .md'], ['newTaskBtn', 'nueva tarea'],
 ['newIncidentBtn', 'reportar incidencia'], ['newChangeBtn', 'registrar modificación'], ['mcpStatusBtn', 'estado del servidor MCP'],
 ['auditLogBtn', 'auditoría completa'], ['inviteMemberBtn', 'invitar integrante'], ['productDoclinkBtn', 'documentación global'],
 ['globalDocsBtn', 'documentación global'], ['deactivateNodeBtn', 'desactivar nodo (conserva historial)']
].forEach(([id, label]) => { const el = document.getElementById(id); if (el) el.addEventListener('click', mockAction(label)); });
$$('[data-goto-config]').forEach(b => b.addEventListener('click', () => switchView('config')));
$('#notifBtn').addEventListener('click', () => toast('3 avisos · INC-087 sigue crítica · TAR-240 bloqueada · agente registró 12 tests OK'));

/* ============ 14. Paleta de comandos (Ctrl K) ============ */
const paletteItems = [
  ...Object.keys(CRUMB).map(k => ({ label: 'Ir a · ' + CRUMB[k][1], hint: 'vista', action: () => switchView(k) })),
  ...flattenTree(D.trees.kanora || []).slice(0, 30).map(n => ({ label: `${n.id} · ${n.name}`, hint: 'nodo funcional', action: () => { document.body.dataset.context = 'product'; renderTree(); switchView('arbol'); selectNode(n.id); } })),
  ...D.docs.slice(0, 10).map(d => ({ label: `${d.id} · ${d.titulo}`, hint: 'documento', action: () => switchView('docs') })),
  ...D.tasks.slice(0, 10).map(t => ({ label: `${t.id} · ${t.titulo}`, hint: 'tarea', action: () => switchView('tareas') }))
];
const backdrop = $('#paletteBackdrop'), input = $('#paletteInput'), listEl = $('#paletteList');
let paletteIndex = 0, paletteMatches = paletteItems;
function renderPalette(filter = '') {
  const q = filter.trim().toLowerCase();
  paletteMatches = paletteItems.filter(i => !q || i.label.toLowerCase().includes(q)).slice(0, 12);
  paletteIndex = 0;
  listEl.innerHTML = paletteMatches.map((m, i) => `<button class="palette-item ${i === 0 ? 'active' : ''}" data-idx="${i}" role="option"><span>${esc(m.label)}</span><small>${esc(m.hint)}</small></button>`).join('') || '<div class="empty-state" style="margin:8px">Sin resultados</div>';
}
function openPalette() { backdrop.classList.add('open'); input.value = ''; renderPalette(''); input.focus(); }
function closePalette() { backdrop.classList.remove('open'); }
$('#openPalette').addEventListener('click', openPalette);
backdrop.addEventListener('click', e => { if (e.target === backdrop) closePalette(); });
listEl.addEventListener('click', e => { const b = e.target.closest('[data-idx]'); if (b) { paletteMatches[Number(b.dataset.idx)].action(); closePalette(); } });
input.addEventListener('input', () => renderPalette(input.value));
input.addEventListener('keydown', e => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault(); paletteIndex = (paletteIndex + (e.key === 'ArrowDown' ? 1 : paletteItems.length - 1)) % Math.max(paletteMatches.length, 1);
    $$('.palette-item', listEl).forEach((el, i) => el.classList.toggle('active', i === paletteIndex));
  } else if (e.key === 'Enter' && paletteMatches[paletteIndex]) { paletteMatches[paletteIndex].action(); closePalette(); }
});
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); backdrop.classList.contains('open') ? closePalette() : openPalette(); }
  else if (e.key === 'Escape') closePalette();
});

/* ============ 15. Leyenda de tipos de nodo ============ */
$('#nodeLegend').innerHTML = D.nodeTypes.map(t => `<span class="type-dot"><i style="background:${esc(t.color)}"></i>${esc(t.label)}</span>`).join('');
$('#nodeTypeFilter').innerHTML = '<option value="">Todos los tipos de nodo</option>' + D.nodeTypes.map(t => `<option value="${esc(t.id)}">${esc(t.label)}</option>`).join('');

/* ============ 16. Arranque ============ */
renderProductsTable();
renderProductContext();
renderTree();
selectNode('PANT-02');
renderTaskResponsables();
renderTasks();
setTaskView('table');
renderIncidents();
renderChanges();
renderTraceQueries();
renderSeguimiento();
renderAgentes();
renderConfig();
renderDocs();
switchView('resumen');
