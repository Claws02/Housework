import { Editor2D }         from './editor2d.js';
import { Viewer3D }          from './viewer3d.js';
import { FURNITURE_CATALOG, CATALOG_BY_TYPE } from './furniture.js';
import { WALL_FINISHES, FLOOR_FINISHES, ROOF_FINISHES } from './textures.js';
import { buildHouse191 }     from './house191.js';
import { sounds }            from './sounds.js';

const STORAGE_KEY = 'house-v1';
const LEGACY_KEY  = 'apt-v2';
const ACH_KEY     = 'apt-ach';
const BUDGET_MAX  = 75000;

const ROOM_COLORS  = ['#3b82f6','#22c55e','#f59e0b','#ec4899','#8b5cf6','#06b6d4','#84cc16','#f97316'];
const FURN_COLORS  = ['#f3f1ec','#d8d4cb','#c9c3b8','#7d8ea3','#2f4f8f','#24324a','#4f6a4f','#7a5233','#4a2e1a','#2b2b2e','#c3c7cc','#b52f3a'];
const PAINT_COLORS = ['#ecebe6','#e6e4dd','#d9dbdc','#c8cbcd','#5f6b7f','#dcc896','#ead9a2','#eadfc3','#bfe0e0','#c9d6c0','#e8c9c0','#5f7180'];
const FLOOR_COLORS = ['#c9a77c','#b08a5e','#8a6440','#e0c9a6','#8d8c88','#6f7377','#a39a8c','#a7a49e','#9c8f7e'];
const ROOF_COLORS  = ['#4d4b4a','#2f3133','#6b5a4a','#7a7f85','#7a3b2e','#3b4a3a'];

const kindOf = id => !id ? null : id[0] === 'r' ? 'room' : id[0] === 'w' ? 'wall' : id[0] === 'g' ? 'roof' : 'item';
const uid = p => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  floors: [], activeFloor: 0, site: { roofs: [] },
  view3d: { level: 'all', roof: true, ceilings: false, cutaway: false, walk: false },
  tool: 'select', pendingAdd: null, selectedId: null, mode: '2d',
};
// The 2D editor works on "the" rooms/walls/furniture — map them onto the active floor.
for (const k of ['rooms', 'walls', 'furniture'])
  Object.defineProperty(state, k, {
    get() { return state.floors[state.activeFloor]?.[k] ?? []; },
    set(v) { if (state.floors[state.activeFloor]) state.floors[state.activeFloor][k] = v; },
  });

function emptyHouse() {
  return {
    floors: [{ id: 'L1', name: '1st Floor', short: '1', elev: 0, height: 8, rooms: [], walls: [], furniture: [] }],
    activeFloor: 0, site: { roofs: [], ground: -0.5, groundFloor: 0, sidingColor: '#5f7180', trimColor: '#f7f6f2', lot: { x: -40, y: -40, w: 120, h: 120 } },
  };
}

function _data() { return { floors: state.floors, activeFloor: state.activeFloor, site: state.site }; }
function _apply(d) {
  state.floors = d.floors; state.activeFloor = Math.min(d.activeFloor ?? 0, d.floors.length - 1); state.site = d.site || { roofs: [] };
  state.site.roofs ||= [];
  state.selectedId = null;
}

let editor = null;
let viewer = null;
let _clipboard  = null;
let _nameDebounce = null;

// ── History ────────────────────────────────────────────────────────────────
const hist = { stack: [], cursor: -1 };

function _snapshot() {
  const snap = JSON.stringify(_data());
  if (hist.stack[hist.cursor] === snap) return;
  hist.stack = hist.stack.slice(0, hist.cursor + 1);
  hist.stack.push(snap);
  if (hist.stack.length > 60) hist.stack.shift();
  else hist.cursor++;
  _updateUndoButtons();
}

function _undo() {
  if (hist.cursor <= 0) { sounds.error(); return; }
  hist.cursor--;
  _restore(hist.stack[hist.cursor]);
  sounds.undo();
  _afterStateChange();
}

function _redo() {
  if (hist.cursor >= hist.stack.length - 1) { sounds.error(); return; }
  hist.cursor++;
  _restore(hist.stack[hist.cursor]);
  _afterStateChange();
}

function _restore(snap) { _apply(JSON.parse(snap)); }

function _afterStateChange() {
  editor?.render();
  if (viewer && state.mode === '3d') viewer.refresh();
  _buildFloorTabs();
  _updateBudget(); _updateUndoButtons(); _saveStorage();
  _refreshProps(); _updateHint();
}

function _updateUndoButtons() {
  const u = _qs('#btn-undo'), r = _qs('#btn-redo');
  if (u) u.disabled = hist.cursor <= 0;
  if (r) r.disabled = hist.cursor >= hist.stack.length - 1;
}

// ── Hint ───────────────────────────────────────────────────────────────────
function _updateHint() {
  const empty = !state.rooms.length && !state.walls.length && !state.furniture.length;
  _qs('#canvas-container')?.classList.toggle('is-empty', empty && state.mode === '2d');
}

// ── Budget ─────────────────────────────────────────────────────────────────
function _calcSpent() {
  let sum = 0;
  for (const f of state.floors) for (const it of f.furniture) sum += CATALOG_BY_TYPE[it.type]?.price ?? 0;
  return sum;
}

function _updateBudget() {
  const spent = _calcSpent();
  const pct   = Math.min(100, (spent / BUDGET_MAX) * 100);
  const left  = BUDGET_MAX - spent;
  const fill  = _qs('#budget-fill');
  const hud   = _qs('#budget-hud');
  if (!fill || !hud) return;
  _qs('#budget-spent').textContent     = `$${spent.toLocaleString()}`;
  _qs('#budget-remaining').textContent = left >= 0 ? `$${left.toLocaleString()} left` : `$${Math.abs(left).toLocaleString()} over!`;
  fill.style.width      = pct + '%';
  fill.style.background = pct < 65 ? '#4ade80' : pct < 88 ? '#fbbf24' : '#f87171';
  const wasOver = hud.classList.contains('over-budget');
  hud.classList.toggle('over-budget', left < 0);
  if (left < 0 && !wasOver) sounds.overBudget();
}

// ── Achievements ───────────────────────────────────────────────────────────
const ACHIEVEMENTS = {
  'first-room':      { icon:'🏠', title:'Blueprint Begins!',    sub:'You drew your first room' },
  'first-furn':      { icon:'🛋', title:'Moving In!',           sub:'First piece of furniture placed' },
  'five-furn':       { icon:'⭐', title:'Getting Cozy!',        sub:'You placed 5 pieces of furniture' },
  'three-rooms':     { icon:'🏘', title:'Floor Plan Pro!',      sub:'You designed 3 rooms' },
  'full-bedroom':    { icon:'😴', title:'Dream Bedroom!',       sub:'Bed + nightstand combo placed' },
  'living-room-set': { icon:'🎉', title:'Living Room Ready!',   sub:'Sofa + coffee table placed' },
};

function _checkAchievements() {
  let done = {};
  try { done = JSON.parse(localStorage.getItem(ACH_KEY) || '{}'); } catch (_) {}
  const types = new Set(state.furniture.map(f => f.type));
  const checks = [
    ['first-room',      state.rooms.length >= 1],
    ['first-furn',      state.furniture.length >= 1],
    ['five-furn',       state.furniture.length >= 5],
    ['three-rooms',     state.rooms.length >= 3],
    ['full-bedroom',    [...types].some(t => t.startsWith('bed-')) && [...types].some(t => t.startsWith('nightstand'))],
    ['living-room-set', [...types].some(t => t.startsWith('sofa')) && (types.has('coffee-table') || types.has('ottoman'))],
  ];
  for (const [key, cond] of checks) {
    if (!done[key] && cond) {
      done[key] = true;
      const ach = ACHIEVEMENTS[key];
      sounds.achievement();
      _toast(ach.icon, ach.title, ach.sub);
    }
  }
  try { localStorage.setItem(ACH_KEY, JSON.stringify(done)); } catch (_) {}
}

// ── Toast ──────────────────────────────────────────────────────────────────
function _toast(icon, title, sub = '') {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="toast-icon">${icon}</span><div><div class="toast-title">${title}</div>${sub ? `<div class="toast-sub">${sub}</div>` : ''}</div>`;
  _qs('#toast-wrap').appendChild(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.remove('in'); el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 3200);
}

// ── onUpdate ──────────────────────────────────────────────────────────────
function _onUpdate() {
  _snapshot(); _saveStorage(); _updateBudget(); _checkAchievements();
  if (viewer && state.mode === '3d') viewer.refresh();
  _refreshProps(); _updateHint();
}

/** Property edits: redraw both views and record history (debounced for typing). */
let _commitTimer = null;
function _commit(immediate = true) {
  editor?.render();
  if (viewer && state.mode === '3d') viewer.refresh();
  _saveStorage(); _updateBudget();
  clearTimeout(_commitTimer);
  if (immediate) _snapshot(); else _commitTimer = setTimeout(_snapshot, 500);
}

// ── Selection helpers ─────────────────────────────────────────────────────
function _selected() {
  const id = state.selectedId, k = kindOf(id);
  if (k === 'room') return state.rooms.find(r => r.id === id);
  if (k === 'wall') return state.walls.find(w => w.id === id);
  if (k === 'roof') return state.site.roofs.find(r => r.id === id);
  if (k === 'item') return state.furniture.find(f => f.id === id);
  return null;
}

function _onPick3D(hit) {
  if (!hit) { state.selectedId = null; }
  else {
    if (hit.floor >= 0 && hit.floor !== state.activeFloor) { state.activeFloor = hit.floor; _buildFloorTabs(); }
    state.selectedId = hit.id;
    sounds.select();
  }
  editor?.render(); viewer?.select(); _refreshProps();
}

// ── Properties panel ──────────────────────────────────────────────────────
const PANELS = ['#props-empty-state', '#props-room', '#props-wall', '#props-furn', '#props-roof'];
function _show(sel) { for (const p of PANELS) { const el = _qs(p); if (el) el.style.display = p === sel ? (p === '#props-empty-state' ? 'flex' : 'block') : 'none'; } }

function _fillSelect(sel, options, value) {
  const el = _qs(sel); if (!el) return;
  if (!el.options.length || el.dataset.filled !== String(Object.keys(options).length)) {
    el.innerHTML = Object.entries(options).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
    el.dataset.filled = String(Object.keys(options).length);
  }
  el.value = value;
}

function _refreshProps() {
  const obj = _selected(), k = kindOf(state.selectedId);
  document.body.classList.toggle('has-sel', !!obj);
  if (!obj) { _show('#props-empty-state'); return; }

  if (k === 'room') {
    _show('#props-room');
    _qs('#pp-room-name').value       = obj.name;
    _qs('#pp-room-w').value          = obj.width.toFixed(2);
    _qs('#pp-room-h').value          = obj.height.toFixed(2);
    _qs('#pp-room-off').value        = (obj.offset || 0).toFixed(2);
    _qs('#pp-room-area').textContent = `${(obj.width * obj.height).toFixed(1)} sq ft`;
    _qs('#pp-room-ceiling').checked  = obj.ceiling !== false;
    _qs('#pp-room-auto').checked     = obj.autoWalls !== false;
    _qs('#pp-room-outdoor').checked  = !!obj.outdoor;
    _fillSelect('#pp-room-floor', Object.fromEntries(Object.entries(FLOOR_FINISHES).map(([k, v]) => [k, v.label])), obj.floorMat || 'oak');
    _fillSelect('#pp-room-wallfin', Object.fromEntries(Object.entries(WALL_FINISHES).map(([k, v]) => [k, v.label])), obj.wallFinish || 'paint');
    _qs('#pp-room-wallcolor').value = obj.wallColor || '#ecebe6';
    _buildSwatches('#pp-room-colors', ROOM_COLORS, obj.color, c => { obj.color = c; _commit(); });
    _buildSwatches('#pp-room-floorcolors', FLOOR_COLORS, obj.floorColor || FLOOR_FINISHES[obj.floorMat || 'oak']?.color, c => { obj.floorColor = c; _commit(); });
    _buildSwatches('#pp-room-paint', PAINT_COLORS, obj.wallColor, c => { obj.wallColor = c; _qs('#pp-room-wallcolor').value = c; _commit(); });
  } else if (k === 'wall') {
    _show('#props-wall');
    const f = state.floors[state.activeFloor];
    _qs('#pp-wall-len').textContent = `${Math.hypot(obj.x2 - obj.x1, obj.y2 - obj.y1).toFixed(2)} ft`;
    _qs('#pp-wall-h').value     = obj.height ?? '';
    _qs('#pp-wall-h').placeholder = `${f.height} (floor)`;
    _qs('#pp-wall-t').value     = (obj.thick ?? 0.4).toFixed(2);
    _qs('#pp-wall-base').value  = (obj.base || 0).toFixed(2);
    _qs('#pp-wall-ext').checked = !!obj.ext;
    const opts = { '': 'Auto (from room)', ...Object.fromEntries(Object.entries(WALL_FINISHES).map(([k, v]) => [k, v.label])) };
    _fillSelect('#pp-wall-finA', opts, obj.finishA || '');
    _fillSelect('#pp-wall-finB', opts, obj.finishB || '');
    _qs('#pp-wall-colA').value = obj.colorA || '#ecebe6';
    _qs('#pp-wall-colB').value = obj.colorB || '#ecebe6';
  } else if (k === 'roof') {
    _show('#props-roof');
    _qs('#pp-roof-name').value = obj.name || 'Roof';
    _qs('#pp-roof-eave').value = obj.eave;
    _qs('#pp-roof-ridge').value = obj.ridge;
    _qs('#pp-roof-over').value = obj.overhang ?? 0.75;
    _fillSelect('#pp-roof-fin', Object.fromEntries(Object.entries(ROOF_FINISHES).map(([k, v]) => [k, v.label])), obj.finish || 'shingle');
    _buildSwatches('#pp-roof-colors', ROOF_COLORS, obj.color, c => { obj.color = c; _commit(); });
    _buildSwatches('#pp-site-siding', ['#5f7180', '#7d8b96', '#e9e6dc', '#c9b99a', '#7a8a6a', '#8a3b2e', '#f3f1ec', '#3b4652'], state.site.sidingColor, c => { state.site.sidingColor = c; _commit(); });
  } else {
    _show('#props-furn');
    const cat = CATALOG_BY_TYPE[obj.type];
    _qs('#pp-furn-icon').textContent  = cat?.icon ?? '📦';
    _qs('#pp-furn-type').textContent  = cat?.label ?? obj.type;
    _qs('#pp-furn-label').value       = obj.label;
    _qs('#pp-furn-w').value           = obj.width.toFixed(2);
    _qs('#pp-furn-d').value           = obj.depth.toFixed(2);
    _qs('#pp-furn-ht').value          = (obj.height ?? cat?.height3d ?? 2.5).toFixed(2);
    _qs('#pp-furn-lift').value        = (obj.lift ?? cat?.lift ?? 0).toFixed(2);
    const deg = Math.round(((obj.rotation * 180 / Math.PI) % 360 + 540) % 360 - 180);
    _qs('#pp-furn-rot').value         = deg;
    _qs('#pp-furn-rot-val').textContent = `${deg}°`;
    _qs('#pp-furn-price').textContent = cat?.price ? `$${cat.price.toLocaleString()}` : 'included';
    _qs('#pp-furn-color').value = obj.color || cat?.color || '#888888';
    _qs('#pp-furn-color2').value = obj.color2 || cat?.color2 || '#888888';
    _qs('#pp-furn-open-row').style.display = cat?.model === 'door' ? '' : 'none';
    _qs('#pp-furn-open').value = obj.open ?? cat?.defaults?.open ?? 0;
    _qs('#pp-furn-open-val').textContent = `${_qs('#pp-furn-open').value}°`;
    _qs('#pp-furn-pattern-row').style.display = cat?.model === 'bed' ? '' : 'none';
    _fillSelect('#pp-furn-pattern', { solid: 'Solid', stripes: 'Stripes', floral: 'Floral', wood: 'Solid + wood frame' }, obj.pattern || 'solid');
    _buildSwatches('#pp-furn-colors', FURN_COLORS, obj.color, c => { obj.color = c; _qs('#pp-furn-color').value = c; _commit(); });
  }
}

function _buildSwatches(sel, colors, current, onChange) {
  const el = _qs(sel);
  if (!el) return;
  el.innerHTML = '';
  for (const c of colors) {
    const sw = document.createElement('div');
    sw.className = 'pp-swatch' + (c === current ? ' active' : '');
    sw.style.background = c;
    sw.addEventListener('click', () => {
      el.querySelectorAll('.pp-swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      onChange(c);
    });
    el.appendChild(sw);
  }
}

function _bindNum(sel, apply, min = -Infinity) {
  _qs(sel)?.addEventListener('change', e => {
    const o = _selected(); const v = parseFloat(e.target.value);
    if (o && (!isNaN(v) && v >= min || e.target.value === '')) { apply(o, e.target.value === '' ? null : v); _onUpdate(); } else _refreshProps();
  });
}

function _bindPropsPanel() {
  // Room
  _qs('#pp-room-name')?.addEventListener('input', e => {
    const r = _selected();
    if (r) { r.name = e.target.value; editor?.render(); clearTimeout(_nameDebounce); _nameDebounce = setTimeout(_snapshot, 600); }
  });
  _bindNum('#pp-room-w', (r, v) => { r.width = v; }, 1);
  _bindNum('#pp-room-h', (r, v) => { r.height = v; }, 1);
  _bindNum('#pp-room-off', (r, v) => { r.offset = v || 0; });
  _qs('#pp-room-floor')?.addEventListener('change', e => { const r = _selected(); if (r) { r.floorMat = e.target.value; delete r.floorColor; _commit(); _refreshProps(); } });
  _qs('#pp-room-wallfin')?.addEventListener('change', e => { const r = _selected(); if (r) { r.wallFinish = e.target.value; _commit(); } });
  _qs('#pp-room-wallcolor')?.addEventListener('input', e => { const r = _selected(); if (r) { r.wallColor = e.target.value; _commit(false); } });
  for (const [id, key, inv] of [['#pp-room-ceiling', 'ceiling'], ['#pp-room-auto', 'autoWalls'], ['#pp-room-outdoor', 'outdoor']])
    _qs(id)?.addEventListener('change', e => { const r = _selected(); if (r) { r[key] = e.target.checked; _commit(); } });
  _qs('#pp-room-delete')?.addEventListener('click', () => { _deleteSelected(); });

  // Wall
  _bindNum('#pp-wall-h', (w, v) => { if (v === null) delete w.height; else w.height = v; }, 0.5);
  _bindNum('#pp-wall-t', (w, v) => { w.thick = v; }, 0.1);
  _bindNum('#pp-wall-base', (w, v) => { w.base = v || 0; });
  _qs('#pp-wall-ext')?.addEventListener('change', e => { const w = _selected(); if (w) { w.ext = e.target.checked; _commit(); } });
  for (const s of ['A', 'B']) {
    _qs(`#pp-wall-fin${s}`)?.addEventListener('change', e => {
      const w = _selected(); if (!w) return;
      if (e.target.value) { w[`finish${s}`] = e.target.value; w[`color${s}`] ||= _qs(`#pp-wall-col${s}`).value; }
      else { delete w[`finish${s}`]; delete w[`color${s}`]; }
      _commit();
    });
    _qs(`#pp-wall-col${s}`)?.addEventListener('input', e => {
      const w = _selected(); if (!w) return;
      w[`color${s}`] = e.target.value;
      if (!w[`finish${s}`]) { w[`finish${s}`] = 'paint'; _qs(`#pp-wall-fin${s}`).value = 'paint'; }
      _commit(false);
    });
  }
  _qs('#pp-wall-flip')?.addEventListener('click', () => {
    const w = _selected(); if (!w) return;
    [w.x1, w.y1, w.x2, w.y2] = [w.x2, w.y2, w.x1, w.y1];
    [w.finishA, w.finishB, w.colorA, w.colorB] = [w.finishB, w.finishA, w.colorB, w.colorA];
    for (const k of ['finishA', 'finishB', 'colorA', 'colorB']) if (w[k] === undefined) delete w[k];
    _onUpdate();
  });
  _qs('#pp-wall-split')?.addEventListener('click', () => {
    const w = _selected(); if (!w) return;
    const mx = Math.round((w.x1 + w.x2) * 2) / 4, my = Math.round((w.y1 + w.y2) * 2) / 4;
    const b = { ...w, id: uid('w'), x1: mx, y1: my };
    w.x2 = mx; w.y2 = my;
    state.walls.push(b);
    _toast('✂', 'Wall split in two'); _onUpdate();
  });
  _qs('#pp-wall-delete')?.addEventListener('click', _deleteSelected);

  // Roof
  _qs('#pp-roof-name')?.addEventListener('input', e => { const r = _selected(); if (r) { r.name = e.target.value; _commit(false); } });
  _bindNum('#pp-roof-eave', (r, v) => { r.eave = v; });
  _bindNum('#pp-roof-ridge', (r, v) => { r.ridge = Math.max(v, r.eave + 0.5); });
  _bindNum('#pp-roof-over', (r, v) => { r.overhang = v; }, 0);
  _qs('#pp-roof-fin')?.addEventListener('change', e => { const r = _selected(); if (r) { r.finish = e.target.value; _commit(); } });
  _qs('#pp-roof-delete')?.addEventListener('click', _deleteSelected);

  // Furniture
  _qs('#pp-furn-label')?.addEventListener('input', e => {
    const f = _selected();
    if (f) { f.label = e.target.value; editor?.render(); clearTimeout(_nameDebounce); _nameDebounce = setTimeout(_snapshot, 600); }
  });
  _bindNum('#pp-furn-w', (f, v) => { f.width = v; }, 0.1);
  _bindNum('#pp-furn-d', (f, v) => { f.depth = v; }, 0.05);
  _bindNum('#pp-furn-ht', (f, v) => { f.height = v; }, 0.02);
  _bindNum('#pp-furn-lift', (f, v) => { f.lift = v ?? 0; });
  _qs('#pp-furn-rot')?.addEventListener('input', e => {
    const f = _selected();
    if (f) {
      f.rotation = parseInt(e.target.value) * Math.PI / 180;
      _qs('#pp-furn-rot-val').textContent = `${e.target.value}°`;
      editor?.render();
    }
  });
  _qs('#pp-furn-rot')?.addEventListener('change', () => _commit());
  _qs('#pp-furn-open')?.addEventListener('input', e => {
    const f = _selected(); if (!f) return;
    f.open = parseInt(e.target.value); _qs('#pp-furn-open-val').textContent = `${f.open}°`;
  });
  _qs('#pp-furn-open')?.addEventListener('change', () => _commit());
  _qs('#pp-furn-pattern')?.addEventListener('change', e => { const f = _selected(); if (f) { f.pattern = e.target.value; _commit(); } });
  _qs('#pp-furn-color')?.addEventListener('input', e => { const f = _selected(); if (f) { f.color = e.target.value; _commit(false); } });
  _qs('#pp-furn-color2')?.addEventListener('input', e => { const f = _selected(); if (f) { f.color2 = e.target.value; _commit(false); } });
  _qs('#pp-furn-dup')?.addEventListener('click', () => { if (kindOf(state.selectedId) === 'item') _duplicateFurniture(state.selectedId); });
  _qs('#pp-furn-delete')?.addEventListener('click', _deleteSelected);
}

function _deleteSelected() {
  const id = state.selectedId, k = kindOf(id);
  if (!k) return;
  if (k === 'room') state.rooms = state.rooms.filter(r => r.id !== id);
  else if (k === 'wall') state.walls = state.walls.filter(w => w.id !== id);
  else if (k === 'roof') state.site.roofs = state.site.roofs.filter(r => r.id !== id);
  else state.furniture = state.furniture.filter(f => f.id !== id);
  state.selectedId = null;
  sounds.remove(); editor?.render(); _onUpdate();
}

function _duplicateFurniture(id) {
  const orig = state.furniture.find(f => f.id === id);
  if (!orig) return;
  const newId = uid('f');
  state.furniture.push({ ...orig, id: newId, x: orig.x + 1.5, y: orig.y + 1.5 });
  state.selectedId = newId;
  editor?.animatePlacement(newId);
  sounds.place(); _onUpdate();
}

function _rotateSelected(deg) {
  const f = kindOf(state.selectedId) === 'item' && _selected();
  if (!f) return;
  f.rotation += deg * Math.PI / 180;
  _commit(); _refreshProps();
}

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  _loadStorage();
  _buildPalette();
  _buildFloorTabs();
  _bindUI();
  _bindPropsPanel();
  _bind3DBar();
  _initEditor();
  _updateToolUI();
  _updateBudget();
  _refreshProps();
  _updateHint();
  _snapshot();
  _updateUndoButtons();
  requestAnimationFrame(() => editor?.zoomToFit());
  if (new URLSearchParams(location.search).get('view') === '3d') _setMode('3d');
  // handy from the browser console: __house.state, __house.editor(), __house.viewer()
  window.__house = { state, editor: () => editor, viewer: () => viewer };
});

function _qs(sel) { return document.querySelector(sel); }
function _on(id, ev, fn) { _qs(`#${id}`)?.addEventListener(ev, fn); }

// ── Editor init ────────────────────────────────────────────────────────────
function _initEditor() {
  editor = new Editor2D(_qs('#canvas-2d'), state, {
    onUpdate:     _onUpdate,
    onToolChange: t => _setTool(t),
    onZoom:       z => { _qs('#zoom-label').textContent = `${z} px/ft`; },
    onPlace:      id  => { sounds.place(); editor.animatePlacement(id); },
    onRoom:       ()  => sounds.room(),
    onWall:       ()  => sounds.wall(),
    onSelect:     ()  => { sounds.select(); _refreshProps(); },
    onRemove:     ()  => sounds.remove(),
  });
}

// ── Floors ─────────────────────────────────────────────────────────────────
function _buildFloorTabs() {
  const el = _qs('#floor-tabs'); if (!el) return;
  el.innerHTML = '';
  state.floors.forEach((f, i) => {
    const b = document.createElement('button');
    b.innerHTML = `<span class="ft-long">${f.name}</span><span class="ft-short">${f.short || i + 1}</span>`; b.title = `${f.name} · elevation ${f.elev}′ · ${f.height}′ ceilings`;
    b.className = i === state.activeFloor ? 'active' : '';
    b.addEventListener('click', () => {
      state.activeFloor = i; state.selectedId = null;
      _buildFloorTabs(); editor?.render(); _refreshProps(); _updateHint();
      if (viewer) { viewer.select(); }
      _saveStorage();
    });
    el.appendChild(b);
  });
  const add = document.createElement('button');
  add.textContent = '+'; add.title = 'Add a floor above';
  add.addEventListener('click', () => {
    const top = state.floors.reduce((a, f) => f.elev > a.elev ? f : a, state.floors[0]);
    const n = state.floors.length + 1;
    state.floors.push({ id: uid('L'), name: `Floor ${n}`, short: String(n), elev: top.elev + top.height + 1, height: 8, rooms: [], walls: [], furniture: [] });
    state.floors.sort((a, b) => a.elev - b.elev);
    state.activeFloor = state.floors.length - 1;
    _buildFloorTabs(); _build3DLevels(); _onUpdate(); editor?.render();
  });
  el.appendChild(add);
  _build3DLevels();
}

function _build3DLevels() {
  const el = _qs('#v3-levels'); if (!el) return;
  el.innerHTML = '';
  const opts = [['all', 'All'], ...state.floors.map((f, i) => [i, f.short || f.name])];
  for (const [v, label] of opts) {
    const b = document.createElement('button');
    b.textContent = label;
    b.className = String(state.view3d.level) === String(v) ? 'active' : '';
    b.title = v === 'all' ? 'Show the whole house' : `Show up to ${state.floors[v].name} (cut away above)`;
    b.addEventListener('click', () => {
      state.view3d.level = v === 'all' ? 'all' : Number(v);
      if (v !== 'all') { state.activeFloor = Number(v); _buildFloorTabs(); }
      _build3DLevels(); viewer?.refresh();
    });
    el.appendChild(b);
  }
}

function _bind3DBar() {
  for (const k of ['roof', 'ceilings', 'cutaway']) {
    _on(`v3-${k}`, 'click', () => {
      state.view3d[k] = !state.view3d[k];
      _qs(`#v3-${k}`).classList.toggle('active', state.view3d[k]);
      viewer?.refresh();
    });
    _qs(`#v3-${k}`)?.classList.toggle('active', state.view3d[k]);
  }
  _on('v3-walk', 'click', () => _setWalk(true));
  _on('v3-home', 'click', () => viewer?.focusOnLayout());
}

/** Walk-through: drive a little character around with a joystick (touch) or WASD. */
function _setWalk(on) {
  if (!viewer || state.view3d.walk === on) return;
  state.view3d.walk = on;
  state.selectedId = null; _refreshProps(); editor?.render();
  document.body.classList.toggle('walking', on);
  _qs('#walk-ui').style.display = on ? 'block' : 'none';
  viewer.setWalk(on, _qs('#walk-ui'), { onExit: () => _setWalk(false) });
  _qs('#status-text').textContent = on
    ? 'Walk: left thumb = joystick (push far to run) · swipe anywhere else to look · WASD + drag on desktop · V camera · Esc exit'
    : '3D: drag to orbit · right-drag / two fingers to pan · tap to select · drag a selected item to move it · , . rotate · Del removes';
  if (on) _toast('🧍', 'Walk-through', window.matchMedia('(pointer: coarse)').matches ? 'Left thumb moves · swipe to look around' : 'WASD to move · drag to look · Shift runs · V switches camera');
}

// ── UI binding ─────────────────────────────────────────────────────────────
function _bindUI() {
  _on('btn-mode-2d', 'click', () => _setMode('2d'));
  _on('btn-mode-3d', 'click', () => _setMode('3d'));
  _on('btn-room',   'click', () => _setTool('room'));
  _on('btn-wall',   'click', () => _setTool('wall'));
  _on('btn-select', 'click', () => _setTool('select'));
  _on('btn-eraser', 'click', () => _setTool('eraser'));
  _on('btn-undo',   'click', _undo);
  _on('btn-redo',   'click', _redo);
  _on('btn-save',   'click', _saveFile);
  _on('btn-load',   'click', () => _qs('#file-input').click());
  _on('btn-clear',  'click', _clearAll);
  _on('btn-preset', 'click', _loadPreset);
  _on('btn-export', 'click', _exportPNG);
  _on('btn-sound',  'click', () => {
    const m = sounds.toggleMute();
    _qs('#btn-sound').textContent = m ? '🔇' : '🔊';
  });
  _on('pp-close', 'click', () => { state.selectedId = null; editor?.render(); viewer?.select(); _refreshProps(); });
  _on('btn-zoom-in',  'click', () => editor?.zoomBy(1.25));
  _on('btn-zoom-out', 'click', () => editor?.zoomBy(1/1.25));
  _on('btn-zoom-fit', 'click', () => editor?.zoomToFit());

  _qs('#file-input')?.addEventListener('change', _loadFile);
  _qs('#palette-search')?.addEventListener('input', e => _filterPalette(e.target.value));
  _on('btn-sidebar-toggle', 'click', _toggleSidebar);

  document.addEventListener('keydown', e => {
    if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key === 'z') { e.preventDefault(); _undo(); }
    if (ctrl && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); _redo(); }
    if (ctrl && e.key === 's') { e.preventDefault(); _saveStorage(); _toast('💾', 'Saved!'); }
    if (ctrl && e.key === 'c' && kindOf(state.selectedId) === 'item') _clipboard = { ...state.furniture.find(f => f.id === state.selectedId) };
    if (ctrl && e.key === 'v' && _clipboard) {
      const newId = uid('f');
      state.furniture.push({ ..._clipboard, id: newId, x: _clipboard.x + 1.5, y: _clipboard.y + 1.5 });
      state.selectedId = newId;
      editor?.animatePlacement(newId);
      sounds.place(); _onUpdate();
    }
    if (ctrl && e.key === 'd' && kindOf(state.selectedId) === 'item') { e.preventDefault(); _duplicateFurniture(state.selectedId); }
    if (!ctrl && (e.key === ',' || e.key === '<')) _rotateSelected(-15);
    if (!ctrl && (e.key === '.' || e.key === '>')) _rotateSelected(15);
    if (state.mode === '3d' && (e.key === 'Delete' || e.key === 'Backspace')) viewer?.refresh();
  });
}

// ── Mode ───────────────────────────────────────────────────────────────────
function _setMode(mode) {
  if (mode !== '3d' && state.view3d.walk) _setWalk(false);
  state.mode = mode;
  _qs('#btn-mode-2d').classList.toggle('active', mode === '2d');
  _qs('#btn-mode-3d').classList.toggle('active', mode === '3d');
  _qs('#canvas-2d').style.display     = mode === '2d' ? 'block' : 'none';
  _qs('#view-3d').style.display       = mode === '3d' ? 'block' : 'none';
  _qs('#view3d-bar').style.display    = mode === '3d' ? 'flex' : 'none';
  _qs('#tools-2d').style.display      = mode === '2d' ? 'flex'  : 'none';
  _qs('#zoom-controls').style.display = mode === '2d' ? 'flex' : 'none';
  _qs('#status-text').textContent = mode === '3d'
    ? '3D: drag to orbit · right-drag / two fingers to pan · tap to select · drag a selected item to move it · , . rotate · Del removes'
    : '';
  if (mode === '2d') _updateToolUI();
  _updateHint();
  if (mode === '3d') {
    if (!viewer) {
      viewer = new Viewer3D(_qs('#view-3d'), state, { onSelect: _onPick3D, onUpdate: _onUpdate });
      viewer.focusOnLayout();
    } else viewer.refresh();
  } else editor?.render();
}

// ── Tool ───────────────────────────────────────────────────────────────────
function _setTool(tool) {
  state.tool = tool;
  state.pendingAdd = null;
  document.querySelectorAll('.pal-item').forEach(el => el.classList.remove('active'));
  _updateToolUI();
  _refreshProps();
}

function _updateToolUI() {
  for (const t of ['room','wall','select','eraser'])
    _qs(`#btn-${t}`)?.classList.toggle('active', state.tool === t);
  const msgs = {
    room:   'Draw Room: drag on the canvas to create a room',
    wall:   'Wall: click to place first point, click again to extend · Esc to stop',
    select: 'Select: tap items, walls or rooms · drag to move · yellow handle rotates · , . rotate 15° · drag wall ends to reshape',
    eraser: 'Erase: tap any wall, room, or furniture to remove it',
    add:    'Tap the floor plan to place · doors & windows snap to walls · Esc to cancel',
  };
  if (state.mode === '2d') _qs('#status-text').textContent = msgs[state.tool] || '';
}

// ── Palette ────────────────────────────────────────────────────────────────
function _buildPalette() {
  const container = _qs('#furniture-palette');
  const cats = [...new Set(FURNITURE_CATALOG.map(f => f.category))];
  let collapsed = {};
  try { collapsed = JSON.parse(localStorage.getItem('house-pal') || '{}'); } catch (_) {}
  cats.forEach(cat => {
    const sec = document.createElement('div');
    sec.className = 'pal-cat' + (collapsed[cat] ? ' collapsed' : ''); sec.dataset.cat = cat;
    const hdr = document.createElement('div');
    const items = FURNITURE_CATALOG.filter(f => f.category === cat);
    hdr.className = 'pal-cat-hdr'; hdr.innerHTML = `<span>${cat}</span><span class="pal-count">${items.length}</span>`;
    hdr.addEventListener('click', () => {
      sec.classList.toggle('collapsed');
      collapsed[cat] = sec.classList.contains('collapsed');
      try { localStorage.setItem('house-pal', JSON.stringify(collapsed)); } catch (_) {}
    });
    sec.appendChild(hdr);
    items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'pal-item'; el.dataset.type = item.type;
      el.innerHTML = `
        <div class="pal-swatch" style="background:${item.color}"><span>${item.icon}</span></div>
        <div class="pal-info">
          <div class="pal-name">${item.label}</div>
          <div class="pal-dims">${item.width} × ${item.depth} × ${item.height3d} ft</div>
        </div>
        <div class="pal-price">${item.price > 0 ? '$'+item.price.toLocaleString() : ''}</div>`;
      el.addEventListener('click', () => _pickFurniture(item.type, el));
      sec.appendChild(el);
    });
    container.appendChild(sec);
  });
}

function _pickFurniture(type, el) {
  if (state.mode === '3d') _setMode('2d');
  state.tool = 'add'; state.pendingAdd = type; state.selectedId = null;
  document.querySelectorAll('.pal-item').forEach(e => e.classList.remove('active'));
  el.classList.add('active');
  _updateToolUI(); sounds.select(); _refreshProps();
  if (window.innerWidth <= 520) _qs('#sidebar').classList.remove('open');
}

function _filterPalette(q) {
  q = q.toLowerCase();
  document.querySelectorAll('.pal-item').forEach(el => {
    el.style.display = !q || el.querySelector('.pal-name').textContent.toLowerCase().includes(q) ? '' : 'none';
  });
  document.querySelectorAll('.pal-cat').forEach(sec => {
    sec.classList.toggle('searching', !!q);
    sec.style.display = [...sec.querySelectorAll('.pal-item')].some(el => el.style.display !== 'none') ? '' : 'none';
  });
}

function _toggleSidebar() {
  const sb = _qs('#sidebar');
  if (window.innerWidth <= 520) sb.classList.toggle('open');
  else sb.classList.toggle('collapsed');
}

// ── Persistence ────────────────────────────────────────────────────────────
function _saveStorage() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_data())); } catch (_) {}
}
function _fromAny(d) {
  if (d?.floors?.length) return d;
  // legacy single-floor apartment layout
  const h = emptyHouse();
  h.floors[0].rooms = d?.rooms || []; h.floors[0].walls = d?.walls || []; h.floors[0].furniture = d?.furniture || [];
  return h;
}
function _loadStorage() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (_) {}
  if (!d) {
    let legacy = null;
    try { legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null'); } catch (_) {}
    d = legacy && (legacy.rooms?.length || legacy.walls?.length || legacy.furniture?.length) ? _fromAny(legacy) : buildHouse191();
  }
  _apply(_fromAny(d));
}
function _loadPreset() {
  if (!confirm('Load the 191 Webster St model? Your current design will be replaced (you can undo).')) return;
  _apply(buildHouse191());
  _afterStateChange(); _snapshot();
  editor?.zoomToFit(); viewer?.focusOnLayout();
  _toast('🏡', '191 Webster St loaded', 'Basement, 1st & 2nd floors, garage, decks and yard');
}
function _saveFile() {
  const blob = new Blob([JSON.stringify(_data(), null, 2)], { type:'application/json' });
  const url  = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href:url, download:`house-${new Date().toISOString().slice(0,10)}.json` }).click();
  URL.revokeObjectURL(url);
  _toast('💾', 'Saved to file!');
}
function _loadFile(e) {
  const file = e.target.files[0]; if (!file) return;
  const fr = new FileReader();
  fr.onload = ev => {
    try {
      _apply(_fromAny(JSON.parse(ev.target.result)));
      _afterStateChange(); _snapshot(); editor?.zoomToFit();
      _toast('📂','Layout loaded!');
    } catch(_){ _toast('❌','Could not load file'); }
  };
  fr.readAsText(file);
  e.target.value = '';
}
function _clearAll() {
  if (!confirm('Clear everything and start from an empty lot?')) return;
  _apply(emptyHouse());
  hist.stack=[]; hist.cursor=-1;
  _afterStateChange(); _snapshot();
  _toast('🗑', 'Canvas cleared');
}
function _exportPNG() {
  const name = `${state.mode === '3d' ? 'house-3d' : 'floor-plan'}-${new Date().toISOString().slice(0,10)}.png`;
  if (state.mode === '3d' && viewer) {
    Object.assign(document.createElement('a'), { href: viewer.snapshotPNG(), download: name }).click();
    return;
  }
  _qs('#canvas-2d').toBlob(blob => {
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href:url, download:name }).click();
    URL.revokeObjectURL(url);
  });
}
