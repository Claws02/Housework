import { Editor2D }         from './editor2d.js';
import { Viewer3D }          from './viewer3d.js';
import { FURNITURE_CATALOG } from './furniture.js';
import { sounds }            from './sounds.js';

const STORAGE_KEY = 'apt-v2';
const ACH_KEY     = 'apt-ach';
const BUDGET_MAX  = 10000;

const ROOM_COLORS = ['#3b82f6','#22c55e','#f59e0b','#ec4899','#8b5cf6','#06b6d4','#84cc16','#f97316'];
const FURN_COLORS = ['#7B6E5D','#5B7A9A','#A08060','#4A6A8A','#8B7355','#6A8BAA','#3A7A3A','#888888','#C8B8A0','#1A1A1A'];

// ── State ──────────────────────────────────────────────────────────────────
const state = {
  rooms: [], walls: [], furniture: [],
  tool: 'room', pendingAdd: null, selectedId: null, mode: '2d',
};

let editor = null;
let viewer = null;
let _clipboard  = null;
let _nameDebounce = null;

// ── History ────────────────────────────────────────────────────────────────
const hist = { stack: [], cursor: -1 };

function _snapshot() {
  const snap = JSON.stringify({ rooms: state.rooms, walls: state.walls, furniture: state.furniture });
  hist.stack = hist.stack.slice(0, hist.cursor + 1);
  hist.stack.push(snap);
  if (hist.stack.length > 60) hist.stack.shift();
  else hist.cursor++;
  _updateUndoButtons();
}

function _undo() {
  if (hist.cursor <= 0) { sounds.error(); return; }
  hist.stack[hist.cursor] = JSON.stringify({ rooms: state.rooms, walls: state.walls, furniture: state.furniture });
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

function _restore(snap) {
  const d = JSON.parse(snap);
  state.rooms = d.rooms; state.walls = d.walls; state.furniture = d.furniture;
  state.selectedId = null;
}

function _afterStateChange() {
  editor?.render();
  if (viewer && state.mode === '3d') viewer.refresh();
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
  return state.furniture.reduce((sum, f) => {
    const cat = FURNITURE_CATALOG.find(c => c.type === f.type);
    return sum + (cat?.price ?? 0);
  }, 0);
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
  hud.classList.toggle('over-budget', left < 0);
  if (left < 0) sounds.overBudget();
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
  const done  = JSON.parse(localStorage.getItem(ACH_KEY) || '{}');
  const types = new Set(state.furniture.map(f => f.type));
  const checks = [
    ['first-room',      state.rooms.length >= 1],
    ['first-furn',      state.furniture.length >= 1],
    ['five-furn',       state.furniture.length >= 5],
    ['three-rooms',     state.rooms.length >= 3],
    ['full-bedroom',    (types.has('bed-queen')||types.has('bed-king')||types.has('bed-full')||types.has('bed-twin')) && types.has('nightstand')],
    ['living-room-set', (types.has('sofa-2')||types.has('sofa-3')||types.has('sofa-l')) && types.has('coffee-table')],
  ];
  for (const [key, cond] of checks) {
    if (!done[key] && cond) {
      done[key] = true;
      const ach = ACHIEVEMENTS[key];
      sounds.achievement();
      _toast(ach.icon, ach.title, ach.sub);
    }
  }
  localStorage.setItem(ACH_KEY, JSON.stringify(done));
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

// ── Properties panel ──────────────────────────────────────────────────────
function _refreshProps() {
  const empty = _qs('#props-empty-state');
  const roomP = _qs('#props-room');
  const furnP = _qs('#props-furn');
  if (!empty) return;

  if (!state.selectedId) {
    empty.style.display = 'flex'; roomP.style.display = 'none'; furnP.style.display = 'none'; return;
  }

  const isRoom = state.selectedId[0] === 'r';
  if (isRoom) {
    const room = state.rooms.find(r => r.id === state.selectedId);
    if (!room) { empty.style.display='flex'; roomP.style.display='none'; furnP.style.display='none'; return; }
    empty.style.display = 'none'; roomP.style.display = 'block'; furnP.style.display = 'none';
    _qs('#pp-room-name').value       = room.name;
    _qs('#pp-room-w').value          = room.width.toFixed(1);
    _qs('#pp-room-h').value          = room.height.toFixed(1);
    _qs('#pp-room-area').textContent = `${(room.width * room.height).toFixed(1)} sq ft`;
    _buildSwatches('#pp-room-colors', ROOM_COLORS, room.color, c => {
      room.color = c; editor?.render(); _saveStorage();
    });
  } else {
    const item = state.furniture.find(f => f.id === state.selectedId);
    if (!item) { empty.style.display='flex'; roomP.style.display='none'; furnP.style.display='none'; return; }
    const cat = FURNITURE_CATALOG.find(c => c.type === item.type);
    empty.style.display = 'none'; roomP.style.display = 'none'; furnP.style.display = 'block';
    _qs('#pp-furn-icon').textContent  = cat?.icon ?? '📦';
    _qs('#pp-furn-type').textContent  = cat?.label ?? item.type;
    _qs('#pp-furn-label').value       = item.label;
    _qs('#pp-furn-w').value           = item.width.toFixed(1);
    _qs('#pp-furn-d').value           = item.depth.toFixed(1);
    const deg = Math.round(item.rotation * 180 / Math.PI);
    _qs('#pp-furn-rot').value         = deg;
    _qs('#pp-furn-rot-val').textContent = `${deg}°`;
    _qs('#pp-furn-price').textContent = cat?.price ? `$${cat.price.toLocaleString()}` : 'free';
    _buildSwatches('#pp-furn-colors', FURN_COLORS, item.color, c => {
      item.color = c; editor?.render(); _saveStorage();
    });
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

function _bindPropsPanel() {
  // Room
  _qs('#pp-room-name')?.addEventListener('input', e => {
    const r = state.rooms.find(r => r.id === state.selectedId);
    if (r) { r.name = e.target.value; editor?.render(); clearTimeout(_nameDebounce); _nameDebounce = setTimeout(_snapshot, 600); }
  });
  _qs('#pp-room-w')?.addEventListener('change', e => {
    const r = state.rooms.find(r => r.id === state.selectedId);
    const v = parseFloat(e.target.value);
    if (r && v >= 2) { r.width = v; _onUpdate(); } else _refreshProps();
  });
  _qs('#pp-room-h')?.addEventListener('change', e => {
    const r = state.rooms.find(r => r.id === state.selectedId);
    const v = parseFloat(e.target.value);
    if (r && v >= 2) { r.height = v; _onUpdate(); } else _refreshProps();
  });
  _qs('#pp-room-delete')?.addEventListener('click', () => {
    if (!state.selectedId || state.selectedId[0] !== 'r') return;
    state.rooms = state.rooms.filter(r => r.id !== state.selectedId);
    state.selectedId = null;
    sounds.remove(); _onUpdate();
  });

  // Furniture
  _qs('#pp-furn-label')?.addEventListener('input', e => {
    const f = state.furniture.find(f => f.id === state.selectedId);
    if (f) { f.label = e.target.value; editor?.render(); clearTimeout(_nameDebounce); _nameDebounce = setTimeout(_snapshot, 600); }
  });
  _qs('#pp-furn-w')?.addEventListener('change', e => {
    const f = state.furniture.find(f => f.id === state.selectedId);
    const v = parseFloat(e.target.value);
    if (f && v > 0) { f.width = v; _onUpdate(); } else _refreshProps();
  });
  _qs('#pp-furn-d')?.addEventListener('change', e => {
    const f = state.furniture.find(f => f.id === state.selectedId);
    const v = parseFloat(e.target.value);
    if (f && v > 0) { f.depth = v; _onUpdate(); } else _refreshProps();
  });
  _qs('#pp-furn-rot')?.addEventListener('input', e => {
    const f = state.furniture.find(f => f.id === state.selectedId);
    if (f) {
      f.rotation = parseInt(e.target.value) * Math.PI / 180;
      _qs('#pp-furn-rot-val').textContent = `${e.target.value}°`;
      editor?.render();
    }
  });
  _qs('#pp-furn-rot')?.addEventListener('change', _snapshot);
  _qs('#pp-furn-dup')?.addEventListener('click', () => {
    if (state.selectedId && state.selectedId[0] !== 'r') _duplicateFurniture(state.selectedId);
  });
  _qs('#pp-furn-delete')?.addEventListener('click', () => {
    if (!state.selectedId || state.selectedId[0] === 'r') return;
    state.furniture = state.furniture.filter(f => f.id !== state.selectedId);
    state.selectedId = null;
    sounds.remove(); _onUpdate();
  });
}

function _duplicateFurniture(id) {
  const orig = state.furniture.find(f => f.id === id);
  if (!orig) return;
  const newId = `f${Date.now()}${Math.random().toString(36).slice(2,5)}`;
  state.furniture.push({ ...orig, id: newId, x: orig.x + 1.5, y: orig.y + 1.5 });
  state.selectedId = newId;
  editor?.animatePlacement(newId);
  sounds.place(); _onUpdate();
}

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  _loadStorage();
  _buildPalette();
  _bindUI();
  _bindPropsPanel();
  _initEditor();
  _updateToolUI();
  _updateBudget();
  _refreshProps();
  _updateHint();
  _snapshot();
  _updateUndoButtons();
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
  _on('btn-export', 'click', _exportPNG);
  _on('btn-sound',  'click', () => {
    const m = sounds.toggleMute();
    _qs('#btn-sound').textContent = m ? '🔇' : '🔊';
  });
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
    if (ctrl && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); _redo(); }
    if (ctrl && e.key === 's') { e.preventDefault(); _saveStorage(); _toast('💾', 'Saved!'); }
    if (ctrl && e.key === 'c' && state.selectedId && state.selectedId[0] !== 'r') {
      _clipboard = { ...state.furniture.find(f => f.id === state.selectedId) };
    }
    if (ctrl && e.key === 'v' && _clipboard) {
      const newId = `f${Date.now()}${Math.random().toString(36).slice(2,5)}`;
      state.furniture.push({ ..._clipboard, id: newId, x: _clipboard.x + 1.5, y: _clipboard.y + 1.5 });
      state.selectedId = newId;
      editor?.animatePlacement(newId);
      sounds.place(); _onUpdate();
    }
    if (ctrl && e.key === 'd' && state.selectedId && state.selectedId[0] !== 'r') {
      e.preventDefault();
      _duplicateFurniture(state.selectedId);
    }
  });
}

// ── Mode ───────────────────────────────────────────────────────────────────
function _setMode(mode) {
  state.mode = mode;
  _qs('#btn-mode-2d').classList.toggle('active', mode === '2d');
  _qs('#btn-mode-3d').classList.toggle('active', mode === '3d');
  _qs('#canvas-2d').style.display    = mode === '2d' ? 'block' : 'none';
  _qs('#view-3d').style.display      = mode === '3d' ? 'block' : 'none';
  _qs('#tools-2d').style.display     = mode === '2d' ? 'flex'  : 'none';
  _qs('#btn-export').style.display   = mode === '2d' ? ''      : 'none';
  _qs('#budget-hud').style.display   = mode === '2d' ? ''      : 'none';
  _qs('#zoom-controls').style.display = mode === '2d' ? 'flex' : 'none';
  _qs('#props-panel').style.display  = mode === '2d' ? ''      : 'none';
  _updateHint();
  if (mode === '3d') {
    if (!viewer) viewer = new Viewer3D(_qs('#view-3d'), state);
    else viewer.refresh();
    viewer.focusOnLayout();
  }
}

// ── Tool ───────────────────────────────────────────────────────────────────
function _setTool(tool) {
  state.tool = tool;
  state.pendingAdd = null;
  document.querySelectorAll('.pal-item').forEach(el => el.classList.remove('active'));
  _updateToolUI();
}

function _updateToolUI() {
  for (const t of ['room','wall','select','eraser'])
    _qs(`#btn-${t}`)?.classList.toggle('active', state.tool === t);
  const msgs = {
    room:   'Draw Room: drag on the canvas to create a room',
    wall:   'Wall: click to place first point, click again to extend',
    select: 'Select: tap furniture or rooms · drag to move · yellow handle rotates · arrow keys nudge · white handles resize rooms',
    eraser: 'Erase: tap any wall, room, or furniture to remove it',
    add:    'Tap the floor plan to place · Esc to cancel',
  };
  _qs('#status-text').textContent = msgs[state.tool] || '';
}

// ── Palette ────────────────────────────────────────────────────────────────
function _buildPalette() {
  const container = _qs('#furniture-palette');
  const cats = [...new Set(FURNITURE_CATALOG.map(f => f.category))];
  cats.forEach(cat => {
    const sec = document.createElement('div');
    sec.className = 'pal-cat'; sec.dataset.cat = cat;
    const hdr = document.createElement('div');
    hdr.className = 'pal-cat-hdr'; hdr.textContent = cat;
    sec.appendChild(hdr);
    FURNITURE_CATALOG.filter(f => f.category === cat).forEach(item => {
      const el = document.createElement('div');
      el.className = 'pal-item'; el.dataset.type = item.type;
      el.innerHTML = `
        <div class="pal-swatch" style="background:${item.color}"></div>
        <div class="pal-info">
          <div class="pal-name">${item.label}</div>
          <div class="pal-dims">${item.width} × ${item.depth} ft</div>
        </div>
        <div class="pal-price">${item.price > 0 ? '$'+item.price.toLocaleString() : 'free'}</div>`;
      el.addEventListener('click', () => _pickFurniture(item.type, el));
      sec.appendChild(el);
    });
    container.appendChild(sec);
  });
}

function _pickFurniture(type, el) {
  state.tool = 'add'; state.pendingAdd = type; state.selectedId = null;
  document.querySelectorAll('.pal-item').forEach(e => e.classList.remove('active'));
  el.classList.add('active');
  _updateToolUI(); sounds.select(); _refreshProps();
}

function _filterPalette(q) {
  q = q.toLowerCase();
  document.querySelectorAll('.pal-item').forEach(el => {
    el.style.display = !q || el.querySelector('.pal-name').textContent.toLowerCase().includes(q) ? '' : 'none';
  });
  document.querySelectorAll('.pal-cat').forEach(sec => {
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
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ rooms: state.rooms, walls: state.walls, furniture: state.furniture })); } catch (_) {}
}
function _loadStorage() {
  try {
    const d = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (d) { state.rooms = d.rooms||[]; state.walls = d.walls||[]; state.furniture = d.furniture||[]; }
  } catch (_) {}
}
function _saveFile() {
  const blob = new Blob([JSON.stringify({ rooms: state.rooms, walls: state.walls, furniture: state.furniture }, null, 2)], { type:'application/json' });
  const url  = URL.createObjectURL(blob);
  Object.assign(document.createElement('a'), { href:url, download:`apartment-${new Date().toISOString().slice(0,10)}.json` }).click();
  URL.revokeObjectURL(url);
  _toast('💾', 'Saved to file!');
}
function _loadFile(e) {
  const file = e.target.files[0]; if (!file) return;
  const fr = new FileReader();
  fr.onload = ev => {
    try {
      const d = JSON.parse(ev.target.result);
      state.rooms=d.rooms||[]; state.walls=d.walls||[]; state.furniture=d.furniture||[]; state.selectedId=null;
      editor?.render(); viewer?.refresh(); _saveStorage(); _updateBudget(); _snapshot(); _refreshProps(); _updateHint();
      _toast('📂','Layout loaded!');
    } catch(_){ _toast('❌','Could not load file'); }
  };
  fr.readAsText(file);
  e.target.value = '';
}
function _clearAll() {
  if (!confirm('Clear everything and start fresh?')) return;
  state.rooms=[]; state.walls=[]; state.furniture=[]; state.selectedId=null;
  editor?.render(); viewer?.refresh(); _saveStorage(); _updateBudget();
  hist.stack=[]; hist.cursor=-1; _snapshot(); _updateUndoButtons();
  _refreshProps(); _updateHint();
  _toast('🗑', 'Canvas cleared');
}
function _exportPNG() {
  _qs('#canvas-2d').toBlob(blob => {
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement('a'), { href:url, download:`floor-plan-${new Date().toISOString().slice(0,10)}.png` }).click();
    URL.revokeObjectURL(url);
  });
}
